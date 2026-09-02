// Every durable Cloud call this board makes, over plain `fetch` (#319).
//
// No Realtime client is loaded here and none is needed: durable reads, writes and actions
// go through the Worker, and Realtime carries only the identifiers of what the Worker
// already stored. That is what lets a terminal `akb` publish on Node 18 with no socket at
// all — see ./live.ts for the connection the app alone opens.
//
// Every call answers rather than throwing. A publisher that threw would make a board write
// fail over a network the board was never waiting for.

import type { CardPayload, DeliveryPayload, DocumentPayload, EventPayload } from '../board/transfer'
import { cloudConfigured, cloudEndpoints, NOT_CONFIGURED } from './config'
import type { CloudEvent, CloudEventAnswer, CloudEventState } from './events'
import type { CloudRequest } from './requests'
import type { CloudServer, ServerRuntime } from './servers'
import { accessToken } from './session'
import type {
  LarkChat,
  LarkCloud,
  LarkCloudOffer,
  LarkConnection,
  SlackConnection,
  SlackConversation,
} from './types'

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
  // An import pointed at a workspace that already holds a board (#315). Retrying it lands
  // on the same board; the answer is a new workspace.
  'board_not_empty',
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

// ---- the workspace a Cloud board lives in (#315) ----------------------------
// The board's own content, not the notifications half above: a workspace holds the cards,
// the memory set, the board's configuration, its history and its deliveries. #316 builds the
// provider that draws a board from these; what is here is what import and export need.

/** Every workspace this account has. */
export const listWorkspaces = (): Promise<CloudCall<{ workspaces: CloudWorkspace[] }>> =>
  send('GET', '/v1/workspaces')

/** Make one. `opId` names the attempt, so a create whose reply was lost finds the same
 *  workspace rather than leaving a second empty one behind. */
export const createWorkspace = (opId: string, name: string): Promise<CloudCall<{ workspace: CloudWorkspace }>> =>
  send('POST', '/v1/workspaces', { opId, name })

/** Write cards, in passes small enough that one call can be retried. */
export const writeWorkspaceCards = (
  workspaceId: string,
  opId: string,
  cards: WireCard[],
): Promise<CloudCall<{ revision: string }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/cards`, { opId, cards })

/** Write the board's files — its configuration, memory, per-flow rules, summaries and
 *  tallies. An empty body deletes one. */
export const writeWorkspaceDocuments = (
  workspaceId: string,
  opId: string,
  documents: WireDocument[],
): Promise<CloudCall<{ revision: string }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/documents`, { opId, documents })

/** Claim a new workspace for one source board, by the fingerprint the machine derived from
 *  it. A workspace already holding a board is refused unless it holds this one. */
export const beginImport = (
  workspaceId: string,
  opId: string,
  fingerprint: string,
): Promise<CloudCall<ImportState>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/import/begin`, { opId, fingerprint })

/** One pass of the source board's own history. Each row carries its own key, so a retried
 *  pass finds its own work rather than appending it again. */
export const importEvents = (
  workspaceId: string,
  opId: string,
  events: EventPayload[],
): Promise<CloudCall<{ added: number }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/import/events`, { opId, events })

/** The source board's finished deliveries, arriving whole rather than through the
 *  open-and-confirm pair a live one goes through. Idempotent on the id the source board gave
 *  each of them. */
export const importDeliveries = (
  workspaceId: string,
  opId: string,
  deliveries: WireDelivery[],
): Promise<CloudCall<{ added: number }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/import/deliveries`, { opId, deliveries })

/** One finished delivery on the wire, under the id the source board gave it. */
export interface WireDelivery {
  sourceId: string
  cardId: number
  state: string
  record: Record<string, unknown>
  approved: string
  finalBody: string
}

export const finishImport = (
  workspaceId: string,
  opId: string,
  nextCardId: number,
): Promise<CloudCall<ImportState>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/import/finish`, { opId, nextCardId })

/** Everything a standalone markdown board is made of. The trail comes beside it, paged. */
export const exportBoard = (workspaceId: string): Promise<CloudCall<WireExport>> =>
  send('GET', `/v1/workspaces/${encodeURIComponent(workspaceId)}/export`)

/** The trail in the order it happened, from where the last page stopped. */
export const exportEvents = (
  workspaceId: string,
  after: number,
  limit: number,
): Promise<CloudCall<{ events: WireEvent[] }>> =>
  send('GET', `/v1/workspaces/${encodeURIComponent(workspaceId)}/export/events?after=${after}&limit=${limit}`)

/** A board stored in Cloud. `revision` moves on every write, so a client holding one can
 *  tell the board changed without reading it back. */
export interface CloudWorkspace {
  id: string
  name: string
  revision: string
  nextCardId: number
  createdAt: string
  updatedAt: string
}

/** One card on the wire: its number, the revision the caller read, and the card itself. */
export interface WireCard {
  id: number | null
  expect: string
  archived?: boolean
  lease?: string
  data: Pick<CardPayload, 'path' | 'meta' | 'body'>
}

/** One document on the wire: where it is written back to, and the revision the caller read.
 *  A resumed import writes each file against what the workspace already holds. */
export type WireDocument = DocumentPayload & { expect: string }

/** Where an import stands, and what the workspace holds. */
export interface ImportState {
  fingerprint?: string
  resuming?: boolean
  workspace?: CloudWorkspace
  held: { cards: number; documents: number; events: number; deliveries: number }
}

/** One line of the workspace's trail, as an export reads it. */
export interface WireEvent {
  id: number
  handle: string
  action: string
  cardId: number | null
  detail: Record<string, unknown>
  at: string
  importKey: string | null
}

/** A whole board, read back. `cards` carries the archive as well as the live board, and each
 *  row carries the revision it is at — what a resumed import writes against. */
export interface WireExport {
  revision: string
  workspace: CloudWorkspace
  cards: { id: number; archived: boolean; revision: string; data: Partial<CardPayload> }[]
  documents: (DocumentPayload & { revision?: string })[]
  // The workspace names a delivery by its own row id; the id the machine that ran it gave it
  // lives inside `record`, so an export has to put it back before writing the file.
  deliveries: (Omit<DeliveryPayload, 'deliveryId'> & { id: string })[]
}

// ---- the account's Slack destination (#320) ---------------------------------
// One connection per account, made in Configuration → Notifications. Every call here is the signed-
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

// ---- the account's Lark destination (#351) ----------------------------------
// The same shape as Slack's above, with one difference: connecting names a cloud, because
// 飞书 and Lark international are two platforms that list two apps.

/** The consent screen to open in the user's own browser, for one cloud. */
export const startLarkConnect = (cloud: LarkCloud): Promise<CloudCall<{ url: string }>> =>
  send('POST', `/v1/lark/${cloud}/connect`)

/** The connection this account holds, and which clouds the service carries an app for. */
export const readLarkConnection = (): Promise<
  CloudCall<{ connection: LarkConnection | null; clouds: LarkCloudOffer[] }>
> => send('GET', '/v1/lark/connection')

/** The chats a destination can be pointed at — the groups the bot is in, and the direct
 *  message with whoever connected. */
export const listLarkChats = (): Promise<CloudCall<{ chats: LarkChat[] }>> =>
  send('GET', '/v1/lark/chats')

/** Point it somewhere. Picking again is also how a refusal is cleared. */
export const setLarkDestination = (
  destinationId: string,
  destinationName: string,
  direct: boolean,
): Promise<CloudCall<{ connection: LarkConnection }>> =>
  send('POST', '/v1/lark/destination', { destinationId, destinationName, direct })

/** End it. No board is touched and every event goes on exactly as it was. */
export const disconnectLark = (): Promise<CloudCall<{ disconnected: true }>> =>
  send('POST', '/v1/lark/disconnect')

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
