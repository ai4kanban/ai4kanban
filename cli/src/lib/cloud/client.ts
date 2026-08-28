// Every durable Cloud call this board makes, over plain `fetch` (#319).
//
// No Realtime client is loaded here and none is needed: durable reads, writes and actions
// go through the Worker, and Realtime carries only the identifiers of what the Worker
// already stored. That is what lets a terminal `akb` publish on Node 18 with no socket at
// all — see ./live.ts for the connection the app alone opens.
//
// Every call answers rather than throwing. A publisher that threw would make a board write
// fail over a network the board was never waiting for.

import { cloudConfigured, cloudEndpoints, NOT_CONFIGURED } from './config'
import type { CloudEvent, CloudEventAnswer, CloudEventState } from './events'
import { accessToken } from './session'

export type CloudCall<T> = { ok: true; value: T } | { ok: false; error: string; code?: string }

/** Refusals a caller acts on rather than retries. Everything else is worth another go. */
export const TERMINAL_CODES = [
  'bad_request',
  'not_admitted',
  'not_yours',
  'not_found',
  'stale_revision',
  'already_acted',
]

export const isTerminal = (code?: string): boolean => !!code && TERMINAL_CODES.includes(code)

/** Tell Cloud this board exists, under the id the machine gave it. Idempotent. */
export const registerBoard = (boardId: string, name: string): Promise<CloudCall<{ boardId: string }>> =>
  send('POST', '/v1/boards', { boardId, name })

/** Store or refresh one event. The Worker deduplicates on `boardId` + `taskId`, so a
 *  refreshed snapshot moves the live row rather than raising a second. */
export const publishEvent = (body: PublishBody): Promise<CloudCall<{ event: CloudEvent }>> =>
  send('POST', '/v1/events', body)

export interface PublishBody {
  opId: string
  boardId: string
  boardName: string
  taskId: number
  taskTitle: string
  release: string
  revision: string
  kind: 'ready_for_review' | 'question'
  decision: 'implement' | 'answer'
  questions: CloudEvent['questions']
  fingerprint: string
}

/** Retire an event whose task stopped being one this board raises events for. Refused when
 *  an action is already on record — that event has a delivery to report on. */
export const retireEvent = (opId: string, eventId: string): Promise<CloudCall<{ event: CloudEvent }>> =>
  send('POST', `/v1/events/${encodeURIComponent(eventId)}/retire`, { opId })

/** Every event this account has that is not finished — the durable catch-up read every start
 *  and reconnect does before listening for hints. */
export const listEvents = (): Promise<CloudCall<{ events: CloudEvent[] }>> => send('GET', '/v1/events')

/** One event, by id — what a Realtime hint is resolved through. */
export const readEvent = (eventId: string): Promise<CloudCall<{ event: CloudEvent }>> =>
  send('GET', `/v1/events/${encodeURIComponent(eventId)}`)

/** Record the one durable action an event may carry. The Worker refuses a second, and
 *  refuses one against a revision that has moved. */
export const recordAction = (body: {
  opId: string
  eventId: string
  decision: 'implement' | 'answer'
  revision: string
  answers: CloudEventAnswer[]
  /** `accepted` for an action taken on this machine; #318's server is what produces
   *  `waiting_for_server`. */
  state: 'accepted' | 'waiting_for_server'
}): Promise<CloudCall<{ event: CloudEvent }>> =>
  send('POST', `/v1/events/${encodeURIComponent(body.eventId)}/action`, body)

/** How the delivery an action started ended. */
export const recordOutcome = (
  opId: string,
  eventId: string,
  outcome: CloudEventState,
): Promise<CloudCall<{ event: CloudEvent }>> =>
  send('POST', `/v1/events/${encodeURIComponent(eventId)}/outcome`, { opId, outcome })

async function send<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<CloudCall<T>> {
  if (!cloudConfigured()) return { ok: false, error: NOT_CONFIGURED, code: 'bad_request' }

  const token = await accessToken()
  if (!token.ok) {
    return token.reason === 'unreachable'
      ? { ok: false, error: `Cloud could not be reached: ${token.error}` }
      : { ok: false, error: 'This machine is not signed in to Cloud.', code: 'unauthenticated' }
  }

  let response: Response
  try {
    response = await fetch(`${cloudEndpoints().api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token.token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (e) {
    return { ok: false, error: `Cloud could not be reached: ${e instanceof Error ? e.message : String(e)}` }
  }

  const parsed = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string }
  }
  if (response.ok) return { ok: true, value: parsed }
  return {
    ok: false,
    code: parsed.error?.code,
    error: parsed.error?.message ?? `Cloud answered ${response.status}.`,
  }
}
