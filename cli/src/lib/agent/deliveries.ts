// A delivery: everything one Implement click starts.
//
// One click, one delivery, one card — and several runs inside it: implementation
// today, review and correction as later cards land. What makes it more than a label is the
// SNAPSHOT: a delivery copies the card's approved requirements the moment it starts and
// builds from that copy, so a card edited underneath it never changes what it was approved
// to build. While it is in flight the card is held — the board's own screens and commands
// won't change it — and the way to take the card back is Cancel delivery.
//
// It leaves two records. The live row sits in docs/kanban/.sessions.json, where the lock
// and the card page read it. The permanent one is a JSON file per delivery under
// docs/kanban/deliveries/, tracked in git, kept after the card is archived, and never
// pruned while the delivery is unfinished.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { DELIVERIES, rel } from '../paths'
import { candidateBase } from './candidate'
import { boardCommand } from './command'
import {
  commitDeliveryWork,
  manualState,
  newDeliveryId,
  snapshotReviewed,
  workMark,
  type DeliveryStart,
} from './commit-mode'
import { completeCard } from './complete'
import { insideRun } from './env'
import { deliveryState, type DeliveryState } from './pause'
import { deliveryRules } from './rules'
import {
  askUser,
  lastRound,
  nextAfterSession,
  parseFindings,
  reviewOf,
  stopQuestion,
} from './review'
import { readStore, withStore, type Store } from './store'
import type {
  AgentRequest,
  DeliveryRecord,
  DeliveryStatus,
  ReviewVerdict,
  RunRecord,
} from './types'

// ---- the permanent record ---------------------------------------------------

const auditPath = (deliveryId: string): string => path.join(DELIVERIES, `${deliveryId}.json`)

/** One run, as the permanent record keeps it: what ran, how it went, and where its log
 *  was — the path, never the contents. A log is this machine's and ages out; the record is
 *  the repository's and does not. */
interface DeliverySessionEntry {
  sessionId: string
  action: string
  status: string
  startedAt: number
  endedAt?: number
  harness?: string
  model?: string
  costUsd?: number
  resumedFrom?: string
  log: string
}

/** Write the delivery's permanent record, or bring it up to date. Best-effort: a delivery
 *  that couldn't write its file is still a delivery, and failing the run that owns it
 *  would cost the user their work over an audit line. */
export function writeAudit(delivery: DeliveryRecord, runs: RunRecord[]): void {
  // What this file already said about each run. The live record keeps only the newest
  // 30, so a long delivery's first run leaves it long before the delivery ends — and
  // the permanent record is exactly the thing that must not forget it.
  const known = new Map(readAudit(delivery.deliveryId)?.sessions.map((s) => [s.sessionId, s]) ?? [])
  const sessions: DeliverySessionEntry[] = delivery.sessions.flatMap((id) => {
    const run = runs.find((r) => r.sessionId === id)
    if (!run) {
      const before = known.get(id)
      return before ? [before] : []
    }
    return [
      {
        sessionId: run.sessionId,
        action: run.action,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        harness: run.harness || undefined,
        model: run.model,
        costUsd: run.costUsd,
        resumedFrom: run.resumedFrom,
        log: rel(run.logPath),
      },
    ]
  })
  try {
    fs.mkdirSync(DELIVERIES, { recursive: true })
    const tmp = `${auditPath(delivery.deliveryId)}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ ...delivery, sessions }, null, 2) + '\n')
    fs.renameSync(tmp, auditPath(delivery.deliveryId))
  } catch {
    // an unwritable folder — the live row is still the truth for the lock
  }
}

/** The permanent record as it stands, or null when there is none to read. */
function readAudit(deliveryId: string): { sessions: DeliverySessionEntry[] } | null {
  try {
    const data = JSON.parse(fs.readFileSync(auditPath(deliveryId), 'utf8')) as { sessions?: unknown }
    return { sessions: Array.isArray(data?.sessions) ? (data.sessions as DeliverySessionEntry[]) : [] }
  } catch {
    return null
  }
}

/** Bring one delivery's permanent record up to date from the live record.
 *
 *  `just` is a run the caller holds that the live record may already have let go of: a
 *  run closes and is pruned in the same write, so the caller's copy is the only one
 *  carrying how it ended. */
export function syncAudit(deliveryId: string, just?: RunRecord): void {
  const store = readStore()
  const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
  if (!delivery) return
  const runs = just ? [just, ...store.runs.filter((r) => r.sessionId !== just.sessionId)] : store.runs
  writeAudit(delivery, runs)
}

// ---- the approved requirements ----------------------------------------------

// What a delivery is approved to build. Everything else on the card — `## Todo` and its
// ticks, status, questions, verify lines, the notes a delivery leaves as it works — sits
// outside, so a delivery writing to its own card is never a change to its requirements.
const APPROVED = [
  /^##\s+Worth noting\s*$/i,
  /^##\s+Scope\s*$/i,
  /^##\s+Scope out\s*$/i,
  /^##\s+By\s+`[^`]+`\s+agent\s*$/i,
]

const isApproved = (heading: string): boolean => APPROVED.some((re) => re.test(heading))

/** The card's approved requirements as one block of markdown: its title, its opening
 *  paragraph, `## Worth noting`, `## Scope`, `## Scope out`, and every spec agent's
 *  section, in the order the card writes them.
 *
 *  Empty when there is no such card — a delivery is refused before that can happen, and a
 *  snapshot of nothing is a truthful answer either way. */
export function approvedRequirements(cardId: number): string {
  const found = locate(cardId)
  if (!found) return ''
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
  const { meta, body } = parseFrontmatter(text)
  const out: string[] = []
  if (meta?.title) out.push(`# ${meta.title}`, '')
  // The opening paragraph is everything before the first heading. The `<!-- agent -->`
  // boundary is a marker, not content, so it never travels.
  const opening: string[] = []
  const sections: string[] = []
  let keeping = false
  let started = false
  for (const line of body.split('\n')) {
    if (/^##(?!#)\s/.test(line)) {
      started = true
      keeping = isApproved(line)
      if (keeping) sections.push('', line)
      continue
    }
    if (line.trim() === '<!-- agent -->') continue
    if (!started) opening.push(line)
    else if (keeping) sections.push(line)
  }
  out.push(opening.join('\n').trim())
  out.push(sections.join('\n').trim())
  // A dropped section leaves the blank lines that framed it, so the copy is squeezed back
  // to one blank line between blocks — it is read by a person as well as by an agent.
  return out.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// The card's frontmatter as it stands, or nothing when there is no reading it.
function cardMeta(cardId: number): ReturnType<typeof parseFrontmatter>['meta'] | null {
  try {
    const found = locate(cardId)
    if (!found) return null
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    return parseFrontmatter(fs.readFileSync(file, 'utf8')).meta
  } catch {
    return null
  }
}

// The card's stage as it stands, or `todo` when there is no reading it.
const cardStatus = (cardId: number): string => cardMeta(cardId)?.status || 'todo'

/** How many questions this card still has open — the count landing holds on (#307), and the
 *  one the Implement dialog and `akb implement` warn about. A card nobody can read has
 *  none: a missing card holds nothing up. */
export const openQuestions = (cardId: number): number => cardMeta(cardId)?.questions.length ?? 0

// ---- the live row -------------------------------------------------------------

/** The delivery in flight on this card, or nothing when the card is free. */
export const activeIn = (store: Store, cardId: number): DeliveryRecord | undefined =>
  store.deliveries.find((d) => d.status === 'active' && d.cardId === cardId)

/** The delivery in flight on this card right now. */
export function activeDelivery(cardId: number): DeliveryRecord | undefined {
  return activeIn(readStore(), cardId)
}

/** One delivery by id, or by any prefix of one that names exactly one. */
export function findDelivery(id: string): DeliveryRecord | undefined {
  const key = id.trim()
  if (!key) return undefined
  const all = readStore().deliveries
  return all.find((d) => d.deliveryId === key) ?? all.find((d) => d.deliveryId.startsWith(key))
}

/** A delivery named by its own id, by any prefix of one, or by the card it is building —
 *  the one way `cancel`, `discard` and `approve` read what the user typed, so they can never
 *  disagree about which delivery was meant. */
export function namedDelivery(id: string): DeliveryRecord | undefined {
  const key = id.trim()
  if (!key) return undefined
  const byCard = /^#?\d+$/.test(key) ? activeDelivery(Number(key.replace('#', ''))) : undefined
  return byCard ?? findDelivery(key)
}

/** Every delivery the live record holds, oldest first. */
export const listDeliveries = (): DeliveryRecord[] => readStore().deliveries

/** Put a run into the delivery its card is being built under, opening one when the
 *  card has none. Called with the record's lock already held, from inside the same
 *  transaction that writes the run down — so a delivery can never exist with no run to
 *  it, and two clicks can never open two deliveries on one card.
 *
 *  `step` is what the run is entering the delivery to do. It is kept as history and
 *  never trusted on a resume: a stored position goes stale in exactly the crash it exists
 *  for.
 *
 *  `start` is what `prepareDelivery` settled before anything was written down (#303): the
 *  commit mode, the fork commit, the branch this delivery lands on, and the worktree it
 *  works in. A run joining a delivery that already exists brings none — the mode a
 *  delivery started in is the mode it keeps. */
export function joinDelivery(
  store: Store,
  run: RunRecord,
  title: string,
  step: string,
  start?: DeliveryStart,
): DeliveryRecord {
  const cardId = run.cardId as number
  let delivery = activeIn(store, cardId)
  if (!delivery) {
    delivery = {
      deliveryId: start?.deliveryId ?? newDeliveryId(store.deliveries),
      cardId,
      title,
      status: 'active',
      startedAt: run.startedAt,
      sessions: [],
      // The one read of the card this delivery will ever make for its requirements.
      approved: approvedRequirements(cardId),
      steps: [],
      // And the one read of where the code stood before it started. Everything the
      // delivery writes is the difference from here, which is the diff review judges.
      base: start ? start.base : (candidateBase() ?? undefined),
      // The stage to put back when the whole delivery ends. Read here, from the first
      // run, because every run after this one would read `implementing` — the
      // stage this delivery itself put there.
      priorStatus: cardStatus(cardId),
      // How it commits, and where. Written now and never again: flipping the setting
      // changes the next delivery, not this one.
      commitMode: start?.commitMode ?? 'manual',
      manualWhy: start?.manualWhy,
      // And the one read of the flow rules this delivery runs under (#306) — the four
      // flows a delivery is made of, frozen the way the card is. Every run in it is
      // given these words rather than the files, a printed flow included, so editing a
      // rule changes the next delivery and never one in flight.
      rules: deliveryRules(),
      targetBranch: start?.targetBranch,
      worktree: start?.worktree,
      branch: start?.branch,
      // And whether the user has to approve the tree before it lands (#308). Read from the
      // setting once, here, so turning the policy on or off changes the next delivery and
      // never one in flight.
      approval: { required: !!start?.needsApproval, events: [] },
    }
    store.deliveries.push(delivery)
  }
  delivery.sessions.push(run.sessionId)
  delivery.steps.push({ step, at: run.startedAt })
  run.deliveryId = delivery.deliveryId
  // The permanent record exists from the delivery's first moment, not from its first
  // ending: a delivery whose machine died in its first minute still left one behind.
  writeAudit(delivery, store.runs)
  return delivery
}

/** Put a review or a correction run into the delivery already in flight on its card.
 *
 *  Unlike `joinDelivery` it opens nothing: there is no delivery to review when nobody has
 *  built anything, and a run that quietly started one would review an empty diff
 *  against a card it had just captured. Undefined when the card has no active delivery,
 *  and the caller refuses.
 *
 *  Starting one also clears the stop it may be waiting at: the user has answered, approved
 *  an exception, or asked for another look, and this run is that look. */
export function joinActive(store: Store, run: RunRecord, step: string): DeliveryRecord | undefined {
  const cardId = run.cardId as number
  const delivery = activeIn(store, cardId)
  if (!delivery) return undefined
  delivery.sessions.push(run.sessionId)
  delivery.steps.push({ step, at: run.startedAt })
  if (delivery.review?.stopped) delivery.review.stopped = undefined
  run.deliveryId = delivery.deliveryId
  writeAudit(delivery, store.runs)
  return delivery
}

/** End a delivery, and say how. Nothing happens to one that has already ended: a cancel
 *  and a run closing can reach here in either order, and the first answer stands. */
export function endDelivery(deliveryId: string, status: Exclude<DeliveryStatus, 'active'>): DeliveryRecord | undefined {
  const ended = withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
    if (!delivery || delivery.status !== 'active') return undefined
    delivery.status = status
    delivery.endedAt = Date.now()
    return { ...delivery }
  })
  if (ended) syncAudit(deliveryId)
  return ended
}

// ---- review, across a delivery's runs (#302) --------------------------------

/** Write one review's verdict onto the delivery in flight on this card.
 *
 *  The review run records its own verdict — it is the only thing that read the diff —
 *  and everything the loop does next is decided from it once the run has closed. A second
 *  call in one run REPLACES the first: a reviewer that changed its mind mid-run leaves
 *  one verdict, not two. */
export function recordVerdict(
  cardId: number,
  sessionId: string,
  verdict: ReviewVerdict,
  findingsText: string,
): { ok: true; delivery: DeliveryRecord } | { ok: false; error: string } {
  const findings = parseFindings(findingsText)
  if (verdict !== 'pass' && !findings.length) {
    return { ok: false, error: `a "${verdict}" verdict has to say what was found — pass the findings with --file` }
  }
  const out = withStore<{ ok: true; delivery: DeliveryRecord } | { ok: false; error: string }>((store) => {
    const delivery = activeIn(store, cardId)
    if (!delivery) return { ok: false, error: `no delivery is in flight on #${cardId}, so there is nothing to review` }
    const review = reviewOf(delivery)
    const mine = review.rounds[review.rounds.length - 1]
    const round = { sessionId, verdict, findings, at: Date.now() }
    if (mine?.sessionId === sessionId) review.rounds[review.rounds.length - 1] = round
    else review.rounds.push(round)
    return { ok: true, delivery: { ...delivery } }
  })
  if (out.ok) syncAudit(out.delivery.deliveryId)
  return out
}

/** What a run's ending means for the delivery it belonged to.
 *
 *  A delivery is implementation, then review, then a correction and another review for as
 *  long as review asks for one. So the end of a run is a decision rather than an
 *  ending: the delivery finishes only when review passes it, stops with a question on the
 *  card when review can go no further, and otherwise writes down the run it starts
 *  next. A run that failed or was cut off mid-build leaves it ACTIVE and unfinished,
 *  with the card still held, until Resume carries it on or Cancel delivery ends it. A
 *  run somebody stopped is the same: stopping a run is not ending the job. */
export function settleDelivery(run: RunRecord): void {
  if (!run.deliveryId) return
  const before = readStore().deliveries.find((d) => d.deliveryId === run.deliveryId)
  if (!before) return
  type Settled = { end: 'finished' } | { ask: string; cardId: number }

  // Everything that has to run git happens here, before the record's lock — every process
  // on this board waits on that lock, and a git command is not what it should be waiting
  // for.
  //
  // First the run's work, committed onto the delivery's branch. Review reads the
  // branch, so an uncommitted change is not part of what it judges — and a change that
  // reached the board's own files is refused outright rather than landed.
  const built = run.status === 'done' && (run.action === 'implement' || run.action === 'correct')
  const commit = built && before.status === 'active' ? commitDeliveryWork(before) : { ok: true as const }
  const uncommitted = commit.ok ? undefined : commit.why
  // Then the candidate's fingerprint, which says whether a correction moved anything and
  // what the next one will be measured against.
  const mark =
    !uncommitted && run.status === 'done' && (run.action === 'review' || run.action === 'correct')
      ? workMark(before)
      : undefined
  // And, in manual commit mode, the snapshot a passed review leaves for the user's own
  // commit to be matched against.
  const reviewed =
    !uncommitted && before.commitMode === 'manual' && run.action === 'review' && passedIn(before, run)
      ? snapshotReviewed(before)
      : undefined

  const settled = withStore<Settled | null>((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === run.deliveryId)
    if (!delivery) return null
    // Work nobody could commit is work nobody can review: the tree that would be judged is
    // not the tree that would land.
    if (uncommitted && delivery.status === 'active') {
      const review = reviewOf(delivery)
      review.stopped = { reason: 'uncommitted', why: uncommitted, at: Date.now() }
      delivery.next = undefined
      releaseLanding(delivery)
      return { ask: stopQuestion(delivery, uncommitted), cardId: delivery.cardId }
    }
    const next = nextAfterSession(delivery, run, mark)
    if ('hold' in next) return null
    if ('finish' in next) {
      delivery.next = undefined
      // In manual commit mode a pass is not the end: the code is sitting in the user's own
      // checkout and only they can commit it. The delivery stays ACTIVE, holding the card,
      // with what review passed written down — and the card page is where the wait is read
      // (`manualSettled` below).
      if (reviewed) {
        delivery.reviewed = reviewed
        return null
      }
      // Nor is it the end in auto commit mode: the work is on the delivery's own branch and
      // still has to reach the target one (#304). The delivery queues for the repository's
      // one landing slot and stays ACTIVE until it has landed.
      if (wantsLanding(delivery)) {
        queueLanding(delivery, run)
        return null
      }
      return { end: 'finished' }
    }
    if ('stop' in next) {
      const review = reviewOf(delivery)
      review.stopped = { reason: next.stop, why: next.why, at: Date.now() }
      delivery.next = undefined
      // A re-review that stops waits on a person, and a landing queue that waits with it
      // stops every other card on the board — so the slot goes back (#304).
      releaseLanding(delivery)
      // The delivery stays ACTIVE. It has not failed and it has not finished — it is
      // waiting for the user, and the card it is holding is the card their answer goes on.
      return { ask: stopQuestion(delivery, next.why), cardId: delivery.cardId }
    }
    delivery.next = next.start
    if (next.start === 'correct') {
      const review = reviewOf(delivery)
      review.corrections += 1
      // Taken now, before the correction writes anything, so the run after it can be
      // told whether the candidate moved at all.
      review.mark = mark
    }
    return null
  })
  if (settled && 'end' in settled) endDelivery(run.deliveryId, settled.end)
  if (settled && 'ask' in settled) askUser(settled.cardId, settled.ask)
  // Whatever happened, the permanent record follows the run that just closed — from
  // the caller's copy, since closing and pruning it are one write.
  syncAudit(run.deliveryId, run)
}

/** The run this delivery starts next, now that one of its own has closed — and it is
 *  taken as it is read, so nothing starts it twice.
 *
 *  Called by the watcher of the run that just closed, which is the one process that
 *  can start it: a run never starts another. A watcher that dies in between leaves
 *  `next` on the record, so the delivery still says what it was about to do and
 *  `akb review <id>` puts it back in motion. */
export function deliveryRunAfter(run: RunRecord): AgentRequest | null {
  return run.deliveryId ? takeNext(run.deliveryId) : null
}

/** The same, by delivery id: the landing asks for the re-review a rebase owes, and it is
 *  taken here so the one that starts it is the one that gets it. */
export function takeNext(deliveryId: string): AgentRequest | null {
  const taken = withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
    if (!delivery || delivery.status !== 'active' || !delivery.next) return null
    const action = delivery.next
    delivery.next = undefined
    return { action, cardId: delivery.cardId, title: delivery.title }
  })
  if (!taken) return null
  return { action: taken.action, id: taken.cardId, title: taken.title }
}

// ---- landing: the queue a passed delivery joins (#304) ----------------------

/** This delivery's work has to reach a branch it is not already on: it built on its own
 *  branch, in its own worktree, and the target branch is where the card is meant to land.
 *  Manual commit mode never does — there the commit is the user's, which is the whole of
 *  what the mode means. */
export const wantsLanding = (delivery: DeliveryRecord): boolean =>
  delivery.commitMode === 'auto' && !!delivery.worktree && !!delivery.branch && !!delivery.targetBranch

// Queue it for the repository's one landing slot, and record the review that authorized
// the landing as the check that ran — with no review rule (#306) the re-review IS the
// gate, so it is the only check there is to record.
function queueLanding(delivery: DeliveryRecord, run: RunRecord): void {
  const round = lastRound(delivery)
  const landing = delivery.landing ?? { status: 'waiting' as const, attempts: 0, at: Date.now() }
  delivery.landing = {
    ...landing,
    status: landing.status === 'landing' ? 'landing' : 'waiting',
    why: undefined,
    checks: [...(landing.checks ?? []), { name: `review ${run.sessionId.slice(0, 8)}`, ok: true, at: round?.at ?? Date.now() }],
    at: Date.now(),
  }
}

// Give the slot back without losing what the landing has already spent on this delivery.
function releaseLanding(delivery: DeliveryRecord): void {
  if (delivery.landing?.status !== 'landing') return
  delivery.landing = { ...delivery.landing, status: 'waiting', at: Date.now() }
}

/** The verdict this delivery's last review left, for a flow that has to say where it
 *  stands. */
export const latestVerdict = (delivery: DeliveryRecord): ReviewVerdict | undefined =>
  lastRound(delivery)?.verdict

// This very run recorded a pass. A review whose run ended without a verdict told us
// nothing, and a verdict from an earlier round is not this run's answer.
function passedIn(delivery: DeliveryRecord, run: RunRecord): boolean {
  const round = lastRound(delivery)
  return round?.sessionId === run.sessionId && round.verdict === 'pass'
}

// ---- manual commit mode: the user's own commit (#303) -----------------------

/** Where a manual delivery stands now that review has passed it and the code is the user's
 *  to commit — and act on it if they have.
 *
 *  Nothing watches git for this: it is asked when the card page is read, which is the
 *  moment somebody wants to know. They committed exactly what review passed and the
 *  delivery is done; they committed something else and a fresh review judges it; or the
 *  code is still sitting there uncommitted and the delivery waits.
 *
 *  Returns the sentence the card page shows while it waits, and nothing once it has moved
 *  on. */
export function manualSettled(delivery: DeliveryRecord): string | undefined {
  if (delivery.status !== 'active' || delivery.commitMode === 'auto' || !delivery.reviewed) return undefined
  const state = manualState(delivery)
  if (state === 'waiting') {
    return `review passed — commit the change in your own checkout and this delivery is done`
  }
  if (state === 'landed') {
    // Their commit IS what review passed, so the delivery is done — and the card is
    // completed here, the way a landing completes one (#307). The delivery is ended first,
    // so nothing is holding the card when it is archived.
    endDelivery(delivery.deliveryId, 'finished')
    completeCard(delivery.cardId, delivery.deliveryId)
    return undefined
  }
  // They committed something other than what review passed, so the whole candidate goes
  // back through review. The snapshot is dropped first, so a second read of the card page
  // can't ask for a second review of the same commit.
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live || live.status !== 'active' || !live.reviewed) return
    live.reviewed = undefined
    live.next = 'review'
  })
  syncAudit(delivery.deliveryId)
  return undefined
}

// ---- the hold a delivery puts on its card -----------------------------------

/** True when THIS process is a run of that card's delivery, so the hold does not apply
 *  to it. The implement flow closes by ticking todos, appending verify lines and archiving
 *  the card — card writes like any other, so a hold that couldn't tell them from a user's
 *  edit would refuse the delivery its last step. */
export function insideDelivery(cardId: number): boolean {
  const sessionId = insideRun()
  if (!sessionId) return false
  const store = readStore()
  const delivery = activeIn(store, cardId)
  if (!delivery) return false
  return delivery.sessions.includes(sessionId)
}

/** Where the delivery in flight on this card stands (#307), or nothing when the card is
 *  free. Derived on every read from the card's questions and the delivery's own records. */
export function deliveryStateOf(cardId: number): DeliveryState | undefined {
  const delivery = activeDelivery(cardId)
  return delivery && deliveryState(delivery, openQuestions(cardId))
}

/** The one line saying what the delivery in flight is waiting on, while it waits on the
 *  USER — or nothing while the board's own work is still moving it along.
 *
 *  A waiting delivery is not a stuck one: what continues it is an answer, a resolve or a
 *  commit. So the hold below lets a resolve through whenever this says something, and the
 *  card page offers the same. */
export function deliveryWaiting(cardId: number): string | undefined {
  const state = deliveryStateOf(cardId)
  return state?.paused ? state.line : undefined
}

/** Why this card can't be changed from outside its delivery — one is in flight — or
 *  nothing when it is free. The sentence names the delivery, says what it is building, and
 *  names the one thing that takes the card back; "try again later" without any of those is
 *  a refusal nobody can act on.
 *
 *  A run of the delivery itself passes straight through. */
export function heldByDelivery(cardId: number, program?: string): string | undefined {
  const delivery = activeDelivery(cardId)
  if (!delivery) return undefined
  if (insideDelivery(cardId)) return undefined
  const cmd = program ?? boardCommand()
  const state = deliveryState(delivery, openQuestions(cardId))
  // What answers the wait: an approval on an approval hold (#308), the card's own questions
  // everywhere else. Naming the wrong one is a refusal nobody can act on.
  const answer =
    state.stage === 'approval'
      ? `Approve it with \`${cmd} approve ${delivery.deliveryId}\`.`
      : `Answer it with \`${cmd} resolve ${cardId}\`.`
  const doing = state.paused
    ? `is waiting on you on #${cardId} — ${state.line} — so the board won't change the card. ` +
      `${answer} Or take the card back with `
    : `is in flight on #${cardId} — it is building the card as it was approved when it started, ` +
      `so the board won't change it. Take the card back with `
  return (
    `delivery ${delivery.deliveryId} ${doing}` +
    `Cancel delivery on the card page, or \`${cmd} cancel ${delivery.deliveryId}\`.`
  )
}
