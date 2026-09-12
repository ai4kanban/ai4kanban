// The board's local outbox (#319).
//
// A publication is written down here BEFORE it is sent, and retried independently of the
// board change it describes. The board write and the outbox row are not one transaction, so
// a crash between them leaves a `ready` task nothing will ever retry — the reconciliation at
// start (./publish.ts) is what closes that gap. Together they are the whole of the promise
// that nothing on the board waits for the network.
//
// It lives in the board's `.akb/`, which the board already keeps out of git, so no
// repository gains an ignore rule for Cloud.

import fs from 'node:fs'
import path from 'node:path'

import { withLock } from '../lock'
import { AKB_DIR, ensureAkbDir, KANBAN, REPO_ROOT } from '../paths'
import { isProjectBoard } from './boards'
import type { CloudEventAnswer, CloudEventState } from './events'
import type { EventSnapshot } from './snapshot'

/** What this board last got onto Cloud for one task. */
export interface PublishedEvent {
  eventId: string
  /** What the person was last asked to decide — a fingerprint that has not moved is not
   *  news, so nobody is interrupted. */
  fingerprint: string
  /** The card revision Cloud last stored for it. Kept apart from the fingerprint because it
   *  moves on every edit to the card file and none of them is news: an action binds this, so
   *  a revision that has moved still has to be written through, quietly. Empty on a record
   *  this board took over from a claim, which is one refresh. */
  revision?: string
  /** As the board last knew it. Local truth about a remote row, kept so the publisher can
   *  tell a live event from one already retired without a round trip. */
  state: CloudEventState
}

/** What every queued item carries, whatever it is about.
 *
 *  `nextAt` is the backoff: a send that failed is not tried again until then, so an hour
 *  offline costs an item a handful of attempts rather than all of them. Absent on one that
 *  has never been tried, which is due at once. */
interface Queued {
  opId: string
  attempts: number
  lastError?: string
  nextAt?: number
}

/** One thing waiting to reach the Worker. Each is retried on its own: a publication that
 *  cannot get out must not hold an action back, and the other way round. */
export type Pending =
  | (Queued & { kind: 'publish'; snapshot: EventSnapshot })
  | (Queued & { kind: 'retire'; eventId: string; state: CloudEventState })
  | (Queued & {
      kind: 'action'
      eventId: string
      decision: 'implement' | 'answer'
      revision: string
      answers: CloudEventAnswer[]
    })
  | (Queued & {
      kind: 'outcome'
      eventId: string
      outcome: CloudEventState
      /** Why it ended badly, when it did — what a refused request carries onto its `failed`
       *  so a refused approval and a broken build never read as one outcome (#318). */
      reason?: string
    })
  /** The one message a scope change sends (#451). It belongs to no card, so it names none:
   *  what is watched now, and how many waiting cards the switch brought in. */
  | (Queued & {
      kind: 'summary'
      boardId: string
      release: string
      cards: number
    })

/** One thing this board gave up on sending (#329).
 *
 *  An action and an outcome are queued once and nothing re-queues them, so an item that runs
 *  out of attempts is a change Cloud will never hear about. It is written down here rather
 *  than dropped in silence, and the bell says the board is out of step with Cloud until a
 *  later send about the same thing gets through. */
export interface Unsent {
  /** What it was about, so a later send about the same thing clears it. */
  subject: string
  kind: Pending['kind']
  /** The card it concerned, or 0 when this board no longer has a record of one. */
  taskId: number
  /** The last thing Cloud said, as it stands. */
  error: string
}

/** One execution request this board's server has claimed and not yet finished (#318).
 *
 *  Held on the board rather than only in Cloud, because more than one local process has to
 *  find it: whichever one is carrying the delivery renews its lease, the run that ends is
 *  what reports an answer's outcome, and the card page's Resume and Cancel act on it. */
export interface HeldClaim {
  requestId: string
  eventId: string
  taskId: number
  decision: 'implement' | 'answer'
  /** The run an approved ANSWER started. An implement's states are reported by its delivery;
   *  a resolve has no delivery, so this is what says whose ending is the request's outcome. */
  sessionId?: string
}

interface Outbox {
  version: 1
  /** task id → what is on record for it. */
  published: Record<string, PublishedEvent>
  /** task id → the event a delivery is carrying while its card is raised again (#647).
   *
   *  A delivery that stops for an answer hands its event over to this second place, which
   *  frees `published` for the question the card is now asking. The two are reported on
   *  apart: the delivery's own states — and the landing notification — belong to the event
   *  here, and a run or a request that ended belongs to the event it claimed. */
  delivering: Record<string, PublishedEvent>
  pending: Pending[]
  /** request id → the claim this board holds on it. */
  claims: Record<string, HeldClaim>
  /** What this board gave up on sending. */
  unsent: Unsent[]
}

const EMPTY: Outbox = { version: 1, published: {}, delivering: {}, pending: [], claims: {}, unsent: [] }

/**
 * Which board's outbox this is.
 *
 * `.akb/` belongs to the PROJECT, and a project can hold more than one board (#407) — so a
 * board that is not the project's own writes its own file. One file for two boards is one
 * board's record read as the other's: every pass would find the other's events among cards it
 * has never heard of, retire all of them, and the board they belong to would raise them again
 * from nothing. The project's own board keeps the plain name, so nothing existing moves.
 */
function boardPart(): string {
  if (isProjectBoard(REPO_ROOT, KANBAN)) return ''
  const inside = path.relative(REPO_ROOT, KANBAN)
  const where = !inside || inside.startsWith('..') ? path.basename(KANBAN) : inside
  return `-${where.replace(/[^a-zA-Z0-9]+/g, '-')}`
}

const outboxFile = (): string => path.join(AKB_DIR, `cloud-outbox${boardPart()}.json`)
const outboxLock = (): string => path.join(AKB_DIR, `cloud-outbox${boardPart()}.lock`)

function read(): Outbox {
  try {
    const parsed = JSON.parse(fs.readFileSync(outboxFile(), 'utf8')) as Partial<Outbox>
    return {
      version: 1,
      published: parsed.published && typeof parsed.published === 'object' ? parsed.published : {},
      delivering: parsed.delivering && typeof parsed.delivering === 'object' ? parsed.delivering : {},
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      claims: parsed.claims && typeof parsed.claims === 'object' ? parsed.claims : {},
      unsent: Array.isArray(parsed.unsent) ? parsed.unsent : [],
    }
  } catch {
    return { ...EMPTY, published: {}, delivering: {}, pending: [], claims: {}, unsent: [] }
  }
}

function write(next: Outbox): void {
  ensureAkbDir()
  const file = outboxFile()
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
  fs.renameSync(tmp, file)
}

/** Read, change, write, under this board's own outbox lock — the desktop server and a
 *  terminal `akb` both publish, and two read-modify-writes would lose one of them. */
export function editOutbox<T>(change: (outbox: Outbox) => T): T {
  ensureAkbDir()
  return withLock(outboxLock(), 'writing this board’s Cloud outbox', () => {
    const outbox = read()
    const result = change(outbox)
    write(outbox)
    return result
  })
}

/** What is on record, without taking the lock. A read may be a moment old. */
export const readOutbox = (): Outbox => read()

/** What this board published for one task, or undefined when it never has. */
export const publishedFor = (taskId: number): PublishedEvent | undefined =>
  read().published[String(taskId)]

/** The event a delivery on one task is carrying, or undefined on every task whose delivery
 *  has not stopped for an answer. */
export const deliveringFor = (taskId: number): PublishedEvent | undefined =>
  read().delivering[String(taskId)]

/**
 * Hand one task's record over to the delivery it is carrying (#647).
 *
 * What a delivery stopping for an answer does: the event goes on standing for that delivery
 * — it holds the Implement the user pressed, and the landing notification is its to report —
 * and `published` is freed, so the very next pass raises the card as the question it now is.
 *
 * Answers whether there was one to hand over. Only an event a delivery really ran against
 * moves: anything else is a card asking on its own, which is already raised.
 *
 * One delivery, one event: a card already carrying one hands nothing over. The question
 * raised beside it reads `accepted` from the moment it is answered until the run that
 * answers it is written down, and a pass landing in that gap would otherwise move the
 * QUESTION here — over the Implement the delivery reports its landing against.
 */
export function holdDelivering(taskId: number): boolean {
  return editOutbox((outbox) => {
    if (outbox.delivering[String(taskId)]) return false
    const held = outbox.published[String(taskId)]
    if (!held || (held.state !== 'accepted' && held.state !== 'running')) return false
    outbox.delivering[String(taskId)] = held
    delete outbox.published[String(taskId)]
    return true
  })
}

/** The delivery is over — its event stops standing for one. A supersede opens a fresh
 *  delivery, and that one reports against whatever event it was granted, not this. */
export function forgetDelivering(taskId: number): void {
  editOutbox((outbox) => {
    delete outbox.delivering[String(taskId)]
  })
}

/** The record standing for one event, wherever this board keeps it. */
export function recordForEvent(eventId: string): { taskId: number; event: PublishedEvent } | undefined {
  const outbox = read()
  for (const where of [outbox.published, outbox.delivering]) {
    for (const [id, held] of Object.entries(where)) {
      if (held.eventId === eventId) return { taskId: Number(id), event: held }
    }
  }
  return undefined
}

/** Forget what is on record for one task, so the next pass raises a FRESH event rather than
 *  reusing this one. The event itself stays on Cloud: it is the history the bell looks back
 *  over. Only a row a delivery really ran against is ever left behind this way. */
export function forgetPublication(taskId: number): void {
  editOutbox((outbox) => {
    delete outbox.published[String(taskId)]
  })
}

/** Forget the record naming this event, whichever task holds it. What a click Cloud never
 *  recorded leaves behind: nothing may be reported against that event again, so the record
 *  must not go on standing for it. */
export function forgetEvent(eventId: string): void {
  editOutbox((outbox) => {
    for (const where of [outbox.published, outbox.delivering]) {
      for (const [id, held] of Object.entries(where)) {
        if (held.eventId === eventId) delete where[id]
      }
    }
  })
}

/** Which event a queued item is about, or undefined on one that names none. */
const eventOf = (p: Pending): string | undefined =>
  p.kind === 'publish' || p.kind === 'summary' ? undefined : p.eventId

/** Drop what is still queued about one event, of these kinds, and say which items went.
 *  Nothing here has been sent, so this is a change of mind rather than a state Cloud has to
 *  be told about: a click takes back the retirement queued a moment before it, and an action
 *  Cloud never recorded takes back the outcomes that had nowhere to land. */
export function dropQueuedFor(eventId: string, kinds: ReadonlyArray<Pending['kind']>): string[] {
  return editOutbox((outbox) => {
    const going = outbox.pending.filter((p) => kinds.includes(p.kind) && eventOf(p) === eventId)
    outbox.pending = outbox.pending.filter((p) => !going.includes(p))
    return going.map((p) => p.opId)
  })
}

/** Every task with a live event on record, in either place — what the retirement test walks.
 *  A task whose delivery stopped for an answer contributes two: the question it is asking,
 *  and the delivery still carrying it. */
export function livePublications(): Array<{ taskId: number; event: PublishedEvent }> {
  const outbox = read()
  const out: Array<{ taskId: number; event: PublishedEvent }> = []
  for (const where of [outbox.published, outbox.delivering]) {
    for (const [id, event] of Object.entries(where)) {
      if (event.state === 'stale' || isEnded(event.state)) continue
      out.push({ taskId: Number(id), event })
    }
  }
  return out
}

/** A delivery really ran against this event and it is over. That row is history — the 30
 *  days the bell looks back over are what it is for — so the task needing a person again is
 *  a new event rather than a reuse of this one.
 *
 *  `stale` is deliberately NOT one of these: it means "not waiting on anybody right now".
 *  A Resolve rewrites a card through more than one board write, so a task can leave `ready`
 *  and come straight back, and the user must see ONE row turn from the question into the
 *  approval rather than a retired row and a second one beside it. */
export const isEnded = (state: CloudEventState): boolean =>
  state === 'completed' || state === 'failed' || state === 'cancelled' || state === 'interrupted'

/** What a queued item is ABOUT, as against which attempt at it this is. One task means one
 *  row on Cloud, so it means one pending publication here too: the record that would stop a
 *  second being queued is only written once a send succeeds, and until then every board
 *  write would queue the same card again. An outcome carries its state, because `running`
 *  and how it ended are two things to report rather than two tries at one. */
const subject = (p: Pending): string => {
  switch (p.kind) {
    case 'publish':
      return `publish:${p.snapshot.taskId}`
    case 'retire':
      return `retire:${p.eventId}`
    case 'action':
      return `action:${p.eventId}`
    case 'summary':
      // One board, one outbox, so a switch superseding an unsent switch is the whole rule:
      // what a chat is owed is where the board stands NOW, not every scope it passed through.
      return 'summary'
    default:
      return `outcome:${p.eventId}:${p.outcome}`
  }
}

/** Whether a queued item and a new one about the same subject would send the same thing. A
 *  publication is its fingerprint AND its revision — the revision is not news, but Cloud
 *  stores it, so a queued snapshot must not hold back the one the card reads at now. A
 *  summary is the scope and the count. Nothing else carries a payload that can move. */
const unchanged = (queued: Pending, next: Pending): boolean => {
  if (queued.kind === 'publish' && next.kind === 'publish') {
    return (
      queued.snapshot.fingerprint === next.snapshot.fingerprint &&
      queued.snapshot.revision === next.snapshot.revision
    )
  }
  if (queued.kind === 'summary' && next.kind === 'summary') {
    return queued.release === next.release && queued.cards === next.cards
  }
  return true
}

/**
 * Queue one thing, in the same edit that records what it is about.
 *
 * At most one item per subject. An identical one already queued is kept as it stands, with
 * the attempts it has spent — replacing it would reset them on every board write and defeat
 * MAX_ATTEMPTS. A card that has MOVED supersedes it instead: what waits to be sent is what
 * the card says now, sent once, rather than every version it passed through.
 */
export function queue(pending: Pending): void {
  editOutbox((outbox) => {
    if (outbox.pending.some((p) => p.opId === pending.opId)) return
    const at = outbox.pending.findIndex((p) => subject(p) === subject(pending))
    if (at === -1) outbox.pending.push(pending)
    else if (!unchanged(outbox.pending[at] as Pending, pending)) outbox.pending[at] = pending
  })
}

/** What is due to be tried right now. Nothing is removed here — a send that fails stays
 *  queued, and `settle` is what takes a successful one off.
 *
 *  An item inside its backoff is not due: a machine that has been offline an hour must come
 *  back with its publication still queued rather than with its attempts spent on a network
 *  nobody was waiting for. */
export const duePending = (now = Date.now()): Pending[] =>
  read().pending.filter((p) => !p.nextAt || p.nextAt <= now)

/** One queued item reached the Worker. `published` records what it left on Cloud. */
export function settle(opId: string, published?: { taskId: number; event: PublishedEvent }): void {
  editOutbox((outbox) => {
    const item = outbox.pending.find((p) => p.opId === opId)
    outbox.pending = outbox.pending.filter((p) => p.opId !== opId)
    // A send about the same thing got through, so the board is no longer out of step over it.
    // An outcome clears every earlier outcome of its event too: `running` and how it ended
    // are two subjects, and the one that lands last is where the row on Cloud now stands.
    if (item) {
      const sent = subject(item)
      const earlier = item.kind === 'outcome' ? `outcome:${item.eventId}:` : null
      outbox.unsent = outbox.unsent.filter(
        (u) => u.subject !== sent && !(earlier && u.subject.startsWith(earlier)),
      )
    }
    if (published) outbox.published[String(published.taskId)] = published.event
  })
}

/** One queued item did not. It stays queued and carries why and when to try again, so a
 *  retry is what happens next rather than a screen the user has to look at. */
export function failed(opId: string, error: string, nextAt?: number): void {
  editOutbox((outbox) => {
    const item = outbox.pending.find((p) => p.opId === opId)
    if (!item) return
    item.attempts += 1
    item.lastError = error
    if (nextAt) item.nextAt = nextAt
  })
}

/** One queued item has run out of attempts. It leaves the queue and is written down, so a
 *  change Cloud never heard about is something a surface can say rather than nothing (#329). */
export function giveUp(opId: string, error: string): void {
  editOutbox((outbox) => {
    const item = outbox.pending.find((p) => p.opId === opId)
    if (!item) return
    outbox.pending = outbox.pending.filter((p) => p.opId !== opId)
    // A scope change's summary is dropped rather than written down (#451). It acknowledges a
    // click whose result the user can already see in the bell, so a copy that never reached a
    // chat is worth less than a row telling them the board is out of step with Cloud.
    if (item.kind === 'summary') return
    const note: Unsent = {
      subject: subject(item),
      kind: item.kind,
      taskId: item.kind === 'publish' ? item.snapshot.taskId : taskHolding(outbox, item.eventId),
      error,
    }
    const at = outbox.unsent.findIndex((u) => u.subject === note.subject)
    if (at === -1) outbox.unsent.push(note)
    else outbox.unsent[at] = note
  })
}

/** Everything this board gave up on sending. What the bell says it is out of step over. */
export const unsentToCloud = (): Unsent[] => read().unsent

/** Which task holds an event, as this board last knew. 0 when it holds none — the record can
 *  be dropped before the item that named it is given up on. */
function taskHolding(outbox: Outbox, eventId: string): number {
  for (const where of [outbox.published, outbox.delivering]) {
    for (const [id, held] of Object.entries(where)) {
      if (held.eventId === eventId) return Number(id)
    }
  }
  return 0
}

/** Take over the record for one task from a claim (#318): an approval acted on somewhere
 *  else never touched this board's outbox, so the delivery reporting #319 already wired has
 *  nothing to report against until this is written.
 *
 *  Written where the event already stands. A claim naming the event a stopped delivery is
 *  carrying is about that delivery, and writing it beside the question the card is asking
 *  would take the question's own record out from under it. */
export function notePublication(taskId: number, eventId: string, state: CloudEventState): void {
  editOutbox((outbox) => {
    const carrying = outbox.delivering[String(taskId)]
    if (carrying?.eventId === eventId) {
      carrying.state = state
      return
    }
    const held = outbox.published[String(taskId)]
    outbox.published[String(taskId)] = {
      eventId,
      fingerprint: held?.fingerprint ?? '',
      revision: held?.revision ?? '',
      state,
    }
  })
}

/** Record a state a surface already knows about — an action taken here, a delivery that
 *  ended — without waiting for the round trip that carries it. Named by EVENT, because one
 *  task can hold two: what it is asking, and what its delivery is carrying. */
export function noteEventState(eventId: string, state: CloudEventState): void {
  editOutbox((outbox) => {
    for (const where of [outbox.published, outbox.delivering]) {
      for (const held of Object.values(where)) {
        if (held.eventId === eventId) held.state = state
      }
    }
  })
}

// ---- the claims this board's server holds (#318) -----------------------------

/** Every request this board has claimed and not finished. */
export const heldClaims = (): HeldClaim[] => Object.values(read().claims)

/** The claim on one EVENT, or undefined. What a card whose delivery stopped for an answer
 *  needs: it can be carrying two requests at once — the Implement behind the delivery, and
 *  the Answer behind the question — and each ends on its own. */
export const claimForEvent = (eventId: string): HeldClaim | undefined =>
  heldClaims().find((c) => c.eventId === eventId)

/** Write one down. Claimed and started are one edit: a claim recorded without the run it
 *  started would be renewed forever by a board building nothing. */
export function holdClaim(claim: HeldClaim): void {
  editOutbox((outbox) => {
    outbox.claims[claim.requestId] = claim
  })
}

/** Let one go — the request is over, however it ended. */
export function dropClaim(requestId: string): void {
  editOutbox((outbox) => {
    delete outbox.claims[requestId]
  })
}

/** Forget everything this board has on Cloud. What turning a board's notifications off
 *  leaves behind, once its live events have been queued for retirement. */
export function clearPublications(): void {
  editOutbox((outbox) => {
    outbox.published = {}
    outbox.delivering = {}
    outbox.claims = {}
    outbox.unsent = []
  })
}
