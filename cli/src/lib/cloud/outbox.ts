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
import { AKB_DIR, ensureAkbDir } from '../paths'
import type { CloudEventAnswer, CloudEventState } from './events'
import type { EventSnapshot } from './snapshot'

/** What this board last got onto Cloud for one task. */
export interface PublishedEvent {
  eventId: string
  /** The snapshot this event was last published at — a fingerprint that has not moved is
   *  not news, so nothing is written and nobody is interrupted. */
  fingerprint: string
  /** As the board last knew it. Local truth about a remote row, kept so the publisher can
   *  tell a live event from one already retired without a round trip. */
  state: CloudEventState
}

/** One thing waiting to reach the Worker. Each is retried on its own: a publication that
 *  cannot get out must not hold an action back, and the other way round. */
export type Pending =
  | { opId: string; kind: 'publish'; attempts: number; lastError?: string; snapshot: EventSnapshot }
  | { opId: string; kind: 'retire'; attempts: number; lastError?: string; eventId: string; state: CloudEventState }
  | {
      opId: string
      kind: 'action'
      attempts: number
      lastError?: string
      eventId: string
      decision: 'implement' | 'answer'
      revision: string
      answers: CloudEventAnswer[]
    }
  | {
      opId: string
      kind: 'outcome'
      attempts: number
      lastError?: string
      eventId: string
      outcome: CloudEventState
      /** Why it ended badly, when it did — what a refused request carries onto its `failed`
       *  so a refused approval and a broken build never read as one outcome (#318). */
      reason?: string
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
  pending: Pending[]
  /** request id → the claim this board holds on it. */
  claims: Record<string, HeldClaim>
}

const EMPTY: Outbox = { version: 1, published: {}, pending: [], claims: {} }

const outboxFile = (): string => path.join(AKB_DIR, 'cloud-outbox.json')
const outboxLock = (): string => path.join(AKB_DIR, 'cloud-outbox.lock')

function read(): Outbox {
  try {
    const parsed = JSON.parse(fs.readFileSync(outboxFile(), 'utf8')) as Partial<Outbox>
    return {
      version: 1,
      published: parsed.published && typeof parsed.published === 'object' ? parsed.published : {},
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      claims: parsed.claims && typeof parsed.claims === 'object' ? parsed.claims : {},
    }
  } catch {
    return { ...EMPTY, published: {}, pending: [], claims: {} }
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

/** Forget what is on record for one task, so the next pass raises a FRESH event rather than
 *  reusing this one. The event itself stays on Cloud: it is the history the bell looks back
 *  over. Only a row a delivery really ran against is ever left behind this way. */
export function forgetPublication(taskId: number): void {
  editOutbox((outbox) => {
    delete outbox.published[String(taskId)]
  })
}

/** Every task with a live event on record — what the retirement test walks. */
export function livePublications(): Array<{ taskId: number; event: PublishedEvent }> {
  const out: Array<{ taskId: number; event: PublishedEvent }> = []
  for (const [id, event] of Object.entries(read().published)) {
    if (event.state === 'stale' || isEnded(event.state)) continue
    out.push({ taskId: Number(id), event })
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

/** Queue one thing, in the same edit that records what it is about. Idempotent on `opId`:
 *  the same attempt is never queued twice. */
export function queue(pending: Pending): void {
  editOutbox((outbox) => {
    if (outbox.pending.some((p) => p.opId === pending.opId)) return
    outbox.pending.push(pending)
  })
}

/** Take the queue as it stands, to try sending. Nothing is removed here — a send that
 *  fails stays queued, and `settle` is what takes a successful one off. */
export const takePending = (): Pending[] => read().pending

/** One queued item reached the Worker. `published` records what it left on Cloud. */
export function settle(opId: string, published?: { taskId: number; event: PublishedEvent }): void {
  editOutbox((outbox) => {
    outbox.pending = outbox.pending.filter((p) => p.opId !== opId)
    if (published) outbox.published[String(published.taskId)] = published.event
  })
}

/** One queued item did not. It stays queued and carries why, so a retry is what happens
 *  next rather than a screen the user has to look at. */
export function failed(opId: string, error: string): void {
  editOutbox((outbox) => {
    const item = outbox.pending.find((p) => p.opId === opId)
    if (!item) return
    item.attempts += 1
    item.lastError = error
  })
}

/** Take over the record for one task from a claim (#318): an approval acted on somewhere
 *  else never touched this board's outbox, so the delivery reporting #319 already wired has
 *  nothing to report against until this is written. */
export function notePublication(taskId: number, eventId: string, state: CloudEventState): void {
  editOutbox((outbox) => {
    const held = outbox.published[String(taskId)]
    outbox.published[String(taskId)] = { eventId, fingerprint: held?.fingerprint ?? '', state }
  })
}

/** Record a state a surface already knows about — an action taken here, a delivery that
 *  ended — without waiting for the round trip that carries it. */
export function noteState(taskId: number, state: CloudEventState): void {
  editOutbox((outbox) => {
    const held = outbox.published[String(taskId)]
    if (held) held.state = state
  })
}

// ---- the claims this board's server holds (#318) -----------------------------

/** Every request this board has claimed and not finished. */
export const heldClaims = (): HeldClaim[] => Object.values(read().claims)

/** The claim on one task, or undefined. */
export const claimForTask = (taskId: number): HeldClaim | undefined =>
  heldClaims().find((c) => c.taskId === taskId)

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
    outbox.claims = {}
  })
}
