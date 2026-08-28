import { mutate } from './db.ts'
import { requireEnv } from './env.ts'
import type { Env } from './env.ts'
import { Refusal, badRequest, methodNotAllowed, notAdmitted, notFound } from './errors.ts'
import {
  listEvents,
  publishEvent,
  readOneEvent,
  recordAction,
  recordOutcome,
  registerBoard,
  retireEvent,
} from './events.ts'
import { json, refusalResponse } from './http.ts'
import { redeemInvitation, requestInvite, sendPendingMail } from './invites.ts'
import { readSession, requireOwner } from './owner.ts'
import { runScheduled } from './scheduled.ts'
import {
  attachServer,
  claimRequest,
  detachServer,
  listRequests,
  listServers,
  renewClaim,
} from './servers.ts'

interface SelfCheck {
  writes_today: number
  daily_write_budget: number
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      requireEnv(env)
      return await route(request, env, ctx)
    } catch (error) {
      if (!(error instanceof Refusal)) console.error('cloud: request failed', error)
      return refusalResponse(error)
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    requireEnv(env)
    await runScheduled(env)
  },
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { pathname } = new URL(request.url)

  // Liveness. It reaches nothing, so it stays honest while the database is read-only.
  if (pathname === '/health') {
    requireMethod(request, 'GET')
    return json({ service: 'ai4kanban-cloud', ok: true })
  }

  // The one route open to a verified sign-in we have not admitted (#326), so the app can
  // name the account it refused rather than showing a refusal about nobody.
  if (pathname === '/v1/session') {
    requireMethod(request, 'GET')
    const session = await readSession(request, env)
    // The refusal every other route would give, carried here so the app shows the service's
    // own words rather than writing its own copy of them.
    const refusal = session.admitted ? undefined : notAdmitted()
    return json({
      session,
      ...(refusal ? { refusal: { code: refusal.code, message: refusal.message } } : {}),
    })
  }

  // The two routes #327 opens before admission, beside the session above. A refused person
  // asks for an invite here and redeems the code we answer with here, and both need exactly
  // what the session needed: a verified sign-in, admitted or not.
  if (pathname === '/v1/invite-request') {
    requireMethod(request, 'POST')
    const session = await readSession(request, env)
    if (session.admitted) throw badRequest('This account is already in the preview.')
    const requestedAt = await requestInvite(env, session.subject)
    // The row is written, and a Worker is standing right here — so send it now rather than
    // leaving a person waiting on the top of the hour. `waitUntil` keeps the response off
    // Resend's latency, and a send that fails is what the hourly run retries.
    ctx.waitUntil(sendPendingMail(env).catch((e) => console.error('cloud: mail failed', e)))
    return json({ requestedAt })
  }

  if (pathname === '/v1/invitations/redeem') {
    requireMethod(request, 'POST')
    const session = await readSession(request, env)
    if (session.admitted) return json({ admitted: true })
    await redeemInvitation(env, session.subject, await codeFrom(request))
    return json({ admitted: true })
  }

  // The events a board publishes, and the one action each may carry (#319). All behind the
  // owner check: a board, an event and an action are an admitted account's rows.
  if (pathname === '/v1/boards') {
    requireMethod(request, 'POST')
    const owner = await requireOwner(request, env)
    return json(await registerBoard(env, owner, await bodyOf(request)))
  }

  // Which machine runs a board's work, and the requests it claims (#318). A board attaches
  // exactly one server; a second is refused and told which machine holds it.
  const boardServer = /^\/v1\/boards\/([^/]+)\/server(?:\/(detach))?$/.exec(pathname)
  if (boardServer) {
    requireMethod(request, 'POST')
    const [, board = '', move] = boardServer
    const owner = await requireOwner(request, env)
    const body = await bodyOf(request)
    return json(
      move === 'detach'
        ? await detachServer(env, owner, board, body)
        : await attachServer(env, owner, board, body),
    )
  }

  if (pathname === '/v1/servers') {
    requireMethod(request, 'GET')
    return json(await listServers(env, await requireOwner(request, env)))
  }

  const serverRequests = /^\/v1\/servers\/([^/]+)\/requests$/.exec(pathname)
  if (serverRequests) {
    requireMethod(request, 'GET')
    return json(await listRequests(env, await requireOwner(request, env), serverRequests[1] ?? ''))
  }

  const requestMove = /^\/v1\/requests\/([^/]+)\/(claim|renew)$/.exec(pathname)
  if (requestMove) {
    requireMethod(request, 'POST')
    const [, id = '', move] = requestMove
    const owner = await requireOwner(request, env)
    const body = await bodyOf(request)
    return json(
      move === 'claim'
        ? await claimRequest(env, owner, id, body)
        : await renewClaim(env, owner, id, body),
    )
  }

  if (pathname === '/v1/events') {
    if (request.method === 'GET') return json(await listEvents(env, await requireOwner(request, env)))
    requireMethod(request, 'POST')
    const owner = await requireOwner(request, env)
    return json(await publishEvent(env, owner, await bodyOf(request)))
  }

  const event = /^\/v1\/events\/([^/]+)(?:\/(retire|action|outcome))?$/.exec(pathname)
  if (event) {
    const [, id = '', move] = event
    const owner = await requireOwner(request, env)
    if (!move) {
      requireMethod(request, 'GET')
      return json(await readOneEvent(env, owner, id))
    }
    requireMethod(request, 'POST')
    if (move === 'retire') return json(await retireEvent(env, owner, id))
    const body = await bodyOf(request)
    if (move === 'action') return json(await recordAction(env, owner, id, body))
    return json(await recordOutcome(env, owner, id, body))
  }

  // The post-deploy check: one budgeted write through the same path every mutation uses,
  // so a deploy shows the write budget and the read-only refusal working before a client
  // meets them. Behind the owner check like every route that is not the session.
  if (pathname === '/v1/self-check') {
    requireMethod(request, 'POST')
    await requireOwner(request, env)
    return json(await mutate<SelfCheck>(env, 'service_self_check'))
  }

  throw notFound()
}

function requireMethod(request: Request, method: string): void {
  if (request.method !== method) throw methodNotAllowed()
}

/** A JSON body, or nothing. A request that carries something other than JSON is a bad
 *  request; each route says which field it was missing. */
async function bodyOf(request: Request): Promise<unknown> {
  return (await request.json().catch(() => null)) as unknown
}

/** The one thing a redeem carries. A body that is not a code is a bad request, not a code we
 *  do not know — the two read very differently to whoever pasted one. */
async function codeFrom(request: Request): Promise<string> {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!code) throw badRequest('That request carries no invitation code.')
  return code
}
