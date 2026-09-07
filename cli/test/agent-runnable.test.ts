// Which runtimes the first run tries before it draws a picker (#404, #467).
//
// The probe spends a real call on every row this list holds, so what keeps it cheap is what is
// left OFF: a row whose CLI isn't here, and one whose provider still wants a setting nobody
// filled in — trying that one would ask for the very key the probe exists to spare the user.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { HARNESSES } from '../src/lib/agent/harnesses/index.ts'
import { commandBinary } from '../src/lib/agent/installed.ts'
import { runnableAgents, runnableHarnesses } from '../src/lib/agent/resolve.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runnable-'))
const kanban = path.join(root, 'docs', 'kanban')
const bin = path.join(root, 'bin')
const PATH = process.env.PATH

function board(config: Record<string, unknown>, env = ''): void {
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(config))
  fs.writeFileSync(path.join(kanban, '.env'), env)
  setBoardRoot(root)
}

/** A PATH holding exactly these commands, so what the machine running the tests has
 *  installed changes nothing. */
function onPath(...binaries: string[]): void {
  fs.rmSync(bin, { recursive: true, force: true })
  fs.mkdirSync(bin, { recursive: true })
  for (const name of binaries) fs.writeFileSync(path.join(bin, name), '', { mode: 0o755 })
  process.env.PATH = bin
}

/** Every harness's binary, taken from the harnesses themselves — a hand-written list here
 *  goes stale the next time one is added, and the test that reads "every installed row" would
 *  then be run on a machine missing one. */
const ALL = HARNESSES.map((h) => commandBinary(h.command))

// One row per harness, in the harnesses' own order, so a board holding every CLI is a board
// with every CLI to try.
const everyHarness = (): Record<string, unknown> => ({
  runtimes: HARNESSES.map((h, i) => ({
    id: i === 0 ? 'global' : h.name,
    name: i === 0 ? 'Global default' : h.label,
    harness: h.name,
    settings: {},
  })),
})

const rows = (...list: { id: string; harness: string; settings?: Record<string, string> }[]) => ({
  runtimes: list.map((r) => ({ id: r.id, name: r.id, harness: r.harness, settings: r.settings ?? {} })),
})

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
})

after(() => {
  process.env.PATH = PATH
  fs.rmSync(root, { recursive: true, force: true })
})

describe('which rows get tried', () => {
  it('tries every installed row, in the board’s own order', () => {
    board(everyHarness())
    onPath(...ALL)
    assert.deepEqual(runnableAgents(), ['global', ...HARNESSES.slice(1).map((h) => h.name)])
  })

  it('starts at Global default, which is the first row', () => {
    board(everyHarness())
    onPath(...ALL)
    assert.equal(runnableAgents()[0], 'global')
  })

  it('skips a row whose CLI is not on the PATH', () => {
    board(rows({ id: 'global', harness: 'claude-code' }, { id: 'cheap', harness: 'cursor' }))
    onPath('claude')
    assert.deepEqual(runnableAgents(), ['global'])
  })

  it('tries nothing on a machine with no CLI installed', () => {
    board(everyHarness())
    onPath()
    assert.deepEqual(runnableAgents(), [])
  })

  it('skips a row whose provider still wants a setting', () => {
    board(
      rows(
        { id: 'global', harness: 'claude-code', settings: { provider: 'endpoint' } },
        { id: 'cheap', harness: 'codex' },
      ),
    )
    onPath('claude', 'codex')
    assert.deepEqual(runnableAgents(), ['cheap'])
  })

  it('tries it once that setting is filled in', () => {
    board(
      rows({
        id: 'global',
        harness: 'claude-code',
        settings: { provider: 'endpoint', baseUrl: 'http://localhost:4000' },
      }),
    )
    onPath('claude')
    assert.deepEqual(runnableAgents(), ['global'])
  })

  it('counts a key held under that row’s own name as filled in', () => {
    const board_ = rows({
      id: 'global',
      harness: 'kimi',
      settings: { provider: 'endpoint', modelName: 'kimi-k3', baseUrl: 'http://localhost:4000' },
    })
    board(board_)
    onPath('kimi')
    assert.deepEqual(runnableAgents(), [])
    board(board_, 'KIMI_MODEL_API_KEY__GLOBAL=sk-kimi\n')
    assert.deepEqual(runnableAgents(), ['global'])
  })

  it('looks up the binary a row’s command override names, not the CLI default', () => {
    board(rows({ id: 'global', harness: 'claude-code', settings: { command: 'my-claude -p' } }))
    onPath('my-claude')
    assert.deepEqual(runnableAgents(), ['global'])
  })
})

// And the same question asked of the CONNECTORS, which is what the guided first run walks: it
// is choosing the harness Global default runs, and a board it has never touched holds one row.
describe('which connectors the first run tries', () => {
  it('tries every installed one, though the board holds a single runtime', () => {
    board({})
    onPath(...ALL)
    assert.deepEqual(runnableAgents(), ['global'])
    assert.deepEqual(runnableHarnesses(), HARNESSES.map((h) => h.name))
  })

  it('skips one whose CLI is not on the PATH', () => {
    board({})
    onPath('claude')
    assert.deepEqual(runnableHarnesses(), ['claude-code'])
  })

  it('reads the row already on a connector, and the connector’s own defaults where none is', () => {
    board(rows({ id: 'global', harness: 'claude-code', settings: { provider: 'endpoint' } }))
    onPath('claude', 'codex')
    // Global default is on Claude Code and its endpoint has no base URL, so that one is off;
    // Codex has no row at all and reads as its own default, which wants nothing.
    assert.deepEqual(runnableHarnesses(), ['codex'])
  })
})
