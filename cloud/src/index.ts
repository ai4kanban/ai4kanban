import { bearerToken, verifyAccessToken } from './auth.ts'
import type { Identity } from './auth.ts'
import { mutate } from './db.ts'
import { requireEnv } from './env.ts'
import type { Env } from './env.ts'
import { Refusal, methodNotAllowed, notFound } from './errors.ts'
import { json, refusalResponse } from './http.ts'
import { runScheduled } from './scheduled.ts'

interface SelfCheck {
  writes_today: number
  daily_write_budget: number
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      requireEnv(env)
      return await route(request, env)
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

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)

  // Liveness. It reaches nothing, so it stays honest while the database is read-only.
  if (pathname === '/health') {
    requireMethod(request, 'GET')
    return json({ service: 'ai4kanban-cloud', ok: true })
  }

  // Proves a sign-in end to end: the token is verified against the project's JWKS and
  // nothing else is consulted. Membership and roles are #314's.
  if (pathname === '/v1/session') {
    requireMethod(request, 'GET')
    return json({ session: await identify(request, env) })
  }

  // The post-deploy check: one budgeted write through the same path every mutation uses,
  // so a deploy shows the write budget and the read-only refusal working before a client
  // meets them.
  if (pathname === '/v1/self-check') {
    requireMethod(request, 'POST')
    await identify(request, env)
    return json(await mutate<SelfCheck>(env, 'service_self_check'))
  }

  throw notFound()
}

function identify(request: Request, env: Env): Promise<Identity> {
  return verifyAccessToken(bearerToken(request), env.SUPABASE_URL)
}

function requireMethod(request: Request, method: string): void {
  if (request.method !== method) throw methodNotAllowed()
}
