// Which account a Codex run goes through (#95 for Codex), and how hard its model thinks.
//
// Codex takes none of this as a flag of its own: the provider, its address and the effort
// level all reach it as `-c key=value` overrides. So what is asked here is the argv — that
// each pick writes the block it needs and no other, that the key only ever reaches the picks
// that use it, and that a hand-written `command` naming the provider wins outright.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { agentInfo, openPlan, planRun, planResume } from '../src/lib/agent/resolve.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

/** A board whose one runtime is on Codex, with the settings and the `.env` this test wants. */
function board(settings: Record<string, unknown> = {}, env = ''): void {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(
    path.join(kanban, 'ui.config.json'),
    JSON.stringify({ runtimes: [{ id: 'global', name: 'Global default', harness: 'codex', settings }] }),
  )
  fs.writeFileSync(path.join(kanban, '.env'), env)
  setBoardRoot(root)
}

const argv = (): string[] => planRun('s1', root).argv
const runEnv = (): NodeJS.ProcessEnv => openPlan(planRun('s1', root)).env

const QUIET = ['check_for_update_on_startup=false', 'notice.hide_rate_limit_model_nudge=true']

/** The `-c` overrides one run carries, as `key=value`, so an assertion reads like the
 *  config it writes rather than like a walk over argv. The sandbox's overrides and the
 *  startup defaults are left out; their own blocks below ask about them. */
const overrides = (): string[] =>
  argv().flatMap((tok, i) =>
    argv()[i - 1] === '-c' && !tok.startsWith('sandbox_') && !QUIET.includes(tok) ? [tok] : [])

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-codex-provider-'))
  spawnSync('git', ['init', '-q'], { cwd: root })
  delete process.env.OPENAI_API_KEY
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.OPENAI_API_KEY
})

describe('the ChatGPT subscription', () => {
  it('is what a board that picked nothing runs on', () => {
    board()
    assert.equal(agentInfo().values.provider, 'subscription')
  })

  // A key in the box is not a pick (#938). It stays there for the moment its provider is
  // chosen, and until then the run goes through the login the CLI already holds.
  it('is still the default on a board that holds a key but picked nothing', () => {
    board({}, 'OPENAI_API_KEY__GLOBAL=sk-board\n')
    assert.equal(agentInfo().values.provider, 'subscription')
    assert.equal(runEnv().OPENAI_API_KEY, undefined)
  })

  it('declares no provider of its own — the CLI runs on its own login', () => {
    board({ provider: 'subscription' })
    assert.deepEqual(overrides(), [])
  })

  // The pick is a config key, not a flag: it reaches the run inside the provider's own
  // arguments or not at all. Appending it the way a model is appended would hand `codex
  // exec` a bare word it reads as a subcommand, and the run would exit before it started.
  it('puts neither the pick nor its name on the command line', () => {
    board({ provider: 'subscription' })
    assert.deepEqual(argv(), ['codex', 'exec', '--json', '--dangerously-bypass-approvals-and-sandbox', '-c', 'check_for_update_on_startup=false', '-c', 'notice.hide_rate_limit_model_nudge=true'])
  })

  it('never carries a key, not even one the board holds', () => {
    board({ provider: 'subscription' }, 'OPENAI_API_KEY__GLOBAL=sk-board\n')
    assert.equal(runEnv().OPENAI_API_KEY, undefined)
  })

  it('drops a key exported in the shell, so the pick is what runs', () => {
    process.env.OPENAI_API_KEY = 'sk-stray'
    board({ provider: 'subscription' })
    assert.equal(runEnv().OPENAI_API_KEY, undefined)
  })
})

describe('the OpenAI API', () => {
  it('runs through a provider of the board’s own that reads the key', () => {
    board({ provider: 'openai-api' }, 'OPENAI_API_KEY__GLOBAL=sk-board\n')
    assert.ok(!argv().includes('openai-api'), `the pick is a config key, never a bare word: ${argv().join(' ')}`)
    assert.deepEqual(overrides(), [
      'model_providers.openai-api.name=OpenAI',
      'model_providers.openai-api.base_url=https://api.openai.com/v1',
      'model_providers.openai-api.env_key=OPENAI_API_KEY',
      'model_provider=openai-api',
    ])
    assert.equal(runEnv().OPENAI_API_KEY, 'sk-board')
  })

  it('is kept once picked, and goes on using the key the board holds', () => {
    board({ provider: 'openai-api' }, 'OPENAI_API_KEY__GLOBAL=sk-board\n')
    assert.equal(agentInfo().values.provider, 'openai-api')
  })
})

describe('an OpenAI-compatible endpoint', () => {
  it('sends the run to the address the box holds', () => {
    board({ provider: 'endpoint', baseUrl: 'https://gateway.example.com/v1' })
    assert.deepEqual(overrides(), [
      'model_providers.endpoint.name=Endpoint',
      'model_providers.endpoint.env_key=OPENAI_API_KEY',
      'model_provider=endpoint',
      'model_providers.endpoint.base_url=https://gateway.example.com/v1',
    ])
  })

  it('runs unsigned when the gateway takes no key', () => {
    board({ provider: 'endpoint', baseUrl: 'https://gateway.example.com/v1' })
    assert.equal(runEnv().OPENAI_API_KEY, undefined)
  })
})

describe('the endpoint address', () => {
  it('reaches no other pick, however long it has been in the file', () => {
    board({ provider: 'openai-api', baseUrl: 'https://gateway.example.com/v1' })
    assert.ok(!argv().some((tok) => tok.includes('gateway.example.com')))
  })
})

describe('the reasoning effort', () => {
  it('rides on Codex’s own config flag', () => {
    board({ reasoning: 'xhigh' })
    const at = argv().indexOf('model_reasoning_effort=xhigh')
    assert.equal(argv()[at - 1], '-c', argv().join(' '))
  })

  it('is left out entirely on the agent’s default', () => {
    board({ reasoning: '' })
    assert.ok(!argv().some((tok) => tok.startsWith('model_reasoning_effort')))
  })

  it('gives way to a command that already names one', () => {
    board({ command: 'codex exec -c model_reasoning_effort=low', reasoning: 'xhigh' })
    assert.ok(!argv().includes('model_reasoning_effort=xhigh'))
  })
})

// A background run must never stop on an approval or a sandbox fence, so the default is the
// bypass; a command that names its own sandbox keeps it.
describe('the sandbox', () => {
  it('is bypassed by default, on fresh and resumed runs alike', () => {
    board()
    for (const run of [planRun('s1', root), planResume('codex', 's1', root)]) {
      assert.ok(run)
      assert.ok(run.argv.includes('--dangerously-bypass-approvals-and-sandbox'), run.argv.join(' '))
      assert.ok(!run.argv.includes('workspace-write'), run.argv.join(' '))
    }
  })

  it('is left entirely to a command that names one', () => {
    board({ command: 'codex exec --json --sandbox read-only' })
    assert.ok(!argv().includes('--dangerously-bypass-approvals-and-sandbox'), argv().join(' '))
    assert.ok(!argv().some((tok) => tok.startsWith('sandbox_')), argv().join(' '))
  })

  it('is added to a command that names none', () => {
    board({ command: 'codex exec' })
    assert.deepEqual(argv(), ['codex', 'exec', '--json', '--dangerously-bypass-approvals-and-sandbox', '-c', 'check_for_update_on_startup=false', '-c', 'notice.hide_rate_limit_model_nudge=true'])
  })

  it('reads a saved former default as the default', () => {
    for (const command of [
      'codex exec --json --sandbox workspace-write',
      'codex exec --json --sandbox workspace-write -c sandbox_workspace_write.network_access=true',
    ]) {
      board({ command })
      assert.deepEqual(argv(), ['codex', 'exec', '--json', '--dangerously-bypass-approvals-and-sandbox', '-c', 'check_for_update_on_startup=false', '-c', 'notice.hide_rate_limit_model_nudge=true'])
    }
  })
})

// Either prompt would stall an unattended pane.
describe('the startup prompts', () => {
  it('are turned off on fresh and resumed runs alike', () => {
    board()
    for (const run of [planRun('s1', root), planResume('codex', 's1', root)]) {
      assert.ok(run)
      for (const config of QUIET) {
        assert.equal(run.argv[run.argv.indexOf(config) - 1], '-c', run.argv.join(' '))
      }
    }
  })

  it('reach a hand-written command too', () => {
    board({ command: 'codex exec --json --sandbox read-only' })
    assert.ok(QUIET.every((config) => argv().includes(config)), argv().join(' '))
  })

  it('leave a command that names one of them alone', () => {
    board({ command: 'codex exec -c check_for_update_on_startup=true --config notice.hide_rate_limit_model_nudge=false' })
    assert.ok(!argv().some((tok) => QUIET.includes(tok)), argv().join(' '))
  })
})

describe('a command that picks the provider by hand', () => {
  it('wins, and the whole block the pick would have written is dropped', () => {
    board({ command: 'codex exec -c model_provider=mine', provider: 'endpoint', baseUrl: 'https://g/v1' })
    assert.deepEqual(overrides(), ['model_provider=mine'])
  })
})


describe('checkout-local state from a delivery worktree', () => {
  it('allows the owning board and local state to a workspace-write run, fresh or resumed', () => {
    board({ command: 'codex exec --json --sandbox workspace-write -c sandbox_workspace_write.network_access=false' })
    const cwd = path.join(root, '.akb/worktrees/delivery')
    for (const run of [planRun('s1', cwd), planResume('codex', 's1', cwd)]) {
      assert.ok(run)
      const dirs = run.argv.flatMap((arg, i) => arg === '--add-dir' ? [run.argv[i + 1]] : [])
      assert.deepEqual(dirs, [path.join(root, 'docs/kanban'), path.join(root, '.akb')])
    }
  })

  it('adds nothing to the default bypass', () => {
    board()
    assert.ok(!planRun('s1', path.join(root, '.akb/worktrees/delivery')).argv.includes('--add-dir'))
  })

  it('keeps an explicitly read-only run read-only', () => {
    board({ command: 'codex exec --json --sandbox read-only' })
    assert.ok(!planRun('s1', path.join(root, '.akb/worktrees/delivery')).argv.includes('--add-dir'))
  })
})
