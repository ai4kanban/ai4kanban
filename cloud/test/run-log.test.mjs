// A run's log (#2085): the `RunLog` object on a real SQLite, its sockets stood in for.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DatabaseSync } from 'node:sqlite'

import { RunLog } from '../src/run-log.ts'
import { storageOn } from './fake-board.mjs'

function socket(tag) {
  return { tag, sent: [], closed: false, readyState: 1, send(m) { this.sent.push(JSON.parse(m)) }, close() { this.closed = true } }
}

function runLog() {
  const sockets = []
  let alarm = null
  const storage = {
    ...storageOn(new DatabaseSync(':memory:')),
    setAlarm: async (at) => { alarm = at },
    deleteAlarm: async () => { alarm = null },
  }
  const state = {
    storage,
    getTags: (ws) => [ws.tag],
    getWebSockets: (tag) => sockets.filter((ws) => !tag || ws.tag === tag),
  }
  const log = new RunLog(state)
  const join = (tag) => {
    const ws = socket(tag)
    sockets.push(ws)
    return ws
  }
  return { log, join, alarm: () => alarm, rows: () => log.sql.exec('select * from batches').toArray() }
}

const events = (...seqs) => JSON.stringify({ type: 'events', events: seqs.map((seq) => ({ seq, text: `line ${seq}` })) })

describe('the run log object', () => {
  it('stores each batch once, pushes it to the pages watching and keeps the alarm ahead', async () => {
    const r = runLog()
    const runner = r.join('runner')
    const page = r.join('page')
    await r.log.webSocketMessage(runner, events(0, 1))
    await r.log.webSocketMessage(runner, events(1, 2))
    assert.deepEqual(r.rows().map((b) => [b.seq_from, b.seq_to]), [[0, 1], [2, 2]])
    assert.deepEqual(page.sent.flatMap((m) => m.events.map((e) => e.seq)), [0, 1, 2])
    assert.ok(r.alarm() > Date.now())
  })

  it('tells its Runner to stop, and remembers it for one that connects later (#2133)', async () => {
    const r = runLog()
    const runner = r.join('runner')
    const res = await r.log.fetch(new Request('https://run-log/stop', { method: 'POST' }))
    assert.equal(res.status, 204)
    assert.deepEqual(runner.sent, [{ type: 'stop' }])
    assert.equal(r.log.sql.exec(`select value from meta where key = 'stop'`).toArray()[0]?.value, '1')
  })

  it('ignores a page that sends, and a batch it cannot read', async () => {
    const r = runLog()
    const runner = r.join('runner')
    await r.log.webSocketMessage(r.join('page'), events(0))
    await r.log.webSocketMessage(runner, '{')
    await r.log.webSocketMessage(runner, JSON.stringify({ type: 'events', events: [{ seq: 0, kind: 'thought' }] }))
    assert.deepEqual(r.rows(), [])
  })

  it('keeps nothing at the end, tells everyone and empties itself (#2164)', async () => {
    const r = runLog()
    const runner = r.join('runner')
    const page = r.join('page')
    await r.log.webSocketMessage(runner, events(0, 1))
    await r.log.webSocketMessage(runner, JSON.stringify({ type: 'end' }))
    assert.deepEqual(r.rows(), [])
    assert.equal(r.alarm(), null)
    assert.deepEqual(runner.sent.at(-1), { type: 'ended' })
    assert.ok(runner.closed && page.closed)
    await r.log.webSocketMessage(runner, events(2))
    assert.deepEqual(r.rows(), [], 'a batch after the end was kept')
  })

  it('ends a run that never said so when its alarm fires', async () => {
    const r = runLog()
    await r.log.webSocketMessage(r.join('runner'), events(0))
    await r.log.alarm()
    assert.deepEqual(r.rows(), [])
    assert.equal(r.alarm(), null)
  })

  it('keeps a quiet run going while its Runner says it is alive', async () => {
    const r = runLog()
    await r.log.webSocketMessage(r.join('runner'), JSON.stringify({ type: 'alive' }))
    assert.ok(r.alarm() > Date.now())
  })

  it('tells the Runner when the last page leaves', async () => {
    const r = runLog()
    const runner = r.join('runner')
    const page = r.join('page')
    await r.log.webSocketClose(page)
    assert.deepEqual(runner.sent, [{ type: 'watched', on: false }])
  })
})
