/**
 * The public API's conventions (#2000): who is calling, prefixed ids, cursor pages,
 * `Idempotency-Key` replays and `Deprecation`/`Sunset` headers. Errors are the service's own
 * `{ error: { code, message } }` (src/http.ts).
 */

import { bearerToken } from '../auth.ts'
import { call } from '../db.ts'
import type { Env } from '../env.ts'
import { badRequest, idempotencyInProgress, idempotencyKeyReused, unauthenticated } from '../errors.ts'
import { json } from '../http.ts'
import { requireOwner } from '../owner.ts'

export const API_KEY_PREFIX = 'wck_'

/** The account behind a request, and how it signed in. */
export interface Caller {
  accountId: string
  handle: string
  /** Set when the request carried an API key rather than a sign-in. */
  key?: { id: string; name: string }
}

export async function authenticate(request: Request, env: Env): Promise<Caller> {
  const token = bearerToken(request)
  if (!token.startsWith(API_KEY_PREFIX)) {
    const owner = await requireOwner(request, env)
    return { accountId: owner.accountId, handle: owner.handle }
  }
  const row = await call<{ account_id: string; handle: string; key_id: string; key_name: string } | null>(
    env,
    'v1_account_for_key',
    { p_hash: await sha256(token) },
  )
  if (!row) throw unauthenticated('This API key is not valid or has been revoked.')
  return { accountId: row.account_id, handle: row.handle, key: { id: row.key_id, name: row.key_name } }
}

/** Who a decision names as its maker. */
export const actorOf = (caller: Caller) =>
  caller.key
    ? { kind: 'api_key', id: caller.key.id, name: caller.key.name }
    : { kind: 'user', handle: caller.handle }

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const ID = /^[a-z]+_[0-9a-z_]{1,64}$/

/** An id of one resource type, from a path or a body. */
export function idOf(value: unknown, prefix: string, what: string): string {
  if (typeof value !== 'string' || !value.startsWith(`${prefix}_`) || !ID.test(value)) {
    throw badRequest(`That is not a ${what} id.`)
  }
  return value
}

export const PAGE = { default: 20, max: 100 }

/** `limit` and `after` off a list's query. */
export function pageOf(params: URLSearchParams, prefix?: string): { p_after: string | null; p_limit: number } {
  const raw = params.get('limit')
  const limit = raw === null ? PAGE.default : Number(raw)
  if (!Number.isInteger(limit) || limit < 1 || limit > PAGE.max) {
    throw badRequest(`limit must be a whole number from 1 to ${PAGE.max}.`)
  }
  const after = params.get('after')
  return { p_after: after ? (prefix ? idOf(after, prefix, 'cursor') : after) : null, p_limit: limit }
}

/**
 * Endpoints on their way out, by `METHOD /path` as written in openapi.json. Each answer carries
 * `Deprecation` and `Sunset`, at least six months apart. Empty while nothing is retired.
 */
export const DEPRECATED: Record<string, { since: string; sunset: string; link?: string }> = {}

export function deprecationHeaders(route: string): Record<string, string> {
  const held = DEPRECATED[route]
  if (!held) return {}
  return {
    deprecation: `@${Math.floor(Date.parse(held.since) / 1000)}`,
    sunset: new Date(held.sunset).toUTCString(),
    ...(held.link ? { link: `<${held.link}>; rel="deprecation"` } : {}),
  }
}

const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/

/**
 * Runs a create once per `Idempotency-Key`: a retry with the same request answers what the
 * first one did, and the same key on a different request is refused. A failed attempt keeps
 * nothing, so it can be retried under the same key.
 */
export async function idempotent(
  env: Env,
  caller: Caller,
  request: Request,
  body: unknown,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<Response> {
  const key = request.headers.get('idempotency-key')
  if (key === null) {
    const done = await run()
    return json(done.body, done.status)
  }
  if (!IDEMPOTENCY_KEY.test(key)) throw badRequest('Idempotency-Key must be 1 to 255 printable characters.')
  const { pathname } = new URL(request.url)
  const hash = await sha256(`${request.method} ${pathname} ${JSON.stringify(body ?? null)}`)
  const held = await call<{ claimed: boolean; request_hash?: string; status?: number | null; response?: unknown }>(
    env,
    'v1_claim_idempotency',
    { p_account: caller.accountId, p_key: key, p_hash: hash },
  )
  if (!held.claimed) {
    if (held.request_hash !== hash) throw idempotencyKeyReused()
    if (held.status == null) throw idempotencyInProgress()
    return json(held.response, held.status, { 'idempotent-replayed': 'true' })
  }
  let done: { status: number; body: unknown }
  try {
    done = await run()
  } catch (error) {
    await call(env, 'v1_release_idempotency', { p_account: caller.accountId, p_key: key }).catch(() => {})
    throw error
  }
  await call(env, 'v1_finish_idempotency', {
    p_account: caller.accountId,
    p_key: key,
    p_status: done.status,
    p_response: done.body,
  }).catch((e) => console.error('cloud: idempotency record failed', e))
  return json(done.body, done.status)
}
