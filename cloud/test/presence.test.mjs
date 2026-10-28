// A Runner's presence (#2163): the `RunnerPresence` object on a real SQLite, its sockets and
// the runtime's ping timestamps stood in for.

import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { DatabaseSync } from 'node:sqlite'

import { GRACE_MS, RunnerPresence } from '../src/presence.ts'
import { storageOn } from './fake-board.mjs'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const MACHINE = '44444444-4444-4444-8444-444444444444'
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

globalThis.WebSocketRequestResponsePair ??= class {
  constructor(request, response) {
    Object.assign(this, { request, response })
  }
}

function writes() {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ fn: String(url).split('/rpc/')[1], args: JSON.parse(init.body) })
    return new Response(JSON.stringify({ released: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  return calls
}

function presence(db = new DatabaseSync(':memory:')) {
  const sockets = []
  const pinged = new Map()
  let alarm = null
  const state = {
    storage: { ...storageOn(db), getAlarm: async () => alarm, setAlarm: async (at) => { alarm = at } },
    acceptWebSocket: (ws, tags) => sockets.push(Object.assign(ws, { tags })),
    getTags: (ws) => ws.tags,
    getWebSockets: (tag) => sockets.filter((ws) => !tag || ws.tags.includes(tag)),
    setWebSocketAutoResponse: () => {},
    getWebSocketAutoResponseTimestamp: (ws) => pinged.get(ws) ?? null,
  }
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = {}
      this[1] = { close() { this.closed = true } }
    }
  }
  const object = new RunnerPresence(state, ENV)
  return {
    object,
    db,
    sockets,
    alarm: () => alarm,
    connect: () => object.fetch(new Request(`https://presence/connect?account=${ACCOUNT}&machine=${MACHINE}`)).catch(() => null),
    ping: (ws, ago) => pinged.set(ws, new Date(Date.now() - ago)),
    seenAgo: (ms) => db.prepare('update seen set at = ?').run(Date.now() - ms),
  }
}

describe('the Runner presence object', () => {
  it('writes nothing while the Runner connects and pings', async () => {
    const calls = writes()
    const p = presence()
    await p.connect()
    assert.ok(p.alarm() > Date.now())
    p.seenAgo(GRACE_MS * 2)
    p.ping(p.sockets[0], 10_000)
    await p.object.alarm()
    assert.deepEqual(calls, [])
    assert.ok(p.alarm() > Date.now(), 'the check stopped while connected')
  })

  it('ends the lease of a machine silent past the grace, then stops checking', async () => {
    const calls = writes()
    const p = presence()
    await p.connect()
    p.seenAgo(GRACE_MS + 1000)
    const before = p.alarm()
    await p.object.alarm()
    assert.deepEqual(calls.map((c) => [c.fn, c.args.p_subject, c.args.p_machine]), [['release_runner', ACCOUNT, MACHINE]])
    assert.ok(p.sockets[0].closed)
    assert.equal(p.alarm(), before, 'a check was set after the release')
  })

  it('counts a reconnect as heard from', async () => {
    const calls = writes()
    const p = presence()
    await p.connect()
    p.seenAgo(GRACE_MS + 1000)
    await p.connect()
    await p.object.alarm()
    assert.deepEqual(calls, [])
  })

  it('keeps the grace across a restart with no connection yet', async () => {
    const calls = writes()
    const first = presence()
    await first.connect()
    first.seenAgo(30_000)
    const again = presence(first.db)
    await again.object.alarm()
    assert.deepEqual(calls, [])
    assert.ok(again.alarm() > Date.now())
  })

  it('keeps checking when the write fails', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('down', { status: 503 }))
    const p = presence()
    await p.connect()
    p.seenAgo(GRACE_MS + 1000)
    await p.object.alarm()
    assert.equal(p.db.prepare('select count(*) as n from seen').get().n, 1)
  })
})
