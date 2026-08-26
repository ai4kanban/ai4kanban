import { mutate } from './db.ts'
import { requireEnv } from './env.ts'
import type { Env } from './env.ts'
import { Refusal, methodNotAllowed, notAdmitted, notFound } from './errors.ts'
import { json, refusalResponse } from './http.ts'
import { readSession, requireOwner } from './owner.ts'
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
