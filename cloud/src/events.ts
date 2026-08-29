/**
 * Events, actions and outcomes (#319) — the durable half of the flow the desktop bell and
 * #320's Slack message both draw one row from.
 *
 * Every call here is one database function, which is one transaction: an action and the
 * state change it causes either both land or neither does. The Worker's job is the shape of
 * the request — a body that is not an event is a bad request, not a service failure — and
 * the owner check, which the database applies again inside the same transaction.
 */

import { CLAIM_LEASE_SECONDS } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, notFound } from './errors.ts'
import type { Owner } from './owner.ts'

/** One event, as every surface reads it. Named here so a route answers a shape rather than
 *  whatever the database happened to build. */
export interface EventRow {
  id: string
  boardId: string
  boardName: string
  taskId: number
  taskTitle: string
  release: string
  revision: string
  kind: 'ready_for_review' | 'question'
  decision: 'implement' | 'answer'
  state: string
  questions: unknown[]
  /** The card's opening paragraph, as the publisher bounded it (#320). Empty on an event
   *  published before this release, and on a card that opens with nothing. */
  summary: string
  /** The card's `## Worth noting` and `## Worth noting after implementation`, likewise. */
  notes: string
  /** Why the delivery ended as it did, in the board's own words — a refused approval reads
   *  nothing like a broken build, and a state name carries neither. Empty on an ending with
   *  nothing to explain. */
  reason: string
  /** The machine that runs this board's work, so a surface can name what a decision is
   *  waiting for. Empty when the board has no server attached. */
  serverName: string
  createdAt: string
  changedAt: string
  acted: boolean
}

const KINDS = ['ready_for_review', 'question']
const DECISIONS = ['implement', 'answer']
const OUTCOMES = ['running', 'completed', 'failed', 'cancelled', 'interrupted']

/** Register a board under the id the machine minted. Cloud never learns where it is. */
export async function registerBoard(env: Env, owner: Owner, body: unknown): Promise<{ boardId: string }> {
  const input = body as { boardId?: unknown; name?: unknown } | null
  const boardId = uuid(input?.boardId, 'board')
  const name = text(input?.name, 'name', 200)
  return mutate(env, 'register_board', {
    p_subject: owner.accountId,
    p_board: boardId,
    p_name: name,
  })
}

/** Store or refresh one event. */
export async function publishEvent(env: Env, owner: Owner, body: unknown): Promise<{ event: EventRow }> {
  const input = (body ?? {}) as Record<string, unknown>
  const kind = String(input.kind ?? '')
  const decision = String(input.decision ?? '')
  if (!KINDS.includes(kind)) throw badRequest('That event names no kind Cloud knows.')
  if (!DECISIONS.includes(decision)) throw badRequest('That event asks for no decision Cloud knows.')
  const taskId = Number(input.taskId)
  if (!Number.isInteger(taskId) || taskId < 0) throw badRequest('That event names no task.')

  const event = await mutate<EventRow>(env, 'publish_event', {
    p_subject: owner.accountId,
    p_board: uuid(input.boardId, 'board'),
    p_task_id: taskId,
    p_task_title: text(input.taskTitle, 'task title', 500),
    p_release: typeof input.release === 'string' ? input.release.slice(0, 100) : '',
    p_revision: text(input.revision, 'revision', 200),
    p_kind: kind,
    p_decision: decision,
    p_questions: questions(input.questions),
    // The card's own words, bounded by the publisher and bounded again here. Cloud stores
    // what a message is reviewed from and no other part of the card (#320).
    p_summary: bounded(input.summary, 4000),
    p_notes: bounded(input.notes, 4000),
    p_fingerprint: text(input.fingerprint, 'fingerprint', 200),
  })
  return { event }
}

/** Every event this account holds — the catch-up read on every start and reconnect. */
export async function listEvents(env: Env, owner: Owner): Promise<{ events: EventRow[] }> {
  const events = await call<EventRow[]>(env, 'list_events', { p_subject: owner.accountId })
  return { events: events ?? [] }
}

/** One event, which is how a Realtime hint is resolved. */
export async function readOneEvent(env: Env, owner: Owner, eventId: string): Promise<{ event: EventRow }> {
  const event = await call<EventRow | null>(env, 'read_event', {
    p_subject: owner.accountId,
    p_event: uuid(eventId, 'event'),
  })
  if (!event) throw notFound()
  return { event }
}

/** Retire an event whose task stopped being one its board raises events for. */
export async function retireEvent(env: Env, owner: Owner, eventId: string): Promise<{ event: EventRow }> {
  const event = await mutate<EventRow | null>(env, 'retire_event', {
    p_subject: owner.accountId,
    p_event: uuid(eventId, 'event'),
  })
  if (!event) throw notFound()
  return { event }
}

/** Record the one action an event carries. */
export async function recordAction(
  env: Env,
  owner: Owner,
  eventId: string,
  body: unknown,
): Promise<{ event: EventRow }> {
  const input = (body ?? {}) as Record<string, unknown>
  const decision = String(input.decision ?? '')
  if (!DECISIONS.includes(decision)) throw badRequest('That action names no decision Cloud knows.')
  const state = input.state === 'waiting_for_server' ? 'waiting_for_server' : 'accepted'

  const event = await mutate<EventRow | null>(env, 'record_event_action', {
    p_subject: owner.accountId,
    p_op_id: text(input.opId, 'attempt id', 200),
    p_event: uuid(eventId, 'event'),
    p_decision: decision,
    p_revision: text(input.revision, 'revision', 200),
    p_answers: answers(input.answers),
    p_state: state,
  })
  if (!event) throw notFound()
  return { event }
}

/**
 * Where the delivery that action started has got to.
 *
 * It ends the execution request in the same transaction (#318): the delivery's state and the
 * job's are one fact, and reporting them apart would leave a finished delivery holding a
 * claim nobody would ever release. `reason` is what a refused request carries onto its
 * `failed`, so a refused approval and a broken build never read as the same outcome.
 */
export async function recordOutcome(
  env: Env,
  owner: Owner,
  eventId: string,
  body: unknown,
): Promise<{ event: EventRow }> {
  const input = (body ?? {}) as Record<string, unknown>
  const outcome = String(input.outcome ?? '')
  if (!OUTCOMES.includes(outcome)) throw badRequest('That is not an outcome Cloud knows.')

  const event = await mutate<EventRow | null>(env, 'record_event_outcome', {
    p_subject: owner.accountId,
    p_op_id: text(input.opId, 'attempt id', 200),
    p_event: uuid(eventId, 'event'),
    p_outcome: outcome,
    p_reason: typeof input.reason === 'string' ? input.reason.slice(0, 500) : '',
    p_lease_seconds: CLAIM_LEASE_SECONDS,
  })
  if (!event) throw notFound()
  return { event }
}

// ---- reading a request's own shape ------------------------------------------
// A body that is not an event is a bad request, not a row Cloud could not find: the two read
// very differently to whoever sent one.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuid(value: unknown, what: string): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (!UUID.test(held)) throw badRequest(`That request names no ${what}.`)
  return held
}

function text(value: unknown, what: string, max: number): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (!held) throw badRequest(`That request carries no ${what}.`)
  return held.slice(0, max)
}

/** Optional text, cut to a ceiling. An event that carries none is not a bad request — a
 *  card can open with nothing to say and note nothing worth noting. */
const bounded = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

/** Every user-owned question with its options and recommendation, and nothing else — the
 *  event's whole payload, trimmed to what the contract says it holds. */
function questions(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 50).map((raw) => {
    const q = (raw ?? {}) as Record<string, unknown>
    const options = Array.isArray(q.options) ? q.options.slice(0, 20).map((o) => String(o).slice(0, 500)) : []
    const out: Record<string, unknown> = { text: String(q.text ?? '').slice(0, 2000) }
    if (options.length > 0) {
      out.mode = q.mode === 'multi' ? 'multi' : 'single'
      out.options = options
      out.recommend = Array.isArray(q.recommend)
        ? q.recommend.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= options.length)
        : []
    }
    return out
  })
}

/** One answer per question the event carried, blanks included. The board's own rule is kept
 *  here too: a ticked option or the user's own words, never both. */
function answers(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 50).map((raw) => {
    const a = (raw ?? {}) as Record<string, unknown>
    const picked = Array.isArray(a.picked)
      ? a.picked.map(Number).filter((n) => Number.isInteger(n) && n >= 1).slice(0, 20)
      : []
    const typed = typeof a.text === 'string' ? a.text.slice(0, 4000) : ''
    return picked.length > 0 ? { picked, text: '' } : { picked: [], text: typed }
  })
}
