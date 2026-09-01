/**
 * The workspace a Cloud board lives in (#314).
 *
 * One trusted place that decides what may change and in what order. Every route here is
 * behind #326's admission check and then behind the workspace's own: `cloud.workspace_for`
 * in the migration is the whole of it, and a workspace that is not the caller's and one that
 * has been deleted meet the same refusal, so nothing leaks whether a workspace ever existed.
 *
 * Like every other route in this service, one call is one `api` function and therefore one
 * transaction: authorization, lifecycle rules, operation uniqueness and the expected revision
 * are checked, the change is applied, revisions advance and an audit event is appended — all
 * of it or none of it. The Worker's job is the SHAPE of the request; the rules that have to
 * hold against two machines calling at once are the migration's.
 */

import { MAX_CARDS_PER_WRITE, NODE_LEASE_SECONDS } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, notFound } from './errors.ts'
import { bodyOf, json, requireMethod } from './http.ts'
import { runtimes, shortName, uuid } from './input.ts'
import type { ServerRuntime } from './input.ts'
import type { Owner } from './owner.ts'

/** A board stored in Cloud. `revision` moves on every mutation, so a client holding one can
 *  tell the board changed without reading it back. */
export interface Workspace {
  id: string
  ownerId: string
  name: string
  revision: string
  /** The next card number the board has free. Import carries a board's own numbers in. */
  nextCardId: number
  createdAt: string
  updatedAt: string
}

/** One card, under the small integer the board already calls it by. What `data` holds is
 *  #315's; the control plane stores it whole and reads nothing out of it. */
export interface WorkspaceCard {
  id: number
  revision: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** A machine registered to run this workspace's work. */
export interface WorkspaceNode {
  id: string
  workspaceId: string
  name: string
  machineId: string
  machineName: string
  runtimes: ServerRuntime[]
  leaseExpiresAt: string | null
  live: boolean
}

/** One delivery attempt, under an id the service allocated. */
export interface DeliveryAttempt {
  id: string
  workspaceId: string
  cardId: number
  nodeId: string | null
  state: 'open' | 'completed' | 'failed' | 'cancelled'
  detail: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** One line of the trail: what was done, by whom, and from which machine. */
export interface AuditEvent {
  id: number
  accountId: string | null
  handle: string
  nodeId: string | null
  action: string
  cardId: number | null
  detail: Record<string, unknown>
  at: string
}

/** How a delivery attempt may end. `open` is where it starts, never where it stops. */
const OUTCOMES = ['completed', 'failed', 'cancelled']

// ---- the workspace itself ---------------------------------------------------

/** Make one. Any admitted account may, and there is no cap: #326's list bounds who reaches
 *  the service at all, so a second refusal here would turn the same people away twice. */
export async function createWorkspace(env: Env, owner: Owner, body: unknown): Promise<{ workspace: Workspace }> {
  const input = held(body)
  return {
    workspace: await mutate<Workspace>(env, 'create_workspace', {
      p_subject: owner.accountId,
      // Optional, unlike every other mutation's: the ledger that would deduplicate a retry
      // lives inside the workspace this call is making. The workspace row carries it instead.
      p_op_id: typeof input.opId === 'string' ? opId(input.opId) : '',
      p_name: shortName(input.name),
    }),
  }
}

export async function listWorkspaces(env: Env, owner: Owner): Promise<{ workspaces: Workspace[] }> {
  const workspaces = await call<Workspace[]>(env, 'list_workspaces', { p_subject: owner.accountId })
  return { workspaces: workspaces ?? [] }
}

export async function readWorkspace(env: Env, owner: Owner, id: string): Promise<{ workspace: Workspace }> {
  return {
    workspace: await call<Workspace>(env, 'read_workspace', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
    }),
  }
}

export async function renameWorkspace(env: Env, owner: Owner, id: string, body: unknown): Promise<{ workspace: Workspace }> {
  const input = held(body)
  return {
    workspace: await mutate<Workspace>(env, 'rename_workspace', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: node(input.nodeId),
      p_expect: revision(input.expect),
      p_name: shortName(input.name),
    }),
  }
}

/**
 * Delete the workspace and everything in it, inside this call. No grace window, no
 * deleted-but-answering state, and nothing left to restore from — the owner's export is the
 * only copy anyone can restore from, which is what #321's privacy page promises.
 *
 * The confirmation is the caller's: #317 is what asks a person whether they mean it.
 */
export async function deleteWorkspace(env: Env, owner: Owner, id: string): Promise<{ deleted: true; workspaceId: string; name: string }> {
  return await call(env, 'delete_workspace', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
}

// ---- cards ------------------------------------------------------------------

export async function readCards(env: Env, owner: Owner, id: string): Promise<{ revision: string; cards: WorkspaceCard[] }> {
  return await call(env, 'read_cards', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
}

/**
 * Write one card or twenty, in one transaction. Every expected revision is checked before
 * anything is written, so the operation commits whole or changes nothing.
 *
 * An entry naming no id is given the next number the board has free; one naming an id the
 * workspace does not hold keeps that number, which is what lets #315's import carry a board's
 * own numbering in unchanged.
 */
export async function writeCards(env: Env, owner: Owner, id: string, body: unknown): Promise<{ revision: string; cards: WorkspaceCard[] }> {
  const input = held(body)
  return await mutate(env, 'write_cards', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_node: node(input.nodeId),
    p_cards: cards(input.cards),
  })
}

export async function readAudit(env: Env, owner: Owner, id: string, limit: string | null): Promise<{ events: AuditEvent[] }> {
  const events = await call<AuditEvent[]>(env, 'read_audit', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_limit: Number.parseInt(limit ?? '', 10) || 100,
  })
  return { events: events ?? [] }
}

// ---- the workspace's execution nodes ----------------------------------------

/** A machine registers itself the first time it opens the workspace. Idempotent on the
 *  machine id, and free when nothing about the machine moved. */
export async function registerNode(env: Env, owner: Owner, id: string, body: unknown): Promise<{ node: WorkspaceNode }> {
  const input = held(body)
  return {
    node: await mutate<WorkspaceNode>(env, 'register_node', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_machine: uuid(input.machineId, 'machine'),
      p_machine_name: shortName(input.machineName),
      p_runtimes: runtimes(input.runtimes),
    }),
  }
}

export async function listNodes(env: Env, owner: Owner, id: string): Promise<{ nodes: WorkspaceNode[] }> {
  const nodes = await call<WorkspaceNode[]>(env, 'list_nodes', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
  return { nodes: nodes ?? [] }
}

export async function renameNode(env: Env, owner: Owner, id: string, nodeId: string, body: unknown): Promise<{ node: WorkspaceNode }> {
  const input = held(body)
  return {
    node: await mutate<WorkspaceNode>(env, 'rename_node', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: uuid(nodeId, 'node'),
      p_name: shortName(input.name),
    }),
  }
}

/** Take a machine off the workspace. Its next renewal, write and delivery confirmation are
 *  all refused after this. */
export async function removeNode(env: Env, owner: Owner, id: string, nodeId: string, body: unknown): Promise<{ removed: true; nodeId: string }> {
  const input = held(body)
  return await mutate(env, 'remove_node', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_node: uuid(nodeId, 'node'),
  })
}

/** A node saying it is still there. The lease is the SERVICE's, never one a client asked for. */
export async function renewNode(env: Env, owner: Owner, id: string, nodeId: string): Promise<{ node: WorkspaceNode }> {
  return {
    node: await mutate<WorkspaceNode>(env, 'renew_node', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_node: uuid(nodeId, 'node'),
      p_lease_seconds: NODE_LEASE_SECONDS,
    }),
  }
}

// ---- delivery attempts ------------------------------------------------------

export async function openDelivery(env: Env, owner: Owner, id: string, body: unknown): Promise<{ delivery: DeliveryAttempt }> {
  const input = held(body)
  return {
    delivery: await mutate<DeliveryAttempt>(env, 'open_delivery', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: node(input.nodeId),
      p_card: cardId(input.cardId),
    }),
  }
}

export async function confirmDelivery(env: Env, owner: Owner, id: string, deliveryId: string, body: unknown): Promise<{ delivery: DeliveryAttempt }> {
  const input = held(body)
  const outcome = typeof input.outcome === 'string' ? input.outcome : ''
  if (!OUTCOMES.includes(outcome)) {
    throw badRequest(`A delivery ends as ${OUTCOMES.join(', ')} — never as “${outcome}”.`)
  }
  return {
    delivery: await mutate<DeliveryAttempt>(env, 'confirm_delivery', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: node(input.nodeId),
      p_delivery: uuid(deliveryId, 'delivery'),
      p_outcome: outcome,
      p_detail: plain(input.detail),
    }),
  }
}

// ---- the routes -------------------------------------------------------------

/**
 * Everything under `/v1/workspaces`, dispatched here rather than as a dozen patterns in
 * `index.ts`: the workspace surface is one thing, and its routes read as a list when they sit
 * together. The caller is already an admitted account — `requireOwner` ran before this.
 */
export async function routeWorkspace(env: Env, owner: Owner, request: Request, url: URL, path: string): Promise<Response> {
  const [id = '', section = '', name = '', move = '', ...rest] = path.split('/')
  // A move is the last thing a path says. Anything after it is a path this service does
  // not have, and answering it would let `…/delete/typo` remove a workspace for good.
  if (rest.length) throw notFound()

  if (!id) {
    if (request.method === 'GET') return json(await listWorkspaces(env, owner))
    requireMethod(request, 'POST')
    return json(await createWorkspace(env, owner, await bodyOf(request)))
  }

  if (!section) {
    requireMethod(request, 'GET')
    return json(await readWorkspace(env, owner, id))
  }

  if ((section === 'rename' || section === 'delete') && !name) {
    requireMethod(request, 'POST')
    return json(
      section === 'delete'
        ? await deleteWorkspace(env, owner, id)
        : await renameWorkspace(env, owner, id, await bodyOf(request)),
    )
  }

  if (section === 'cards' && !name) {
    if (request.method === 'GET') return json(await readCards(env, owner, id))
    requireMethod(request, 'POST')
    return json(await writeCards(env, owner, id, await bodyOf(request)))
  }

  if (section === 'audit' && !name) {
    requireMethod(request, 'GET')
    return json(await readAudit(env, owner, id, url.searchParams.get('limit')))
  }

  if (section === 'nodes' && !name) {
    if (request.method === 'GET') return json(await listNodes(env, owner, id))
    requireMethod(request, 'POST')
    return json(await registerNode(env, owner, id, await bodyOf(request)))
  }

  if (section === 'nodes' && (move === 'rename' || move === 'remove' || move === 'renew')) {
    requireMethod(request, 'POST')
    if (move === 'renew') return json(await renewNode(env, owner, id, name))
    const body = await bodyOf(request)
    return json(
      move === 'rename'
        ? await renameNode(env, owner, id, name, body)
        : await removeNode(env, owner, id, name, body),
    )
  }

  if (section === 'deliveries' && (!name || move === 'confirm')) {
    requireMethod(request, 'POST')
    const body = await bodyOf(request)
    return json(
      name ? await confirmDelivery(env, owner, id, name, body) : await openDelivery(env, owner, id, body),
    )
  }

  throw notFound()
}

// ---- what a body has to be --------------------------------------------------

const held = (body: unknown): Record<string, unknown> => (body ?? {}) as Record<string, unknown>

/** The attempt this call is. #312 mints one per attempt, and it is what makes a retry
 *  answerable, so a mutation that carries none is refused rather than silently unrepeatable. */
function opId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim().slice(0, 200) : ''
  if (!id) throw badRequest('That change names no attempt.')
  return id
}

/** The machine a call was made from, where it names one. The owner acting in the app names
 *  none, and a node that was removed is refused by the database rather than here. */
const node = (value: unknown): string | null =>
  value === undefined || value === null || value === '' ? null : uuid(value, 'node')

/** The revision the caller read, as it travels: opaque, and `''` for a card that does not
 *  exist yet — #312's NO_REVISION, what a create expects to find. */
function revision(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw badRequest('That change names no revision.')
  return value.trim().slice(0, 64)
}

function cardId(value: unknown): number {
  const id = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isSafeInteger(id) || id < 1) throw badRequest('That request names no card.')
  return id
}

/** `[{ id, expect, data }, ...]`, capped so one call cannot grow a transaction without
 *  bound. An entry naming no id is a card the board has not numbered yet. */
function cards(value: unknown): { id: number | null; expect: string; data: Record<string, unknown> }[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('That write names no card.')
  if (value.length > MAX_CARDS_PER_WRITE) {
    throw badRequest(`One write carries at most ${MAX_CARDS_PER_WRITE} cards. Send the rest in another.`)
  }
  return value.map((entry) => {
    const card = held(entry)
    return {
      id: card.id === undefined || card.id === null ? null : cardId(card.id),
      expect: revision(card.expect),
      data: plain(card.data),
    }
  })
}

/** A JSON object, or an empty one. Never an array or a bare value: a row's `data` is a
 *  record, and taking anything else would store a shape nothing can read back. */
function plain(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest('That change carries no object.')
  return value as Record<string, unknown>
}
