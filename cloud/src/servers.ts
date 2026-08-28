/**
 * The board's server, and the requests it claims (#318).
 *
 * #319's action assumed the person pressing it was at the machine holding the board. These
 * routes are what lets it be pressed anywhere: a machine registers as a board's one server,
 * and an action taken somewhere else becomes a durable request that server claims, runs
 * locally and reports back.
 *
 * Like every other route here, one call is one database function, which is one transaction.
 * The Worker's job is the shape of the request and the owner check; the claim's own rules —
 * one server per board, one claim per request, an expired lease reading as interrupted —
 * are the migration's, because they have to hold against two machines calling at once.
 */

import { CLAIM_LEASE_SECONDS } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, notFound } from './errors.ts'
import type { Owner } from './owner.ts'

/** A machine registered against one board. */
export interface ServerRow {
  id: string
  boardId: string
  machineId: string
  machineName: string
  enabled: boolean
}

/** One job waiting for a board's server, with everything it needs to run it. */
export interface RequestRow {
  id: string
  boardId: string
  eventId: string
  serverId: string | null
  claimedBy: string | null
  state: 'waiting' | 'claimed' | 'finished' | 'interrupted'
  leaseExpiresAt: string | null
  taskId: number
  taskTitle: string
  revision: string
  decision: 'implement' | 'answer'
  answers: unknown[]
  questions: unknown[]
}

/** What a claim answers with: the request, or why this machine may not have it. */
export type ClaimResult = { claimed: true; request: RequestRow } | { claimed: false; reason: string }

/** Register this machine as the board's one server. `takeOver` is the user moving the board
 *  to the machine in front of them; without it a second machine is refused. */
export async function attachServer(env: Env, owner: Owner, boardId: string, body: unknown): Promise<{ server: ServerRow }> {
  const input = (body ?? {}) as Record<string, unknown>
  const server = await mutate<ServerRow | null>(env, 'attach_server', {
    p_subject: owner.accountId,
    p_board: uuid(boardId, 'board'),
    p_machine: uuid(input.machineId, 'machine'),
    p_machine_name: typeof input.machineName === 'string' ? input.machineName.slice(0, 200) : '',
    p_take_over: input.takeOver === true,
  })
  if (!server) throw notFound()
  return { server }
}

/** Stop this machine running a board's work. The local board is untouched. */
export async function detachServer(env: Env, owner: Owner, boardId: string, body: unknown): Promise<{ server: ServerRow | null }> {
  const input = (body ?? {}) as Record<string, unknown>
  const server = await mutate<ServerRow | null>(env, 'detach_server', {
    p_subject: owner.accountId,
    p_board: uuid(boardId, 'board'),
    p_machine: uuid(input.machineId, 'machine'),
  })
  return { server: server ?? null }
}

/** Which machine runs each of this account's boards. */
export async function listServers(env: Env, owner: Owner): Promise<{ servers: ServerRow[] }> {
  const servers = await call<ServerRow[]>(env, 'list_servers', { p_subject: owner.accountId })
  return { servers: servers ?? [] }
}

/** What this server has to do — the catch-up read every start and reconnect makes. */
export async function listRequests(env: Env, owner: Owner, serverId: string): Promise<{ requests: RequestRow[] }> {
  const requests = await call<RequestRow[]>(env, 'list_requests', {
    p_subject: owner.accountId,
    p_server: uuid(serverId, 'server'),
  })
  return { requests: requests ?? [] }
}

/** Take one request, or say why not. A refusal is an answer, not an error: the server
 *  carries its words onto the event's `failed` outcome. */
export function claimRequest(env: Env, owner: Owner, requestId: string, body: unknown): Promise<ClaimResult> {
  const input = (body ?? {}) as Record<string, unknown>
  return mutate<ClaimResult>(env, 'claim_request', {
    p_subject: owner.accountId,
    p_server: uuid(input.serverId, 'server'),
    p_request: uuid(requestId, 'request'),
    p_lease_seconds: CLAIM_LEASE_SECONDS,
  })
}

/** Hold the claim while the delivery is live on that machine. */
export function renewClaim(env: Env, owner: Owner, requestId: string, body: unknown): Promise<{ renewed: boolean }> {
  const input = (body ?? {}) as Record<string, unknown>
  return mutate<{ renewed: boolean }>(env, 'renew_claim', {
    p_subject: owner.accountId,
    p_server: uuid(input.serverId, 'server'),
    p_request: uuid(requestId, 'request'),
    p_lease_seconds: CLAIM_LEASE_SECONDS,
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuid(value: unknown, what: string): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (!UUID.test(held)) throw badRequest(`That request names no ${what}.`)
  return held
}
