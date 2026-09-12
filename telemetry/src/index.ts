/**
 * The endpoint. One route takes batches, one takes feedback (#603), one takes a partner's
 * refine case (#628), one says the service is up, and there is no fifth: nothing here
 * answers a request that returns a number. The
 * numbers are read from this repository with the Cloudflare account we already hold
 * (`npm run numbers`), which is the only way #292's promise that nobody outside the project
 * reads them can hold.
 *
 * The three posting routes never meet. A batch is taken whatever came of it, because a
 * number nobody notices losing is not worth a retry; a piece of feedback and a case are
 * answered honestly, because a person is waiting on the screen either was written on and is
 * told when it did not go.
 */

import { LIMITS } from '../contract.ts'
import { BadCase, storeCase, takeCase } from './case.ts'
import { runDaily } from './daily.ts'
import { BadFeedback, storeFeedback, takeFeedback } from './feedback.ts'
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
  if (pathname === '/v1/feedback') return feedback(request, env, now, said)
  if (pathname === '/v1/case') return partnerCase(request, env, now, said)
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

/** What a route answers with, already carrying the CORS the request earned. */
type Said = (status: number, body: unknown, headers?: Record<string, string>) => Handled

/**
 * One piece of feedback, taken or refused in so many words.
 *
 * Its own size limit — a conversation alone is 10-20 kB, so a batch's 16 would refuse every
 * submission that carries one — and its own answer: 202 stored, 400 unreadable, 413 too
 * large, 500 the store failed. The sender says which of those happened and does not try
 * again.
 */
async function feedback(request: Request, env: Env, now: Date, said: Said): Promise<Handled> {
  if (request.method === 'OPTIONS') return said(204, null)
  if (request.method !== 'POST') return said(405, { ok: false })

  const origin = request.headers.get('origin')
  if (origin && !allowed(origin, env)) return said(403, { ok: false })

  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.feedbackBytes) {
    return said(413, { ok: false })
  }
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > LIMITS.feedbackBytes) return said(413, { ok: false })

  let taken
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    taken = takeFeedback(body, now.toISOString().slice(0, 10))
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof BadFeedback) return said(400, { ok: false })
    throw error
  }

  const country = (request as CloudflareRequest).cf?.country ?? ''
  try {
    const stored = await storeFeedback(env.DB, taken, country, now.toISOString())
    return {
      answer: answered(request, env, 202, { ok: true }),
      rowsWritten: stored.rowsWritten,
      rowsRead: stored.rowsRead,
    }
  } catch (error) {
    console.error('telemetry: feedback not stored', error)
    return said(500, { ok: false })
  }
}

/**
 * One partner's refine case, taken or refused in so many words (#628).
 *
 * Its own limit, and the refusal is the WHOLE pack: a case cut down to fit is a
 * reproduction that no longer reproduces, so 413 goes back and the sender offers to send the
 * question description on its own instead. The same id posted twice writes the same object,
 * which is what makes the sender's retry safe.
 */
async function partnerCase(request: Request, env: Env, now: Date, said: Said): Promise<Handled> {
  if (request.method === 'OPTIONS') return said(204, null)
  if (request.method !== 'POST') return said(405, { ok: false })

  const origin = request.headers.get('origin')
  if (origin && !allowed(origin, env)) return said(403, { ok: false })

  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.caseBytes) {
    return said(413, { ok: false })
  }
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > LIMITS.caseBytes) return said(413, { ok: false })

  let taken
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    taken = takeCase(body, now.toISOString().slice(0, 10))
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof BadCase) return said(400, { ok: false })
    throw error
  }

  try {
    await storeCase(env.CASES, taken)
    return said(202, { ok: true, id: taken.id })
  } catch (error) {
    console.error('telemetry: case not stored', error)
    return said(500, { ok: false })
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
