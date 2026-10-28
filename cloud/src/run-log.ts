// One run's log while it runs (#2085). The Runner sends its events over a WebSocket, pages
// watching the run get them pushed, and at the end the log is dropped, never kept (#2164).
// Connections are hibernated, so a quiet run costs nothing.

import type { Env } from './env.ts'
import { jobEvents } from './runners.ts'

/** The same as the job's lease: a run silent this long has ended, whether it said so or not. */
const ALARM_MS = 15 * 60_000
/** Past this the rest of a run's events are dropped; its result still arrives with `finish`. */
const MAX_BYTES = 16 * 1024 * 1024
/** Under DO SQLite's 2 MB row cap. */
const ROW_BYTES = 1024 * 1024

/** Asks the Runner running `job` to stop it. */
export async function stopRun(env: Env, job: string): Promise<void> {
  await env.RUN_LOGS?.get(env.RUN_LOGS.idFromName(job)).fetch('https://run-log/stop', { method: 'POST' })
}

type Event = ReturnType<typeof jobEvents>[number] & { at: string }

export class RunLog {
  private readonly state: DurableObjectState
  private readonly sql: SqlStorage

  constructor(state: DurableObjectState) {
    this.state = state
    this.sql = state.storage.sql
    this.sql.exec('create table if not exists batches (seq_from integer primary key, seq_to integer not null, body text not null)')
    this.sql.exec('create table if not exists meta (key text primary key, value text not null)')
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    // A chat's reply stopped (#2133): told now, and to a Runner that connects later.
    if (url.pathname === '/stop') {
      this.setMeta('stop', '1')
      this.toRunners({ type: 'stop' })
      return new Response(null, { status: 204 })
    }
    const role = url.pathname === '/runner' ? 'runner' : 'page'
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.state.acceptWebSocket(server, [role])
    if (this.meta('ended')) {
      server.send(JSON.stringify({ type: 'ended' }))
      server.close(1000, 'ended')
    } else if (role === 'runner') {
      server.send(JSON.stringify({ type: 'hello', after: this.last(), watched: this.pages().length > 0 }))
      if (this.meta('stop')) server.send(JSON.stringify({ type: 'stop' }))
    } else {
      const after = Number(url.searchParams.get('after') ?? -1)
      for (const row of this.sql.exec<{ body: string }>('select body from batches where seq_to > ? order by seq_from', after).toArray()) {
        const events = (JSON.parse(row.body) as Event[]).filter((e) => e.seq > after)
        if (events.length) server.send(JSON.stringify({ type: 'events', events }))
      }
      if (this.pages().length === 1) this.toRunners({ type: 'watched', on: true })
    }
    return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': 'bearer' } })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.state.getTags(ws).includes('runner') || typeof message !== 'string') return
    let held: { type?: string; events?: unknown }
    try {
      held = JSON.parse(message)
    } catch {
      return
    }
    if (held.type === 'end') return this.end()
    if (this.meta('ended')) return
    // The Runner renewed its lease: the run goes on, however quiet.
    if (held.type === 'alive') return this.state.storage.setAlarm(Date.now() + ALARM_MS)
    if (held.type !== 'events') return
    let events: Event[]
    try {
      const at = new Date().toISOString()
      const last = this.last()
      events = jobEvents(held.events).filter((e) => e.seq > last).map((e) => ({ ...e, at }))
    } catch {
      return
    }
    events.sort((a, b) => a.seq - b.seq)
    let room = MAX_BYTES - this.bytes()
    const kept: Event[] = []
    for (const e of events) {
      const size = JSON.stringify(e).length
      if (size > room) break
      room -= size
      kept.push(e)
    }
    if (!kept.length) return
    this.store(kept)
    await this.state.storage.setAlarm(Date.now() + ALARM_MS)
    for (const page of this.pages()) send(page, { type: 'events', events: kept })
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000)
    } catch {
      // already closed
    }
    if (this.state.getTags(ws).includes('page') && !this.pages().some((p) => p !== ws)) this.toRunners({ type: 'watched', on: false })
  }

  async alarm(): Promise<void> {
    if (!this.meta('ended')) await this.end()
  }

  /** Every connection told and closed, and the storage emptied. */
  private async end(): Promise<void> {
    if (this.meta('ended')) return
    this.sql.exec('delete from batches')
    this.setMeta('ended', '1')
    await this.state.storage.deleteAlarm()
    for (const ws of this.state.getWebSockets()) {
      send(ws, { type: 'ended' })
      try {
        ws.close(1000, 'ended')
      } catch {
        // already closed
      }
    }
  }

  private store(events: Event[]): void {
    let row: Event[] = []
    let size = 0
    const flush = () => {
      if (!row.length) return
      this.sql.exec('insert or ignore into batches (seq_from, seq_to, body) values (?, ?, ?)', row[0]!.seq, row[row.length - 1]!.seq, JSON.stringify(row))
      row = []
      size = 0
    }
    for (const e of events) {
      const n = JSON.stringify(e).length
      if (size + n > ROW_BYTES) flush()
      row.push(e)
      size += n
    }
    flush()
  }

  private last(): number {
    return this.sql.exec<{ seq: number | null }>('select max(seq_to) as seq from batches').toArray()[0]?.seq ?? -1
  }

  private bytes(): number {
    return this.sql.exec<{ n: number | null }>('select sum(length(body)) as n from batches').toArray()[0]?.n ?? 0
  }

  private pages(): WebSocket[] {
    return this.state.getWebSockets('page').filter((ws) => ws.readyState === WebSocket.OPEN)
  }

  private toRunners(message: unknown): void {
    for (const ws of this.state.getWebSockets('runner')) send(ws, message)
  }

  private meta(key: string): string | null {
    return this.sql.exec<{ value: string }>('select value from meta where key = ?', key).toArray()[0]?.value ?? null
  }

  private setMeta(key: string, value: string): void {
    this.sql.exec('insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value', key, value)
  }
}

function send(ws: WebSocket, message: unknown): void {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // a closing socket
  }
}
