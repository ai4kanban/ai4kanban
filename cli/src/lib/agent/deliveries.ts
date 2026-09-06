// A delivery: everything one Implement click starts.
//
// One click, one delivery, one card — implementation, review, and landing. What makes it more than a label is the
// SNAPSHOT: a delivery copies the card's approved requirements the moment it starts and
// builds from that copy, so a card edited underneath it never changes what it was approved
// to build. While it is in flight the card is held — the board's own screens and commands
// won't change it — and the way to take the card back is Discard on the card page, or
// `cancel` here, which ends it the same way but leaves its worktree behind.
//
// A delivery may also carry NO card (#428) — **Build now** sends a typed sentence straight
// to a build. Its snapshot is that sentence, which nothing can rewrite; it holds nothing,
// archives nothing, and its own id is what everything finds it by.
//
// It leaves two records. The live row sits in docs/kanban/.sessions.json, where the lock
// and the card page read it. The permanent one is a JSON file per delivery under
// docs/kanban/deliveries/, tracked in git, kept after the card is archived, and never
// pruned while the delivery is unfinished.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../cards'
import type { CloudEventState } from '../cloud/events'
import { recordCloudDeliveryState } from '../cloud/publish'
import { parseFrontmatter } from '../frontmatter'
import { DELIVERIES, rel } from '../paths'
import { candidateBase } from './candidate'
import { decideRunAfter, decidingOn } from './decide'
import { boardCommand } from './command'
import {
  commitDeliveryWork,
  manualState,
  newDeliveryId,
  snapshotReviewed,
  type DeliveryStart,
} from './commit-mode'
import { completeCard } from './complete'
import { insideRun } from './env'
import { DELIVERY_FLOWS } from './flows'
import { answeredStop, deliveryState, type DeliveryState } from './pause'
import { deliveryRules } from './rules'
import {
  aiReviewOn,
  lastRound,
  nextAfterSession,
  reviewOf,
} from './review'
import { readStore, withStore, type Store } from './store'
import type {
  AgentRequest,
  DeliveryRecord,
  DeliveryStatus,
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
  /** On a review after the first: why it started (#417). Kept here so the reason outlives
   *  the live record's window, which forgets a run long before the delivery is history. */
  trigger?: string
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
        trigger: run.trigger,
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
  // `skill` is the word a spec section carries now; `agent` is the word it carried before
  // #403, and a card written by an older release still has to travel whole.
  /^##\s+By\s+`[^`]+`\s+(skill|agent)\s*$/i,
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

/** The card's stage as it stands, or `todo` when there is no reading it. */
export const cardStatus = (cardId: number): string => cardMeta(cardId)?.status || 'todo'

/** How many questions this card still has open — the count landing holds on (#307), and the
 *  one the Implement dialog and `akb card implement` warn about. A card nobody can read has
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

/** The delivery one run belongs to: the one it names outright — the only way a build with
 *  no card can be found (#428) — or the one in flight on its card. Nothing on a run that is
 *  not a delivery's own. */
export function deliveryFor(req: Pick<AgentRequest, 'action' | 'id' | 'deliveryId'>): DeliveryRecord | undefined {
  if (!DELIVERY_FLOWS.has(req.action)) return undefined
  // In flight, either way: a delivery that has ended is not one to build, review or resolve
  // a conflict against, however it was named.
  if (req.deliveryId) {
    const found = findDelivery(req.deliveryId)
    return found?.status === 'active' ? found : undefined
  }
  return req.id === undefined ? undefined : activeDelivery(req.id)
}

/** Put a run into the delivery its card is being built under, opening one when the
 *  card has none — and always opening one for a build that names no card at all (#428),
 *  whose `approved` is the typed sentence the caller passes in. Called with the record's
 *  lock already held, from inside the same transaction that writes the run down — so a
 *  delivery can never exist with no run to it, and two clicks can never open two
 *  deliveries on one card.
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
  approved?: string,
): DeliveryRecord {
  const cardId = run.cardId
  // A build with no card joins nothing (#428): there is no card to look one up by, and two
  // Build now sends are two builds — each opens a delivery of its own.
  let delivery = cardId === null ? undefined : activeIn(store, cardId)
  if (!delivery) {
    delivery = {
      deliveryId: start?.deliveryId ?? newDeliveryId(store.deliveries),
      cardId,
      title,
      status: 'active',
      startedAt: run.startedAt,
      sessions: [],
      // The one read of the card this delivery will ever make for its requirements — or,
      // with no card, the typed sentence it was handed, which can never move under it.
      approved: cardId === null ? approved ?? '' : approvedRequirements(cardId),
      // Existing questions predate review. Review waits only on a decision it adds itself;
      // these keep waiting at landing as before.
      initialQuestions: cardId === null ? 0 : openQuestions(cardId),
      steps: [],
      // And the one read of where the code stood before it started. Everything the
      // delivery writes is the difference from here, which is the diff review judges.
      base: start ? start.base : (candidateBase() ?? undefined),
      // The stage to put back when the whole delivery ends. Read here, from the first
      // run, because every run after this one would read `implementing` — the
      // stage this delivery itself put there. There is no stage to hold with no card.
      priorStatus: cardId === null ? undefined : cardStatus(cardId),
      // How it commits, and where. Written now and never again: flipping the setting
      // changes the next delivery, not this one.
      commitMode: start?.commitMode ?? 'manual',
      // And whether a fresh session reviews what it builds (#416). Frozen here too, so a
      // resume and every later session follow the policy this build started with.
      aiReview: start ? start.aiReview : true,
      manualWhy: start?.manualWhy,
      // And the one read of the rules this delivery runs under (#306, #420) — the agents
      // its flows are run by, frozen the way the card is. Every run in it is
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
  joinFlow(run, delivery)
  // The permanent record exists from the delivery's first moment, not from its first
  // ending: a delivery whose machine died in its first minute still left one behind.
  writeAudit(delivery, store.runs)
  // The action a Cloud event carries is followed by its delivery's own states (#319). A
  // card-less delivery answers no action and reports nothing.
  if (cardId !== null) recordCloudDeliveryState(cardId, 'running')
  return delivery
}

/** Put a review run into the delivery already in flight on its card.
 *
 *  Unlike `joinDelivery` it opens nothing: there is no delivery to review when nobody has
 *  built anything, and a run that quietly started one would review an empty diff
 *  against a card it had just captured. Undefined when the card has no active delivery,
 *  and the caller refuses.
 *
 *  Starting one also clears the stop it may be waiting at: the user has answered, approved
 *  an exception, or asked for another look, and this run is that look. */
export function joinActive(
  store: Store,
  run: RunRecord,
  step: string,
  deliveryId?: string,
): DeliveryRecord | undefined {
  // By the delivery the caller named, or by the card when it named none — the same delivery
  // either way, and the only one a build with no card can be found by (#428).
  const delivery = deliveryId
    ? store.deliveries.find((d) => d.status === 'active' && d.deliveryId === deliveryId)
    : run.cardId === null
      ? undefined
      : activeIn(store, run.cardId)
  if (!delivery) return undefined
  delivery.sessions.push(run.sessionId)
  delivery.steps.push({ step, at: run.startedAt })
  if (delivery.review?.stopped) delivery.review.stopped = undefined
  joinFlow(run, delivery)
  writeAudit(delivery, store.runs)
  return delivery
}

/** Tie one run to the delivery it just joined — and to the delivery's own job (#417).
 *
 *  The flow id IS the delivery id, whatever the run was asked to join: a run of a delivery
 *  is handed back by whichever watcher happened to be closing, and taking that run's flow
 *  drew the job under someone else's card. The delivery is the job, so its id is the group,
 *  and a fresh delivery — the one a supersede starts — is a fresh group by construction.
 *  A refinement one of these runs goes on to start inherits the id and stays with the job
 *  long after the run that opened it has aged out of the live record. */
function joinFlow(run: RunRecord, delivery: DeliveryRecord): void {
  run.deliveryId = delivery.deliveryId
  run.flowId = delivery.deliveryId
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
  if (ended) {
    syncAudit(deliveryId)
    // How it ended, against the Cloud event whose action started it (#319). A card with no
    // action on record has nothing to report, so this is a no-op on most deliveries — and a
    // delivery with no card at all answers no action and reports nothing.
    if (ended.cardId !== null) recordCloudDeliveryState(ended.cardId, DELIVERY_OUTCOME[status])
  }
  return ended
}

/** How a delivery's own ending reads as one of the nine event states (#319). */
const DELIVERY_OUTCOME: Record<Exclude<DeliveryStatus, 'active'>, CloudEventState> = {
  finished: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
}

/** What a run's ending means for the delivery it belonged to.
 *
 *  A delivery is implementation, then a review that fixes plain mistakes itself. The
 *  delivery finishes only when review passes it, or stops with a question when review
 *  needs the user. A run that failed or was cut off mid-build leaves it ACTIVE and unfinished,
 *  with the card still held, until Resume carries it on or Discard ends it. A
 *  run somebody stopped is the same: stopping a run is not ending the job. */
export async function settleDelivery(run: RunRecord): Promise<void> {
  if (!run.deliveryId) return
  const before = readStore().deliveries.find((d) => d.deliveryId === run.deliveryId)
  if (!before) return
  type Settled = { end: 'finished' }
  const questions = before.cardId === null ? 0 : openQuestions(before.cardId)
  const raisedQuestions = Math.max(0, questions - (before.initialQuestions ?? 0))

  // Everything that has to run git happens here, before the record's lock — every process
  // on this board waits on that lock, and a git command is not what it should be waiting
  // for.
  //
  // First the run's work, committed onto the delivery's branch. Review may fix plain
  // mistakes itself, so its changes are committed before its pass can land.
  const built = run.status === 'done' && (run.action === 'implement' || run.action === 'review')
  const commit = built && before.status === 'active' ? commitDeliveryWork(before) : { ok: true as const }
  const uncommitted = commit.ok ? undefined : commit.why
  // And, in manual commit mode, the snapshot the finished work leaves for the user's own
  // commit to be matched against. It comes from the run that ends the delivery's own work:
  // a review that passed, or — with AI review off (#416) — the implementation itself. A
  // review asked for by hand on a review-off delivery is still a review, and still the run
  // that ends its work; without this the delivery would finish on it and take the card with
  // it, leaving the user's checkout uncommitted.
  const finishing =
    run.action === 'review' ? raisedQuestions === 0 : run.action === 'implement' && !aiReviewOn(before)
  //
  // A build with no card takes no snapshot (#428): nothing is waiting for the user's commit,
  // because the wait is read on a card page and there is none — the delivery finishes with
  // its run and leaves the change where it is.
  const reviewed =
    !uncommitted && before.commitMode === 'manual' && before.cardId !== null && run.status === 'done' && finishing
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
      return null
    }
    const next = nextAfterSession(delivery, run, raisedQuestions)
    if ('hold' in next) return null
    if ('finish' in next) {
      delivery.next = undefined
      // In manual commit mode a pass is not the end: the code is sitting in the user's own
      // checkout and only they can commit it. The delivery stays ACTIVE, holding the card,
      // with what the board built written down — and the card page is where the wait is
      // read (`manualSettled` below).
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
      return null
    }
    delivery.next = next.start
    return null
  })
  if (settled && 'end' in settled) endDelivery(run.deliveryId, settled.end)
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
 *  `akb delivery review <id>` puts it back in motion. */
export function deliveryRunAfter(run: RunRecord): AgentRequest | null {
  if (run.deliveryId) return takeNext(run.deliveryId) ?? decideAfterDelivery(run.cardId)
  // A run that is not the delivery's own can still be the thing it was waiting for:
  // `resolve` is how the question a stopped review left gets answered, and the hold lets it
  // through for exactly that (`heldByDelivery`). It joins no delivery, so nothing here was
  // taken — the answer itself is what the review follows.
  //
  // How that run ENDED is not asked, and deliberately: the card is the whole of this stop
  // (`answeredStop`), so a run that dropped the last question answered it whether or not it
  // went on to fail. The tick reads it that way already (`answeredWork`), and asking the run
  // here as well made the two disagree — the watcher holds the row it claimed the card with,
  // written before the run spawned and never written back into, so its `status` still reads
  // `running` at the moment it asks. The delivery then carried on nothing, and the card sat
  // at its stop until a tick happened to pick it up.
  //
  // A run with no card answers no stop either: a card-less delivery has no questions to
  // settle, and its own `next` is taken above.
  return run.cardId === null ? null : (answeredReview(run.cardId) ?? decideAfterDelivery(run.cardId))
}

/** The decide run this close owes, when it left a delivery waiting on the card's `[user]`
 *  questions and the decider is switched on (#447) — the second of the decider's two
 *  triggers, the other being QA converging (`refine.ts`).
 *
 *  Both holds count and for one reason: a review that sent the delivery back and a landing
 *  that will not go until the questions are answered are the same wait, and the decider is
 *  what answers it. It joins no delivery — once its answers clear the card, `answeredReview`
 *  at ITS close is what hands the delivery on. */
function decideAfterDelivery(cardId: number | null): AgentRequest | null {
  if (cardId === null) return null
  const state = deliveryStateOf(cardId)
  if (!state || (state.stage !== 'stopped' && state.stage !== 'held')) return null
  return decideRunAfter(cardId)
}

/** True while the delivery on this card is stopped on questions somebody may still answer —
 *  the user, or the decider on their behalf. What the hold lets `resolve` and `decide`
 *  through on: both rewrite questions and never the approved copy, so the delivery is
 *  building exactly what it was building before. */
export function deliveryAcceptsAnswers(cardId: number): boolean {
  const state = deliveryStateOf(cardId)
  return !!state && (state.paused || state.deciding === true)
}

/** The review this card's delivery is owed now that its question has been answered — or
 *  nothing, which is every card that is not waiting at one.
 *
 *  Derived, never stored (`pause.ts`): the card's questions are the whole of that stop, so
 *  a card with none left is a delivery whose next step is another look. Nothing is written
 *  here — the run that starts clears the stop (`joinActive`), and until one does, every
 *  read of this says the same thing. */
export function answeredReview(cardId: number): AgentRequest | null {
  const delivery = activeDelivery(cardId)
  if (!delivery || delivery.next) return null
  if (!answeredStop(delivery, openQuestions(cardId))) return null
  return { action: 'review', id: cardId, deliveryId: delivery.deliveryId, title: delivery.title, trigger: 'answered' }
}

/** The same for every delivery on the board, which is what the tick asks (`view/dispatch`).
 *
 *  The run that answered hands its card on as it closes, so this is what picks up the one
 *  nothing handed off: `resolve` may have run in another process, or days ago, and no
 *  watcher was ever left holding this delivery. A card with a run already on it is left for
 *  the next pass — a second run on it would be refused anyway. */
export function answeredWork(busy: Set<number> = new Set()): AgentRequest[] {
  const work: AgentRequest[] = []
  for (const delivery of readStore().deliveries) {
    // A card-less delivery has no questions and so no stop to be answered (#428).
    if (delivery.status !== 'active' || delivery.cardId === null || busy.has(delivery.cardId)) continue
    const request = answeredReview(delivery.cardId)
    if (request) work.push(request)
  }
  return work
}

/** The same, by delivery id. */
export function takeNext(deliveryId: string): AgentRequest | null {
  const taken = withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
    if (!delivery || delivery.status !== 'active' || !delivery.next) return null
    const action = delivery.next
    delivery.next = undefined
    return { action, cardId: delivery.cardId, title: delivery.title }
  })
  if (!taken) return null
  return { action: taken.action, id: taken.cardId ?? undefined, deliveryId, title: taken.title }
}

// ---- landing: the queue a passed delivery joins (#304) ----------------------

/** This delivery's work has to reach a branch it is not already on: it built on its own
 *  branch, in its own worktree, and the target branch is where the card is meant to land.
 *  Manual commit mode never does — there the commit is the user's, which is the whole of
 *  what the mode means. */
export const wantsLanding = (delivery: DeliveryRecord): boolean =>
  delivery.commitMode === 'auto' && !!delivery.worktree && !!delivery.branch && !!delivery.targetBranch

// Queue it for the repository's one landing slot, and record the run that authorized the
// landing as the check that ran — with no review rule (#306) the re-review IS the gate, so
// it is the only check there is to record. The check is named for the run that actually
// ran, which with AI review off is the implementation (#416).
function queueLanding(delivery: DeliveryRecord, run: RunRecord): void {
  const round = lastRound(delivery)
  const landing = delivery.landing ?? { status: 'waiting' as const, attempts: 0, at: Date.now() }
  delivery.landing = {
    ...landing,
    status: landing.status === 'landing' ? 'landing' : 'waiting',
    why: undefined,
    checks: [
      ...(landing.checks ?? []),
      { name: `${run.action} ${run.sessionId.slice(0, 8)}`, ok: true, at: round?.at ?? Date.now() },
    ],
    at: Date.now(),
  }
}

// Give the slot back without losing what the landing has already spent on this delivery.
function releaseLanding(delivery: DeliveryRecord): void {
  if (delivery.landing?.status !== 'landing') return
  delivery.landing = { ...delivery.landing, status: 'waiting', at: Date.now() }
}

// ---- manual commit mode: the user's own commit (#303) -----------------------

// A manual delivery that review has passed, or nothing when this card has no such
// delivery waiting on the user's commit.
//
// A build with no card never waits (#428): the wait is read on a card page, there is none,
// and there is no card to archive at the end of it — so the delivery finishes when its run
// does and leaves the change uncommitted in the checkout.
function awaitingCommit(delivery: DeliveryRecord | undefined): DeliveryRecord | undefined {
  if (!delivery || delivery.status !== 'active' || delivery.commitMode === 'auto' || !delivery.reviewed) return undefined
  return delivery.cardId === null ? undefined : delivery
}

/** Where a manual delivery stands now that its work is finished and the code is the user's
 *  to commit — and act on it if they have.
 *
 *  Nothing watches git for this: it is asked when the card page is read, which is the
 *  moment somebody wants to know. They committed exactly what the board built and the
 *  delivery is done; they committed something else and a fresh review judges it — or, with
 *  AI review off, the delivery ends on that commit too (#416); or the code is still sitting
 *  there uncommitted and the delivery waits.
 *
 *  Reports what it found. Ending a finished delivery is `settleManualCommit`, which the
 *  Local board's `readCard` awaits before this is asked.
 *
 *  Returns the sentence the card page shows while it waits, and nothing once it has moved
 *  on. */
export function manualSettled(delivery: DeliveryRecord): string | undefined {
  if (!awaitingCommit(delivery)) return undefined
  const state = manualState(delivery)
  if (state === 'waiting') {
    return aiReviewOn(delivery)
      ? `review passed — commit the change in your own checkout and this delivery is done`
      : `the build is done — commit the change in your own checkout and this delivery is done`
  }
  if (state === 'landed') return undefined
  // They committed something other than what the board built. With AI review off there is
  // no reviewer to judge the difference, so their commit is the last word and
  // `settleManualCommit` has already ended the delivery on it (#416).
  if (!aiReviewOn(delivery)) return undefined
  // Otherwise the whole candidate goes back through review. The snapshot is dropped first,
  // so a second read of the card page can't ask for a second review of the same commit.
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live || live.status !== 'active' || !live.reviewed) return
    live.reviewed = undefined
    live.next = 'review'
  })
  syncAudit(delivery.deliveryId)
  return undefined
}

/** End the delivery on this card and archive it, when the user has committed what the
 *  board built (#303) — and do nothing at all otherwise.
 *
 *  With AI review off a commit that differs ends it too (#416): the board has no reviewer
 *  to judge one, so whatever they committed is the last word.
 *
 *  Reading a card must not write the board, so this is the awaited step that comes first:
 *  the Local board's `readCard` calls it, and the read that follows finds a card the
 *  delivery has already let go. The delivery is ended before the archive, so nothing is
 *  holding the card when it goes. */
export async function settleManualCommit(cardId: number): Promise<void> {
  const delivery = awaitingCommit(activeDelivery(cardId))
  if (!delivery) return
  const state = manualState(delivery)
  if (state !== 'landed' && !(state === 'changed' && !aiReviewOn(delivery))) return
  endDelivery(delivery.deliveryId, 'finished')
  await completeCard(delivery.cardId as number, delivery.deliveryId)
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
  return delivery && deliveryState(delivery, openQuestions(cardId), decidingOn(cardId))
}

/** The same by delivery id — what a build with no card is read by (#428). Its flow in Runs
 *  draws this where a card page draws `deliveryStateOf`, because there is no card page. */
export function deliveryPause(deliveryId: string): DeliveryState | undefined {
  const delivery = findDelivery(deliveryId)
  if (!delivery) return undefined
  return delivery.cardId === null
    ? deliveryState(delivery, 0, false)
    : deliveryState(delivery, openQuestions(delivery.cardId), decidingOn(delivery.cardId))
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
  const state = deliveryState(delivery, openQuestions(cardId), decidingOn(cardId))
  // What answers the wait: an approval on an approval hold (#308), the card's own questions
  // everywhere else. Naming the wrong one is a refusal nobody can act on.
  const answer =
    state.stage === 'approval'
      ? `Approve it with \`${cmd} delivery approve ${delivery.deliveryId}\`.`
      : state.stage === 'refused'
        ? `Clear that and it lands by itself.`
        : `Answer it with \`${cmd} card resolve ${cardId}\`.`
  const doing = state.paused
    ? `is waiting on you on #${cardId} — ${state.line} — so the board won't change the card. ` +
      `${answer} Or take the card back with `
    : state.deciding
      ? // The decider is answering its questions (#447), so nothing is asked of the user —
        // but the card is no more this move's to rewrite than it was before.
        `is waiting on an answer on #${cardId} — ${state.line} — so the board won't change the card. ` +
        `Take the card back with `
      : `is in flight on #${cardId} — it is building the card as it was approved when it started, ` +
        `so the board won't change it. Take the card back with `
  // Two ways out, and they differ in what they leave behind: Discard throws the delivery's
  // worktree away with it, `cancel` ends it and leaves the work on disk.
  return (
    `delivery ${delivery.deliveryId} ${doing}` +
    `Discard on the card page, or \`${cmd} delivery cancel ${delivery.deliveryId}\` to end it and keep its work.`
  )
}
