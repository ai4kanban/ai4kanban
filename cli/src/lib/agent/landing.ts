// Landing: putting a delivery's reviewed code on the target branch (#304).
//
// Review passes and the work is still on the delivery's own branch. Landing is the last
// step, and it is the BOARD's own work — no run does it. The branch is squashed to one
// commit, rebased onto the target branch's tip when that has moved, and the target branch
// is moved to it. Only the re-review a rebase costs and the resolution of a conflict are
// agent sessions.
//
// One card lands at a time. The slot is held on the delivery record rather than in a lock:
// a landing can span a whole review run, and the board's own lock is held for the
// milliseconds of one write and breaks itself as stale after a minute.
//
// Nothing here is ever pushed, and nothing is ever staged in the user's checkout: the
// squash is made in the delivery's own worktree, and the target branch is fast-forwarded
// under them so their index and working tree follow it the way a `git pull` would.

import { say } from '../io'
import { REPO_ROOT } from '../paths'
import { approvalStands, cancelApproval } from './approval'
import { boardCommand } from './command'
import { completeCard } from './complete'
import {
  approvedRequirements,
  endDelivery,
  listDeliveries,
  openQuestions,
  syncAudit,
  takeNext,
  wantsLanding,
} from './deliveries'
import { askUser, lastRound, reviewOf } from './review'
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
      if (skip.has(holder.deliveryId) || held.has(holder.deliveryId)) return undefined
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
function handOver(delivery: DeliveryRecord, status: 'waiting' | 'conflict', why: string, question: string): void {
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live || live.status !== 'active') return
    live.landing = { ...(live.landing as DeliveryLanding), status, why, at: Date.now() }
    reviewOf(live).stopped = { reason: 'landing', why, at: Date.now() }
    live.next = undefined
  })
  syncAudit(delivery.deliveryId)
  askUser(delivery.cardId, question)
}

// ---- held on the card's open questions (#307) -------------------------------

// Why a delivery is waiting outside the queue. The opening words are fixed, so a landing
// that was held on a question can be told from one waiting for any other reason — that is
// what says the pause has been answered, without a field of its own.
const HELD_ON_QUESTIONS = 'held on an open question'

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
const HELD_ON_APPROVAL = 'held on your approval'

const approvalWhy = (delivery: DeliveryRecord, why: string): string =>
  `${HELD_ON_APPROVAL}: ${why} — approve it on #${delivery.cardId}, or with \`${boardCommand()} approve ${delivery.deliveryId}\``

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

/** A delivery whose hold has just been answered, but whose card no longer says what it was
 *  approved to build. It ends here and a fresh delivery starts on the card as it now
 *  reads; the request is handed back for the caller to start.
 *
 *  Only ever asked of a delivery that was HELD on its card's questions and is not any more:
 *  answering is the one thing that rewrites a card under a delivery, so it is the one
 *  moment the copy can have moved. A card edited in the user's own editor while its code is
 *  being written still changes nothing — the delivery builds from its copy. */
function supersededDelivery(held: Set<string>): AgentRequest | null {
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
    say(
      `delivery ${delivery.deliveryId} was approved to build a #${delivery.cardId} that has since changed — ` +
        `it ends here, and a fresh delivery starts on the card as it now reads.`,
    )
    return { action: 'implement', id: delivery.cardId, title: delivery.title }
  }
  return null
}

// ---- one pass ---------------------------------------------------------------

/** Move the landing queue on by one step, and hand back the run it wants started —
 *  a re-review after a rebase, or the agent that resolves a conflict.
 *
 *  Called by the watcher of every run that closes, by `nextWork()` each tick so a
 *  waiter nothing handed off to is still picked up, and once as a board comes up. It never
 *  throws: a caller on a timer must survive an unreadable repository and try again. */
export function advanceLanding(): AgentRequest | null {
  try {
    // First the cards whose questions are still open, and the ones whose answers changed
    // the plan (#307). Both are read from the card files, so both are settled once, before
    // the queue is touched.
    const held = holdForQuestions()
    const fresh = supersededDelivery(held)
    if (fresh) return fresh
    // Then the approval each delivery still owes (#308). After the superseded check, which
    // reads the `why` a question hold left behind.
    for (const id of holdForApproval(held)) held.add(id)
    // A delivery this pass has already tried is not tried again: one that gave the slot
    // back is still queued, and picking it straight up again is a loop, not a queue.
    const tried = new Set<string>()
    for (;;) {
      const picked = takeSlot(tried, held)
      if (!picked) return null
      tried.add(picked.deliveryId)
      const step = landStep(picked)
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

function landStep(delivery: DeliveryRecord): Step {
  const dir = worktreeDir(delivery.worktree!)
  if (!worktreeExists(delivery.worktree)) {
    giveUpSlot(delivery, `its worktree ${delivery.worktree} is gone, so there is nothing to land`)
    return { done: true }
  }
  // A rebase stopped part-way through is a conflict somebody has been resolving — or a
  // crash. Either way it is finished before anything else is decided.
  if (rebaseInProgress(dir)) return finishConflict(delivery, dir)

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
    finish(delivery, { onto: target })
    return { done: true }
  }

  if (!isAncestor(target, tip, dir)) {
    // The target branch moved while this card was being built. The reviewed tree is not the
    // tree that would land, so it is rebased and reviewed again.
    return rebaseAndReview(delivery, dir, target)
  }
  if (owesReview(delivery)) {
    // It was rebased and the review that has to follow one has not run yet — a watcher died
    // between the two. Ask for it again rather than landing a tree nothing judged.
    return { start: askForReview(delivery) }
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
  return move(delivery, tip, target)
}

// The commit message: the card's title, its id, and the delivery — so a line of
// `git log` names the card it came from and the record that holds the rest.
const landingMessage = (delivery: DeliveryRecord): string =>
  `${delivery.title || `card #${delivery.cardId}`} (#${delivery.cardId})\n\ndelivery ${delivery.deliveryId}`

// ---- before it lands --------------------------------------------------------

// Why this delivery can't land right this moment, or nothing when it may. Everything here
// is about the USER's checkout: the delivery's own branch was settled by review.
function landingRefusal(delivery: DeliveryRecord): string | undefined {
  const cmd = boardCommand()
  if (!delivery.base) return 'it has no base commit to land against'
  const target = branchTip(delivery.targetBranch!)
  if (!target) {
    return `${delivery.targetBranch} is gone, so there is nowhere to land — put the branch back, or cancel the delivery`
  }
  const staged = stagedPaths()
  if (staged.length) {
    return (
      `you have ${names(staged)} staged in your own checkout. Landing moves ${delivery.targetBranch} under you, ` +
      `so it waits until your index is clean — commit or unstage ${them(staged.length)}.`
    )
  }
  // Tracked changes only, exactly as the start gate counts them (`prepareDelivery`): the
  // board's own files are left out, and an untracked file of the user's is not in the way
  // of a fast-forward unless the landed commit adds that same path, which git says itself.
  const dirty = dirtyPaths(false)
  if (dirty.length) {
    return (
      `you have uncommitted changes in ${names(dirty)}. Landing moves ${delivery.targetBranch} under you and your ` +
      `files change with it, so it waits until the checkout is clean — commit or stash ${them(dirty.length)}, and it lands by itself. ` +
      `(\`${cmd} runs\` says what is waiting.)`
    )
  }
  const pending = pendingPaths(worktreeDir(delivery.worktree!))
  if (pending.length) {
    return `its own worktree still holds uncommitted work in ${names(pending)}, so there is no settled tree to land`
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

// Rebase the one squash commit onto the target's new tip, and review the rebased branch
// again. The slot is HELD across that review: the tree being judged is the tree that lands,
// and a second card landing under it would make that untrue again.
function rebaseAndReview(delivery: DeliveryRecord, dir: string, target: string): Step {
  const spent = delivery.landing?.attempts ?? 0
  if (spent >= MAX_LAND_ATTEMPTS) {
    const why = `${delivery.targetBranch} moved again after ${spent} rebases, so this landing is not converging`
    handOver(
      delivery,
      'waiting',
      why,
      `[user] Delivery ${delivery.deliveryId} could not land on ${delivery.targetBranch}: ${why}. ` +
        `Decide: land it yourself from ${delivery.branch}, pause whatever keeps moving ${delivery.targetBranch}, or cancel the delivery. ` +
        `Once you have, \`${boardCommand()} review ${delivery.cardId}\` puts it back in motion.`,
    )
    return { done: true }
  }
  const rebased = rebaseOnto(dir, target, delivery.base!)
  if ('conflict' in rebased) return startConflict(delivery, target, rebased.conflict)
  if (!rebased.ok) {
    giveUpSlot(delivery, rebased.error)
    return { done: true }
  }
  return afterRebase(delivery, target)
}

// The rebase landed. The tip it was rebased onto becomes the delivery's base — the same
// field, so the diff review reads is still everything this delivery changed — and a fresh
// review judges the rebased branch.
function afterRebase(delivery: DeliveryRecord, target: string): Step {
  const at = Date.now()
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live || live.status !== 'active') return
    live.base = target
    live.next = 'review'
    const landing = (live.landing = live.landing ?? { status: 'landing', attempts: 0, at })
    landing.status = 'landing'
    landing.attempts += 1
    landing.rebasedAt = at
    landing.why = undefined
    landing.at = at
    // A rebased delivery is reviewed again before it may land.
  })
  syncAudit(delivery.deliveryId)
  const started = takeNext(delivery.deliveryId)
  return started ? { start: started } : { done: false }
}

// A review the delivery owes but has not had: it was rebased, and no review has passed
// since. Nothing lands on the strength of a verdict about a different tree.
function owesReview(delivery: DeliveryRecord): boolean {
  const at = delivery.landing?.rebasedAt
  if (!at) return false
  const round = lastRound(delivery)
  return !(round && round.verdict === 'pass' && round.at >= at)
}

function askForReview(delivery: DeliveryRecord): AgentRequest {
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (live && live.status === 'active') live.next = 'review'
  })
  return (
    takeNext(delivery.deliveryId) ?? {
      action: 'review',
      id: delivery.cardId,
      title: delivery.title,
    }
  )
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
function finishConflict(delivery: DeliveryRecord, dir: string): Step {
  const left = conflictedPaths(dir)
  const done = left.length ? { ok: false, why: `${names(left)} ${are(left.length)} still conflicted` } : continueRebase(dir)
  if (done.ok && !rebaseInProgress(dir)) {
    return afterRebase(delivery, branchTip(delivery.targetBranch!) ?? delivery.base!)
  }
  abortRebase(dir)
  const why =
    `the conflict between #${delivery.cardId} and ${delivery.targetBranch} was not resolved — ` +
    `${done.why ?? 'the rebase would not go through'}`
  handOver(
    delivery,
    'conflict',
    why,
    `[user] Delivery ${delivery.deliveryId} could not land on ${delivery.targetBranch}: ${why}. ` +
      `Its work is whole on ${delivery.branch}. Decide: resolve it yourself and land that branch, or cancel the delivery ` +
      `and start the card again on top of ${delivery.targetBranch}. Once you have, ` +
      `\`${boardCommand()} review ${delivery.cardId}\` puts it back in motion.`,
  )
  return { done: true }
}

// ---- moving the target branch -----------------------------------------------

// The last step, and the only one that touches the user's own checkout. Their branch is
// fast-forwarded under them when it is the one they have out, so their index and working
// tree move with it; otherwise the ref is moved, and only from where the landing found it.
function move(delivery: DeliveryRecord, tip: string, target: string): Step {
  const branch = delivery.targetBranch!
  const here = currentBranch(REPO_ROOT) === branch
  const moved = here ? asMove(fastForward(tip)) : moveBranchRef(branch, tip, target)
  if ('moved' in moved) {
    // It moved again between the ancestor check and this write — a race of milliseconds.
    // Try the whole step again against wherever it is now; the attempt count bounds it,
    // because the next pass finds the target no longer an ancestor and rebases.
    const live = readStore().deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    return live && live.status === 'active' ? landStep(live) : { done: true }
  }
  if (!moved.ok) {
    giveUpSlot(delivery, moved.error)
    return { done: true }
  }
  cleanUp(delivery)
  finish(delivery, { commit: tip, onto: target })
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
function finish(delivery: DeliveryRecord, landed: { commit?: string; onto: string }): void {
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
  completeCard(delivery.cardId, delivery.deliveryId)
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
