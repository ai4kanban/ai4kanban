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

/**
 * What one call answered with.
 *
 * A refusal carries the service's own `code` and `message`, and the two fields a workspace
 * refusal adds: `current`, the revision the resource holds now, and `until`, when the writer
 * holding a card gives it up (#316). A refusal with NO code never reached the service — that
 * is what "offline" means here, and nothing probes for it separately.
 */
export type CloudCall<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code?: string; current?: string; until?: string }

/** Whether this call never reached the service, as against being refused by it. */
export const isOffline = (call: { ok: boolean; code?: string }): boolean => !call.ok && !call.code

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
  // The workspace's own refusals (#316). Each is an answer the caller acts on: re-read that
  // card, wait for the writer holding it, register this machine again, mint a new attempt,
  // or show the free-tier sentence as it stands. Retrying any of them changes nothing.
  'revision_conflict',
  'card_locked',
  'node_removed',
  'operation_reused',
  'daily_write_budget_reached',
  'storage_limit_reached',
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

/** Write cards, in passes small enough that one call can be retried. Answers with each card
 *  as the workspace now holds it, so a caller folds the revisions it was handed back into
 *  its own copy rather than re-reading the board (#316). */
export const writeWorkspaceCards = (
  workspaceId: string,
  opId: string,
  cards: WireCard[],
  nodeId = '',
): Promise<CloudCall<{ revision: string; cards: WireWorkspaceCard[] }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/cards`, { opId, cards, nodeId })

/** Write the board's files — its configuration, memory, per-flow rules, summaries and
 *  tallies. An empty body deletes one. */
export const writeWorkspaceDocuments = (
  workspaceId: string,
  opId: string,
  documents: WireDocument[],
  nodeId = '',
  lease = '',
): Promise<CloudCall<{ revision: string; documents: WireWorkspaceDocument[] }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/documents`, {
    opId,
    documents,
    nodeId,
    lease,
  })

// ---- reading a workspace (#316) ---------------------------------------------
// What a board opened from a checkout hydrates its copy from, and the pieces it re-reads
// afterwards. The snapshot is the LIVE board; the archive and the history files are their
// own reads, because this board holds three times as many archived cards as live ones.

/** The whole live board under one cursor: the workspace, its live cards, and the documents
 *  that are the board being worked on now. */
export const readWorkspaceSnapshot = (
  workspaceId: string,
  opts?: SendOptions,
): Promise<CloudCall<WireSnapshot>> =>
  send('GET', `/v1/workspaces/${encodeURIComponent(workspaceId)}/snapshot`, undefined, opts)

/** One card, by its number — what a conflict is re-read through. */
export const readWorkspaceCard = (
  workspaceId: string,
  cardId: number,
): Promise<CloudCall<{ revision: string; card: WireWorkspaceCard }>> =>
  send('GET', `/v1/workspaces/${encodeURIComponent(workspaceId)}/cards/${cardId}`)

/** The cards that have left the board. Never in a snapshot; closing a release is what
 *  fetches it. */
export const readWorkspaceArchive = (
  workspaceId: string,
): Promise<CloudCall<{ revision: string; cards: WireWorkspaceCard[] }>> =>
  send('GET', `/v1/workspaces/${encodeURIComponent(workspaceId)}/archive`)

/** The board's files, all of them or one kind. */
export const readWorkspaceDocuments = (
  workspaceId: string,
  kind = '',
  opts?: SendOptions,
): Promise<CloudCall<{ revision: string; documents: WireWorkspaceDocument[] }>> =>
  send(
    'GET',
    `/v1/workspaces/${encodeURIComponent(workspaceId)}/documents${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`,
    undefined,
    opts,
  )

// ---- the workspace's writer lock --------------------------------------------

/** Take the lock over one card, or over the board when no card is named, and be handed the
 *  revision it reads at. Presenting the lease it was granted under takes it again. */
export const takeWorkspaceLock = (
  workspaceId: string,
  target: { cardId?: number; nodeId?: string; lease?: string },
): Promise<CloudCall<{ lock: WireLock }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/locks`, {
    cardId: target.cardId ?? null,
    nodeId: target.nodeId ?? '',
    lease: target.lease ?? '',
  })

/** Give it up before it runs out. Silent about a lock this caller does not hold. */
export const releaseWorkspaceLock = (
  workspaceId: string,
  target: { cardId?: number; lease: string },
): Promise<CloudCall<{ released: boolean }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/locks/release`, {
    cardId: target.cardId ?? null,
    lease: target.lease,
  })

/** Every lock the workspace is holding right now. */
export const listWorkspaceLocks = (workspaceId: string): Promise<CloudCall<{ locks: WireLock[] }>> =>
  send('GET', `/v1/workspaces/${encodeURIComponent(workspaceId)}/locks`)

// ---- this machine, as one of the workspace's nodes ---------------------------

/** Register this machine the first time it opens the workspace, so its writes are
 *  attributed and #317's node controls have something to list. Idempotent on the machine
 *  id. */
export const registerWorkspaceNode = (
  workspaceId: string,
  machineId: string,
  machineName: string,
  runtimes: ServerRuntime[] = [],
): Promise<CloudCall<{ node: WireNode }>> =>
  send('POST', `/v1/workspaces/${encodeURIComponent(workspaceId)}/nodes`, {
    machineId,
    machineName,
    runtimes,
  })

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

/** One card as the workspace holds it. `data` is what the machine that wrote it sent — the
 *  card's path, its portable frontmatter and its body. */
export interface WireWorkspaceCard {
  id: number
  revision: string
  archived: boolean
  archivedAt: string | null
  data: Partial<CardPayload>
}

/** One board file as the workspace holds it, under the path it is written back to. */
export interface WireWorkspaceDocument extends DocumentPayload {
  revision: string
}

/** The whole live board under one cursor. The archive and the history files are their own
 *  reads — a snapshot is the board somebody is working on now. */
export interface WireSnapshot {
  revision: string
  workspace: CloudWorkspace
  cards: WireWorkspaceCard[]
  documents: WireWorkspaceDocument[]
}

/** The lock one writer holds over a card, or over the board. `revision` is what that
 *  resource read at when the lock was granted. */
export interface WireLock {
  leaseId: string
  cardId: number | null
  revision: string
  grantedAt: string
  expiresAt: string
}

/** A machine registered to run this workspace's work. */
export interface WireNode {
  id: string
  workspaceId: string
  name: string
  machineId: string
  machineName: string
  runtimes: ServerRuntime[]
  leaseExpiresAt: string | null
  live: boolean
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

/** How long one call may take before it counts as a service that is not answering. Named
 *  by the caller that needs a short one: a board opening offline retries the workspace on
 *  every read, and a service that hangs must not hang the screen (#316).
 *
 *  `signal` is the same deadline shared across several calls — a read made of three calls
 *  bounds the three together, or a service that answers the first and then stops would
 *  still hang for as long as the other two are given. */
export interface SendOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

async function send<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  opts: SendOptions = {},
): Promise<CloudCall<T>> {
  if (!cloudConfigured()) return { ok: false, error: NOT_CONFIGURED, code: 'bad_request' }

  const token = await accessToken()
  if (!token.ok) {
    return token.reason === 'unreachable'
      ? { ok: false, error: `Cloud could not be reached: ${token.error}` }
      : { ok: false, error: 'This machine is not signed in to Cloud.', code: 'unauthenticated' }
  }

  let response: Response
  const stop = opts.signal ?? (opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined)
  try {
    response = await fetch(`${cloudEndpoints().api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token.token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...(stop ? { signal: stop } : {}),
    })
  } catch (e) {
    return { ok: false, error: `Cloud could not be reached: ${e instanceof Error ? e.message : String(e)}` }
  }

  const parsed = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string; current?: string; until?: string }
  }
  if (response.ok) return { ok: true, value: parsed }
  return {
    ok: false,
    code: parsed.error?.code,
    error: parsed.error?.message ?? `Cloud answered ${response.status}.`,
    // What a workspace refusal carries beside its sentence: the revision the resource holds
    // now, and when the writer holding a card gives it up. Dropping them would leave the
    // caller with a message where it needs a card to re-read (#316).
    ...(parsed.error?.current === undefined ? {} : { current: parsed.error.current }),
    ...(parsed.error?.until === undefined ? {} : { until: parsed.error.until }),
  }
}
