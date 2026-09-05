import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LIMITS } from '../contract.ts'
import worker from '../src/index.ts'
import { fakeEnv } from './fake.mjs'

// What the endpoint answers. Two things it must never do: tell a sender what was dropped,
// and answer any request with a number.

const INSTALL = '0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'
const day = () => new Date().toISOString().slice(0, 10)

const post = (env, body, headers = {}) =>
  worker.fetch(
    new Request('https://t.ai4kanban.dev/v1/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  )

const appBatch = (events) => ({ v: 1, install: INSTALL, events })
const siteBatch = (events) => ({ v: 1, events })
const stored = (env) => env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM events').all()[0].n

describe('the endpoint', () => {
  it('takes an app batch and says nothing about what it kept', async () => {
    const env = fakeEnv()
    const answer = await post(env, appBatch([{ id: 'e1', name: 'app_open', day: day(), surface: 'app', version: '0.8.1' }]))
    assert.equal(answer.status, 202)
    assert.deepEqual(await answer.json(), { ok: true })
    assert.equal(stored(env), 1)
  })

  it('takes a batch whose events it all drops, and answers the same way', async () => {
    const env = fakeEnv()
    const answer = await post(env, appBatch([{ id: 'e1', name: 'not_an_event', day: day() }]))
    assert.equal(answer.status, 202)
    assert.deepEqual(await answer.json(), { ok: true })
    assert.equal(stored(env), 0)
  })

  it('answers the site and refuses every other site', async () => {
    const env = fakeEnv()
    const page = [{ name: 'page_view', day: day(), page: '/', language: 'en' }]
    const mine = await post(env, siteBatch(page), { origin: 'https://ai4kanban.dev' })
    assert.equal(mine.status, 202)
    assert.equal(mine.headers.get('access-control-allow-origin'), 'https://ai4kanban.dev')

    const theirs = await post(env, siteBatch(page), { origin: 'https://example.com' })
    assert.equal(theirs.status, 403)
    assert.equal(theirs.headers.get('access-control-allow-origin'), null)
  })

  it('answers localhost from the development copy only', async () => {
    const page = [{ name: 'page_view', day: day(), page: '/', language: 'en' }]
    const real = await post(fakeEnv(), siteBatch(page), { origin: 'http://localhost:3000' })
    assert.equal(real.status, 403)
    const dev = await post(fakeEnv({ COPY: 'development' }), siteBatch(page), {
      origin: 'http://localhost:3000',
    })
    assert.equal(dev.status, 202)
  })

  it('refuses a bad, an oversized and a wrongly addressed batch', async () => {
    const env = fakeEnv()
    assert.equal((await post(env, 'not json')).status, 400)
    assert.equal((await post(env, { v: 99, events: [] })).status, 400)
    assert.equal((await post(env, { v: 1, install: 'nope', events: [] })).status, 400)
    const huge = JSON.stringify({ v: 1, events: [{ name: 'x'.repeat(LIMITS.batchBytes) }] })
    assert.equal((await post(env, huge)).status, 413)
    assert.equal(stored(env), 0)
  })

  it('answers no request that returns a number', async () => {
    const env = fakeEnv()
    for (const path of ['/v1/batch', '/v1/numbers', '/daily', '/v1/events', '/']) {
      const answer = await worker.fetch(new Request(`https://t.ai4kanban.dev${path}`), env)
      assert.ok(answer.status === 404 || answer.status === 405, `${path} answered ${answer.status}`)
    }
    const health = await worker.fetch(new Request('https://t.ai4kanban.dev/health'), env)
    assert.deepEqual(await health.json(), { service: 'ai4kanban-telemetry', ok: true })
  })

  it('holds one address to its hour and lets another through', async () => {
    const env = fakeEnv()
    const batch = appBatch([{ id: 'e1', name: 'app_day', day: day(), surface: 'app' }])
    let last
    for (let n = 0; n <= LIMITS.requestsPerHour; n += 1) {
      last = await post(env, batch, { 'cf-connecting-ip': '203.0.113.7' })
    }
    assert.equal(last.status, 429)
    const other = await post(env, batch, { 'cf-connecting-ip': '203.0.113.8' })
    assert.equal(other.status, 202)
  })

  it('holds the hour against every request, not only the batches', async () => {
    // A preflight, an unknown path and a refused origin each spend one of the day's 100,000,
    // so a limit that let them past would leave the day open to a script sending nothing.
    const address = { 'cf-connecting-ip': '203.0.113.9' }
    const asked = {
      preflight: () =>
        new Request('https://t.ai4kanban.dev/v1/batch', { method: 'OPTIONS', headers: address }),
      unknown: () => new Request('https://t.ai4kanban.dev/nope', { headers: address }),
      health: () => new Request('https://t.ai4kanban.dev/health', { headers: address }),
      refused: () =>
        new Request('https://t.ai4kanban.dev/v1/batch', {
          method: 'POST',
          headers: { ...address, origin: 'https://example.com' },
          body: '{}',
        }),
    }
    for (const [what, make] of Object.entries(asked)) {
      const env = fakeEnv()
      let last
      for (let n = 0; n <= LIMITS.requestsPerHour; n += 1) last = await worker.fetch(make(), env)
      assert.equal(last.status, 429, what)
    }
  })

  it('keeps taking batches when the database will not', async () => {
    const env = fakeEnv({
      DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('daily limit') } }) }) },
    })
    const answer = await post(env, appBatch([{ id: 'e1', name: 'app_day', day: day(), surface: 'app' }]))
    assert.equal(answer.status, 202)
    assert.deepEqual(await answer.json(), { ok: true })
  })
})
