import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { check } from '../scripts/check-live.mjs'
import worker from '../src/index.ts'

// `npm run check:live` (#1449): the verdict from what it read. The reads themselves are the
// live service's and git's.

const migration = (file, checksum = `sum-${file}`) => ({ file, checksum })
const FILES = [migration('0001_a.sql'), migration('0002_b.sql')]
const ALL_APPLIED = new Map(FILES.map((m) => [m.file, m.checksum]))

function source(over = {}) {
  return {
    commit: async () => 'abc1234',
    applied: async () => ALL_APPLIED,
    migrations: async () => FILES,
    known: async () => true,
    unshipped: async () => [],
    ...over,
  }
}

describe('check', () => {
  it('is up to date when the live commit and migrations match HEAD', async () => {
    assert.deepEqual(await check(source()), {
      code: 0,
      lines: ['Live: commit abc1234, 2 migrations applied.', 'up to date'],
    })
  })

  it('lists the migrations to apply', async () => {
    const { code, lines } = await check(source({ applied: async () => new Map([['0001_a.sql', 'sum-0001_a.sql']]) }))
    assert.equal(code, 1)
    assert.deepEqual(lines, ['Live: commit abc1234, 1 migrations applied.', 'Migrations to apply:', '  0002_b.sql'])
  })

  it('lists the Worker commits since the live one', async () => {
    const asked = []
    const { code, lines } = await check(
      source({ unshipped: async (sha) => (asked.push(sha), ['def5678 Change a route']) }),
    )
    assert.equal(code, 1)
    assert.deepEqual(asked, ['abc1234'])
    assert.deepEqual(lines.slice(1), ['Commits not live:', '  def5678 Change a route'])
  })

  it('is behind when the live Worker reports no commit', async () => {
    const { code, lines } = await check(source({ commit: async () => undefined }))
    assert.equal(code, 1)
    assert.equal(lines[0], 'Live: commit unknown, 2 migrations applied.')
    assert.match(lines[1], /does not report its commit/)
  })

  it('is behind when the live Worker was deployed with uncommitted changes', async () => {
    const asked = []
    const { code, lines } = await check(
      source({ commit: async () => 'abc1234+dirty', known: async (sha) => (asked.push(sha), true) }),
    )
    assert.equal(code, 1)
    assert.deepEqual(asked, ['abc1234'])
    assert.equal(lines[0], 'Live: commit abc1234+dirty, 2 migrations applied.')
    assert.match(lines[1], /uncommitted changes/)
  })

  it('is behind when the live commit is not in this history', async () => {
    const { code, lines } = await check(source({ known: async () => false }))
    assert.equal(code, 1)
    assert.match(lines[1], /not in this repository's history/)
  })

  it('cannot check when a read fails, and says why in fixed words', async () => {
    const failing = source({ commit: async () => { throw new Error('Could not read https://api.ai4kanban.dev/health.') } })
    assert.deepEqual(await check(failing), { code: 2, lines: ['Could not read https://api.ai4kanban.dev/health.'] })
  })

  it('cannot check when an applied migration was changed', async () => {
    const { code, lines } = await check(source({ migrations: async () => [migration('0001_a.sql', 'edited'), FILES[1]] }))
    assert.equal(code, 2)
    assert.match(lines[0], /^0001_a\.sql was changed after it was applied/)
  })
})

describe('/health', () => {
  const health = async (env) =>
    (await worker.fetch(new Request('https://api.example/health'), env, { waitUntil() {} })).json()
  const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

  it('names the commit a deploy stamped', async () => {
    assert.deepEqual(await health({ ...ENV, COMMIT: 'abc1234' }), { service: 'ai4kanban-cloud', ok: true, commit: 'abc1234' })
  })

  it('leaves the commit out when the build carries none', async () => {
    assert.deepEqual(await health(ENV), { service: 'ai4kanban-cloud', ok: true })
  })
})
