/**
 * The endpoint. One route takes batches, one says the service is up, and there is no third:
 * nothing here answers a request that returns a number. The numbers are read from this
 * repository with the Cloudflare account we already hold (`npm run numbers`), which is the
 * only way #292's promise that nobody outside the project reads them can hold.
 */

import { LIMITS } from '../contract.ts'
import { runDaily } from './daily.ts'
import type { Env } from './env.ts'
import { development } from './env.ts'
import { AddressHour, withinLimit } from './limit.ts'
import { store } from './store.ts'
import { BadBatch, take } from './take.ts'
import { spent } from './usage.ts'

export { AddressHour }

/** The site, and nothing else. A browser request from any other site is refused. */
const SITE = ['https://ai4kanban.dev', 'https://www.ai4kanban.dev']
/** The development copy answers the site being worked on too, so #297's counting can be
 *  built and tried without posting into the real numbers. */
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** What one request came to: the answer, and what it cost the day's allowance. */
interface Handled {
  answer: Response
  rowsWritten: number
  rowsRead: number
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const now = new Date()
    let handled: Handled
    try {
      handled = await route(request, env, now)
    } catch (error) {
      console.error('telemetry: request failed', error)
      handled = { answer: answered(request, env, 500, { ok: false }), rowsWritten: 0, rowsRead: 0 }
    }
    // Every request that reached us spent one of the day's, whatever we answered.
    spent(env, now.toISOString().slice(0, 10), handled.rowsWritten, handled.rowsRead)
    return handled.answer
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runDaily(env, new Date())
  },
}

async function route(request: Request, env: Env, now: Date): Promise<Handled> {
  const { pathname } = new URL(request.url)
  const said = (status: number, body: unknown, headers?: Record<string, string>): Handled => ({
    answer: answered(request, env, status, body, headers),
    rowsWritten: 0,
    rowsRead: 0,
  })

  // Before the routing: a preflight, an unknown path and a refused origin each spend one of
  // the day's 100,000 too, so a limit that only covered the batches would not protect the
  // day at all.
  const address = request.headers.get('cf-connecting-ip') ?? ''
  if (!(await withinLimit(env.LIMITER, address, now))) {
    return said(429, { ok: false }, { 'retry-after': '600' })
  }

  if (pathname === '/health') {
    if (request.method !== 'GET') return said(405, { ok: false })
    return said(200, { service: 'ai4kanban-telemetry', ok: true })
  }
  if (pathname !== '/v1/batch') return said(404, { ok: false })
  if (request.method === 'OPTIONS') return said(204, null)
  if (request.method !== 'POST') return said(405, { ok: false })

  // A browser says where it came from; the app and the command send no origin at all.
  const origin = request.headers.get('origin')
  if (origin && !allowed(origin, env)) return said(403, { ok: false })

  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.batchBytes) {
    return said(413, { ok: false })
  }
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > LIMITS.batchBytes) return said(413, { ok: false })

  let taken
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    taken = take(body, now.toISOString().slice(0, 10), () => crypto.randomUUID())
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof BadBatch) return said(400, { ok: false })
    throw error
  }

  const country = (request as CloudflareRequest).cf?.country ?? ''
  const stored = await store(env.DB, taken.install, country, taken.rows)

  // Taken either way. A sender is never told which of its events were stored, so it never
  // retries them — and once the day's allowance is spent, dropping quietly costs less than
  // every install on the busiest day of the year retrying into a wall.
  return {
    answer: answered(request, env, 202, { ok: true }),
    rowsWritten: stored.rowsWritten,
    rowsRead: stored.rowsRead,
  }
}

function allowed(origin: string, env: Env): boolean {
  if (SITE.includes(origin)) return true
  return development(env) && LOCAL.test(origin)
}

function answered(
  request: Request,
  env: Env,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const origin = request.headers.get('origin')
  const cors: Record<string, string> =
    origin && allowed(origin, env)
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
          vary: 'origin',
        }
      : {}
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(body === null ? {} : { 'content-type': 'application/json; charset=utf-8' }),
      'cache-control': 'no-store',
      ...cors,
      ...headers,
    },
  })
}
