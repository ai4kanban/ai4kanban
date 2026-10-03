import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { check, wranglerHome } from '../scripts/check-live.mjs'

// `npm run check:live` (#1490): the verdict from what it read. The reads themselves are the
// live endpoint's, D1's and git's.

const FILES = ['0001_a.sql', '0002_b.sql']

function source(over = {}) {
  return {
    commit: async () => 'abc1234',
    applied: async () => new Set(FILES),
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
    const { code, lines } = await check(source({ applied: async () => new Set(['0001_a.sql']) }))
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
    const failing = source({ applied: async () => { throw new Error('Could not read the applied migrations from D1.') } })
    assert.deepEqual(await check(failing), { code: 2, lines: ['Could not read the applied migrations from D1.'] })
  })
})

describe('wranglerHome', () => {
  const root = (withWrangler) => {
    const dir = mkdtempSync(join(tmpdir(), 'check-live-'))
    if (withWrangler) mkdirSync(join(dir, 'node_modules', '.bin', 'wrangler'), { recursive: true })
    return dir
  }

  it("prefers this checkout's wrangler, then the main checkout's", () => {
    const [here, main] = [root(true), root(true)]
    assert.equal(wranglerHome([here, main]), here)
    const bare = root(false)
    assert.equal(wranglerHome([bare, main]), main)
    assert.equal(wranglerHome([bare, root(false)]), undefined)
  })
})
