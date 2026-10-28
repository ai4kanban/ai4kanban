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

/** Events an API key is never shown: comments are for people (#2019). */
export const KEY_HIDDEN = ['comment.created']

export const readEvents = (env: Env, accountId: string, after: number, limit = 100, hidden: string[] = []) =>
  call<Page>(env, 'v1_list_events', { p_account: accountId, p_after: after, p_limit: limit, p_hidden: hidden })

const hubOf = (env: Env, accountId: string) => {
  if (!env.EVENT_HUBS) return null
  return env.EVENT_HUBS.get(env.EVENT_HUBS.idFromName(accountId))
}

export function openStream(env: Env, accountId: string, request: Request, hidden: string[] = []): Promise<Response> {
  const hub = hubOf(env, accountId)
  if (!hub) throw serviceUnavailable()
  const after = eventSeq(request.headers.get('last-event-id') ?? new URL(request.url).searchParams.get('after'))
  const hide = hidden.map((type) => `&hide=${encodeURIComponent(type)}`).join('')
  return hub.fetch(`https://hub/stream?after=${after}${hide}`, { headers: { 'x-account': accountId } })
}

/** Tell the open streams of everyone sharing a workspace with the account (only `workspace`,
 *  when named) to read again. Best effort: the tick reads anyway. */
export function poke(env: Env, ctx: ExecutionContext, accountId: string | null, workspace: string | null = null): void {
  if (!env.EVENT_HUBS) return
  ctx.waitUntil(
    call<string[]>(env, 'v1_audience', { p_account: accountId, p_workspace: workspace })
      .then((accounts) => Promise.all(accounts.map((account) =>
        hubOf(env, account)!.fetch('https://hub/poke', { method: 'POST', headers: { 'x-account': account } }))))
      .catch((e) => console.error('cloud: event poke failed', e)),
  )
}

interface Client {
  writer: WritableStreamDefaultWriter<Uint8Array>
  after: number
  hidden: string[]
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
      hidden: url.searchParams.getAll('hide'),
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
        const page = await readEvents(this.env, this.account, client.after, 100, client.hidden)
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
