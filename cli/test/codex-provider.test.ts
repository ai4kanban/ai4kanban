// Which account a Codex run goes through (#95 for Codex), and how hard its model thinks.
//
// Codex takes none of this as a flag of its own: the provider, its address and the effort
// level all reach it as `-c key=value` overrides. So what is asked here is the argv — that
// each pick writes the block it needs and no other, that the key only ever reaches the picks
// that use it, and that a hand-written `command` naming the provider wins outright.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { agentInfo, openPlan, planRun } from '../src/lib/agent/resolve.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

/** A board on Codex, with the settings block and the `.env` this test wants. */
function board(settings: Record<string, unknown> = {}, env = ''): void {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(
    path.join(kanban, 'ui.config.json'),
    JSON.stringify({ harness: 'codex', harnessSettings: { codex: settings } }),
  )
  fs.writeFileSync(path.join(kanban, '.env'), env)
  setBoardRoot(root)
}

const argv = (): string[] => planRun('s1', root).argv
const runEnv = (): NodeJS.ProcessEnv => openPlan(planRun('s1', root)).env

/** The `-c` overrides one run carries, as `key=value`, so an assertion reads like the
 *  config it writes rather than like a walk over argv. The sandbox's own overrides are left
 *  out: they ride with the sandbox the board picks, not with a provider or a setting, and
 *  `the sandbox` below is where they are asked about. */
const overrides = (): string[] =>
  argv().flatMap((tok, i) => (argv()[i - 1] === '-c' && !tok.startsWith('sandbox_') ? [tok] : []))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-codex-provider-'))
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

  it('declares no provider of its own — the CLI runs on its own login', () => {
    board({ provider: 'subscription' })
    assert.deepEqual(overrides(), [])
  })

  // The pick is a config key, not a flag: it reaches the run inside the provider's own
  // arguments or not at all. Appending it the way a model is appended would hand `codex
  // exec` a bare word it reads as a subcommand, and the run would exit before it started.
  it('puts neither the pick nor its name on the command line', () => {
    board({ provider: 'subscription' })
    assert.deepEqual(argv(), [
      'codex',
      'exec',
      '--json',
      '--sandbox',
      'workspace-write',
      '-c',
      'sandbox_workspace_write.network_access=true',
    ])
  })

  it('never carries a key, not even one the board holds', () => {
    board({ provider: 'subscription' }, 'OPENAI_API_KEY=sk-board\n')
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
    board({ provider: 'openai-api' }, 'OPENAI_API_KEY=sk-board\n')
    assert.ok(!argv().includes('openai-api'), `the pick is a config key, never a bare word: ${argv().join(' ')}`)
    assert.deepEqual(overrides(), [
      'model_providers.openai-api.name=OpenAI',
      'model_providers.openai-api.base_url=https://api.openai.com/v1',
      'model_providers.openai-api.env_key=OPENAI_API_KEY',
      'model_provider=openai-api',
    ])
    assert.equal(runEnv().OPENAI_API_KEY, 'sk-board')
  })

  it('is what a board holding a key reads as, so a pasted key goes on being used', () => {
    board({}, 'OPENAI_API_KEY=sk-board\n')
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
    assert.deepEqual(argv().slice(-2), ['-c', 'model_reasoning_effort=xhigh'])
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

// The fence a Codex run works inside, and the one thing about it the board had to choose
// deliberately. `workspace-write` blocks the network by default, and Codex is the only
// connector that fences it at all — so a card needing an `npm install` would pass on five
// agents and fail on this one. The network is opened with the sandbox and never apart from
// it: a hand-written sandbox is someone choosing for themselves, network included.
describe('the sandbox', () => {
  it('opens the network alongside the workspace the board writes in', () => {
    board()
    assert.deepEqual(argv().slice(-4), [
      '--sandbox',
      'workspace-write',
      '-c',
      'sandbox_workspace_write.network_access=true',
    ])
  })

  it('is left entirely to a command that names one, network and all', () => {
    board({ command: 'codex exec --json --sandbox read-only' })
    assert.ok(!argv().some((tok) => tok.startsWith('sandbox_')), argv().join(' '))
  })

  it('is added whole to a command that names none', () => {
    board({ command: 'codex exec' })
    assert.deepEqual(argv(), [
      'codex',
      'exec',
      '--json',
      '--sandbox',
      'workspace-write',
      '-c',
      'sandbox_workspace_write.network_access=true',
    ])
  })
})

describe('a command that picks the provider by hand', () => {
  it('wins, and the whole block the pick would have written is dropped', () => {
    board({ command: 'codex exec -c model_provider=mine', provider: 'endpoint', baseUrl: 'https://g/v1' })
    assert.deepEqual(overrides(), ['model_provider=mine'])
  })
})
