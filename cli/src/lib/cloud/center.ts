// The notification center, as the board server holds it (#319).
//
// One connection however many boards are enabled: every event on the account's one topic
// reaches whoever is subscribed, whichever board raised it, so the board server the window
// is showing draws the whole bell and a backgrounded one keeps publishing over `fetch`
// without subscribing or interrupting anyone.
//
// What is held here is a cache of what Cloud already stored, never a second authority: the
// catch-up read on every connect and reconnect is what makes a missed hint cost nothing.
//
// Two interruptions and no more, both decided here and raised by the app:
//   • a card that is waiting for a person and has nothing working on it — the board has
//     finished its runs and left something to decide — unless the app's window is focused,
//     and nothing later to make up for it;
//   • the outcome of a DELIVERY with a Cloud action recorded against it, focused window
//     included, because the user may have walked away from a build they approved.
// A start's catch-up raises neither: the person launching the app is in front of it. A
// reconnect's raises both, because the window may have been sitting unwatched.
//
// The rail draws the same two (./events.ts `needsPerson`), so the bell's count is things to
// do rather than a log of state changes: a delivery going, an approval this machine just
// took, a cancellation and a card that stopped asking are all the board or the user's own
// click coming back, and none of them takes a row. The card page reads `rows` for its own
// title band, so every event stays in there and `onRail` is what says which are drawn.

import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'
import { notificationsSilenced } from '../machine/settings'
import { REPO_ROOT } from '../paths'
import { cloudBoardById, cloudBoardFor, namesBoards } from './boards'
import { listEvents, readEvent } from './client'
import { eventLabel, needsPerson, onTheRail, type CloudEvent, type CloudEventState } from './events'
import { connectCloudLive, type LiveConnection } from './live'
import { ensureBoardNotifications } from './notifications'
import { unsentToCloud } from './outbox'
import { flushCloudOutbox, publishBoardEvents } from './publish'
import { readSession } from './session'

/** One row of the rail. The card's number and title, the event's name under it, and nothing
 *  else — a row opens that card's page rather than a second view of the event. */
export interface NotificationRow {
  eventId: string
  boardId: string
  /** Named on a row only once a second board is enabled. */
  boardName: string
  /** False when that board is no longer on this machine. The row says so rather than
   *  switching to it, because the checkout can come back. */
  boardHere: boolean
  taskId: number
  taskTitle: string
  /** The event's name — what the row's second line and a notification both say. */
  label: string
  state: CloudEventState
  /** The rail draws this one. False on the states nobody has to act on — the card page still
   *  reads them here for its title band. */
  onRail: boolean
  unread: boolean
  changedAt: string
}

/** One interruption the app is being asked to raise. */
export interface NotificationAlert {
  eventId: string
  boardId: string
  taskId: number
  /** The row's words: `#319 Sync actionable events…`. */
  title: string
  /** The event's name, or the outcome for the second notification. */
  body: string
  /** An outcome is raised whether or not the window is focused; an actionable event is not
   *  raised at all while it is. */
  kind: 'actionable' | 'outcome'
}

/** What the bell draws, and what this board's Cloud section needs beside it. */
export interface NotificationCenter {
  signedIn: boolean
  /** Notifications are on for THIS board. */
  enabled: boolean
  /** This board's own Cloud id, so a card page can tell its own event from a row another
   *  board raised about a task that happens to share a number. Empty when it has none. */
  boardId: string
  /** The release this board watches. Empty on an enabled board whose release has closed —
   *  the rail asks for another where the filling stopped. */
  release: string
  silenced: boolean
  /** Whether a row has to name its board. */
  namesBoards: boolean
  /** Every live event, newest change first. The rail draws the ones marked `onRail`; the
   *  card page reads the rest for its own title band. */
  rows: NotificationRow[]
  /** How many rows are waiting for a person and have not been opened — the bell's count. */
  unread: number
  /** Alerts to raise now, handed out once. */
  alerts: NotificationAlert[]
  /** Cloud could not be reached. The rows are what was last known. */
  error?: string
  /** How many changes this board gave up on sending (#329). Non-zero means Cloud is out of
   *  step with the board here, and only a person can tell which way. */
  unsent: number
}

// ---- what this machine has looked at ----------------------------------------
// A row is unread until it is opened, and unread AGAIN when its delivery ends: the mark is
// the event's newest change, so a change nobody has opened since counts — as long as the
// state it changed to is one waiting for a person.

const readsFile = (): string => path.join(machineHome(), 'notifications.json')

function reads(): Record<string, string> {
  try {
    const held = JSON.parse(fs.readFileSync(readsFile(), 'utf8')) as { read?: Record<string, string> }
    return held.read && typeof held.read === 'object' ? held.read : {}
  } catch {
    return {}
  }
}

function writeReads(read: Record<string, string>): void {
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = readsFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify({ read }, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, file)
  } catch {
    // A read mark we could not save is a row that stays bold. Not worth an error.
  }
}

// ---- the held connection ----------------------------------------------------

/** How long the bell goes without a durable read while its socket is not carrying it. A
 *  socket that never joined receives nothing and says nothing, so without this the rail would
 *  sit on whatever the start read and never move again (#329). */
const CATCH_UP_MS = 5 * 60_000

interface Held {
  live: LiveConnection | null
  events: Map<string, CloudEvent>
  alerts: NotificationAlert[]
  error?: string
  starting?: Promise<void>
  /** When the last durable read began. */
  readAt?: number
}

function state(): Held {
  const g = globalThis as unknown as { __akbCloudCenter?: Held }
  if (!g.__akbCloudCenter) g.__akbCloudCenter = { live: null, events: new Map(), alerts: [] }
  return g.__akbCloudCenter
}

/**
 * Open the account's topic, if this process is the one that should hold it.
 *
 * `focused` is whether this board server is the one the window is showing. A backgrounded
 * server keeps publishing and never subscribes — a subscription in each would raise one
 * event's notification several times over.
 */
export function startCloudCenter(focused: boolean): void {
  const held = state()
  if (!focused || !readSession()) return
  // Signed in means on, so the board registers itself here rather than waiting for somebody
  // to open Configuration. Ahead of the guards below: this runs on every poll, and the pass
  // that enables the board is usually not the one that opens the socket.
  void ensureBoardNotifications().catch(() => {})
  if (held.live || held.starting) {
    // The socket is what keeps the rail moving, so long as it really joined. One that did
    // not receives nothing and reports nothing — a refused topic, or a Realtime having a bad
    // afternoon — and the durable read is the floor under it.
    if (!held.live?.joined() && Date.now() - (held.readAt ?? 0) > CATCH_UP_MS) {
      void catchUp(false).catch(() => {})
    }
    return
  }
  held.starting = (async () => {
    // The reconciliation this board owes Cloud, before anything is listened for.
    await publishBoardEvents({ reconcile: true }).catch(() => {})
    const session = readSession()
    held.live = connectCloudLive({
      topic: `account:${session?.subject ?? ''}`,
      onReady: (firstTime) => void catchUp(firstTime),
      onHint: (payload) => {
        const id = payload.eventId
        if (typeof id === 'string' && id) void hint(id)
      },
    })
    // No socket on this runtime — the bell still fills from the catch-up read.
    if (!held.live) await catchUp(true)
  })()
    // Nobody awaits this, so it must not reject: the bell going quiet is worth less than
    // the board server it is running inside.
    .catch(() => {})
    .finally(() => {
      held.starting = undefined
    })
}

/** Close it. What signing out and quitting do. */
export function stopCloudCenter(): void {
  const held = state()
  held.live?.close()
  held.live = null
  held.events.clear()
  held.alerts = []
  held.readAt = undefined
}

/** The durable read every start and reconnect does before listening for hints.
 *
 *  It sends as well as reads: a reconnect is the first moment a machine that was asleep or
 *  offline knows Cloud is reachable, and the outbox it filled while it was not is what
 *  reaching Cloud again is for (#329). */
async function catchUp(firstTime: boolean): Promise<void> {
  const held = state()
  held.readAt = Date.now()
  void flushCloudOutbox()
  const answer = await listEvents()
  if (!answer.ok) {
    held.error = answer.error
    return
  }
  held.error = undefined
  const fresh = new Map<string, CloudEvent>()
  for (const event of answer.value.events) fresh.set(event.id, event)
  for (const event of fresh.values()) merge(event, { silent: firstTime })
  // Anything Cloud no longer holds is finished and swept, so it leaves the bell too.
  for (const id of [...held.events.keys()]) if (!fresh.has(id)) held.events.delete(id)
}

/** One hint, resolved through the Worker. Realtime carries the identifier; Postgres is the
 *  authority for what it now says. */
async function hint(eventId: string): Promise<void> {
  const answer = await readEvent(eventId)
  if (!answer.ok) return
  merge(answer.value.event, { silent: false })
}

/** Take one event as Cloud now holds it, and decide whether it interrupts anybody. */
function merge(event: CloudEvent, { silent }: { silent: boolean }): void {
  const held = state()
  const before = held.events.get(event.id)
  held.events.set(event.id, event)
  const raise = alertFor(before, event, silent)
  if (raise) held.alerts.push(raise)
}

/**
 * Whether one event, as Cloud now holds it, interrupts anybody — and with what.
 *
 * Read against what this machine held BEFORE, which is what makes a broadcast delivered
 * twice cost nothing: the second carries the same state and the same `changedAt`, so there
 * is nothing new to say. Missing a broadcast costs nothing either — the catch-up read hands
 * the event through here exactly the same way (#329).
 */
export function alertFor(
  before: CloudEvent | undefined,
  event: CloudEvent,
  silent: boolean,
): NotificationAlert | null {
  if (silent) return null
  // Nothing is waiting for anybody. `needsPerson` is the whole of that judgment, and the rail
  // draws from the same one, so an interruption and a row can never disagree.
  if (!needsPerson(event)) return null
  // The same state again is the same piece of work the user was already told about: a
  // broadcast delivered twice, or a card refreshed in place under a question still open.
  //
  // What makes an actionable event an interruption is that nothing is working on it NOW —
  // not whether this machine has seen the row before. A card is put down while a run rewrites
  // it (./snapshot.ts) and picked up again when the run ends, so the same card raises the
  // user each time the board finishes with it and leaves it needing one.
  if (before?.state === event.state) return null
  return alert(event, event.state === 'actionable' ? 'actionable' : 'outcome', eventLabel(event))
}

const alert = (event: CloudEvent, kind: NotificationAlert['kind'], body: string): NotificationAlert => ({
  eventId: event.id,
  boardId: event.boardId,
  taskId: event.taskId,
  title: `#${event.taskId} ${event.taskTitle}`,
  body,
  kind,
})

// ---- what the bell draws ----------------------------------------------------

/** Every live event, newest change first, and the alerts waiting to be raised. Reading takes
 *  the alerts away: they are raised once or not at all. */
export function readCloudCenter(): NotificationCenter {
  const held = state()
  const marks = reads()
  const enabled = cloudBoardFor(REPO_ROOT)
  const rows: NotificationRow[] = [...held.events.values()]
    .map((event) => {
      const board = cloudBoardById(event.boardId)
      return {
        eventId: event.id,
        boardId: event.boardId,
        boardName: board?.name ?? event.boardName,
        boardHere: !!board,
        taskId: event.taskId,
        taskTitle: event.taskTitle,
        label: eventLabel(event),
        state: event.state,
        onRail: onTheRail(event),
        // Only a state waiting for a person counts, so a delivery starting under a row the
        // user has already read leaves it read.
        unread: needsPerson(event) && marks[event.id] !== event.changedAt,
        changedAt: event.changedAt,
      }
    })
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : a.changedAt > b.changedAt ? -1 : b.taskId - a.taskId))

  const alerts = notificationsSilenced() ? [] : held.alerts
  held.alerts = []

  return {
    signedIn: !!readSession(),
    enabled: !!enabled,
    boardId: enabled?.id ?? '',
    release: enabled?.release ?? '',
    silenced: notificationsSilenced(),
    namesBoards: namesBoards(),
    rows,
    unread: rows.filter((r) => r.unread).length,
    alerts,
    error: held.error,
    unsent: unsentToCloud().length,
  }
}

/** Opening a row marks it read — the bell's count is unread rows, so a row the user has
 *  looked at stops counting. Answers with where to go: the board's own path on this
 *  machine, and the card to open in it. */
export function openNotification(eventId: string): { boardPath: string | null; taskId: number } | null {
  const event = state().events.get(eventId)
  if (!event) return null
  const marks = reads()
  marks[eventId] = event.changedAt
  writeReads(marks)
  return { boardPath: cloudBoardById(event.boardId)?.path ?? null, taskId: event.taskId }
}

// ---- the card link a message carries (#320) ----------------------------------
// `ai4kanban://card/<board>/<task>`, which the app registers (#326) and hands here. It is
// for READING the whole card: a decision is made in the message it came from, and this link
// is never how one is made.
//
// The board is named as well as the card, so a link works while another project is open —
// and a board that is no longer on this machine is said plainly rather than opening whatever
// card wears that number on the board in front of the user. The checkout can come back.

/** Where a card link leads, or why it leads nowhere. Null when the URL is not a card link
 *  at all, so a caller can hand every one of the app's URLs through this. */
export type CloudCardLink =
  | { ok: true; boardPath: string; taskId: number }
  | { ok: false; reason: 'not-here' }

export function readCloudCardLink(url: string): CloudCardLink | null {
  const named = cardInUrl(url)
  if (!named) return null
  const board = cloudBoardById(named.boardId)
  return board ? { ok: true, boardPath: board.path, taskId: named.taskId } : { ok: false, reason: 'not-here' }
}

/** The board and card a URL names. Read off the whole address rather than off `URL`'s parts,
 *  because a custom scheme's authority is not parsed the same way everywhere. */
function cardInUrl(url: string): { boardId: string; taskId: number } | null {
  const match = /^ai4kanban:\/\/card\/([^/?#]+)\/(\d+)(?:[/?#]|$)/i.exec((url ?? '').trim())
  if (!match) return null
  const taskId = Number(match[2])
  if (!Number.isInteger(taskId)) return null
  return { boardId: decodeURIComponent(match[1] ?? ''), taskId }
}
