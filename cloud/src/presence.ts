// One account's Runner presence (#2163). A Runner keeps a WebSocket here and pings it; the
// runtime answers the pings without waking the object. When a machine's pings stop for longer
// than the grace, its registration lease ends now instead of running out (15 minutes).
// Coming online stays HTTP registration's job: this only ends a lease early.

import { mutate } from './db.ts'
import type { Env } from './env.ts'

/** Long enough for a Runner to reconnect after a deploy drops every connection. */
export const GRACE_MS = 90_000
const CHECK_MS = 60_000

export class RunnerPresence {
  private readonly state: DurableObjectState
  private readonly env: Env
  private readonly sql: SqlStorage

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sql = state.storage.sql
    // When each machine was last heard from, kept so a restart still counts from it.
    this.sql.exec('create table if not exists seen (machine text primary key, at integer not null)')
    this.sql.exec('create table if not exists meta (key text primary key, value text not null)')
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const machine = url.searchParams.get('machine') ?? ''
    this.sql.exec(`insert into meta (key, value) values ('account', ?) on conflict (key) do update set value = excluded.value`, url.searchParams.get('account') ?? '')
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.state.acceptWebSocket(server, [machine])
    this.saw(machine, Date.now())
    if ((await this.state.storage.getAlarm()) === null) await this.state.storage.setAlarm(Date.now() + CHECK_MS)
    return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': 'bearer' } })
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const [machine] = this.state.getTags(ws)
    const at = this.state.getWebSocketAutoResponseTimestamp(ws)
    if (machine !== undefined && at) this.saw(machine, at.getTime())
    try {
      ws.close(1000)
    } catch {
      // already closed
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now()
    const account = this.sql.exec<{ value: string }>(`select value from meta where key = 'account'`).toArray()[0]?.value
    for (const { machine } of this.sql.exec<{ machine: string }>('select machine from seen').toArray()) {
      const sockets = this.state.getWebSockets(machine)
      for (const ws of sockets) {
        const at = this.state.getWebSocketAutoResponseTimestamp(ws)
        if (at) this.saw(machine, at.getTime())
      }
      const last = this.sql.exec<{ at: number }>('select at from seen where machine = ?', machine).toArray()[0]?.at ?? now
      if (now - last <= GRACE_MS) continue
      try {
        // `release_runner` writes only while this machine is still the account's Runner.
        if (account) await mutate(this.env, 'release_runner', { p_subject: account, p_machine: machine })
      } catch {
        continue // tried again on the next check
      }
      this.sql.exec('delete from seen where machine = ?', machine)
      for (const ws of sockets) {
        try {
          ws.close(1000, 'gone')
        } catch {
          // already closed
        }
      }
    }
    if (this.sql.exec('select 1 from seen limit 1').toArray().length) await this.state.storage.setAlarm(now + CHECK_MS)
  }

  private saw(machine: string, at: number): void {
    this.sql.exec('insert into seen (machine, at) values (?, ?) on conflict (machine) do update set at = max(at, excluded.at)', machine, at)
  }
}
