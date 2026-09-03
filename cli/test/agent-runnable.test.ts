// Which agents the first run tries before it draws a picker (#404).
//
// The probe spends a real call on every name this list holds, so what keeps it cheap is
// what is left OFF: an agent whose CLI isn't here, and one whose provider still wants a
// setting nobody filled in — trying that one would ask for the very key the probe exists to
// spare the user.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { HARNESSES } from '../src/lib/agent/harnesses/index.ts'
import { commandBinary } from '../src/lib/agent/installed.ts'
import { runnableAgents } from '../src/lib/agent/resolve.ts'
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

/** Every connector's binary, taken from the connectors themselves — a hand-written list here
 *  goes stale the next time one is added, and the test that reads "every installed agent"
 *  would then be run on a machine missing one. */
const ALL = HARNESSES.map((h) => commandBinary(h.command))

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
})

after(() => {
  process.env.PATH = PATH
  fs.rmSync(root, { recursive: true, force: true })
})

describe('who gets tried', () => {
  it('tries every installed agent, in the order they are declared', () => {
    board({})
    onPath(...ALL)
    assert.deepEqual(runnableAgents(), HARNESSES.map((h) => h.name))
  })

  it('puts Claude Code before Codex, and both before the rest', () => {
    board({})
    onPath(...ALL)
    assert.deepEqual(runnableAgents().slice(0, 2), ['claude-code', 'codex'])
  })

  it('skips an agent whose CLI is not on the PATH', () => {
    board({})
    onPath('claude', 'codex')
    assert.deepEqual(runnableAgents(), ['claude-code', 'codex'])
  })

  it('tries nothing on a machine with no agent installed', () => {
    board({})
    onPath()
    assert.deepEqual(runnableAgents(), [])
  })

  it('skips an agent whose provider still wants a setting', () => {
    board({ harnessSettings: { 'claude-code': { provider: 'endpoint' } } })
    onPath('claude', 'codex')
    assert.deepEqual(runnableAgents(), ['codex'])
  })

  it('tries it once that setting is filled in', () => {
    board({ harnessSettings: { 'claude-code': { provider: 'endpoint', baseUrl: 'http://localhost:4000' } } })
    onPath('claude')
    assert.deepEqual(runnableAgents(), ['claude-code'])
  })

  it('counts a key held in docs/kanban/.env as filled in', () => {
    const settings = { kimi: { provider: 'endpoint', modelName: 'kimi-k3', baseUrl: 'http://localhost:4000' } }
    board({ harnessSettings: settings })
    onPath('kimi')
    assert.deepEqual(runnableAgents(), [])
    board({ harnessSettings: settings }, 'KIMI_MODEL_API_KEY=sk-kimi\n')
    assert.deepEqual(runnableAgents(), ['kimi'])
  })

  it('looks up the binary a command override names, not the connector default', () => {
    board({ harnessSettings: { 'claude-code': { command: 'my-claude -p' } } })
    onPath('my-claude')
    assert.deepEqual(runnableAgents(), ['claude-code'])
  })
})
