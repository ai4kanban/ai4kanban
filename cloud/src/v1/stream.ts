/**
 * The event feed (#2000). Postgres holds every event; `EventHub`, one Durable Object per
 * account, only holds the open SSE connections and reads Postgres for each of them when a
 * write pokes it, and every 25 seconds in case a poke was lost.
 */

import { call } from '../db.ts'
import type { Env } from '../env.ts'
import { badRequest, serviceUnavailable } from '../errors.ts'

const TICK_MS = 25_000

interface Event {
  id: string
  type: string
}

interface Page {
  data: Event[]
  next: string | null
}

/** `evt_<n>`, or nothing, as a sequence number. */
export function eventSeq(value: string | null): number {
  if (!value) return 0
  const match = /^evt_(\d{1,18})$/.exec(value)
  if (!match) throw badRequest('That is not an event id.')
  return Number(match[1])
}

export const readEvents = (env: Env, accountId: string, after: number, limit = 100) =>
  call<Page>(env, 'v1_list_events', { p_account: accountId, p_after: after, p_limit: limit })

const hubOf = (env: Env, accountId: string) => {
  if (!env.EVENT_HUBS) return null
  return env.EVENT_HUBS.get(env.EVENT_HUBS.idFromName(accountId))
}

export function openStream(env: Env, accountId: string, request: Request): Promise<Response> {
  const hub = hubOf(env, accountId)
  if (!hub) throw serviceUnavailable()
  const after = eventSeq(request.headers.get('last-event-id') ?? new URL(request.url).searchParams.get('after'))
  return hub.fetch(`https://hub/stream?after=${after}`, { headers: { 'x-account': accountId } })
}

/** Tell the account's open streams to read again. Best effort: the tick reads anyway. */
export function poke(env: Env, ctx: ExecutionContext, accountId: string): void {
  const hub = hubOf(env, accountId)
  if (!hub) return
  ctx.waitUntil(
    hub
      .fetch('https://hub/poke', { method: 'POST', headers: { 'x-account': accountId } })
      .catch((e) => console.error('cloud: event poke failed', e)),
  )
}

interface Client {
  writer: WritableStreamDefaultWriter<Uint8Array>
  after: number
  queue: Promise<void>
}

const encoder = new TextEncoder()

export class EventHub {
  private readonly env: Env
  private readonly clients = new Set<Client>()
  private account = ''
  private timer?: ReturnType<typeof setInterval>

  constructor(_state: DurableObjectState, env: Env) {
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    this.account = request.headers.get('x-account') ?? this.account
    if (url.pathname === '/poke') {
      await Promise.all([...this.clients].map((c) => this.drain(c)))
      return new Response(null, { status: 204 })
    }
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const client: Client = {
      writer: writable.getWriter(),
      after: Number(url.searchParams.get('after') ?? 0),
      queue: Promise.resolve(),
    }
    this.clients.add(client)
    client.writer.closed.catch(() => this.drop(client))
    this.timer ??= setInterval(() => this.tick(), TICK_MS)
    void this.write(client, 'retry: 3000\n\n').then(() => this.drain(client))
    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    })
  }

  /** Send a client everything after where it stands, one read at a time. */
  drain(client: Client): Promise<void> {
    client.queue = client.queue.then(async () => {
      if (!this.clients.has(client)) return
      for (;;) {
        const page = await readEvents(this.env, this.account, client.after)
        for (const event of page.data) {
          await this.write(client, `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
          if (!this.clients.has(client)) return
          client.after = eventSeq(event.id)
        }
        if (!page.next) return
      }
    }).catch((e) => console.error('cloud: event stream read failed', e))
    return client.queue
  }

  private async tick(): Promise<void> {
    for (const client of this.clients) {
      await this.write(client, ': ping\n\n')
      await this.drain(client)
    }
  }

  private drop(client: Client): void {
    this.clients.delete(client)
    if (this.clients.size === 0 && this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  private async write(client: Client, text: string): Promise<void> {
    try {
      await client.writer.write(encoder.encode(text))
    } catch {
      this.drop(client)
    }
  }
}
