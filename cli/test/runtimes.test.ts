// A runtime, and what it runs as here (#343).
//
// What is asked here is the whole of the promise: a board that names no runtimes runs
// exactly as it did before they existed; a flow, a pass a flow spawns, and a spec agent each
// come up on the right one; a runtime nobody bound here falls back and says so in the run's
// log; and a resume stays on the agent it started on.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { agentInfo, planResume, planRun, skillCall } from '../src/lib/agent/resolve.ts'
import { runtimeFor } from '../src/lib/agent/runtime.ts'
import {
  addRuntime,
  readRuntimes,
  removeRuntime,
  renameRuntime,
  setFlowRuntime,
  setRuntimeComputer,
  setSpecAgentRuntime,
  specAgentEntries,
} from '../src/lib/agent/settings.ts'
import { runtimesHere } from '../src/lib/cloud/servers.ts'
import { readSpecAgents } from '../src/lib/spec-agents.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''
let home = ''

const config = (cfg: Record<string, unknown>): void => {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

const bind = (bindings: Record<string, unknown>): void => {
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(path.join(home, 'runtimes.json'), JSON.stringify(bindings, null, 2))
}

// What one flow spawns: the agent it ran under, and the argv, so a setting that reached the
// run through the wrong block would show up here rather than pass.
const plan = (ask: Parameters<typeof runtimeFor>[0]) => planRun('s1', root, runtimeFor(ask))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runtime-board-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runtime-home-'))
  process.env.AI4KANBAN_HOME = home
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
})

describe('a board that names no runtimes', () => {
  it('runs every flow on what `harness` and `harnessSettings` already say', () => {
    config({ harness: 'codex', harnessSettings: { codex: { model: 'gpt-5.1-codex' } } })
    for (const action of ['implement', 'review', 'clarify', 'setup', 'propose'] as const) {
      const run = plan({ action })
      assert.equal(run.harness, 'codex')
      assert.ok(run.argv.includes('gpt-5.1-codex'))
      // Nothing to say about a runtime nobody named.
      assert.equal(run.note, null)
    }
  })

  it('reads as the one runtime, with nothing written into the file', () => {
    config({ harness: 'claude-code' })
    const runtimes = readRuntimes()
    assert.equal(runtimes.named, false)
    assert.deepEqual(runtimes.names, ['default'])
    assert.equal(agentInfo().globalRuntime, 'default')
  })
})

describe('a flow on its own runtime', () => {
  const board = {
    harness: 'claude-code',
    harnessSettings: { 'claude-code': { model: 'claude-opus-5' } },
    runtimes: { names: ['default', 'cheap'], global: 'default', flows: { implement: 'cheap' } },
    specAgents: { 'ui-design': { runtime: 'cheap', mockupStyle: 'ascii' } },
  }

  beforeEach(() => {
    config(board)
    bind({
      default: { harness: 'claude-code', settings: { model: 'claude-opus-5' } },
      cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } },
    })
  })

  it('spawns the agent its runtime is bound to here', () => {
    const run = plan({ action: 'implement' })
    assert.equal(run.runtime, 'cheap')
    assert.equal(run.harness, 'codex')
    assert.ok(run.argv.includes('gpt-5.1-codex'))
    assert.equal(run.note, null)
  })

  it('leaves every other flow on the global one', () => {
    const run = plan({ action: 'review' })
    assert.equal(run.runtime, 'default')
    assert.equal(run.harness, 'claude-code')
  })

  it('runs the passes a refine spawns on refine’s runtime', () => {
    config({ ...board, runtimes: { ...board.runtimes, flows: { refine: 'cheap' } } })
    for (const action of ['clarify', 'resolve', 'writing'] as const) {
      assert.equal(runtimeFor({ action, refineRound: 1 }), 'cheap')
    }
    // And a `correct` still in flight belongs to review, not to the flow that named it.
    config({ ...board, runtimes: { ...board.runtimes, flows: { review: 'cheap' } } })
    assert.equal(runtimeFor({ action: 'correct' }), 'cheap')
  })

  it('keeps an `akb resolve` of its own on the resolve flow’s runtime', () => {
    // The same action as one of refine's passes, and only the round tells them apart: a
    // refine's `resolve` is refine's, and one a user typed is the `resolve` flow's.
    config({ ...board, runtimes: { ...board.runtimes, flows: { refine: 'cheap' } } })
    assert.equal(runtimeFor({ action: 'resolve' }), 'default')
    config({ ...board, runtimes: { ...board.runtimes, flows: { resolve: 'cheap' } } })
    assert.equal(runtimeFor({ action: 'resolve' }), 'cheap')
    assert.equal(runtimeFor({ action: 'resolve', refineRound: 2 }), 'default')
  })

  it('keeps `setup` on the global runtime whatever the file says', () => {
    config({ ...board, runtimes: { ...board.runtimes, flows: { setup: 'cheap' } } })
    assert.equal(runtimeFor({ action: 'setup' }), 'default')
  })

  it('runs a spec agent on the runtime its own entry names', () => {
    assert.equal(runtimeFor({ action: 'spec', specAgent: 'ui-design' }), 'cheap')
    assert.equal(runtimeFor({ action: 'spec', specAgent: 'technology-selection' }), 'default')
    assert.equal(plan({ action: 'spec', specAgent: 'ui-design' }).harness, 'codex')
  })

  it('keeps the spec agent’s runtime out of its settings, and its switch a switch', () => {
    // `runtime` is the entry's own key: `mockupStyle` is the only setting here, and the
    // agent is still on because nothing switched it off.
    assert.deepEqual(specAgentEntries()['ui-design'], {
      enabled: true,
      values: { mockupStyle: 'ascii' },
      runtime: 'cheap',
    })
    const view = readSpecAgents().find((a) => a.name === 'ui-design')
    assert.equal(view?.enabled, true)
    assert.equal(view?.values.mockupStyle, 'ascii')
    assert.equal(view?.runtime, 'cheap')
    assert.equal(view?.harness, 'codex')
  })

  it('calls the skill the way the runtime’s agent expects', () => {
    assert.equal(skillCall(runtimeFor({ action: 'implement' })), '$kanban')
    assert.equal(skillCall(runtimeFor({ action: 'review' })), '/kanban')
  })

  it('says what each flow runs on, for a front end that keeps no list', () => {
    const info = agentInfo()
    assert.equal(info.flows.find((f) => f.command === 'implement')?.harness, 'codex')
    assert.equal(info.flows.find((f) => f.command === 'review')?.harness, 'claude-code')
    assert.deepEqual(
      info.runtimes.map((r) => [r.name, r.harness, r.global]),
      [
        ['default', 'claude-code', true],
        ['cheap', 'codex', false],
      ],
    )
  })
})

// What this computer tells Cloud it runs the board's runtimes as (#345). The Worker caps and
// shapes what it is sent; this is the side that decides what leaves the machine at all.
describe('what a registration reports the runtimes as', () => {
  it('sends the name, the harness, the model and the fallback mark — and nothing else', () => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5', args: '--foo /Users/me/board' } },
      runtimes: { names: ['default', 'cheap'], global: 'default' },
    })
    bind({ default: { harness: 'claude-code', settings: { model: 'claude-opus-5', apiKey: 'sk-ant-secret' } } })
    assert.deepEqual(runtimesHere(), [
      { name: 'default', harness: 'claude-code', model: 'claude-opus-5' },
      // Nothing bound `cheap` here, so it falls back and says so.
      { name: 'cheap', harness: 'claude-code', model: 'claude-opus-5', fallback: true },
    ])
  })

  it('names no model where this computer set none', () => {
    config({ harness: 'claude-code', runtimes: { names: ['default'], global: 'default' } })
    bind({ default: { harness: 'codex', settings: {} } })
    assert.deepEqual(runtimesHere(), [{ name: 'default', harness: 'codex' }])
  })

  it('reports none on a board that names none', () => {
    config({ harness: 'codex', harnessSettings: { codex: { model: 'gpt-5.1-codex' } } })
    assert.deepEqual(runtimesHere(), [])
  })
})

describe('a runtime this computer has not bound', () => {
  beforeEach(() => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5' } },
      runtimes: { names: ['default', 'cheap'], global: 'default', flows: { implement: 'cheap' } },
    })
  })

  it('runs this computer’s global binding, and the log says so', () => {
    bind({ default: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } } })
    const run = plan({ action: 'implement' })
    assert.equal(run.runtime, 'cheap')
    assert.equal(run.harness, 'codex')
    assert.match(run.note ?? '', /runtime "cheap" is not bound on this computer/)
  })

  it('falls back the same way when its binding names an agent we don’t ship', () => {
    bind({
      default: { harness: 'codex', settings: {} },
      cheap: { harness: 'some-tool-from-the-future', settings: {} },
    })
    const run = plan({ action: 'implement' })
    assert.equal(run.harness, 'codex')
    assert.match(run.note ?? '', /bound to "some-tool-from-the-future"/)
  })

  it('runs what the board holds when this computer has bound nothing at all', () => {
    const run = plan({ action: 'implement' })
    assert.equal(run.harness, 'claude-code')
    assert.ok(run.argv.includes('claude-opus-5'))
    assert.match(run.note ?? '', /running Claude Code/)
  })
})

describe('the raw arguments', () => {
  it('go after the settings’ flags and before the agent’s own', () => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5', args: '--foo --bar=1' } },
    })
    const { argv } = planRun('s1', root)
    const model = argv.indexOf('claude-opus-5')
    const foo = argv.indexOf('--foo')
    const session = argv.indexOf('--session-id')
    assert.ok(model >= 0 && foo > model, `expected --foo after the model flag: ${argv.join(' ')}`)
    assert.deepEqual(argv.slice(foo, foo + 2), ['--foo', '--bar=1'])
    assert.ok(session > foo, `expected the agent's own arguments last: ${argv.join(' ')}`)
  })

  it('are a binding’s to carry too, and never the board’s block', () => {
    config({
      harness: 'claude-code',
      runtimes: { names: ['default'], global: 'default' },
    })
    bind({ default: { harness: 'codex', settings: { args: '--search' } } })
    assert.ok(planRun('s1', root).argv.includes('--search'))
  })
})

describe('a resume', () => {
  beforeEach(() => {
    config({
      harness: 'claude-code',
      runtimes: { names: ['default', 'cheap'], global: 'default', flows: { implement: 'cheap' } },
    })
  })

  it('stays on the agent it started on while its runtime still resolves there', () => {
    bind({ cheap: { harness: 'claude-code', settings: {} } })
    const plan = planResume('claude-code', 'abc', root, 'cheap')
    assert.equal(plan?.harness, 'claude-code')
    assert.equal(plan?.runtime, 'cheap')
    assert.ok(plan?.argv.includes('--resume'))
  })

  it('is not offered once that runtime runs something else', () => {
    bind({ cheap: { harness: 'codex', settings: {} } })
    assert.equal(planResume('claude-code', 'abc', root, 'cheap'), null)
  })
})

describe('writing the runtime block', () => {
  beforeEach(() => config({ harness: 'claude-code' }))

  const held = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(root, 'docs', 'kanban', 'ui.config.json'), 'utf8'))

  it('adds one without moving the global, so every flow runs what it ran', () => {
    assert.equal(addRuntime('cheap').ok, true)
    assert.deepEqual(readRuntimes().names, ['default', 'cheap'])
    assert.equal(readRuntimes().global, 'default')
  })

  it('refuses a name that isn’t one word', () => {
    assert.equal(addRuntime('two words').ok, false)
  })

  it('refuses to remove the global one, and names the way out', () => {
    addRuntime('cheap')
    const res = removeRuntime('default')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /global runtime/)
  })

  it('leaves the flows that named a removed one on the global one', () => {
    addRuntime('cheap')
    setFlowRuntime('implement', 'cheap')
    assert.equal(removeRuntime('cheap').ok, true)
    assert.equal(runtimeFor({ action: 'implement' }), 'default')
    assert.deepEqual(readRuntimes().flows, {})
  })

  it('drops the block entirely when it says no more than a board that never had one', () => {
    addRuntime('cheap')
    removeRuntime('cheap')
    assert.equal(held().runtimes, undefined)
    assert.equal(readRuntimes().named, false)
  })

  it('keeps a spec agent’s switch and settings when its runtime changes', () => {
    config({ harness: 'claude-code', specAgents: { 'ui-design': { enabled: false, mockupStyle: 'ascii' } } })
    addRuntime('cheap')
    assert.equal(setSpecAgentRuntime('ui-design', 'cheap').ok, true)
    assert.deepEqual(held().specAgents, {
      'ui-design': { enabled: false, runtime: 'cheap', mockupStyle: 'ascii' },
    })
    // And back off it, leaving the entry exactly as it was before.
    assert.equal(setSpecAgentRuntime('ui-design', '').ok, true)
    assert.deepEqual(held().specAgents, { 'ui-design': { enabled: false, mockupStyle: 'ascii' } })
  })

  it('keeps a plain boolean a switch, and never writes a runtime beside nothing', () => {
    config({ harness: 'claude-code', specAgents: { 'ui-design': false } })
    assert.equal(specAgentEntries()['ui-design']?.enabled, false)
    addRuntime('cheap')
    setSpecAgentRuntime('ui-design', 'cheap')
    setSpecAgentRuntime('ui-design', '')
    assert.deepEqual(held().specAgents, { 'ui-design': false })
  })

  it('refuses a runtime the board doesn’t hold, and lists the ones it does', () => {
    addRuntime('cheap')
    const res = setFlowRuntime('implement', 'nope')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /default, cheap/)
  })

  it('clears a removed runtime’s spec agents too, so re-adding it never puts them back', () => {
    config({ harness: 'claude-code', specAgents: { 'ui-design': { mockupStyle: 'ascii' } } })
    addRuntime('cheap')
    setSpecAgentRuntime('ui-design', 'cheap')
    assert.equal(removeRuntime('cheap').ok, true)
    assert.equal(readSpecAgents().find((a) => a.name === 'ui-design')?.runtime, 'default')
    addRuntime('cheap')
    assert.equal(readSpecAgents().find((a) => a.name === 'ui-design')?.runtime, 'default')
    assert.deepEqual(held().specAgents, { 'ui-design': { mockupStyle: 'ascii' } })
  })
})

// A rename (#344). The board's half moves whole; this computer's binding is COPIED, because
// `~/.ai4kanban/runtimes.json` is keyed by name alone and every board on this machine shares
// an entry.
describe('renaming a runtime', () => {
  const held = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(root, 'docs', 'kanban', 'ui.config.json'), 'utf8'))
  const bindings = (): Record<string, { harness: string; settings: Record<string, string> }> =>
    JSON.parse(fs.readFileSync(path.join(home, 'runtimes.json'), 'utf8'))

  beforeEach(() => {
    config({
      harness: 'claude-code',
      runtimes: { names: ['default', 'cheap'], global: 'default', flows: { implement: 'cheap' } },
      specAgents: { 'ui-design': { runtime: 'cheap', mockupStyle: 'ascii' } },
    })
  })

  it('carries the flows and the spec agents that named it', () => {
    assert.equal(renameRuntime('cheap', 'plan').ok, true)
    assert.deepEqual(readRuntimes().names, ['default', 'plan'])
    assert.equal(runtimeFor({ action: 'implement' }), 'plan')
    assert.deepEqual(held().specAgents, { 'ui-design': { runtime: 'plan', mockupStyle: 'ascii' } })
  })

  it('follows the global pointer when the renamed one was global', () => {
    assert.equal(renameRuntime('default', 'build').ok, true)
    assert.equal(readRuntimes().global, 'build')
    assert.deepEqual(readRuntimes().names, ['build', 'cheap'])
  })

  it('copies this computer’s binding rather than moving it', () => {
    bind({ cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } } })
    assert.equal(renameRuntime('cheap', 'plan').ok, true)
    assert.equal(bindings().plan?.harness, 'codex')
    assert.equal(bindings().plan?.settings.model, 'gpt-5.1-codex')
    // The old name keeps its own: another board on this machine may still name it.
    assert.equal(bindings().cheap?.harness, 'codex')
  })

  it('leaves another computer reading the new name as unbound', () => {
    bind({ default: { harness: 'claude-code', settings: {} } })
    assert.equal(renameRuntime('cheap', 'plan').ok, true)
    const run = plan({ action: 'implement' })
    assert.equal(run.runtime, 'plan')
    assert.match(run.note ?? '', /runtime "plan" is not bound on this computer/)
  })

  it('refuses a name the board already holds, and one that isn’t a name', () => {
    assert.equal(renameRuntime('cheap', 'default').ok, false)
    assert.equal(renameRuntime('cheap', 'two words').ok, false)
    assert.equal(renameRuntime('nope', 'plan').ok, false)
    assert.deepEqual(readRuntimes().names, ['default', 'cheap'])
  })

  it('refuses one on a board that names no runtimes at all', () => {
    config({ harness: 'claude-code' })
    const res = renameRuntime('default', 'build')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /names no runtimes/)
  })
})

// What a screen offering the runtimes is handed (#344): the binding behind each one, this
// computer's own name, and whether the board names any at all.
describe('what the agent info says about a runtime', () => {
  it('carries the binding this computer made, and what it is set to', () => {
    config({ harness: 'claude-code', runtimes: { names: ['default', 'cheap'], global: 'default' } })
    bind({ cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } } })
    const info = agentInfo()
    assert.equal(info.namedRuntimes, true)
    assert.equal(typeof info.machine, 'string')
    const cheap = info.runtimes.find((r) => r.name === 'cheap')
    assert.equal(cheap?.binding?.harness, 'codex')
    assert.equal(cheap?.binding?.values.model, 'gpt-5.1-codex')
    assert.equal(cheap?.fallback, undefined)
  })

  it('carries no binding for one that fell back, and says what ran instead', () => {
    config({ harness: 'claude-code', runtimes: { names: ['default', 'cheap'], global: 'default' } })
    bind({ default: { harness: 'codex', settings: {} } })
    const cheap = agentInfo().runtimes.find((r) => r.name === 'cheap')
    assert.equal(cheap?.binding, undefined)
    assert.equal(cheap?.fallback?.was, 'unbound')
    assert.equal(cheap?.fallback?.ran, 'global')
  })

  it('says the board’s own harness ran when this computer has bound nothing', () => {
    config({ harness: 'claude-code', runtimes: { names: ['default', 'cheap'], global: 'default' } })
    const cheap = agentInfo().runtimes.find((r) => r.name === 'cheap')
    assert.equal(cheap?.fallback?.ran, 'board')
  })

  it('says a board that names none names none', () => {
    config({ harness: 'claude-code' })
    assert.equal(agentInfo().namedRuntimes, false)
  })
})

// Which computer a runtime is meant to run on (#370). The board holds the answer beside the
// names, so everyone on the repository reads the same one; what that computer RUNS it as
// stays in that computer's own file. Set, not routed — nothing here dispatches by it (#371).
describe('the computer a runtime runs on', () => {
  const held = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(root, 'docs', 'kanban', 'ui.config.json'), 'utf8'))
  const block = (): Record<string, unknown> => held().runtimes as Record<string, unknown>

  beforeEach(() => {
    config({ harness: 'claude-code', runtimes: { names: ['default', 'cheap'], global: 'default' } })
  })

  it('is absent until the pick is made, and reaches the pane once it is', () => {
    assert.deepEqual(readRuntimes().computers, {})
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.computer, undefined)
    assert.equal(setRuntimeComputer('cheap', 'buildbox').ok, true)
    assert.deepEqual(block().computers, { cheap: 'buildbox' })
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.computer, 'buildbox')
  })

  it('goes back to nothing, which is the computer the run starts on', () => {
    setRuntimeComputer('cheap', 'buildbox')
    assert.equal(setRuntimeComputer('cheap', '').ok, true)
    assert.deepEqual(readRuntimes().computers, {})
    assert.equal(block().computers, undefined)
  })

  it('refuses a runtime the board doesn’t hold, and lists the ones it does', () => {
    const res = setRuntimeComputer('nope', 'buildbox')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /default, cheap/)
  })

  it('changes nothing about where a run actually lands', () => {
    bind({ default: { harness: 'codex', settings: {} } })
    setFlowRuntime('implement', 'cheap')
    setRuntimeComputer('cheap', 'buildbox')
    const run = plan({ action: 'implement' })
    assert.equal(run.runtime, 'cheap')
    assert.equal(run.harness, 'codex')
  })

  it('is carried by a rename and dropped by a removal', () => {
    setRuntimeComputer('cheap', 'buildbox')
    assert.equal(renameRuntime('cheap', 'plan').ok, true)
    assert.deepEqual(readRuntimes().computers, { plan: 'buildbox' })
    assert.equal(removeRuntime('plan').ok, true)
    assert.deepEqual(readRuntimes().computers, {})
  })

  it('takes a hostname of any length the pane can put on the list', () => {
    assert.equal(setRuntimeComputer('cheap', 'a'.repeat(253)).ok, true)
    assert.equal(setRuntimeComputer('cheap', 'has a space in it').ok, true)
    assert.equal(setRuntimeComputer('cheap', 'a'.repeat(254)).ok, false)
    assert.equal(setRuntimeComputer('cheap', 'two\nlines').ok, false)
  })

  it('drops one naming a runtime the board no longer holds', () => {
    config({
      harness: 'claude-code',
      runtimes: { names: ['default'], global: 'default', computers: { gone: 'buildbox' } },
    })
    assert.deepEqual(readRuntimes().computers, {})
  })

  it('keeps the block on a lone default that names a computer', () => {
    config({ harness: 'claude-code', runtimes: { names: ['default'], global: 'default' } })
    assert.equal(setRuntimeComputer('default', 'buildbox').ok, true)
    assert.deepEqual(block().computers, { default: 'buildbox' })
    assert.equal(readRuntimes().named, true)
  })
})
