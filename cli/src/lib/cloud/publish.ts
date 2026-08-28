// The shared local publisher (#319).
//
// One pass over the board, after every successful desktop, CLI or agent board write. It
// compares what the board is holding actionable against what this board already has on
// Cloud, and writes the difference into the outbox before anything is sent:
//
//   • actionable, nothing on record        → publish
//   • actionable, on record, moved under it → refresh that same event in place
//   • on record, no longer actionable      → retire it as `stale`
//
// One task means one row. A card revised twice before anyone looks must not leave three
// rows asking about revisions two of them no longer bind, and answering the last question
// on a `ready` card turns that event into the approval rather than raising another. Nothing
// here interrupts anybody: what a refresh changes is the same piece of work the user was
// already told about, and `stale` retires an event nobody was waiting on.
//
// Everything is best effort. A board write never fails because Cloud was unreachable.

import crypto from 'node:crypto'

import { board } from '../board'
import { REPO_ROOT } from '../paths'
import { ALL_RELEASES, cloudBoardFor, setCloudBoardRelease, type CloudBoard } from './boards'
import {
  isTerminal,
  listEvents,
  publishEvent,
  recordAction,
  recordOutcome,
  registerBoard,
  retireEvent,
} from './client'
import type { CloudEventAnswer, CloudEventState } from './events'
import {
  claimForTask,
  clearPublications,
  dropClaim,
  editOutbox,
  forgetPublication,
  heldClaims,
  isEnded,
  livePublications,
  noteState,
  publishedFor,
  queue,
  settle,
  takePending,
  failed,
  type Pending,
} from './outbox'
import { attachBoardServer } from './servers'
import { readSession } from './session'
import { snapshotFor } from './snapshot'

/** How many times a queued item is tried before it is left alone. Past this it keeps its
 *  last error and stops being sent on every board write forever. */
const MAX_ATTEMPTS = 8

/** How long a command waits for the outbox to empty before it ends anyway. Long enough for
 *  a healthy round trip, short enough that a terminal never feels held up by Cloud. */
const FLUSH_ON_EXIT_MS = 4_000

const newOpId = (): string => crypto.randomUUID()

/** Whether this board publishes at all: notifications on, a release to watch, and a machine
 *  signed in. Each of the three is checked here rather than in five callers. */
function publishing(): CloudBoard | null {
  const enabled = cloudBoardFor(REPO_ROOT)
  if (!enabled || !enabled.release) return null
  return readSession() ? enabled : null
}

/**
 * The watched release closed, so the filling stops.
 *
 * The board is left enabled with no release: the rail is where the user picks another,
 * because the rail is where the filling stopped. Its live events are not retired here —
 * closing a release clears its open cards' release, so the ordinary retirement test finds
 * them on the very next pass. A board watching every release has none to close.
 */
async function pauseIfReleaseClosed(enabled: CloudBoard): Promise<CloudBoard> {
  if (!enabled.release || enabled.release === ALL_RELEASES) return enabled
  const open = await board().readReleases()
  if (open.includes(enabled.release)) return enabled
  setCloudBoardRelease(REPO_ROOT, '')
  return { ...enabled, release: '' }
}

// ---- the pass ---------------------------------------------------------------

/**
 * Bring Cloud in line with the board, and send whatever the outbox is holding.
 *
 * `reconcile` is the start-up and first-enable pass: it also asks Cloud what it believes is
 * live, so an event whose task was edited by hand outside `akb` — which runs no publisher
 * at all — is refreshed or retired rather than left asking about a card that has moved.
 */
export async function publishBoardEvents({ reconcile = false } = {}): Promise<void> {
  await recordBoardEvents({ reconcile })
  await flushCloudOutbox()
}

/**
 * The local half of the pass: work out the difference and write it into the outbox.
 *
 * This is the half a board write AWAITS. It touches no network — a board read and one file
 * — and it is what makes the publication durable: a `ready` task whose row never reached
 * the outbox is a task nothing would ever retry, and a terminal `akb` is gone the moment
 * its command returns.
 */
export async function recordBoardEvents({ reconcile = false } = {}): Promise<void> {
  const enabled = cloudBoardFor(REPO_ROOT)
  if (!enabled || !readSession()) return
  try {
    const watching = await pauseIfReleaseClosed(enabled)
    if (watching.release) await queueDifference(watching, reconcile)
    else retireLive()
  } catch {
    // A board we could not read this second is a board the next write reads again.
  }
}

/**
 * What a board write calls once it has landed.
 *
 * The outbox write is awaited and the send is not: the publication is durable by the time
 * the write returns, and nothing on the board ever waits for the network. `flushOnExit`
 * below is what gives a terminal command its chance to send before the process ends.
 */
export async function afterBoardWrite(): Promise<void> {
  try {
    if (!publishing()) return
    await recordBoardEvents()
    void flushCloudOutbox()
  } catch {
    // A board write never fails because of Cloud. Whatever this could not record, the next
    // write records again, and the reconciliation at start closes what neither reached.
  }
}

/**
 * Give whatever is queued a bounded chance to reach Cloud before this process ends.
 *
 * A terminal `akb` is over the moment its command returns, so without this a publication
 * would sit in the outbox until the next write — and a user who takes one card to `ready`
 * and walks away makes no next write. It is bounded because a command must not hang on a
 * network the board never waited for: what does not get out stays queued and is retried.
 */
export async function flushOnExit(timeoutMs = FLUSH_ON_EXIT_MS): Promise<void> {
  if (!publishing() || takePending().length === 0) return
  await Promise.race([flushCloudOutbox(), sleep(timeoutMs)])
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })

async function queueDifference(enabled: CloudBoard, reconcile: boolean): Promise<void> {
  const cards = await board().readCards()
  const seen = new Set<number>()

  for (const card of cards) {
    const snapshot = snapshotFor(card, enabled)
    if (!snapshot) continue
    seen.add(card.id)
    const held = publishedFor(card.id)
    if (held) {
      // The same piece of work, unchanged. Nothing to write and nobody to interrupt.
      if (held.state === 'actionable' && held.fingerprint === snapshot.fingerprint) continue
      // A task whose DELIVERY finished and which needs a person again is new work: the
      // record is dropped so a fresh event is raised, and the finished one stays where it
      // is — it is the history the bell looks back over.
      if (isEnded(held.state)) forgetPublication(card.id)
      // Live work somebody already acted on is a delivery's to report, not a publication's
      // to refresh: the revision it bound is the one the action was granted against. A
      // `stale` row falls through and is revived, so one task keeps one row.
      else if (held.state !== 'actionable' && held.state !== 'stale') continue
    }
    queue({ opId: newOpId(), kind: 'publish', attempts: 0, snapshot })
  }

  // Everything on record whose task stopped being one this board raises events for — it
  // left `ready`, lost its user-owned questions, or left the watched release. One test, not
  // three, and the same one a closed release or a swapped one comes down to.
  retireLive(seen)

  if (reconcile) await reconcileAgainstCloud(enabled, seen)
}

/** Queue a retirement for every live event whose task is not in `keep`. With no `keep` it
 *  retires all of them — what a paused board and a board being turned off come to. */
function retireLive(keep?: Set<number>): void {
  for (const { taskId, event } of livePublications()) {
    if (keep?.has(taskId)) continue
    if (event.state !== 'actionable') continue
    queue({ opId: newOpId(), kind: 'retire', attempts: 0, eventId: event.eventId, state: 'stale' })
  }
}

/** What Cloud believes is live for this board, checked against what the board actually
 *  holds. Closes the gap a crash between a board write and its outbox row leaves, and the
 *  one a card edited outside `akb` leaves. */
async function reconcileAgainstCloud(enabled: CloudBoard, actionable: Set<number>): Promise<void> {
  const answer = await listEvents()
  if (!answer.ok) return
  for (const event of answer.value.events) {
    if (event.boardId !== enabled.id) continue
    if (event.state !== 'actionable') continue
    if (actionable.has(event.taskId)) continue
    if (event.acted) continue
    queue({ opId: newOpId(), kind: 'retire', attempts: 0, eventId: event.id, state: 'stale' })
  }
}

// ---- turning a board on and off ---------------------------------------------

/** The first fill of a board that has just been enabled: register it, register this machine
 *  as its server, then publish everything it is already holding actionable. Nothing is raised
 *  for any of it.
 *
 *  A board already held by another machine keeps publishing and runs nothing (#318): the two
 *  are separate, and the Cloud section is where the user moves the server here. */
export async function startPublishing(): Promise<void> {
  const enabled = publishing()
  if (!enabled) return
  await registerBoard(enabled.id, enabled.name)
  await attachBoardServer()
  await publishBoardEvents({ reconcile: true })
}

/** Retire this board's live events. What turning its notifications off does — the record is
 *  what says which they are, and it is dropped once they are queued. */
export async function retireBoardEvents(): Promise<void> {
  retireLive()
  await flushCloudOutbox()
  clearPublications()
}

// ---- the actions and outcomes a surface records -----------------------------

/** Record the one durable action an event carries, from a click on this machine. It joins
 *  the outbox and is retried like a publication, so a click never waits for a round trip. */
export function recordCloudActionFor(
  taskId: number,
  decision: 'implement' | 'answer',
  revision: string,
  answers: CloudEventAnswer[] = [],
): void {
  const held = publishedFor(taskId)
  if (!held || held.state !== 'actionable') return
  queue({
    opId: newOpId(),
    kind: 'action',
    attempts: 0,
    eventId: held.eventId,
    decision,
    revision,
    answers,
  })
  // An action taken here reads as `accepted` on the spot, and the delivery's own states
  // follow it. `waiting for server` is reserved for one taken elsewhere.
  noteState(taskId, 'accepted')
  // The card page starts the delivery and records the click a moment later, so `running`
  // has usually already been reported against an event that had no action yet. Report it
  // now that it has one, rather than letting the row jump from accepted to the outcome.
  const started = startedBeforeAction.get(taskId)
  startedBeforeAction.delete(taskId)
  if (started && started.eventId === held.eventId) recordCloudDeliveryState(taskId, started.state)
  void flushCloudOutbox()
}

/** A delivery that reported a state before its event had an action to report against.
 *  Kept until the click that started it is recorded — the card page starts the run and
 *  records the click in that order — and applied only to the event it was about, so one
 *  left behind by a delivery nobody ever acted on cannot land on a later event. */
const startedBeforeAction = new Map<number, { eventId: string; state: CloudEventState }>()

/**
 * Where the delivery an action started has got to — `running`, and then how it ended.
 *
 * Only a task with an action on record has anything to report: that durable action is the
 * only thing Cloud can see, and a delivery on a task with no event has nothing to report
 * against. Recorded independently of the action itself, so either can retry without
 * duplicating the other.
 */
export function recordCloudDeliveryState(taskId: number, outcome: CloudEventState, reason = ''): void {
  const held = publishedFor(taskId)
  if (!held || held.state === outcome) return
  if (held.state === 'actionable') {
    // Still waiting on a person, so there is nothing to report against yet. Held rather
    // than dropped: on the card page this is the delivery the click is about to record.
    startedBeforeAction.set(taskId, { eventId: held.eventId, state: outcome })
    return
  }
  queue({ opId: newOpId(), kind: 'outcome', attempts: 0, eventId: held.eventId, outcome, reason })
  noteState(taskId, outcome)
  // An outcome that is not `running` ends the execution request too (#318) — Cloud finishes
  // it in the same transaction — so the claim this board was renewing goes with it.
  if (outcome !== 'running') {
    const claim = claimForTask(taskId)
    if (claim) dropClaim(claim.requestId)
  }
  void flushCloudOutbox()
}

/**
 * How a run started from an approved answer ended (#318).
 *
 * An Implement's states are its DELIVERY's to report; a Resolve has no delivery, so the run
 * itself is what says the request is over. Called from `closeRun`, which is the one place a
 * run ends, and a no-op for every run no claim ever started — which is nearly all of them.
 */
export function reportCloudRunEnd(sessionId: string, outcome: CloudEventState): void {
  const claim = heldClaims().find((c) => c.sessionId === sessionId)
  if (!claim) return
  recordCloudDeliveryState(claim.taskId, outcome)
}

// ---- sending ----------------------------------------------------------------

let flushing: Promise<void> | null = null

/** Send everything the outbox is holding, one item at a time, never twice at once. */
export function flushCloudOutbox(): Promise<void> {
  if (flushing) return flushing
  // Never rejects. Most callers start it and walk away (`void flushCloudOutbox()`), and an
  // unhandled rejection out of a best-effort send would take the whole process down —
  // a board server, or the terminal command that had already finished its work.
  flushing = run()
    .catch(() => {})
    .finally(() => {
      flushing = null
    })
  return flushing
}

async function run(): Promise<void> {
  if (!readSession()) return
  for (const item of takePending()) {
    if (item.attempts >= MAX_ATTEMPTS) continue
    const done = await sendOne(item)
    if (done.ok) continue
    // A refusal re-reading changes nothing about is not worth retrying forever: it is taken
    // off with what it left behind recorded, so the next pass writes the truth instead.
    if (isTerminal(done.code)) {
      settle(item.opId)
      continue
    }
    failed(item.opId, done.error)
    // Cloud is not answering. Stop here rather than spending the whole queue on it.
    return
  }
}

async function sendOne(item: Pending): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  if (item.kind === 'publish') {
    const { snapshot } = item
    const answer = await publishEvent({
      opId: item.opId,
      boardId: snapshot.boardId,
      boardName: snapshot.boardName,
      taskId: snapshot.taskId,
      taskTitle: snapshot.taskTitle,
      release: snapshot.release,
      revision: snapshot.revision,
      kind: snapshot.kind,
      decision: snapshot.decision,
      questions: snapshot.questions,
      fingerprint: snapshot.fingerprint,
    })
    if (!answer.ok) return answer
    settle(item.opId, {
      taskId: snapshot.taskId,
      event: {
        eventId: answer.value.event.id,
        fingerprint: snapshot.fingerprint,
        state: answer.value.event.state,
      },
    })
    return { ok: true }
  }

  if (item.kind === 'retire') {
    const answer = await retireEvent(item.opId, item.eventId)
    if (!answer.ok) return answer
    forget(item.eventId, 'stale')
    settle(item.opId)
    return { ok: true }
  }

  if (item.kind === 'action') {
    const answer = await recordAction({
      opId: item.opId,
      eventId: item.eventId,
      decision: item.decision,
      revision: item.revision,
      answers: item.answers,
      state: 'accepted',
    })
    if (!answer.ok) return answer
    forget(item.eventId, answer.value.event.state)
    settle(item.opId)
    return { ok: true }
  }

  const answer = await recordOutcome(item.opId, item.eventId, item.outcome, item.reason ?? '')
  if (!answer.ok) return answer
  forget(item.eventId, answer.value.event.state)
  settle(item.opId)
  return { ok: true }
}

/** Write back the state Cloud now holds for an event, whichever task it belongs to. */
function forget(eventId: string, state: CloudEventState): void {
  editOutbox((outbox) => {
    for (const held of Object.values(outbox.published)) {
      if (held.eventId === eventId) held.state = state
    }
  })
}
