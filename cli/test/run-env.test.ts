// The variable a key reaches a run under. ZCode is the one connector where that name is not
// the name of its docs/kanban/.env line — the file keeps ZAI_API_KEY so the box can't fight
// Claude Code's, and the run gets ANTHROPIC_API_KEY, which is what ZCode's Z.AI provider
// reads. Nothing on a screen shows that rename, so this is what holds it (#282).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { agentInfo, openPlan, planRun } from '../src/lib/agent/resolve.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-env-'))
const kanban = path.join(root, 'docs', 'kanban')

function board(env: string): void {
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify({ harness: 'zcode' }))
  fs.writeFileSync(path.join(kanban, '.env'), env)
  setBoardRoot(root)
}

const runEnv = (): NodeJS.ProcessEnv => openPlan(planRun('s1', root)).env

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  delete process.env.ANTHROPIC_API_KEY
})

after(() => {
  delete process.env.ANTHROPIC_API_KEY
  fs.rmSync(root, { recursive: true, force: true })
})

describe("ZCode's key", () => {
  it('reaches the run as ANTHROPIC_API_KEY', () => {
    board('ZAI_API_KEY=sk-zai\n')
    assert.equal(runEnv().ANTHROPIC_API_KEY, 'sk-zai')
  })

  it('leaves a run with an empty key box unsigned rather than on a stray one', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-claude'
    board('')
    assert.equal(runEnv().ANTHROPIC_API_KEY, undefined)
  })

  it('overrides a stray key exported for another agent', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-claude'
    board('ZAI_API_KEY=sk-zai\n')
    assert.equal(runEnv().ANTHROPIC_API_KEY, 'sk-zai')
  })

  it('is the only way in — the connector offers no sign-in pick', () => {
    board('')
    const zcode = agentInfo().options.find((o) => o.name === 'zcode')
    assert.ok(zcode)
    // `args` is every harness's, added to the list in agent/harnesses/index.ts (#343).
    assert.deepEqual(
      zcode.settings.map((s) => s.key),
      ['model', 'apiKey', 'args'],
    )
  })
})
