// Landing: putting a delivery's reviewed code on the target branch (#304).
//
// Review passes and the work is still on the delivery's own branch. Landing is the last
// step, and it is the BOARD's own work — no run does it. The branch is squashed to one
// commit, rebased onto the target branch's tip when that has moved, reviewed there, and the
// target branch is moved to it. A review only authorizes the exact tree it judged: every
// rebase, including one whose conflict an agent resolved, goes through review again.
//
// One card lands at a time. The slot is held on the delivery record rather than in a lock:
// a landing can span a whole review run, and the board's own lock is held for the
// milliseconds of one write and breaks itself as stale after a minute.
//
// Nothing here is ever pushed, and nothing is ever staged in the user's checkout: the
// squash is made in the delivery's own worktree, and the target branch is fast-forwarded
// under them so their index and working tree follow it the way a `git pull` would.

import { setCardStatusOn } from '../board'
import { say } from '../io'
import { REPO_ROOT } from '../paths'
import { approvalStands, cancelApproval } from './approval'
import { boardCommand } from './command'
import { completeCard } from './complete'
import {
  approvedRequirements,
  cardStatus,
  endDelivery,
  listDeliveries,
  openQuestions,
  syncAudit,
  wantsLanding,
} from './deliveries'
import { HELD_ON_APPROVAL, HELD_ON_QUESTIONS, IN_LINE } from './pause'
import { aiReviewOn, askUser, reviewOf, type Ask } from './review'
import { readStore, withStore } from './store'
import type { AgentRequest, DeliveryLanding, DeliveryRecord } from './types'
import {
  abortRebase,
  branchTip,
  changedPaths,
  continueRebase,
  conflictedPaths,
  currentBranch,
  dirtyPaths,
  fastForward,
  isAncestor,
  moveBranchRef,
  pendingPaths,
  rebaseInProgress,
  rebaseOnto,
  removeWorktree,
  squashOnto,
  stagedPaths,
  worktreeDir,
  worktreeExists,
} from './worktree'

/** Rebases one delivery spends on a target branch that keeps moving. Each one costs a
 *  review, so after this many the card gets an open question instead of another round. */
export const MAX_LAND_ATTEMPTS = 3

// How many files a warning or a question names before it stops counting.
const MAX_NAMED = 5

const names = (files: string[]): string =>
  `${files.slice(0, MAX_NAMED).join(', ')}${files.length > MAX_NAMED ? `, and ${files.length - MAX_NAMED} more` : ''}`

// The same files where a reader has to act on them. One is named, because naming it saves a
// look; more are counted, because the reader's next move is the same for two as for ninety
// and a list of ninety is not a sentence.
const some = (files: string[]): string => (files.length === 1 ? `\`${files[0]}\`` : `${files.length} files`)

const are = (n: number): string => (n === 1 ? 'is' : 'are')
const them = (n: number): string => (n === 1 ? 'it' : 'them')

// ---- the slot ---------------------------------------------------------------

// The delivery to work on this pass: the one already holding the slot when nothing of its
// own is running, or — when the slot is free — the oldest waiter. A waiter whose review has
// stopped is passed over: it is waiting on a person, not on the queue. So is one held on
// its card's open questions (#307), for the same reason.
function takeSlot(skip: Set<string>, held: Set<string>): DeliveryRecord | undefined {
  return withStore((store) => {
    const holder = store.deliveries.find((d) => d.status === 'active' && d.landing?.status === 'landing')
    if (holder) {
      if (skip.has(holder.deliveryId) || held.has(holder.deliveryId) || holder.review?.stopped) return undefined
      // Its own run is working — a re-review, or the agent resolving a conflict. The
      // landing carries on when that run ends.
      if (store.runs.some((r) => r.status === 'running' && r.deliveryId === holder.deliveryId)) return undefined
      // It has a run written down and not yet started; whoever starts it carries on.
      if (holder.next) return undefined
      return { ...holder }
    }
    const waiter = store.deliveries.find(
      (d) =>
        d.status === 'active' &&
        d.landing?.status === 'waiting' &&
        !d.review?.stopped &&
        !skip.has(d.deliveryId) &&
        !held.has(d.deliveryId) &&
        wantsLanding(d),
    )
    if (!waiter) return undefined
    waiter.landing = { ...(waiter.landing as DeliveryLanding), status: 'landing', why: undefined, at: Date.now() }
    return { ...waiter }
  })
}

// Change one delivery's landing record. Every write here goes through this, so the audit
// file follows in the same breath.
function patchLanding(deliveryId: string, change: (landing: DeliveryLanding) => void): void {
  withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
    if (!delivery) return
    delivery.landing = delivery.landing ?? { status: 'waiting', attempts: 0, at: Date.now() }
    change(delivery.landing)
    delivery.landing.at = Date.now()
  })
  syncAudit(deliveryId)
}

// Put the slot back, saying why. The delivery stays ACTIVE and queued: whatever stopped it
// — a dirty checkout, a target that would not take the commit — is a thing the user fixes,
// and the next pass tries again.
function giveUpSlot(delivery: DeliveryRecord, why: string): void {
  patchLanding(delivery.deliveryId, (landing) => {
    landing.status = 'waiting'
    landing.why = why
  })
}

// Stop, and leave the card an open question. The slot goes back and nothing picks the
// delivery up again until the user answers — `review.stopped` is the same gate a stopped
// review waits at, and joining a run clears it.
async function handOver(
  delivery: DeliveryRecord,
  status: 'waiting' | 'conflict',
  why: string,
  question: Ask,
): Promise<void> {
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live || live.status !== 'active') return
    live.landing = { ...(live.landing as DeliveryLanding), status, why, at: Date.now() }
    reviewOf(live).stopped = { reason: 'landing', why, at: Date.now() }
    live.next = undefined
  })
  syncAudit(delivery.deliveryId)
  await askUser(delivery.cardId, question)
}

// ---- held on the card's open questions (#307) -------------------------------

// Why a delivery is waiting outside the queue. The opening words are fixed (`pause.ts`), so
// a landing held on a question can be told from one waiting for any other reason — that is
// what says the pause has been answered, without a field of its own.
const questionWhy = (cardId: number, asked: number): string =>
  `${HELD_ON_QUESTIONS}: #${cardId} has ${asked} of them, and landing waits until ${asked === 1 ? 'it is' : 'they are'} answered`

const wasHeldOnQuestions = (delivery: DeliveryRecord): boolean =>
  !!delivery.landing?.why?.startsWith(HELD_ON_QUESTIONS)

/** The deliveries whose card still has an open question. They are built and reviewed, and
 *  landing is the step that waits for the answer — so one holding the slot gives it back
 *  and every other card can land while it waits.
 *
 *  Read from the card files, once per pass, and never inside the record's lock. */
function holdForQuestions(): Set<string> {
  const held = new Set<string>()
  for (const delivery of readStore().deliveries) {
    if (delivery.status !== 'active' || !delivery.landing || delivery.landing.status === 'landed') continue
    const asked = openQuestions(delivery.cardId)
    if (!asked) continue
    held.add(delivery.deliveryId)
    const why = questionWhy(delivery.cardId, asked)
    if (delivery.landing.status === 'landing') giveUpSlot(delivery, why)
    else if (delivery.landing.why !== why) patchLanding(delivery.deliveryId, (landing) => void (landing.why = why))
  }
  return held
}

// ---- held on your approval of the tree (#308) -------------------------------

// Why a delivery is waiting outside the queue on an approval. Fixed opening words, the way
// the question hold has them, so one hold can be told from the other without a field.
const approvalWhy = (delivery: DeliveryRecord, why: string): string =>
  `${HELD_ON_APPROVAL}: ${why} — approve it on #${delivery.cardId}, or with \`${boardCommand()} delivery approve ${delivery.deliveryId}\``

/** The deliveries that need the user's approval and have none covering the tree they would
 *  land. They are built and reviewed, and approval is the step that waits — so one holding
 *  the slot gives it back, and every other card lands while it waits.
 *
 *  An approval that no longer covers the tree is CANCELLED here, once, rather than left
 *  standing and quietly ignored: the record has to say when it stopped counting and which
 *  of the two moved.
 *
 *  Runs git, so never inside the record's lock. A delivery already held on its card's open
 *  questions is skipped — those are answered first, and a hold is worth one line at a time. */
function holdForApproval(already: Set<string>): Set<string> {
  const held = new Set<string>()
  for (const delivery of readStore().deliveries) {
    if (delivery.status !== 'active' || !delivery.approval?.required) continue
    if (!delivery.landing || delivery.landing.status === 'landed') continue
    if (already.has(delivery.deliveryId)) continue
    const stands = approvalStands(delivery)
    if (stands.ok) continue
    if (delivery.approval.granted) cancelApproval(delivery.deliveryId, stands.moved)
    held.add(delivery.deliveryId)
    const why = approvalWhy(delivery, stands.why)
    if (delivery.landing.status === 'landing') giveUpSlot(delivery, why)
    else if (delivery.landing.why !== why) patchLanding(delivery.deliveryId, (landing) => void (landing.why = why))
  }
  return held
}

// ---- an answer that changed the plan (#307) ---------------------------------

const hasStep = (delivery: DeliveryRecord, step: string): boolean =>
  delivery.steps.some((s) => s.step === step)

/** A delivery whose hold has just been answered, but whose card no longer says what it was
 *  approved to build. It ends here and a fresh delivery starts on the card as it now
 *  reads; the request is handed back for the caller to start.
 *
 *  Only ever asked of a delivery that was HELD on its card's questions and is not any more:
 *  answering is the one thing that rewrites a card under a delivery, so it is the one
 *  moment the copy can have moved. A card edited in the user's own editor while its code is
 *  being written still changes nothing — the delivery builds from its copy.
 *
 *  The card is handed back as it goes. The delivery put `implementing` there and nothing
 *  else takes it off, so a card whose replacement does not start would otherwise rest at a
 *  stage no run is working on. */
async function supersededDelivery(held: Set<string>): Promise<AgentRequest | null> {
  for (const delivery of readStore().deliveries) {
    if (delivery.status !== 'active' || !wantsLanding(delivery)) continue
    if (!delivery.landing || delivery.landing.status === 'landed') continue
    if (held.has(delivery.deliveryId) || delivery.review?.stopped) continue
    if (!wasHeldOnQuestions(delivery)) continue
    const now = approvedRequirements(delivery.cardId)
    if (!now || now === delivery.approved) continue
    withStore((store) => {
      const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
      if (live) live.steps.push({ step: 'superseded', at: Date.now() })
    })
    endDelivery(delivery.deliveryId, 'cancelled')
    await handBackCard(delivery)
    say(
      `delivery ${delivery.deliveryId} was approved to build a #${delivery.cardId} that has since changed — ` +
        `it ends here, and a fresh delivery starts on the card as it now reads.`,
    )
    return { action: 'implement', id: delivery.cardId, title: delivery.title }
  }
  return null
}

// The stage the card had before this delivery took it, put back now that nothing is
// building it. Best-effort, like every other card write a delivery's ending makes: the
// delivery has ended either way, and a stage that would not take the write is one board
// command away.
async function handBackCard(delivery: DeliveryRecord): Promise<void> {
  try {
    await setCardStatusOn(delivery.cardId, delivery.priorStatus ?? 'todo')
  } catch {
    // the board would not take the write — leave the stage as it is
  }
}

/** The card a superseded delivery still owes a fresh one to.
 *
 *  Superseding is two moves — end the old delivery, start a new one — and only the first is
 *  the board's own. The second is a request handed to a caller, and every way that start can
 *  be refused is a way the card is left at `ready` with nothing coming for it. So the debt
 *  is DERIVED here rather than handed over once: every pass asks again until a delivery
 *  actually opens, which makes a refused start cost a minute instead of the card.
 *
 *  It is paid by the next delivery on the card, whenever one starts, and written off when
 *  the user discards the superseded delivery instead — that is them asking for the card
 *  back, and the board must not quietly build it anyway.
 *
 *  The debt is the ended row, so it lives as long as that row does (KEEP_DELIVERIES). Every
 *  pass retries, so it is normally paid in a minute; thirty deliveries ending inside that
 *  minute would lose it. */
async function owedRestart(): Promise<AgentRequest | null> {
  const store = readStore()
  for (const delivery of store.deliveries) {
    if (!hasStep(delivery, 'superseded') || hasStep(delivery, 'dropped')) continue
    // Paid: some delivery opened on this card after this one ended.
    const paid = store.deliveries.some(
      (d) => d.cardId === delivery.cardId && d.startedAt >= (delivery.endedAt ?? 0) && d.deliveryId !== delivery.deliveryId,
    )
    if (paid) continue
    // A run is already working the card; a second one would be refused anyway.
    if (store.runs.some((r) => r.status === 'running' && r.cardId === delivery.cardId)) continue
    // And the card is still here to build — archived or rejected, the debt goes with it.
    if (!approvedRequirements(delivery.cardId)) continue
    // A card left at `implementing` by a supersede written down before the hand-back
    // existed. Nothing else takes that stage off, so it is put back here.
    if (cardStatus(delivery.cardId) === 'implementing') await handBackCard(delivery)
    return { action: 'implement', id: delivery.cardId, title: delivery.title }
  }
  return null
}

// ---- queued behind the slot -------------------------------------------------

const inLineWhy = (cardId: number): string =>
  `${IN_LINE} #${cardId} — one card lands at a time, and this one carries on by itself`

/** Tell every waiter that the slot is taken, and by which card.
 *
 *  `takeSlot` returns on the holder before it ever reaches the queue, so without this a
 *  waiter keeps the `why` of the last pass that actually looked at it — a dirty checkout the
 *  user cleaned up an hour ago, still on the card page as the thing in its way. The queue is
 *  the honest answer, and it is the one nothing else was writing down.
 *
 *  The two holds and a stopped review are left out: those wait on a person whether or not
 *  the slot is free, which is the same reason `takeSlot` passes them over. */
function noteQueue(held: Set<string>): void {
  const store = readStore()
  const holder = store.deliveries.find((d) => d.status === 'active' && d.landing?.status === 'landing')
  if (!holder) return
  const why = inLineWhy(holder.cardId)
  for (const delivery of store.deliveries) {
    if (delivery.deliveryId === holder.deliveryId) continue
    if (delivery.status !== 'active' || delivery.landing?.status !== 'waiting') continue
    if (held.has(delivery.deliveryId) || delivery.review?.stopped || !wantsLanding(delivery)) continue
    if (delivery.landing.why === why) continue
    patchLanding(delivery.deliveryId, (landing) => void (landing.why = why))
  }
}

// ---- one pass ---------------------------------------------------------------

/** Move the landing queue on by one step, and hand back the run it wants started — the
 *  conflict resolution and the review of every rebased result.
 *
 *  Called by the watcher of every run that closes, by `nextWork()` each tick so a
 *  waiter nothing handed off to is still picked up, and once as a board comes up. It never
 *  throws: a caller on a timer must survive an unreadable repository and try again. */
export async function advanceLanding(): Promise<AgentRequest | null> {
  try {
    // A supersede an earlier pass made and nothing ever started, before anything else: it
    // is a card with no delivery and nobody coming for it, which is the worst state the
    // queue can leave one in.
    const owed = await owedRestart()
    if (owed) return owed
    // Then the cards whose questions are still open, and the ones whose answers changed
    // the plan (#307). Both are read from the card files, so both are settled once, before
    // the queue is touched.
    const held = holdForQuestions()
    const fresh = await supersededDelivery(held)
    if (fresh) return fresh
    // Then the approval each delivery still owes (#308). After the superseded check, which
    // reads the `why` a question hold left behind.
    for (const id of holdForApproval(held)) held.add(id)
    // A delivery this pass has already tried is not tried again: one that gave the slot
    // back is still queued, and picking it straight up again is a loop, not a queue.
    const tried = new Set<string>()
    for (;;) {
      const picked = takeSlot(tried, held)
      if (!picked) {
        noteQueue(held)
        return null
      }
      tried.add(picked.deliveryId)
      const step = await landStep(picked)
      if (step.start) return step.start
      if (!step.done) return null
      // It landed, or it gave the slot back — either way the next waiter's turn is now.
    }
  } catch {
    // A repository that would not answer. The delivery keeps the slot it holds and the
    // next pass tries again; nothing here may fail the run that called it.
    return null
  }
}

// What one pass concluded: a run to start (the slot stays held while it runs), the
// landing being over (the slot is free, so try the next waiter), or neither.
type Step = { start?: AgentRequest; done?: boolean }

async function landStep(delivery: DeliveryRecord): Promise<Step> {
  const dir = worktreeDir(delivery.worktree!)
  if (!worktreeExists(delivery.worktree)) {
    giveUpSlot(delivery, `its worktree ${delivery.worktree} is gone, so there is nothing to land`)
    return { done: true }
  }
  // A rebase stopped part-way through is a conflict somebody has been resolving — or a
  // crash. Either way it is finished before anything else is decided.
  if (rebaseInProgress(dir)) return await finishConflict(delivery, dir)

  const refusal = landingRefusal(delivery)
  if (refusal) {
    giveUpSlot(delivery, refusal)
    return { done: true }
  }
  const target = branchTip(delivery.targetBranch!)!
  warnOverlap(delivery)

  // One commit, made before the rebase rather than after it: a single commit conflicts at
  // most once, so a conflict is one run and `--continue` finishes the replay.
  const squashed = squashOnto(dir, delivery.base!, landingMessage(delivery))
  if (!squashed.ok) {
    giveUpSlot(delivery, squashed.error)
    return { done: true }
  }
  const tip = squashed.commit
  if (!tip) {
    // A delivery whose tree is identical to its base built nothing to land. It is finished
    // rather than stuck: there is no commit to add, and the card's work is done.
    await finish(delivery, { onto: target })
    return { done: true }
  }

  if (!isAncestor(target, tip, dir)) {
    // The target branch moved while this card was being built. Replay onto it and carry the
    // verdict the worktree review already gave.
    return await replayOntoTarget(delivery, dir, target)
  }
  // The last thing read before the branch moves (#308): the base and the fingerprint the
  // user approved, against the ones that would land right now. One check covers every way
  // the tree can have changed since — a rebase, a review fix, anything else — because it
  // asks the tree itself rather than what happened to it.
  const approved = approvalStands(delivery)
  if (!approved.ok) {
    if (delivery.approval?.granted) cancelApproval(delivery.deliveryId, approved.moved)
    giveUpSlot(delivery, approvalWhy(delivery, approved.why))
    return { done: true }
  }
  return await move(delivery, tip, target)
}

// The commit message: the card's title, its id, and the delivery — so a line of
// `git log` names the card it came from and the record that holds the rest.
const landingMessage = (delivery: DeliveryRecord): string =>
  `${delivery.title || `card #${delivery.cardId}`} (#${delivery.cardId})\n\ndelivery ${delivery.deliveryId}`

// ---- before it lands --------------------------------------------------------

// Why this delivery can't land right this moment, or nothing when it may. Everything here
// is about the USER's checkout: the delivery's own branch was settled by review.
//
// These are read on the card page as much as in the terminal, so each is ONE line: the thing
// in the way, and the move that clears it. Nothing explains why landing cares — the reader
// wants the move, and the sentence that argues for it is the one they skip. Files, branches
// and commands are wrapped in backticks; the page draws those as marks, and the terminal has
// always spelled a command that way.
function landingRefusal(delivery: DeliveryRecord): string | undefined {
  if (!delivery.base) return 'it has no base commit to land against'
  const target = branchTip(delivery.targetBranch!)
  if (!target) {
    return `\`${delivery.targetBranch}\` is gone — put the branch back, or discard the delivery`
  }
  // The user's own staging, not the board's: a card's files move with the work and never
  // land, so counting them would stop every delivery on the board's own bookkeeping.
  const staged = stagedPaths()
  if (staged.length) {
    return `${some(staged)} ${are(staged.length)} staged in your checkout — commit or unstage ${them(staged.length)}`
  }
  // Tracked changes only, exactly as the start gate counts them (`prepareDelivery`): the
  // board's own files are left out, and an untracked file of the user's is not in the way
  // of a fast-forward unless the landed commit adds that same path, which git says itself.
  const dirty = dirtyPaths(false)
  if (dirty.length) {
    return `your checkout has uncommitted changes in ${some(dirty)} — commit or stash ${them(dirty.length)}`
  }
  const pending = pendingPaths(worktreeDir(delivery.worktree!))
  if (pending.length) {
    return `its worktree still holds ${some(pending)} — clear ${them(pending.length)}`
  }
  return undefined
}

// Cards being built that touch the same files. A warning and never a refusal: landing goes
// ahead, and a real conflict is resolved as new work when the rebase meets one.
function warnOverlap(delivery: DeliveryRecord): void {
  const dir = worktreeDir(delivery.worktree!)
  const mine = new Set(changedPaths(delivery.base!, delivery.branch!, dir))
  if (!mine.size) return
  const clashes: number[] = []
  const shared: string[] = []
  for (const other of listDeliveries()) {
    if (other.deliveryId === delivery.deliveryId || other.status !== 'active') continue
    if (!other.worktree || !other.branch || !other.base) continue
    if (!worktreeExists(other.worktree)) continue
    const hits = changedPaths(other.base, other.branch, worktreeDir(other.worktree)).filter((f) => mine.has(f))
    if (!hits.length) continue
    clashes.push(other.cardId)
    shared.push(...hits)
  }
  patchLanding(delivery.deliveryId, (landing) => {
    landing.overlap = clashes.length ? clashes : undefined
  })
  if (!clashes.length) return
  say(
    `delivery ${delivery.deliveryId} is landing over work in flight on ${clashes.map((c) => `#${c}`).join(', ')} — ` +
      `both change ${names([...new Set(shared)])}. Landing goes ahead; a real conflict is resolved as new work.`,
  )
}

// ---- the target branch moved ------------------------------------------------

// Rebase the one squash commit onto the target's new tip. The result goes back through
// review: the target is the current implementation, and a verdict on the old tree cannot
// authorize the composition Git or a conflict agent made with it. Unless the delivery has
// AI review off (#416), which has no verdict to carry over either way — `afterRebase`.
async function replayOntoTarget(delivery: DeliveryRecord, dir: string, target: string): Promise<Step> {
  const spent = delivery.landing?.attempts ?? 0
  if (spent >= MAX_LAND_ATTEMPTS) {
    const why = `${delivery.targetBranch} moved again after ${spent} rebases, so this landing is not converging`
    await handOver(
      delivery,
      'waiting',
      why,
      {
        text:
          `[user] Delivery ${delivery.deliveryId} could not land on ${delivery.targetBranch}: ${why}. ` +
          `Once you have decided, \`${boardCommand()} delivery review ${delivery.cardId}\` puts it back in motion.`,
        options: [
          `I'll land it myself from ${delivery.branch}`,
          `pause whatever keeps moving ${delivery.targetBranch}, then the board lands it`,
          'cancel the delivery',
        ],
      },
    )
    return { done: true }
  }
  const rebased = rebaseOnto(dir, target, delivery.base!)
  if ('conflict' in rebased) return startConflict(delivery, target, rebased.conflict)
  if (!rebased.ok) {
    giveUpSlot(delivery, rebased.error)
    return { done: true }
  }
  return await afterRebase(delivery, target)
}

// The rebase completed. Its target becomes the delivery's base — the same field, so review
// sees everything this delivery changes against the current implementation. Hold the slot
// while a fresh review judges that exact tree; opening the run clears the stop.
//
// With AI review off there is no such run (#416). The delivery keeps the slot and nothing
// is stopped, so the next landing pass picks the same holder up and carries on against the
// new base.
async function afterRebase(delivery: DeliveryRecord, target: string): Promise<Step> {
  const at = Date.now()
  const reviews = aiReviewOn(delivery)
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live || live.status !== 'active') return
    live.base = target
    const landing = (live.landing = live.landing ?? { status: 'landing', attempts: 0, at })
    landing.status = 'landing'
    landing.attempts += 1
    landing.rebasedAt = at
    landing.why = undefined
    landing.at = at
    if (reviews) {
      reviewOf(live).stopped = {
        reason: 'landing',
        why: `${delivery.targetBranch} moved, so the rebased result must be reviewed before it lands`,
        at,
      }
    }
  })
  syncAudit(delivery.deliveryId)
  const live = readStore().deliveries.find((d) => d.deliveryId === delivery.deliveryId)
  if (!live || live.status !== 'active') return { done: true }
  if (!reviews) return {}
  return { start: { action: 'review', id: live.cardId, title: live.title } }
}

// ---- a conflict is new work -------------------------------------------------

// The rebase stopped on a conflict. An agent resolves it in the worktree, where the
// conflict actually is, and the board finishes the rebase afterwards — so the run has
// one job and no rebase state to get wrong.
function startConflict(delivery: DeliveryRecord, target: string, files: string[]): Step {
  patchLanding(delivery.deliveryId, (landing) => {
    landing.onto = target
    landing.why = `resolving a conflict with ${delivery.targetBranch} in ${names(files)}`
  })
  return { start: { action: 'conflict', id: delivery.cardId, title: delivery.title } }
}

// Finish the rebase the conflict run resolved. It staged the resolution and stopped;
// this is the `--continue` it deliberately did not run. A rebase that still will not go
// through is aborted — the branch is whole again — and the card is asked.
async function finishConflict(delivery: DeliveryRecord, dir: string): Promise<Step> {
  const left = conflictedPaths(dir)
  const done = left.length ? { ok: false, why: `${names(left)} ${are(left.length)} still conflicted` } : continueRebase(dir)
  if (done.ok && !rebaseInProgress(dir)) {
    return await afterRebase(delivery, delivery.landing?.onto ?? delivery.base!)
  }
  abortRebase(dir)
  const why =
    `the conflict between #${delivery.cardId} and ${delivery.targetBranch} was not resolved — ` +
    `${done.why ?? 'the rebase would not go through'}`
  await handOver(
    delivery,
    'conflict',
    why,
    {
      text:
        `[user] Delivery ${delivery.deliveryId} could not land on ${delivery.targetBranch}: ${why}. ` +
        `Its work is whole on ${delivery.branch}. Once you have decided, ` +
        `\`${boardCommand()} delivery review ${delivery.cardId}\` puts it back in motion.`,
      options: [
        `I'll resolve it myself and land ${delivery.branch}`,
        `cancel the delivery, and start the card again on top of ${delivery.targetBranch}`,
      ],
    },
  )
  return { done: true }
}

// ---- moving the target branch -----------------------------------------------

// The last step, and the only one that touches the user's own checkout. Their branch is
// fast-forwarded under them when it is the one they have out, so their index and working
// tree move with it; otherwise the ref is moved, and only from where the landing found it.
async function move(delivery: DeliveryRecord, tip: string, target: string): Promise<Step> {
  const branch = delivery.targetBranch!
  const here = currentBranch(REPO_ROOT) === branch
  const moved = here ? asMove(fastForward(tip)) : moveBranchRef(branch, tip, target)
  if ('moved' in moved) {
    // It moved again between the ancestor check and this write — a race of milliseconds.
    // Try the whole step again against wherever it is now; the attempt count bounds it,
    // because the next pass finds the target no longer an ancestor and rebases.
    const live = readStore().deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    return live && live.status === 'active' ? await landStep(live) : { done: true }
  }
  if (!moved.ok) {
    giveUpSlot(delivery, moved.error)
    return { done: true }
  }
  cleanUp(delivery)
  await finish(delivery, { commit: tip, onto: target })
  return { done: true }
}

// A fast-forward that git refused because the branch had already moved on reads the same
// as a guarded ref move that lost its race.
const asMove = (res: { ok: boolean; why?: string }): { ok: true } | { moved: true } | { ok: false; error: string } => {
  if (res.ok) return { ok: true }
  if (/not possible to fast-forward|non-fast-forward|diverge/i.test(res.why ?? '')) return { moved: true }
  return { ok: false, error: `couldn't move your checkout onto the landed commit: ${res.why ?? 'git refused'}` }
}

// ---- afterwards -------------------------------------------------------------

// The delivery's checkout, once its work is on the target branch. Only ever after landing:
// #303's refusal to remove an unfinished delivery's worktree, and to touch anything outside
// `.akb/`, stands.
function cleanUp(delivery: DeliveryRecord): void {
  const dir = worktreeDir(delivery.worktree!)
  const pending = pendingPaths(dir)
  if (pending.length) {
    say(`delivery ${delivery.deliveryId} landed, but ${delivery.worktree} still holds ${names(pending)} — it was left alone.`)
    return
  }
  const removed = removeWorktree(delivery.worktree, delivery.branch)
  if (!removed.ok) {
    say(`delivery ${delivery.deliveryId} landed, but ${removed.error}.`)
    return
  }
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live) return
    live.worktree = undefined
    live.branch = undefined
  })
}

// Write the landing down, end the delivery, and complete the card. The commit, the base it
// landed against and the checks that ran are what the permanent record keeps of it.
//
// The order is the point (#307): the delivery ends first, so nothing is still holding the
// card when the board archives it.
async function finish(delivery: DeliveryRecord, landed: { commit?: string; onto: string }): Promise<void> {
  patchLanding(delivery.deliveryId, (landing) => {
    landing.status = 'landed'
    landing.why = undefined
    landing.commit = landed.commit
    landing.onto = landed.onto
  })
  endDelivery(delivery.deliveryId, 'finished')
  say(
    landed.commit
      ? `delivery ${delivery.deliveryId} landed on ${delivery.targetBranch} as ${landed.commit.slice(0, 12)}.`
      : `delivery ${delivery.deliveryId} changed nothing, so nothing landed on ${delivery.targetBranch}.`,
  )
  await completeCard(delivery.cardId, delivery.deliveryId)
}

// ---- picking up after a crash -----------------------------------------------

/** What a landing a crash left half-done needs said about it, and what this pass put right.
 *
 *  Called from `repairDeliveries()` as a board comes up. A rebase stopped part-way through
 *  with nothing working on it is put back — the branch keeps every commit it had, and the
 *  landing is simply tried again — and a slot whose holder is no longer active is freed by
 *  the record itself, since only an ACTIVE delivery can hold one. */
export function repairLanding(): string[] {
  const store = readStore()
  const complaints: string[] = []
  for (const d of store.deliveries) {
    if (d.status !== 'active' || !d.worktree || !worktreeExists(d.worktree)) continue
    if (!rebaseInProgress(worktreeDir(d.worktree))) continue
    if (store.runs.some((r) => r.status === 'running' && r.deliveryId === d.deliveryId)) continue
    abortRebase(worktreeDir(d.worktree))
    giveUpSlot(d, 'a rebase was interrupted and has been put back — the landing will be tried again')
    complaints.push(
      `delivery ${d.deliveryId} on #${d.cardId}: a landing rebase was left half-done and has been put back. ` +
        `Its work is whole on ${d.branch}, and the landing is tried again on its own.`,
    )
  }
  return complaints
}
