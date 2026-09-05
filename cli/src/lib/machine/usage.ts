// What the app and the command are used for (#295) — the queue, and the sender behind it.
//
// One event says a thing happened; nothing here says which card, which project or which
// file it happened to. The names and the fields are `telemetry/contract.ts`'s, imported
// rather than copied, so a field renamed on the server's side stops typechecking here
// instead of losing a number in silence.
//
// Three rules shape the whole file:
//
//   - **Nothing waits on the network.** Reporting is a file append; the send is fired and
//     never awaited, and every failure in it is swallowed. An offline machine keeps its
//     events and sends them later; a machine that is never online simply never sends.
//   - **One batch a day, at a minute the install picked for itself.** Every install would
//     otherwise reach #294's endpoint within a minute of a release going out. The day is
//     stamped before the request rather than after, so a failure costs the day rather than
//     starting a retry loop on the busiest day of the year.
//   - **The queue is capped.** A machine that never reaches the network drops its oldest
//     events rather than growing a file forever.
//
// It is also #296's sender: `reportUsage` is the door, and the board's own numbers go
// through this queue rather than building a second one.

import fs from 'node:fs'
import { randomUUID } from 'node:crypto'

import { ENDPOINT, LIMITS, TOKEN, VERSION } from '../../../../telemetry/contract'
import type { EventName, SentEvent } from '../../../../telemetry/contract'
import { SKILL_VERSION } from '../../version'
import { insideRun } from '../agent/env'
import { machineHome } from './home'
import { ensureUsageInstallId, readUsageReporting, usageQueueFile, usageStateFile } from './telemetry'

/** Where an event came from, as the contract spells it. The app and the command send the
 *  same names, and this is what keeps "somebody opened the app" apart from work done in a
 *  terminal — one of the four questions #292 exists to answer. */
export type Surface = 'app' | 'command'

/** One field's value, as a batch carries it. */
type Field = string | number | boolean

/** How many events may wait. One batch is 16 kB and holds far fewer than this, so the cap
 *  is not a batch size — it is what stops a machine that never reaches the network from
 *  growing a file without limit. Past it the OLDEST go. */
const QUEUE_MAX = LIMITS.batchEvents

/** How long a request may take before it is abandoned.
 *
 *  Short on purpose. The app and the board server outlive any request, but a terminal `akb`
 *  is a process that ends — and Node keeps one alive while a socket is open, so a route that
 *  swallows packets would hold the user's prompt after their output had already printed.
 *  Once a day, and three seconds at the very worst. #294 answers in a fraction of that or
 *  the batch waits for tomorrow, which costs nothing: the events are on disk. */
const SEND_TIMEOUT_MS = 3_000

/** Where a batch goes. `AI4KANBAN_USAGE_URL` points a checkout at the development copy
 *  (`ENDPOINT.development`) or at a test's own server, the way the Cloud endpoints are
 *  overridden — a build made for development must never post into the real numbers. */
const endpoint = (): string => process.env.AI4KANBAN_USAGE_URL || ENDPOINT.production

// ---- the surface, the day, and the fields every event carries ---------------

/** Which surface this process is. The app starts the board server with `KANBAN_DESKTOP=1`
 *  and every run and chat happens under it, so one read answers for both; the app's own
 *  process has no board server around it and says `app` itself. */
export function usageSurface(): Surface {
  return process.env.KANBAN_DESKTOP === '1' ? 'app' : 'command'
}

/** The calendar date as THIS machine's clock and time zone saw it — never the time a batch
 *  arrives, which would move an evening's work onto the next day for half the world. */
export function usageDay(at: Date = new Date()): string {
  const two = (n: number): string => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
}

const minuteOfDay = (at: Date): number => at.getHours() * 60 + at.getMinutes()

/** A value the contract will accept, or nothing. A field the server would drop is left out
 *  here instead of sent — the batch is 16 kB, and a value it will not store is waste. */
function token(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cut = value.trim().slice(0, 64)
  return TOKEN.test(cut) ? cut : undefined
}

/** The operating system, in the three words the privacy page names. Anything else is sent
 *  as Node's own word for it, so a platform we did not think of is still one bucket. */
function operatingSystem(): string {
  const named: Record<string, string> = { darwin: 'macos', win32: 'windows', linux: 'linux' }
  return named[process.platform] ?? (token(process.platform) ?? 'other')
}

// ---- what is queued ---------------------------------------------------------

/**
 * Queue one event, and send the day's batch if this is the moment for it.
 *
 * Returns without touching disk when the machine has said no — and, on the app, while the
 * disclosure step is still owed, because that surface is the one that shows the step and
 * must have queued nothing before it is answered. A terminal `akb` never sees that step and
 * goes on the setting alone.
 *
 * Never throws and never waits: a caller reports and carries on.
 */
export function reportUsage(name: EventName, fields: Record<string, Field> = {}, surface: Surface = usageSurface()): void {
  try {
    const held = readUsageReporting()
    if (!held.on) return
    if (surface === 'app' && !held.disclosed) return
    const install = ensureUsageInstallId()
    if (!install) return

    const day = usageDay()
    const state = readState()
    // The once-a-day "this install was used" event rides in front of whatever asked, so
    // returning use is counted without an event per click and without a caller of its own.
    if (state.dayEvent !== day && name !== 'app_day') {
      append({ name: 'app_day', day, id: randomUUID(), surface, version: SKILL_VERSION })
      writeState({ ...state, dayEvent: day })
    }
    append({ name, day, id: randomUUID(), surface, version: SKILL_VERSION, ...fields })
  } catch {
    // Reporting is never worth a failure a caller has to handle.
    return
  }
  void sendUsage()
}

/**
 * The app or the command started.
 *
 * The app reports every launch, which is what "how many people open it" counts. The command
 * reports at most once a day: a single run has its agent type dozens of `akb` moves, and a
 * per-process open would count the board's own work as somebody sitting down to use it. An
 * `akb` run BY that agent reports nothing at all.
 *
 * `first_run` is true on the first open this install ever reported — the install id is made
 * when the first event is queued, so its absence is what "first" means, and #400 counts real
 * installs by it.
 */
export function reportAppOpen(surface: Surface = usageSurface()): void {
  try {
    if (insideRun()) return
    // Asked before anything is written down, so a machine that said no leaves no trace of
    // this file either.
    const held = readUsageReporting()
    if (!held.on) return
    if (surface === 'app' && !held.disclosed) return

    const day = usageDay()
    if (surface === 'command') {
      const state = readState()
      if (state.openDay === day) return
      writeState({ ...state, openDay: day })
    }
    const first = held.installId === ''
    reportUsage('app_open', { os: operatingSystem(), arch: token(process.arch) ?? 'other', first_run: first }, surface)
  } catch {
    return
  }
}

const RUN_EVENT = {
  started: 'run_started',
  finished: 'run_finished',
  failed: 'run_failed',
} as const satisfies Record<string, EventName>

/** A run of the board's agent, as the surface that started it saw it. Only the two endings
 *  the board witnessed are reported: a run nobody saw the end of was never finished, and a
 *  run the user stopped is neither a success nor a failure. */
export function reportRun(what: keyof typeof RUN_EVENT, harness: string): void {
  const named = token(harness)
  reportUsage(RUN_EVENT[what], named ? { harness: named } : {})
}

/** One message the user sent the board's agent. Not the message, and not the reply. */
export function reportChatMessage(): void {
  reportUsage('chat_message')
}

// ---- the queue on disk ------------------------------------------------------

/** Read the queue, dropping every line the endpoint would refuse anyway: a damaged one, one
 *  older than the backfill window, and one dated past the window a wrong clock is allowed —
 *  which would otherwise never age out and would sit at the head of the queue forever. */
function readQueue(day: string = usageDay()): SentEvent[] {
  let text: string
  try {
    text = fs.readFileSync(usageQueueFile(), 'utf8')
  } catch {
    return []
  }
  const oldest = shiftDay(day, -LIMITS.backfillDays)
  const newest = shiftDay(day, LIMITS.aheadDays)
  const out: SentEvent[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as SentEvent
      if (typeof event?.name !== 'string' || typeof event.day !== 'string') continue
      if (event.day < oldest || event.day > newest) continue
      out.push(event)
    } catch {
      continue
    }
  }
  return out
}

function append(event: SentEvent): void {
  const file = usageQueueFile()
  fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`)
  // The cap, checked where the file grows. Cheap: the queue is a few hundred short lines,
  // and this only rewrites once it is actually full.
  const queued = readQueue()
  if (queued.length > QUEUE_MAX) writeQueue(queued.slice(queued.length - QUEUE_MAX))
}

function writeQueue(events: SentEvent[]): void {
  const file = usageQueueFile()
  if (!events.length) {
    fs.rmSync(file, { force: true })
    return
  }
  fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`)
  fs.renameSync(tmp, file)
}

/** A calendar date `days` away from `day`, the same arithmetic the endpoint does. */
function shiftDay(day: string, days: number): string {
  const at = Date.parse(`${day}T00:00:00Z`)
  return new Date(at + days * 86_400_000).toISOString().slice(0, 10)
}

// ---- what the sender remembers ----------------------------------------------

/** The sender's own bookkeeping, in its own small file.
 *
 *  NOT in `settings.json`: an unparseable settings file reads as "cannot be read", which
 *  turns reporting off and refuses every write (#293). A sender that wrote its day into
 *  that file would put the user's own answers behind its own crash. */
interface UsageState {
  /** The minute of the day this install sends at, picked once and at random. */
  sendMinute?: number
  /** The last day a batch was attempted — one attempt a day, whatever came of it. */
  sentDay?: string
  /** The last day an `app_day` event was queued. */
  dayEvent?: string
  /** The last day the COMMAND surface reported an open. */
  openDay?: string
}

function readState(): UsageState {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(usageStateFile(), 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as UsageState) : {}
  } catch {
    return {}
  }
}

function writeState(state: UsageState): void {
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = usageStateFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`)
    fs.renameSync(tmp, file)
  } catch {
    // A home directory we cannot write means nothing is remembered and nothing is sent.
    return
  }
}

/** The minute of the day this install sends at. Random, and kept, so a release day arrives
 *  at #294 spread over 24 hours rather than all at once. */
function sendMinute(state: UsageState): number {
  const held = state.sendMinute
  if (typeof held === 'number' && Number.isInteger(held) && held >= 0 && held < 1440) return held
  const picked = Math.floor(Math.random() * 1440)
  writeState({ ...state, sendMinute: picked })
  return picked
}

// ---- sending ----------------------------------------------------------------

let sending: Promise<void> | null = null

/**
 * Send the day's batch, if today's has not been attempted and this is its moment.
 *
 * Today's events wait for the install's own minute; a queue carried over from an earlier
 * day goes at the first opportunity, or a machine only ever used in the morning would keep
 * an evening send time and never send at all.
 *
 * The day is stamped BEFORE the request. One attempt a day is the whole of the retry
 * policy: a failure leaves the events queued for tomorrow, and never turns a bad afternoon
 * at the endpoint into every install retrying into it.
 *
 * One attempt per PROCESS, not per machine: the app and its board server both hold these
 * rules, so on the day they race one batch may go twice. That is what the id on each event
 * is for — the endpoint stores the second copy and counts it once.
 */
export async function sendUsage(now: Date = new Date()): Promise<void> {
  if (!sending) {
    sending = attempt(now)
      .catch(() => undefined)
      .finally(() => {
        sending = null
      })
  }
  return sending
}

async function attempt(now: Date): Promise<void> {
  const held = readUsageReporting()
  if (!held.on || !held.installId) return

  const day = usageDay(now)
  const state = readState()
  if (state.sentDay === day) return

  const queued = readQueue(day)
  if (!queued.length) return
  const waiting = queued.some((e) => typeof e.day === 'string' && e.day < day)
  if (!waiting && minuteOfDay(now) < sendMinute(state)) return

  const batch = fill(queued, held.installId)
  if (!batch.events.length) return
  writeState({ ...readState(), sentDay: day })

  const answer = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: batch.body,
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })
  // Taken, or refused for a reason no retry fixes. Either way these events are done with;
  // what is left in the queue is whatever did not fit in this batch.
  if (!answer.ok && answer.status !== 400 && answer.status !== 413) return
  const sent = new Set(batch.events.map((e) => e.id))
  writeQueue(readQueue(day).filter((e) => !sent.has(e.id)))
}

/** As many of the oldest events as one batch may carry. The endpoint refuses a batch over
 *  16 kB unread, so the limit is bytes first and a count second; the rest stay queued. */
function fill(queued: SentEvent[], install: string): { events: SentEvent[]; body: string } {
  const events: SentEvent[] = []
  let bytes = Buffer.byteLength(JSON.stringify({ v: VERSION, install, events: [] }))
  for (const event of queued) {
    if (events.length >= LIMITS.batchEvents) break
    // The event, plus the comma in front of it once there is something to separate it from.
    const piece = Buffer.byteLength(JSON.stringify(event)) + (events.length ? 1 : 0)
    if (bytes + piece > LIMITS.batchBytes) break
    events.push(event)
    bytes += piece
  }
  return { events, body: JSON.stringify({ v: VERSION, install, events }) }
}
