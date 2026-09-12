// The shared local publisher (#319).
//
// One pass over the board, after every successful desktop, CLI or agent board write, and
// after every run that ends. It compares what the board is holding actionable against what
// this board already has on Cloud, and writes the difference into the outbox before anything
// is sent:
//
//   • actionable, nothing on record         → publish
//   • actionable, on record, asking something else → refresh that event in place, as news
//   • actionable, on record, only its revision moved → write the revision through, quietly
//   • on record, no longer actionable       → retire it as `stale`
//
// Actionable means waiting for a person WITH A WAY TO ANSWER (./snapshot.ts). A run picking
// a card up puts its row down, and the run ending picks it back up — which is the one thing
// the bell interrupts anybody over, because it is the one moment the board has finished and
// the user has not. Two things bend that rule in opposite directions:
//
//   • a delivery HELD AT LANDING holds a card without working it (#565) — finished but for
//     the card's open questions, so the card is raised as if nothing held it, and
//   • a live run that merely NAMES a card puts it down even when it holds nothing (#568),
//     because the card page turns its controls off for one either way.
//
// One task means one row. A card revised twice before anyone looks must not leave three
// rows asking about revisions two of them no longer bind, and answering the last question
// on a `ready` card turns that event into the approval rather than raising another.
//
// Everything is best effort. A board write never fails because Cloud was unreachable.

import crypto from 'node:crypto'

import { cardsHeldAtLanding } from '../agent/deliveries'
import { cardsAtWork, cardsBeingCreated, cardsWithLiveRun } from '../agent/store'
import { board } from '../board'
import { KANBAN } from '../paths'
import { ALL_RELEASES, cloudBoardFor, type CloudBoard } from './boards'
import {
  isTerminal,
  listEvents,
  postWatchSummary,
  publishEvent,
  readEvent,
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
  dropQueuedFor,
  duePending,
  editOutbox,
  failed,
  forgetEvent,
  forgetPublication,
  giveUp,
  heldClaims,
  isEnded,
  livePublications,
  noteState,
  publishedFor,
  queue,
  readOutbox,
  settle,
  type Pending,
  type PublishedEvent,
} from './outbox'
import { attachBoardServer } from './servers'
import { readSession } from './session'
import { eventHome, inHome, type EventHome } from './home'
import { snapshotFor } from './snapshot'
import { traceCloud } from './trace'

/** How many times a queued item is tried before this board gives up on it. Spread over the
 *  backoff below, so it is roughly four hours of Cloud being unreachable rather than 54 tries
 *  in a few minutes. Past it the item is written down as unsent (#329): a publication is
 *  queued again by the next board write, and an action or an outcome is queued once and by
 *  nobody else, so dropping one in silence loses it. */
const MAX_ATTEMPTS = 54

/** How long a failed item waits before it is tried again: five seconds, doubling, capped at
 *  five minutes. Short at the front because the failure a send usually meets is a passing one
 *  — a notification the board already promised must arrive within seconds of Cloud coming
 *  back, not after a minute. 53 waits still add up to a little over four hours, which is what
 *  carries a lost network and a Cloud having a bad afternoon. A closed laptop costs no attempt
 *  at all: nothing ticks while it is shut, so what it comes back to is the wait it went to
 *  sleep in. */
const FIRST_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000

/** How far each wait is moved either way. A Cloud that dropped every board on the account at
 *  once must not get all of them back on the same second. */
const BACKOFF_JITTER = 0.2

/** How many items one pass sends before it stops and leaves the rest for the next.
 *
 *  A click queues one or two, so this is invisible in ordinary use. What it bounds is the
 *  first fill of a board that already holds many actionable cards: every one of them is a
 *  write against the service's one daily budget and a message in the connected destination,
 *  and a board turned on at lunchtime must fill over the afternoon rather than arrive at
 *  once. Nothing is dropped — what is not sent this pass is sent on the next. */
const SEND_PER_PASS = 20

/** How long a command waits for the outbox to empty before it ends anyway. Long enough for
 *  a healthy round trip, short enough that a terminal never feels held up by Cloud. */
const FLUSH_ON_EXIT_MS = 4_000

const newOpId = (): string => crypto.randomUUID()

/** Whether this board publishes at all: notifications on, a release to watch, and a machine
 *  signed in. Each of the three is checked here rather than in five callers. */
function publishing(): CloudBoard | null {
  const enabled = cloudBoardFor(KANBAN)
  if (!enabled || !enabled.release) return null
  // A workspace member whose own switch is off publishes nothing from this machine (#328),
  // exactly as a Local board with notifications off does. `watchOff` is the mirror of the
  // answer the workspace holds; a Local board's switch is whether the record exists at all.
  if (enabled.watchOff) return null
  return readSession() ? enabled : null
}

// ---- the pass ---------------------------------------------------------------

/**
 * Bring Cloud in line with the board, and send whatever the outbox is holding.
 *
 * `reconcile` is the start-up and first-enable pass: it also asks Cloud what it believes is
 * live, so an event whose task was edited by hand outside `akb` — which runs no publisher
 * at all — is refreshed or retired rather than left asking about a card that has moved.
 *
 * The board's NAME is registered on that same pass. Publishing an event registers the board
 * it names, but under no name — so a board whose first `startPublishing` could not reach
 * Cloud would carry an unnamed row for good, and the bell would draw a row it cannot say
 * which board is asking. The call is idempotent and costs no write once the name matches.
 */
export async function publishBoardEvents({ reconcile = false, broughtIn = false } = {}): Promise<void> {
  if (reconcile) {
    const enabled = publishing()
    if (enabled) await registerBoard(enabled.id, enabled.name)
  }
  await recordBoardEvents({ reconcile, broughtIn })
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
export async function recordBoardEvents({ reconcile = false, broughtIn = false } = {}): Promise<void> {
  const enabled = cloudBoardFor(KANBAN)
  if (!enabled || !readSession()) return
  // A member whose own switch is off publishes nothing from this machine (#328) — and retires
  // nothing either: a workspace card's decision belongs to the team, so going quiet must not
  // take a row out from under the teammates still waiting on it.
  if (enabled.watchOff) return
  try {
    // A workspace board goes through the pass whatever this member watches — including the
    // nothing a closed release leaves (#328). Only a Local board's empty release means the
    // machine has stopped raising events and its own rows come down.
    if (enabled.release || eventHome(enabled).workspaceId) {
      await queueDifference(enabled, reconcile, broughtIn)
    } else retireLive()
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
    if (!cloudBoardFor(KANBAN) || !readSession()) return
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
  if (!readSession() || duePending().length === 0) return
  await Promise.race([flushCloudOutbox(), sleep(timeoutMs)])
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })

/** The cards that raise nothing: every one a delivery is carrying but a
 *  delivery held at landing (#565), which is built, reviewed and queued with only the card's
 *  open questions left, so its card is raised as if nothing held it. `cardsAtWork` itself is
 *  left whole: a delivery is still carrying these cards, which is what `writeOffAbandoned`
 *  asks. Every reader of the actionable set goes through here, so a queued publication is
 *  re-judged on the same terms that queued it. */
function silenced(atWork: ReadonlySet<number>): Set<number> {
  const heldAtLanding = cardsHeldAtLanding()
  const quiet = new Set([...atWork].filter((id) => !heldAtLanding.has(id)))
  // …and any card a live run merely NAMES on top of those (#568). A specialist holds no card,
  // so `atWork` leaves it out — but the card page turns its controls off for one all the same,
  // and a row asking a question the card offers no way to answer is worse than silence. Added
  // after the filter, so it also holds back a card held at landing. The run ending raises it
  // again, which is where a question still open is heard about.
  for (const id of cardsWithLiveRun()) quiet.add(id)
  // …and a card its creator has not finished writing (#564), for the same reason carried
  // further: that card has no page at all, so a row about it would link to a screen that
  // refuses to draw. Neither state is covered above — a creator names its card in
  // `createdCardIds` rather than holding it, and an unfinished one has no live run left.
  for (const id of cardsBeingCreated().keys()) quiet.add(id)
  // …and a card mid-handover (#611). The run that held it is already closed and the agent
  // taking it over is not written down yet, so the record says nobody has it — while the
  // close itself writes the board (the stage put back, a recurring card stamped) and that
  // write is a pass. Held in memory by the watcher across the whole handover.
  for (const id of handover()) quiet.add(id)
  return quiet
}

/** The cards a close is holding open while it starts what comes next (#611).
 *
 *  On `globalThis` for the reason `fill` below is: the rules bundle can be evaluated twice
 *  in one board server, and the hold has to be seen by whichever copy the pass runs in. A
 *  process that dies mid-handover loses it, which leaves the card to the next board write —
 *  where it would have been raised anyway. */
function handover(): Set<number> {
  const g = globalThis as unknown as { __akbHandover?: Set<number> }
  g.__akbHandover ??= new Set()
  return g.__akbHandover
}

/** Hold a card at work for the length of a handover, and let it go again. Paired by the
 *  watcher: the second is what puts the card back in reach of the pass that raises it. */
export function holdCardAtWork(cardId: number | null): void {
  if (cardId !== null) handover().add(cardId)
}

export function releaseCardAtWork(cardId: number | null): void {
  if (cardId !== null) handover().delete(cardId)
}

async function queueDifference(
  enabled: CloudBoard,
  reconcile: boolean,
  broughtIn: boolean,
): Promise<void> {
  const cards = await board().readCards()
  // Where this checkout's decisions live (#364) — its workspace, or the board id its machine
  // minted. Read once for the pass, like the record below: it is a file on disk, and it
  // cannot change under one read of the board.
  const home = eventHome(enabled)
  // Read once for the whole pass: a card the board is working on raises nothing, and asking
  // per card would read the same record as many times as the board has cards.
  const atWork = cardsAtWork()
  const raising = silenced(atWork)
  // What the BOARD still holds a decision for, whatever this member watches. On a Local board
  // that is the same thing as what this machine raises. On a workspace board it is not: the
  // event belongs to the team, so a card outside this member's release is one they are not
  // told about (`cloud.event_audience`) and never one whose row they take down (#328).
  const team = home.workspaceId ? { ...enabled, release: ALL_RELEASES } : enabled
  const seen = new Set<number>()
  // How many cards this switch brought into view — what the summary counts, and what says
  // whether there is a summary at all.
  let broughtInCount = 0

  for (const card of cards) {
    const snapshot = snapshotFor(card, team, raising, home)
    if (!snapshot) continue
    seen.add(card.id)
    // Raised from THIS machine only while its own member watches the card's release. What
    // the rest of the team watches is theirs to raise, and the row stays either way.
    if (enabled.release !== ALL_RELEASES && card.release !== enabled.release) continue
    const held = publishedFor(card.id)
    // What the scope change BROUGHT IN, as against what it merely passed over: a card this
    // board held no live event for when the switch moved. One already on record whose own
    // content moved in the same pass is an ordinary refresh and stays news.
    const quiet = broughtIn && !isLive(held)
    if (held) {
      // The same piece of work at the same revision. Nothing to write and nobody to interrupt.
      //
      // The revision is checked as well as the fingerprint because it is not part of one
      // (./snapshot.ts): an edit an event cannot see still moves it, and Cloud refuses an
      // action against a revision it does not hold. Such a pass sends the snapshot anyway
      // and the Worker writes the revision through without moving `changed_at`, so the row
      // stays exactly as read as it was.
      if (
        held.state === 'actionable' &&
        held.fingerprint === snapshot.fingerprint &&
        held.revision === snapshot.revision
      ) {
        continue
      }
      // A task whose DELIVERY finished and which needs a person again is new work: the
      // record is dropped so a fresh event is raised, and the finished one stays where it
      // is — it is the history the bell looks back over.
      if (isEnded(held.state)) forgetPublication(card.id)
      // Live work somebody already acted on is a delivery's to report, not a publication's
      // to refresh: the revision it bound is the one the action was granted against. A
      // `stale` row falls through and is revived, so one task keeps one row.
      else if (held.state !== 'actionable' && held.state !== 'stale') continue
    }
    if (quiet) broughtInCount += 1
    queue({ opId: newOpId(), kind: 'publish', attempts: 0, snapshot: { ...snapshot, broughtIn: quiet } })
  }

  // Everything on record whose task stopped being one this board raises events for — it
  // left `ready`, lost its user-owned questions, left the watched release, or a run picked
  // it up. One test, not four, and the same one a closed release or a swapped one comes
  // down to. A card put down for the last of those is picked up again when the run ends,
  // and that is the interruption the bell is for.
  //
  // …unless the board came back with NO cards at all while this one is holding live events.
  // A board does not empty; a read does. Retiring on one is how a bad read turns into every
  // row being retired and raised again from nothing, which is a notification a card, twice.
  // The next pass that reads a card retires whatever really left.
  if (cards.length === 0 && livePublications().length > 0) {
    traceCloud(`sweep skipped: the board read as empty while ${livePublications().length} events are live`)
    return
  }
  retireLive(seen)

  // The switch's own summary, instead of a message for each of them (#451). Queued only when
  // it really brought a waiting card in — a switch that changed what is watched and nothing
  // else is not worth a chat message, whichever direction it moved.
  if (broughtInCount > 0) {
    queue({
      opId: newOpId(),
      kind: 'summary',
      attempts: 0,
      boardId: enabled.id,
      release: enabled.release,
      cards: broughtInCount,
    })
    noteWatchFill(enabled.release, broughtInCount)
  }

  if (reconcile) await reconcileAgainstCloud(home, seen, atWork)
}

/** Whether the board is still holding a live event for this task. `stale` is not one — the
 *  card left the watched scope and its row was retired — and neither is a finished delivery's,
 *  which is history. Both are cards a widening brings back in. */
const isLive = (held: PublishedEvent | undefined): boolean =>
  !!held && held.state !== 'stale' && !isEnded(held.state)

// ---- what the bell says about the switch (#451) -----------------------------
// The same sentence the chat gets, one line above the rows it just filled. Held here rather
// than in the center so the publisher — the only thing that knows a switch happened — writes
// it, and handed out ONCE, like an alert: the rail keeps it on screen while it is open, and
// nothing is said again later to make up for a bell nobody opened.

interface WatchFill {
  release: string
  cards: number
}

/** On `globalThis` for the reason ./center.ts's state is: the rules bundle can be evaluated
 *  more than once in one board server, and a line written by one copy has to be read by the
 *  poll running in the other. */
const fill = (): { held?: WatchFill } => {
  const g = globalThis as unknown as { __akbWatchFill?: { held?: WatchFill } }
  if (!g.__akbWatchFill) g.__akbWatchFill = {}
  return g.__akbWatchFill
}

const noteWatchFill = (release: string, cards: number): void => {
  fill().held = { release, cards }
}

/** The last switch's line, taken away as it is read. */
export function takeWatchFill(): WatchFill | null {
  const held = fill().held ?? null
  delete fill().held
  return held
}

/** Queue a retirement for every live event whose task is not in `keep`. With no `keep` it
 *  retires all of them — what a paused board and a board being turned off come to. */
function retireLive(keep?: Set<number>): void {
  for (const { taskId, event } of livePublications()) {
    if (keep?.has(taskId)) continue
    if (event.state !== 'actionable') continue
    traceCloud(`retire #${taskId} queued: event ${event.eventId} is no longer actionable`)
    queue({ opId: newOpId(), kind: 'retire', attempts: 0, eventId: event.eventId, state: 'stale' })
  }
}

/** How long an action taken on this machine may sit with nothing carrying it before the
 *  board writes it off. Long enough to cover the moment between a click and the run it
 *  starts; short enough that a machine killed mid-run has its card back next time it opens. */
const ABANDONED_ACTION_MS = 10 * 60_000

/** What Cloud believes is live for this board, checked against what the board actually
 *  holds. Closes the gap a crash between a board write and its outbox row leaves, the one a
 *  card edited outside `akb` leaves, and the one a machine that died mid-delivery leaves. */
async function reconcileAgainstCloud(
  home: EventHome,
  actionable: Set<number>,
  atWork: ReadonlySet<number>,
): Promise<void> {
  const answer = await listEvents()
  if (!answer.ok) return
  for (const event of answer.value.events) {
    if (!inHome(event, home)) continue
    if (event.state === 'accepted') {
      writeOffAbandoned(event, atWork)
      continue
    }
    if (event.state !== 'actionable') continue
    if (actionable.has(event.taskId)) continue
    if (event.acted) continue
    queue({ opId: newOpId(), kind: 'retire', attempts: 0, eventId: event.id, state: 'stale' })
  }
  dropSwept(answer.value.events, actionable)
}

/**
 * Records pointing at an event Cloud no longer has (#372).
 *
 * Cloud sweeps an event 30 days after it finished, and a retirement finishes one — so a row
 * this board never managed to retire while it was live is swept underneath it. Nothing told
 * this board: `not_found` is terminal, so the retirement is taken off the queue with the
 * record left exactly as it was, and the next pass queues the same doomed retirement again.
 *
 * The cost is not the wasted round trips. A record reading `actionable` is what makes
 * `queueDifference` skip its card, so a card whose event was swept can never be raised
 * again — it is silently absent from every channel for good. Forgetting the record is what
 * lets the card be published afresh the next time it needs a person.
 *
 * A task this pass found actionable is left alone: its event may have been published between
 * the read above and now, and forgetting that record would raise the card twice.
 */
function dropSwept(events: Array<{ id: string }>, actionable: Set<number>): void {
  const onCloud = new Set(events.map((e) => e.id))
  for (const { taskId, event } of livePublications()) {
    if (actionable.has(taskId) || onCloud.has(event.eventId)) continue
    traceCloud(`record #${taskId} dropped: event ${event.eventId} is gone from Cloud`)
    forgetPublication(taskId)
  }
}

/**
 * An action this machine accepted that nothing is carrying any more.
 *
 * `accepted` means a person acted here and the work follows. If no run and no delivery hold
 * the card, that work is over or never began — the process was killed between the click and
 * the run, or ended before it could report. Left alone the event sits there for good: Cloud
 * refuses to retire an event somebody acted on, and the publisher may not refresh one, so
 * the card could never be raised again.
 *
 * `waiting_for_server` is deliberately not written off. That one is waiting for a machine to
 * pick it up, which is exactly what it says, and no amount of time makes it abandoned.
 *
 * Only an action THIS machine holds on record is written off. A board checked out twice has
 * two publishers reading one event, and the other machine's click is its own to finish.
 */
function writeOffAbandoned(
  event: { id: string; taskId: number; changedAt: string },
  atWork: ReadonlySet<number>,
): void {
  if (publishedFor(event.taskId)?.eventId !== event.id) return
  if (atWork.has(event.taskId)) return
  const since = Date.parse(event.changedAt)
  if (!Number.isFinite(since) || Date.now() - since < ABANDONED_ACTION_MS) return
  queue({
    opId: newOpId(),
    kind: 'outcome',
    attempts: 0,
    eventId: event.id,
    outcome: 'interrupted',
    reason: 'Nothing on this board is carrying it.',
  })
  noteState(event.taskId, 'interrupted')
}

// ---- turning a board on and off ---------------------------------------------

/** The first fill of a board that has just been enabled: register it, register this machine
 *  as its server, then publish everything it is already holding actionable. Nothing is raised
 *  for any of it.
 *
 *  It is the same quiet fill a scope change is (#451), rather than a second behaviour: a chat
 *  already connected when a board is turned on gets the one summary instead of the board's
 *  whole backlog.
 *
 *  A board already held by another machine keeps publishing and runs nothing (#318): the two
 *  are separate, and the Cloud section is where the user moves the server here. */
export async function startPublishing(): Promise<void> {
  const enabled = publishing()
  if (!enabled) return
  await registerBoard(enabled.id, enabled.name)
  await attachBoardServer()
  await publishBoardEvents({ reconcile: true, broughtIn: true })
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
  // `stale` is accepted as well as `actionable`. A retirement queued by the pass a click of
  // its own set off is still about the row the user pressed, and Cloud revives such a row
  // for the action rather than refusing it — dropping the click here would be this board
  // refusing what Cloud would have taken.
  if (!held || (held.state !== 'actionable' && held.state !== 'stale')) {
    traceCloud(`action #${taskId} ${decision} dropped: record is ${held?.state ?? 'missing'}`)
    return
  }
  // A retirement of this very event that has not left yet is taken back: the card is not
  // "no longer waiting for anybody", it is being acted on. Sending both would retire the row
  // and then revive it, which is one notification too many.
  dropQueuedFor(held.eventId, ['retire'])
  traceCloud(
    `action #${taskId} ${decision} queued: event ${held.eventId} at ${held.revision}, clicked at ${revision}`,
  )
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
    traceCloud(`delivery #${taskId} ${outcome} parked: event ${held.eventId} has no action yet`)
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
 * The run a recorded click asked for never started (#640) — say so, rather than leaving the
 * event on `accepted` for good.
 *
 * A surface records its action BEFORE it starts the work, so the pass that start sets off
 * cannot retire the row underneath it. That order owes a compensation: an event accepted
 * with nothing behind it is one the publisher may never refresh, so the card could never be
 * raised again. `failed` ends it, and the card is raised afresh as it stands.
 *
 * The same shape as a refused approval's `failed` (./requests.ts), for the same reason: what
 * the row says is why the work did not happen, not that the build broke.
 */
export function reportCloudStartFailure(taskId: number, reason: string): void {
  if (publishedFor(taskId)?.state !== 'accepted') return
  traceCloud(`start #${taskId} failed after its action was recorded: ${reason}`)
  recordCloudDeliveryState(taskId, 'failed', reason)
}

/**
 * A card is being worked again (#611) — take down whatever Cloud is still holding about it.
 *
 * A row goes up when a card stops being worked and comes down when something picks it up,
 * and until this the second half only happened on the next board write. A card handed
 * straight to another agent makes no such write, so a row raised a moment before the handoff
 * would sit there until the whole chain ended. Clicking it asks Cloud to act on a card an
 * agent already has.
 *
 * Only a card this board holds a live event for costs a pass — every other run start reads
 * one record and returns. The pass itself is never awaited by a caller: a run does not wait
 * on the network.
 */
export function reportCloudRunStart(cardId: number | null): Promise<void> {
  try {
    if (cardId === null || !isLive(publishedFor(cardId))) return Promise.resolve()
    return afterBoardWrite()
  } catch {
    // A run never fails over Cloud. The next pass takes down whatever this missed.
    return Promise.resolve()
  }
}

/**
 * A run has ended (#318, #319) — the moment the board may be waiting for a person again.
 *
 * Two things close here. A request this board's server claimed reports its outcome, which is
 * what finishes it: an Implement's states are its DELIVERY's to report, and a Resolve has no
 * delivery, so the run itself is what says the request is over. And an action taken on THIS
 * machine lets go of its event, so the card it was granted against can be raised afresh.
 *
 * The pass at the end is not optional. A card goes quiet while the board works it, so the
 * write that left it `ready` raised nothing — this is where it is raised.
 *
 * "Ended" means the whole chain, not one agent (#611). The watcher calls this once every
 * follow-up this close starts — the retry, the format repair, the delivery's next step, the
 * landing, the gate, the reflections, the next sort — is written down, so a card handed on
 * is still at work when the pass reads it and the handoff raises nothing. A follow-up that
 * would not start leaves nothing holding the card, and the card is raised as it stands.
 */
export async function reportCloudRunEnd(
  sessionId: string,
  cardId: number | null,
  outcome: CloudEventState,
): Promise<void> {
  try {
    const claim = heldClaims().find((c) => c.sessionId === sessionId)
    if (claim) recordCloudDeliveryState(claim.taskId, outcome)
    else if (cardId !== null) releaseLocalAction(cardId, outcome)
  } catch {
    // A run never fails over Cloud. The reconciliation at start closes what this missed.
  }
  await afterBoardWrite()
}

/**
 * Finish an action taken on this machine, now that nothing is working on its card.
 *
 * The outcome is recorded rather than the record dropped: Cloud refuses to retire an event
 * somebody acted on, so an outcome is the only thing that ends one — and an event left
 * `accepted` is one the publisher may never refresh, which is a card that can never be
 * raised again. What the user hears about is the card coming back, not this.
 */
function releaseLocalAction(taskId: number, outcome: CloudEventState): void {
  if (publishedFor(taskId)?.state !== 'accepted') return
  // Another run of the same click is still going, or a delivery is between its runs. The
  // action is not over until they are.
  if (cardsAtWork().has(taskId)) return
  recordCloudDeliveryState(taskId, outcome)
}

// ---- sending ----------------------------------------------------------------

let flushing: Promise<void> | null = null
let wake: ReturnType<typeof setTimeout> | null = null
let wakeAt = 0

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
      scheduleWake()
    })
  return flushing
}

/**
 * Come back by ourselves when the earliest backoff is up.
 *
 * The outbox is otherwise only sent by new activity and by the board's own minute tick, so a
 * five-second wait would really have been a minute — the whole point of a short backoff is
 * lost without this. Only an item INSIDE its backoff is waited for: something due right now
 * is left to the tick, which is what still paces the first fill of a busy board over an
 * afternoon (see SEND_PER_PASS).
 */
function scheduleWake(now = Date.now()): void {
  let soonest = 0
  for (const item of readOutbox().pending) {
    if (!item.nextAt || item.nextAt <= now) continue
    if (!soonest || item.nextAt < soonest) soonest = item.nextAt
  }
  if (!soonest || (wake && wakeAt <= soonest)) return
  if (wake) clearTimeout(wake)
  wakeAt = soonest
  // Floored, because a timer that fires a millisecond early would find nothing due and
  // schedule itself again for the same moment.
  wake = setTimeout(() => {
    wake = null
    wakeAt = 0
    void flushCloudOutbox()
  }, Math.max(soonest - now, 50))
  // A pending retry never holds a terminal `akb` open: what does not get out stays queued.
  wake.unref?.()
}

/** Drop that wake — what signing out, turning the board off and quitting do. */
export function stopOutboxWake(): void {
  if (wake) clearTimeout(wake)
  wake = null
  wakeAt = 0
}

async function run(): Promise<void> {
  if (!readSession()) return
  let sent = 0
  // The board as this pass reads it, read at most once and only if something asks — see
  // `stillNeededNow`.
  let atNow: BoardNow | null = null
  // What an earlier item in this pass took off the queue. The queue is read once, so an
  // action Cloud never recorded has to be able to stop the outcomes standing behind it in
  // this very list — they have nothing left to report against.
  const dropped = new Set<string>()
  for (const item of duePending()) {
    if (dropped.has(item.opId)) continue
    if (item.attempts >= MAX_ATTEMPTS) {
      giveUp(item.opId, item.lastError ?? 'Cloud did not answer.')
      if (item.kind === 'action') for (const gone of abandonAction(item.eventId)) dropped.add(gone)
      continue
    }
    // A publication describes the card as it was when it was written down. If the card has
    // stopped needing a person since — a run picked it up, a blocker opened, someone moved
    // it — sending it now would raise a row about work nobody is waiting on.
    //
    // Every send, not only one that waited out a backoff (#611). A queue drains a tick after
    // the write that filled it, and one agent handing a card to the next is exactly that long:
    // the first send is as capable of describing a card that has moved as the fifty-fourth.
    if (item.kind === 'publish') {
      atNow ??= await boardNow()
      if (!stillNeededNow(item.snapshot.taskId, atNow)) {
        traceCloud(`dropped ${describe(item)}: the card no longer needs a person`)
        settle(item.opId)
        continue
      }
    }
    // The rest of the queue is the next pass's. See SEND_PER_PASS.
    if (sent >= SEND_PER_PASS) return
    const done = await sendOne(item)
    sent += 1
    if (done.ok) {
      traceCloud(`sent ${describe(item)}`)
      continue
    }
    // A refusal re-reading changes nothing about is not worth retrying forever: it is taken
    // off with what it left behind recorded, so the next pass writes the truth instead.
    if (isTerminal(done.code)) {
      traceCloud(`refused ${describe(item)}: ${done.code ?? 'terminal'} — ${done.error}`)
      settle(item.opId)
      if (item.kind === 'action') {
        for (const gone of await actionRefused(item.eventId, done.code)) dropped.add(gone)
      }
      continue
    }
    traceCloud(`failed ${describe(item)}: ${done.error}`)
    if (item.attempts + 1 >= MAX_ATTEMPTS) {
      giveUp(item.opId, done.error)
      if (item.kind === 'action') for (const gone of abandonAction(item.eventId)) dropped.add(gone)
    } else failed(item.opId, done.error, Date.now() + backoff(item.attempts))
    // Cloud is not answering. Stop here rather than spending the whole queue on it.
    return
  }
}

/**
 * An action Cloud refused for good (#640) — leave the board reading what Cloud really holds.
 *
 * Two refusals get here. `already_acted` means the event carries an action after all, taken
 * by another surface or by a retry this board lost track of: the row is somebody's to report
 * against, so Cloud's state is written back and the delivery goes on reporting against it.
 * `stale_revision` means the card moved between the click and the send, and nothing was
 * recorded: that click is gone, and so is anything queued to report against it.
 *
 * A read that cannot be made changes nothing. The next reconciliation is what closes it.
 */
async function actionRefused(eventId: string, code?: string): Promise<string[]> {
  const answer = await readEvent(eventId)
  if (!answer.ok) {
    traceCloud(`action ${eventId} refused as ${code ?? 'terminal'}: Cloud could not be re-read`)
    return []
  }
  const event = answer.value.event
  traceCloud(`action ${eventId} refused as ${code ?? 'terminal'}: Cloud holds it ${event.state}`)
  if (event.acted) {
    forget(eventId, event.state)
    return []
  }
  return abandonAction(eventId)
}

/** A click Cloud has no action for, and never will. What was queued to report against it has
 *  nowhere to land, and the record naming it would keep the card off every later pass — so
 *  both go. The row itself is left to the reconciliation, which retires it as `stale`.
 *
 *  Answers which queued items went, because the pass holding this one read the queue before
 *  it. */
function abandonAction(eventId: string): string[] {
  traceCloud(`action ${eventId} abandoned: its outcomes and this board’s record go with it`)
  const dropped = dropQueuedFor(eventId, ['outcome'])
  forgetEvent(eventId)
  return dropped
}

const backoff = (attempts: number): number => {
  const wait = Math.min(FIRST_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS)
  return Math.round(wait * (1 + (Math.random() * 2 - 1) * BACKOFF_JITTER))
}

/** Which cards need a person as the board reads NOW, for a pass sending publications that
 *  were written down before it. `read` is false when there is nothing to compare against —
 *  the board is off, unreadable, or read as empty — and then nothing is dropped. */
interface BoardNow {
  needed: ReadonlySet<number>
  read: boolean
}

const NOTHING_READ: BoardNow = { needed: new Set(), read: false }

async function boardNow(): Promise<BoardNow> {
  const enabled = cloudBoardFor(KANBAN)
  if (!enabled || enabled.watchOff) return NOTHING_READ
  const home = eventHome(enabled)
  // The same board the pass judges — including a workspace board this member watches no
  // release of (#328). Reading only a board with a release left that one passing everything
  // through, which is the one board where the queue holds the team's rows.
  if (!enabled.release && !home.workspaceId) return NOTHING_READ
  try {
    const cards = await board().readCards()
    // A board does not empty; a read does. See the sweep in `queueDifference`.
    if (cards.length === 0) return NOTHING_READ
    // What the BOARD holds a decision for, as `queueDifference` reads it. The question here
    // is whether the card still needs a person, not whose release it is in: the item was
    // this member's to raise when it was written down.
    const team = home.workspaceId ? { ...enabled, release: ALL_RELEASES } : enabled
    const raising = silenced(cardsAtWork())
    const needed = new Set<number>()
    for (const card of cards) if (snapshotFor(card, team, raising, home)) needed.add(card.id)
    return { needed, read: true }
  } catch {
    return NOTHING_READ
  }
}

const stillNeededNow = (taskId: number, now: BoardNow): boolean => !now.read || now.needed.has(taskId)

/** One queued item, as the trace names it. */
function describe(item: Pending): string {
  switch (item.kind) {
    case 'publish':
      return `publish #${item.snapshot.taskId} at ${item.snapshot.revision}`
    case 'retire':
      return `retire ${item.eventId} as ${item.state}`
    case 'action':
      return `action ${item.eventId} ${item.decision} at ${item.revision}`
    case 'summary':
      return `summary ${item.release} brought ${item.cards} in`
    default:
      return `outcome ${item.eventId} ${item.outcome}`
  }
}

async function sendOne(item: Pending): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  if (item.kind === 'publish') {
    const { snapshot } = item
    const answer = await publishEvent({
      opId: item.opId,
      boardId: snapshot.boardId,
      workspaceId: snapshot.workspaceId,
      boardName: snapshot.boardName,
      taskId: snapshot.taskId,
      taskTitle: snapshot.taskTitle,
      release: snapshot.release,
      revision: snapshot.revision,
      kind: snapshot.kind,
      decision: snapshot.decision,
      questions: snapshot.questions,
      summary: snapshot.summary,
      notes: snapshot.notes,
      fingerprint: snapshot.fingerprint,
      broughtIn: snapshot.broughtIn,
    })
    if (!answer.ok) return answer
    settle(item.opId, {
      taskId: snapshot.taskId,
      event: {
        eventId: answer.value.event.id,
        fingerprint: snapshot.fingerprint,
        revision: snapshot.revision,
        state: answer.value.event.state,
      },
    })
    return { ok: true }
  }

  if (item.kind === 'summary') {
    const answer = await postWatchSummary({
      opId: item.opId,
      boardId: item.boardId,
      watching: item.release,
      cards: item.cards,
    })
    if (!answer.ok) return answer
    settle(item.opId)
    return { ok: true }
  }

  if (item.kind === 'retire') {
    const answer = await retireEvent(item.opId, item.eventId)
    if (!answer.ok) return answer
    // What Cloud now holds, not what was asked for: it refuses to retire an event somebody
    // acted on and answers with the state it kept, so writing `stale` here would put this
    // board out of step with the row it just read.
    forget(item.eventId, answer.value.event.state)
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
