// Which account a Claude Code run goes through (#95, #938).
//
// Claude Code takes none of it on the command line: the pick reaches the run as the
// environment it starts under. So what is asked here is that environment — which provider a
// board reads as before anybody picks one, and that the key only ever reaches the picks that
// use it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { agentInfo, openPlan, planRun } from '../src/lib/agent/resolve.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

/** A board whose one runtime is on Claude Code, with the settings and the `.env` this test
 *  wants. */
function board(settings: Record<string, unknown> = {}, env = ''): void {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(
    path.join(kanban, 'ui.config.json'),
    JSON.stringify({
      runtimes: [{ id: 'global', name: 'Global default', harness: 'claude-code', settings }],
    }),
  )
  fs.writeFileSync(path.join(kanban, '.env'), env)
  setBoardRoot(root)
}

const runEnv = (): NodeJS.ProcessEnv => openPlan(planRun('s1', root)).env

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-claude-provider-'))
  spawnSync('git', ['init', '-q'], { cwd: root })
  delete process.env.ANTHROPIC_API_KEY
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.ANTHROPIC_API_KEY
})

describe('the Claude subscription', () => {
  it('is what a board that picked nothing runs on', () => {
    board()
    assert.equal(agentInfo().values.provider, 'subscription')
  })

  // A key in the box is not a pick (#938). It stays there for the moment its provider is
  // chosen, and until then the run goes through the login the CLI already holds.
  it('is still the default on a board that holds a key but picked nothing', () => {
    board({}, 'ANTHROPIC_API_KEY__GLOBAL=sk-ant\n')
    assert.equal(agentInfo().values.provider, 'subscription')
    assert.equal(runEnv().ANTHROPIC_API_KEY, undefined)
  })

  it('drops a key exported in the shell, so the pick is what runs', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-stray'
    board({ provider: 'subscription' })
    assert.equal(runEnv().ANTHROPIC_API_KEY, undefined)
  })
})

describe('the Anthropic API', () => {
  it('is kept once picked, and signs the run with the key the board holds', () => {
    board({ provider: 'anthropic-api' }, 'ANTHROPIC_API_KEY__GLOBAL=sk-ant\n')
    assert.equal(agentInfo().values.provider, 'anthropic-api')
    assert.equal(runEnv().ANTHROPIC_API_KEY, 'sk-ant')
  })
})
