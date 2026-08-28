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
//   • a new actionable event, unless the app's window is focused — and nothing later to
//     make up for it;
//   • the outcome of a delivery with a Cloud action recorded against it, focused window
//     included, because the user may have walked away from a run they approved.
// A start's catch-up raises neither: the person launching the app is in front of it. A
// reconnect's raises both, because the window may have been sitting unwatched.

import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'
import { notificationsSilenced } from '../machine/settings'
import { REPO_ROOT } from '../paths'
import { cloudBoardById, cloudBoardFor, namesBoards } from './boards'
import { listEvents, readEvent } from './client'
import { eventLabel, isOutcome, type CloudEvent, type CloudEventState } from './events'
import { connectCloudLive, type LiveConnection } from './live'
import { publishBoardEvents } from './publish'
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
  rows: NotificationRow[]
  unread: number
  /** Alerts to raise now, handed out once. */
  alerts: NotificationAlert[]
  /** Cloud could not be reached. The rows are what was last known. */
  error?: string
}

// ---- what this machine has looked at ----------------------------------------
// A row is unread until it is opened, and unread AGAIN when its delivery ends: the mark is
// the event's newest change, so a change nobody has opened since counts.

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

interface Held {
  live: LiveConnection | null
  events: Map<string, CloudEvent>
  alerts: NotificationAlert[]
  error?: string
  starting?: Promise<void>
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
  if (!focused || held.live || held.starting) return
  if (!readSession()) return
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
}

/** The durable read every start and reconnect does before listening for hints. */
async function catchUp(firstTime: boolean): Promise<void> {
  const held = state()
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
  if (silent) return
  if (before && before.state === event.state && before.changedAt === event.changedAt) return

  // A new actionable event. A refresh in place — same event, still actionable — is the same
  // piece of work the user was already told about, so it says nothing.
  if (event.state === 'actionable' && !before) {
    held.alerts.push(alert(event, 'actionable', eventLabel(event)))
    return
  }
  // The delivery this event's action started has ended. Only an event with an action on
  // record has anything to report, and a cancellation is the user's own doing.
  if (isOutcome(event.state) && event.acted && before?.state !== event.state) {
    held.alerts.push(alert(event, 'outcome', eventLabel(event)))
  }
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

/** The rail's rows, newest change first, and the alerts waiting to be raised. Reading takes
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
        // A retired event stops counting without ever being opened.
        unread: event.state !== 'stale' && marks[event.id] !== event.changedAt,
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
