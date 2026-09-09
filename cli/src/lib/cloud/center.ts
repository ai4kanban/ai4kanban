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
// click coming back, and none of them takes a row. `onRail` is what says which are drawn.
//
// The BELL is this board's, however wide the connection is. `readCloudCenter` hands back the
// rows of the board the window is showing and nothing else: a project open in front of you is
// the work you are doing, and a second project's cards mixed into the same list read as this
// one's. Interruptions stay account-wide — a system notification is how a board you are not
// looking at reaches you at all, and clicking one switches the app to it.

import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'
import { notificationsSilenced } from '../machine/settings'
import { KANBAN } from '../paths'
import { cloudBoardById, cloudBoardFor, readCloudBoards } from './boards'
import { readBoardCopy } from './copy'
import { isTerminal, listEvents, readEvent } from './client'
import { eventLabel, needsPerson, onTheRail, type CloudEvent, type CloudEventState } from './events'
import { eventHome, inHome } from './home'
import { connectCloudLive, type LiveConnection } from './live'
import { ensureBoardNotifications } from './notifications'
import { unsentToCloud } from './outbox'
import { flushCloudOutbox, publishBoardEvents, takeWatchFill } from './publish'
import { readSession } from './session'

/** One row of the rail. The card's number and title, the event's name under it, and nothing
 *  else — a row opens that card's page rather than a second view of the event. */
export interface NotificationRow {
  eventId: string
  boardId: string
  /** The workspace this event belongs to (#364). Empty on a Local board's. */
  workspaceId: string
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

/** One scope change, as the line above the rows says it: what is watched now, and how many
 *  cards it brought in. The same sentence the chat's summary carries. */
export interface WatchFill {
  release: string
  cards: number
}

/** What the bell draws, and what this board's Cloud section needs beside it. */
export interface NotificationCenter {
  signedIn: boolean
  /** Notifications are on for THIS board. */
  enabled: boolean
  /** This board's own Cloud id — every row below is one of its own. Empty when it has none,
   *  and then there are no rows. */
  boardId: string
  /** The release this board watches. Empty on an enabled board whose release has closed —
   *  the rail asks for another where the filling stopped. */
  release: string
  silenced: boolean
  /** This board's live events, newest change first. The rail draws the ones marked `onRail`;
   *  the card page reads the rest for its own title band. */
  rows: NotificationRow[]
  /** How many rows are waiting for a person and have not been opened — the bell's count. */
  unread: number
  /** Alerts to raise now, handed out once. */
  alerts: NotificationAlert[]
  /** The scope change that just filled the bell (#451), handed out once. Absent when no
   *  switch brought anything in — the rail draws its one line only when there is one. */
  filled?: WatchFill
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

/** How long the bell goes without a durable read. A socket that never joined receives nothing
 *  and says nothing, and a joined one can still lose a hint on the wire, so without this the
 *  rail would sit on whatever the start read until the socket reconnects (#329, #566). */
const CATCH_UP_MS = 5 * 60_000

/** How long a failed hint read waits before each further go. Three retries over seven seconds
 *  — long enough for a passing blip, and short enough that the catch-up read above is the only
 *  other floor needed. */
const RETRY_MS = [1_000, 2_000, 4_000]

interface Held {
  live: LiveConnection | null
  events: Map<string, CloudEvent>
  alerts: NotificationAlert[]
  error?: string
  starting?: Promise<void>
  /** When the last durable read began. */
  readAt?: number
  /** Hint retries still waiting. */
  retries: Set<ReturnType<typeof setTimeout>>
  /** Bumped by every stop. A read still in flight then belongs to a center that is gone, so
   *  it raises nothing. */
  epoch: number
}

function state(): Held {
  const g = globalThis as unknown as { __akbCloudCenter?: Held }
  if (!g.__akbCloudCenter) {
    g.__akbCloudCenter = { live: null, events: new Map(), alerts: [], retries: new Set(), epoch: 0 }
  }
  return g.__akbCloudCenter
}

/**
 * Open the account's topic, if this process is the one that should hold it.
 *
 * `onScreen` is whether a window is showing this board. A backgrounded server keeps
 * publishing and never subscribes — it has no bell to fill.
 *
 * Several boards can be on screen at once (#495) and each subscribes for its own bell, so
 * the alerts below are handed out by more than one server. Raising them once is the app's
 * to arrange (`alertsAllowed` in kanban-ui/lib/desktop.ts).
 */
export function startCloudCenter(onScreen: boolean): void {
  const held = state()
  if (!onScreen || !readSession()) return
  // Signed in means on, so the board registers itself here rather than waiting for somebody
  // to open Configuration. Ahead of the guards below: this runs on every poll, and the pass
  // that enables the board is usually not the one that opens the socket.
  void ensureBoardNotifications().catch(() => {})
  if (held.live || held.starting) {
    // The durable read is the floor under the socket, joined or not. One that did not join
    // receives nothing and reports nothing — a refused topic, or a Realtime having a bad
    // afternoon — and a joined one still drops the odd hint on the wire, which costs five
    // minutes here rather than waiting for a reconnect (#566).
    if (Date.now() - (held.readAt ?? 0) > CATCH_UP_MS) void catchUp(false).catch(() => {})
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
        if (typeof id === 'string' && id) void readHint(id)
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
  // Nothing a stopped center was still waiting on may raise anybody: signing out and quitting
  // are both the user saying they are done being interrupted.
  for (const timer of held.retries) clearTimeout(timer)
  held.retries.clear()
  held.epoch += 1
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
 *  authority for what it now says.
 *
 *  A read that did not get through is tried again on `RETRY_MS` — the alert this hint carries
 *  has nothing else to arrive on until the catch-up read, five minutes out. A refusal
 *  `isTerminal` names is an answer rather than a blip, so it is given up on at once, and a
 *  hint given up on says nothing: `error` stays what the durable read made of Cloud (#566). */
export async function readHint(eventId: string, attempt = 0): Promise<void> {
  const held = state()
  const epoch = held.epoch
  const answer = await readEvent(eventId)
  if (held.epoch !== epoch) return
  if (!answer.ok) {
    const wait = RETRY_MS[attempt]
    if (wait === undefined || isTerminal(answer.code)) return
    const timer = setTimeout(() => {
      held.retries.delete(timer)
      void readHint(eventId, attempt + 1)
    }, wait)
    timer.unref?.()
    held.retries.add(timer)
    return
  }
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
  // A scope change brought this in (#451): it was already waiting when the switch moved, and
  // the person who moved it is looking at the bell. Nothing about it is news.
  if (event.broughtIn) return null
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

/** This board's live events, newest change first, and the alerts waiting to be raised.
 *  Reading takes the alerts away: they are raised once or not at all. */
export function readCloudCenter(): NotificationCenter {
  const held = state()
  const marks = reads()
  const enabled = cloudBoardFor(KANBAN)
  const boardId = enabled?.id ?? ''
  // What this board's own events are addressed to (#364) — its workspace, or its board id.
  const home = enabled ? eventHome(enabled) : null
  const rows: NotificationRow[] = [...held.events.values()]
    // The bell is the open board's. The connection carries the whole account, because one
    // machine holds one socket and every board's interruptions come down it.
    .filter((event) => !!home && inHome(event, home))
    .map((event) => ({
      eventId: event.id,
      boardId: event.boardId,
      workspaceId: event.workspaceId ?? '',
      taskId: event.taskId,
      taskTitle: event.taskTitle,
      label: eventLabel(event),
      state: event.state,
      onRail: onTheRail(event),
      // Only a state waiting for a person counts, so a delivery starting under a row the
      // user has already read leaves it read. A row a scope change brought in arrives read
      // too (#451) — it was already waiting, and the line above the list is what says so.
      unread: needsPerson(event) && !event.broughtIn && marks[event.id] !== event.changedAt,
      changedAt: event.changedAt,
    }))
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : a.changedAt > b.changedAt ? -1 : b.taskId - a.taskId))

  const alerts = notificationsSilenced() ? [] : held.alerts
  held.alerts = []
  // Handed out once, like an alert. The rail keeps it on screen while it is open; nothing is
  // said again later to make up for a bell nobody opened.
  const filled = takeWatchFill()

  return {
    signedIn: !!readSession(),
    enabled: !!enabled,
    boardId,
    release: enabled?.release ?? '',
    silenced: notificationsSilenced(),
    rows,
    unread: rows.filter((r) => r.unread).length,
    alerts,
    ...(filled ? { filled } : {}),
    error: held.error,
    unsent: unsentToCloud().length,
  }
}

/** Opening a row marks it read — the bell's count is unread rows, so a row the user has
 *  looked at stops counting. Answers with where to go: the project this board belongs to on
 *  this machine, the board folder inside it, and the card to open. The two are not the same
 *  answer for a project holding a second board (#407) — the project opens its own board, and
 *  the folder is what says which one the row is about. */
export function openNotification(
  eventId: string,
): { boardPath: string | null; boardDir: string | null; taskId: number } | null {
  const event = state().events.get(eventId)
  if (!event) return null
  const marks = reads()
  marks[eventId] = event.changedAt
  writeReads(marks)
  const where = checkoutOf(event)
  return { boardPath: where?.path ?? null, boardDir: where?.boardDir ?? null, taskId: event.taskId }
}

/** The checkout on THIS machine an event's card is in, or null when none is. A board event
 *  names a board record; a workspace event names a workspace, and this machine's copy of it
 *  is what `copies.json` records (#364). */
function checkoutOf(event: {
  boardId: string
  workspaceId?: string
}): { path: string; boardDir: string } | null {
  if (event.workspaceId) {
    const board = readCloudBoards().find(
      (b) => readBoardCopy(b.path)?.workspaceId === event.workspaceId,
    )
    return board ? { path: board.path, boardDir: board.boardDir } : null
  }
  const board = cloudBoardById(event.boardId)
  return board ? { path: board.path, boardDir: board.boardDir } : null
}

/** Mark every row read at once, without opening any of them. The rows stay — what they are
 *  waiting for has not changed — and the bell's count empties. The rows this board's, like
 *  the bell: emptying the count here must not empty another project's. */
export function readAllNotifications(): void {
  const enabled = cloudBoardFor(KANBAN)
  if (!enabled) return
  const home = eventHome(enabled)
  const marks = reads()
  for (const event of state().events.values()) {
    if (inHome(event, home) && needsPerson(event)) marks[event.id] = event.changedAt
  }
  writeReads(marks)
}

// ---- the card link a message carries (#320) ----------------------------------
// `ai4kanban://card/<id>/<task>`, which the app registers (#326) and hands here. It is for
// READING the whole card: a decision is made in the message it came from, or on the hosted
// card page, and this link is never how one is made.
//
// The id in it is a board's or a WORKSPACE's (#364): a Local board's message still carries its
// board id, and the hosted card page offers this link with the workspace it is showing, so a
// machine holding a copy of that workspace opens the card in the app. Either way the id is
// named as well as the card, so a link works while another project is open — and one this
// machine does not hold is said plainly rather than opening whatever card wears that number on
// the board in front of the user. The checkout can come back.

/** Where a card link leads, or why it leads nowhere. Null when the URL is not a card link
 *  at all, so a caller can hand every one of the app's URLs through this.
 *
 *  The project and the board folder inside it are two answers, like `openNotification`
 *  above: a project can hold more than one board (#407) and #12 there is not #12 here. */
export type CloudCardLink =
  | { ok: true; boardPath: string; boardDir: string; taskId: number }
  | { ok: false; reason: 'not-here' }

export function readCloudCardLink(url: string): CloudCardLink | null {
  const named = cardInUrl(url)
  if (!named) return null
  // A board record first, then a copy of a workspace: the two id spaces are both uuids, so
  // only one of them can ever answer, and asking in this order leaves a Local board's link
  // reading exactly as it always has.
  const where = checkoutOf({ boardId: named.id, workspaceId: '' }) ?? checkoutOf({ boardId: '', workspaceId: named.id })
  if (!where) return { ok: false, reason: 'not-here' }
  return { ok: true, boardPath: where.path, boardDir: where.boardDir, taskId: named.taskId }
}

/** The board or workspace and the card a URL names. Read off the whole address rather than off
 *  `URL`'s parts, because a custom scheme's authority is not parsed the same way everywhere. */
function cardInUrl(url: string): { id: string; taskId: number } | null {
  const match = /^ai4kanban:\/\/card\/([^/?#]+)\/(\d+)(?:[/?#]|$)/i.exec((url ?? '').trim())
  if (!match) return null
  const taskId = Number(match[2])
  if (!Number.isInteger(taskId)) return null
  return { id: decodeURIComponent(match[1] ?? ''), taskId }
}
