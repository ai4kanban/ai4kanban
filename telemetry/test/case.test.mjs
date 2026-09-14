import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { casePrefix, caseKey } from '../src/case.ts'
import worker from '../src/index.ts'
import { fakeEnv } from './fake.mjs'

// A partner's refine case (#628). Three promises hold this file up: the submission id is the
// whole address, the pack is stored whole however big it is (#685), and nothing about it
// reaches the tables and the archive the anonymous numbers live in.

const ID = 'fb_7k4m2p3q'
const day = () => new Date().toISOString().slice(0, 10)

const post = (env, body, headers = {}) =>
  worker.fetch(
    new Request('https://t.ai4kanban.dev/v1/case', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  )

const one = (over = {}) => ({
  v: 1,
  id: ID,
  day: day(),
  submittedAt: new Date().toISOString(),
  surface: 'app',
  version: '0.9.4',
  card: 603,
  flowId: 'c0ffee',
  text: '归档卡片也要能按编号搜索，规格里漏了。',
  analysis: '澄清里说过归档，定稿只写了待开发。',
  gaps: ['最早那次细化的轨迹已被清理'],
  runs: [{ action: 'refine', startedAt: 1_757_000_000_000, harness: 'claude', sessionId: 's-1', trace: 'read cards.ts' }],
  files: [{ path: 'cli/src/lib/cards.ts', bytes: 12, text: 'export {}', version: 'read', evidence: 'Read cards.ts' }],
  ...over,
})

const stored = (env) => JSON.parse(env.CASES.held.get(caseKey(ID)))

describe('a partner case', () => {
  it('takes one and stores it as a single object under its own id', async () => {
    const env = fakeEnv()
    const answer = await post(env, one())
    assert.equal(answer.status, 202)
    assert.deepEqual(await answer.json(), { ok: true, id: ID })
    assert.deepEqual([...env.CASES.held.keys()], [caseKey(ID)])
    assert.ok(caseKey(ID).startsWith(casePrefix(ID)))
    const pack = stored(env)
    assert.equal(pack.card, 603)
    assert.equal(pack.files[0].version, 'read')
    assert.deepEqual(pack.gaps, ['最早那次细化的轨迹已被清理'])
  })

  it('keeps nothing in the tables or the archive the numbers live in', async () => {
    const env = fakeEnv()
    await post(env, one())
    assert.equal(env.ARCHIVE.held.size, 0)
    assert.equal(env.DB.sqlite.prepare('SELECT * FROM feedback').all().length, 0)
    assert.equal(env.DB.sqlite.prepare('SELECT * FROM events').all().length, 0)
  })

  it('writes the same object for the same id, so a retry is not a second case', async () => {
    const env = fakeEnv()
    await post(env, one({ text: '第一次' }))
    await post(env, one({ text: '第二次' }))
    assert.equal(env.CASES.held.size, 1)
    assert.equal(stored(env).text, '第二次')
  })

  it('stores a pack past every limit this service used to hold (#685)', async () => {
    const env = fakeEnv()
    // Each one is over a ceiling the case path once enforced: the conversation over the
    // 4,000-character cut, one trace over 4 MiB, one project file over 512 KiB, and the whole
    // pack over 24 MiB. All of it is stored exactly as it was sent.
    const text = '很长的对话。'.repeat(2_000)
    const trace = 'x'.repeat(5 * 1024 * 1024)
    const file = 'y'.repeat(600 * 1024)
    const answer = await post(
      env,
      one({
        text,
        analysis: 'z'.repeat(20 * 1024 * 1024),
        runs: [{ action: 'refine', startedAt: 1, harness: 'claude', sessionId: 's-1', trace }],
        files: [{ path: 'a.ts', bytes: file.length, text: file, version: 'read' }],
      }),
    )
    assert.equal(answer.status, 202)
    const pack = stored(env)
    assert.equal(pack.text, text)
    assert.equal(pack.runs[0].trace.length, trace.length)
    assert.equal(pack.files[0].text.length, file.length)
  })

  it('refuses a body it cannot read, and says so', async () => {
    const env = fakeEnv()
    for (const bad of [
      one({ id: 'fb_NOPE' }),
      one({ id: undefined }),
      one({ card: undefined }),
      one({ text: '   ' }),
      one({ day: '2020-01-01' }),
      one({ v: 2 }),
      one({ files: [{ path: 'a', bytes: 1, text: 'a', version: 'guessed' }] }),
      one({ files: [{ path: 'a', bytes: 1, text: 'a', version: 'read' }, { path: 'a', bytes: 1, text: 'a', version: 'read' }] }),
    ]) {
      const answer = await post(env, bad)
      assert.equal(answer.status, 400, JSON.stringify(bad).slice(0, 60))
    }
    assert.equal(env.CASES.held.size, 0)
  })

  it('answers nothing but POST', async () => {
    const env = fakeEnv()
    const answer = await worker.fetch(new Request('https://t.ai4kanban.dev/v1/case'), env)
    assert.equal(answer.status, 405)
  })
})
