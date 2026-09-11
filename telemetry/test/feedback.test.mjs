import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'

import { LIMITS } from '../contract.ts'
import { runDaily } from '../src/daily.ts'
import worker from '../src/index.ts'
import { fakeEnv } from './fake.mjs'

// Feedback (#603). Two promises hold the whole file up: it is answered honestly, and it
// never touches the tables and the archive the anonymous numbers live in.

const INSTALL = '0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'
const day = () => new Date().toISOString().slice(0, 10)

const post = (env, body, headers = {}) =>
  worker.fetch(
    new Request('https://t.ai4kanban.dev/v1/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  )

const one = (over = {}) => ({
  v: 1,
  install: INSTALL,
  id: randomUUID(),
  day: day(),
  source: 'task',
  surface: 'app',
  version: '0.9.3',
  text: '归档后回到创建页，但草稿没有清空。',
  ...over,
})

const rows = (env, table) => env.DB.sqlite.prepare(`SELECT * FROM ${table}`).all()

describe('feedback', () => {
  it('takes one and stores the body', async () => {
    const env = fakeEnv()
    const answer = await post(env, one({ card: 601 }))
    assert.equal(answer.status, 202)
    assert.deepEqual(await answer.json(), { ok: true })
    const [stored] = rows(env, 'feedback')
    assert.equal(stored.install_id, INSTALL)
    assert.equal(stored.card_id, 601)
    assert.equal(stored.source, 'task')
    assert.match(stored.body, /草稿/)
    assert.equal(rows(env, 'feedback_files').length, 0)
  })

  it('never writes into the events the anonymous numbers are counted from', async () => {
    const env = fakeEnv()
    await post(env, one())
    assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM events').all()[0].n, 0)
  })

  it('takes it from a machine with no install id at all', async () => {
    const env = fakeEnv()
    const sent = one()
    delete sent.install
    assert.equal((await post(env, sent)).status, 202)
    assert.equal(rows(env, 'feedback')[0].install_id, '')
  })

  it('stores each attachment as its own row', async () => {
    const env = fakeEnv()
    await post(
      env,
      one({
        parts: [
          { part: 'card', text: '# 601\n…' },
          { part: 'environment', text: 'macos arm64 0.9.3' },
        ],
      }),
    )
    const parts = rows(env, 'feedback_files').map((row) => row.part).sort()
    assert.deepEqual(parts, ['card', 'environment'])
  })

  it('stores a submission posted twice exactly once', async () => {
    const env = fakeEnv()
    const sent = one({ parts: [{ part: 'card', text: 'x' }] })
    assert.equal((await post(env, sent)).status, 202)
    assert.equal((await post(env, sent)).status, 202)
    assert.equal(rows(env, 'feedback').length, 1)
    assert.equal(rows(env, 'feedback_files').length, 1)
  })

  it('refuses what it cannot read, and says so', async () => {
    const env = fakeEnv()
    assert.equal((await post(env, one({ text: '   ' }))).status, 400)
    assert.equal((await post(env, one({ source: 'somewhere' }))).status, 400)
    assert.equal((await post(env, one({ id: 'not-a-uuid' }))).status, 400)
    assert.equal((await post(env, one({ parts: [{ part: 'secrets', text: 'x' }] }))).status, 400)
    assert.equal((await post(env, '{')).status, 400)
    assert.equal(rows(env, 'feedback').length, 0)
  })

  it('refuses one larger than its own limit', async () => {
    const env = fakeEnv()
    const answer = await post(env, one({ text: 'x' }), {
      'content-length': String(LIMITS.feedbackBytes + 1),
    })
    assert.equal(answer.status, 413)
  })

  it('takes one far larger than a batch may be', async () => {
    const env = fakeEnv()
    const chat = 'a'.repeat(LIMITS.batchBytes * 2)
    assert.equal((await post(env, one({ parts: [{ part: 'chat', text: chat }] }))).status, 202)
    assert.equal(rows(env, 'feedback_files')[0].content.length, chat.length)
  })

  it('answers the site and refuses every other site', async () => {
    const env = fakeEnv()
    const mine = await post(env, one(), { origin: 'https://ai4kanban.dev' })
    assert.equal(mine.headers.get('access-control-allow-origin'), 'https://ai4kanban.dev')
    assert.equal((await post(env, one(), { origin: 'https://example.com' })).status, 403)
  })

  it('says when the store failed rather than claiming it took it', async () => {
    const env = fakeEnv()
    const real = env.DB.prepare.bind(env.DB)
    env.DB.prepare = (sql) => {
      if (sql.includes('INSERT OR IGNORE INTO feedback\n')) throw new Error('no')
      return real(sql)
    }
    assert.equal((await post(env, one())).status, 500)
  })

  it('sweeps the attachments at 90 days and keeps the body', async () => {
    const env = fakeEnv()
    const old = new Date(Date.now() - (LIMITS.retentionDays + 5) * 86_400_000)
      .toISOString()
      .slice(0, 10)
    env.DB.sqlite
      .prepare(
        `INSERT INTO feedback (install_id, feedback_id, day, received_at, source, surface, version, country, card_id, body)
         VALUES (?, ?, ?, ?, 'board', 'app', '0.9.3', '', NULL, 'old')`,
      )
      .run(INSTALL, 'f-old', old, `${old}T00:00:00Z`)
    env.DB.sqlite
      .prepare(
        `INSERT INTO feedback_files (install_id, feedback_id, part, day, bytes, content)
         VALUES (?, 'f-old', 'trace', ?, 3, 'log')`,
      )
      .run(INSTALL, old)

    const run = await runDaily(env, new Date())
    assert.equal(run.sweptFeedbackFiles, 1)
    assert.equal(rows(env, 'feedback_files').length, 0)
    assert.equal(rows(env, 'feedback').length, 1)
  })

  it('is never written into the daily archive', async () => {
    const env = fakeEnv()
    await post(env, one({ parts: [{ part: 'chat', text: 'hello' }] }))
    await runDaily(env, new Date())
    for (const file of env.ARCHIVE.held.values()) assert.doesNotMatch(file, /hello/)
  })
})
