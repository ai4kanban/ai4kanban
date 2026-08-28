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
import type { CloudRequest } from './requests'
import type { CloudServer, ServerRuntime } from './servers'
import { accessToken } from './session'
import type { SlackConnection, SlackConversation } from './types'

export type CloudCall<T> = { ok: true; value: T } | { ok: false; error: string; code?: string }

/** Refusals a caller acts on rather than retries. Everything else is worth another go. */
export const TERMINAL_CODES = [
  'bad_request',
  'not_admitted',
  'not_yours',
  'not_found',
  'stale_revision',
  'already_acted',
  // A board attaches exactly one server (#318). Retrying cannot change whose it is; the
  // user moves it or leaves it where it is.
  'server_elsewhere',
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
  /** The card's opening paragraph and its review notes, bounded by the publisher (#320) —
   *  what a Slack message is reviewed from while this machine is off. */
  summary: string
  notes: string
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

/** How the delivery an action started ended. `reason` is what a refused request carries onto
 *  its `failed`, so a refused approval and a broken build never read as one outcome (#318). */
export const recordOutcome = (
  opId: string,
  eventId: string,
  outcome: CloudEventState,
  reason = '',
): Promise<CloudCall<{ event: CloudEvent }>> =>
  send('POST', `/v1/events/${encodeURIComponent(eventId)}/outcome`, { opId, outcome, reason })

// ---- the board's server, and the requests it claims (#318) ------------------

/** Register this machine as the board's one server, and say what it runs the board's
 *  runtimes as (#345). `takeOver` is the user moving the board to the machine in front of
 *  them; without it a second machine is refused and told which one holds it. */
export const attachServer = (
  boardId: string,
  machineId: string,
  machineName: string,
  takeOver = false,
  runtimes: ServerRuntime[] = [],
): Promise<CloudCall<{ server: CloudServer }>> =>
  send('POST', `/v1/boards/${encodeURIComponent(boardId)}/server`, { machineId, machineName, takeOver, runtimes })

/** Stop this machine running that board's work. Nothing local is touched. */
export const detachServer = (boardId: string, machineId: string): Promise<CloudCall<{ server: CloudServer | null }>> =>
  send('POST', `/v1/boards/${encodeURIComponent(boardId)}/server/detach`, { machineId })

/** Which machine runs each of this account's boards. */
export const listServers = (): Promise<CloudCall<{ servers: CloudServer[] }>> =>
  send('GET', '/v1/servers')

/** What this server has to do — the durable catch-up read every start and reconnect makes. */
export const listRequests = (serverId: string): Promise<CloudCall<{ requests: CloudRequest[] }>> =>
  send('GET', `/v1/servers/${encodeURIComponent(serverId)}/requests`)

/** Take one request, or be told why not. A refusal is an answer: its words go onto the
 *  event's `failed`. */
export const claimRequest = (
  requestId: string,
  serverId: string,
): Promise<CloudCall<{ claimed: boolean; reason?: string; request?: CloudRequest }>> =>
  send('POST', `/v1/requests/${encodeURIComponent(requestId)}/claim`, { serverId })

/** Hold the claim while the delivery is live on this machine. */
export const renewClaim = (requestId: string, serverId: string): Promise<CloudCall<{ renewed: boolean }>> =>
  send('POST', `/v1/requests/${encodeURIComponent(requestId)}/renew`, { serverId })

// ---- the account's Slack destination (#320) ---------------------------------
// One connection per account, made in Configuration → Cloud. Every call here is the signed-
// in machine talking about its own account; the presses that come back the other way are
// Slack's own request to the service and never touch this board.

/** The consent screen to open in the user's own browser. Slack answers the service, which
 *  hands the browser back to the app on its URL scheme. */
export const startSlackInstall = (): Promise<CloudCall<{ url: string }>> =>
  send('POST', '/v1/slack/install')

/** The connection this account holds, and whether the service carries a Slack app at all. */
export const readSlackConnection = (): Promise<
  CloudCall<{ connection: SlackConnection | null; configured: boolean }>
> => send('GET', '/v1/slack/connection')

/** The conversations a destination can be pointed at — the channels the app can reach, and
 *  the direct message with whoever connected. */
export const listSlackConversations = (): Promise<CloudCall<{ conversations: SlackConversation[] }>> =>
  send('GET', '/v1/slack/conversations')

/** Point it somewhere. Picking again is also how a refusal is cleared. */
export const setSlackDestination = (
  channelId: string,
  channelName: string,
): Promise<CloudCall<{ connection: SlackConnection }>> =>
  send('POST', '/v1/slack/destination', { channelId, channelName })

/** End it. No board is touched and every event goes on exactly as it was. */
export const disconnectSlack = (): Promise<CloudCall<{ disconnected: true }>> =>
  send('POST', '/v1/slack/disconnect')

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
