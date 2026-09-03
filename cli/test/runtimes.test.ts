// A runtime, and what it runs as (#343).
//
// What is asked here is the whole of the promise: a board that names no runtimes runs
// exactly as it did before they existed; a flow, a pass a flow spawns, and a spec skill each
// come up on the right one; every answer lives in the board's own file, so a fresh clone
// runs what everyone else runs; and a resume stays on the agent it started on.

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
  setGlobalRuntime,
  setRuntimeHarness,
  setRuntimeSetting,
  setSpecAgentRuntime,
  specAgentEntries,
} from '../src/lib/agent/settings.ts'
import { runtimesHere } from '../src/lib/cloud/servers.ts'
import { readSpecSkills } from '../src/lib/spec-skills/index.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const config = (cfg: Record<string, unknown>): void => {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

const held = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(root, 'docs', 'kanban', 'ui.config.json'), 'utf8'))

const block = (): Record<string, unknown> => (held().runtimes ?? {}) as Record<string, unknown>

// What one flow spawns: the agent it ran under, and the argv, so a setting that reached the
// run through the wrong block would show up here rather than pass.
const plan = (ask: Parameters<typeof runtimeFor>[0]) => planRun('s1', root, runtimeFor(ask))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runtime-board-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
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
    runtimes: {
      names: ['default', 'cheap'],
      global: 'default',
      flows: { implement: 'cheap' },
      agents: { cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } } },
    },
    specAgents: { 'ui-design': { runtime: 'cheap', mockupStyle: 'ascii' } },
  }

  beforeEach(() => config(board))

  it('spawns the agent the board gave that runtime', () => {
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

  it('runs a spec skill on the runtime its own entry names', () => {
    assert.equal(runtimeFor({ action: 'spec', specAgent: 'ui-design' }), 'cheap')
    assert.equal(runtimeFor({ action: 'spec', specAgent: 'technology-selection' }), 'default')
    assert.equal(plan({ action: 'spec', specAgent: 'ui-design' }).harness, 'codex')
  })

  it('keeps the spec skill’s runtime out of its settings, and its switch a switch', () => {
    // `runtime` is the entry's own key: `mockupStyle` is the only setting here, and the
    // agent is still on because nothing switched it off.
    assert.deepEqual(specAgentEntries()['ui-design'], {
      enabled: true,
      values: { mockupStyle: 'ascii' },
      runtime: 'cheap',
    })
    const view = readSpecSkills().find((s) => s.name === 'ui-design')
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

// Where one runtime's settings come from: the agent's own block is the board's default for
// that tool, and the runtime's entry overrides it key by key.
describe('a runtime’s settings', () => {
  it('inherit the agent’s block and override it one key at a time', () => {
    config({
      harness: 'claude-code',
      harnessSettings: { codex: { model: 'gpt-5.1-codex', reasoning: 'high' } },
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        agents: { cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex-mini' } } },
      },
    })
    const cheap = agentInfo().runtimes.find((r) => r.name === 'cheap')
    assert.equal(cheap?.values.model, 'gpt-5.1-codex-mini')
    // Not overridden, so the board's own answer for Codex still reaches the run.
    assert.equal(cheap?.values.reasoning, 'high')
  })

  it('are the agent’s block alone when the entry names a different agent’s keys', () => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5' } },
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        agents: { cheap: { harness: 'claude-code', settings: {} } },
      },
    })
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.values.model, 'claude-opus-5')
  })
})

// What a registration reports the runtimes as (#345). Every machine reads the same board, so
// this is the board's answer rather than one computer's.
describe('what a registration reports the runtimes as', () => {
  it('sends the name, the agent and the model — and nothing else', () => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5', args: '--foo /Users/me/board' } },
      runtimes: { names: ['default', 'cheap'], global: 'default' },
    })
    assert.deepEqual(runtimesHere(), [
      { name: 'default', harness: 'claude-code', model: 'claude-opus-5' },
      // `cheap` says nothing of its own, so it runs the board's agent.
      { name: 'cheap', harness: 'claude-code', model: 'claude-opus-5' },
    ])
  })

  it('names no model where nothing set one', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default'],
        global: 'default',
        flows: { implement: 'default' },
      },
    })
    assert.deepEqual(runtimesHere(), [{ name: 'default', harness: 'claude-code' }])
  })

  it('reports none on a board that names none', () => {
    config({ harness: 'codex', harnessSettings: { codex: { model: 'gpt-5.1-codex' } } })
    assert.deepEqual(runtimesHere(), [])
  })
})

describe('a runtime with nothing of its own', () => {
  beforeEach(() => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5' } },
      runtimes: { names: ['default', 'cheap'], global: 'default', flows: { implement: 'cheap' } },
    })
  })

  it('runs the board’s agent, with nothing to say about it', () => {
    const run = plan({ action: 'implement' })
    assert.equal(run.runtime, 'cheap')
    assert.equal(run.harness, 'claude-code')
    assert.ok(run.argv.includes('claude-opus-5'))
    assert.equal(run.note, null)
  })

  it('falls back and says so when its entry names an agent we don’t ship', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        flows: { implement: 'cheap' },
        agents: { cheap: { harness: 'some-tool-from-the-future', settings: {} } },
      },
    })
    const run = plan({ action: 'implement' })
    assert.equal(run.harness, 'claude-code')
    assert.match(run.note ?? '', /set to "some-tool-from-the-future"/)
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.unknownHarness, 'some-tool-from-the-future')
  })

  it('never reads an entry left under the global runtime’s name', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default'],
        global: 'default',
        agents: { default: { harness: 'codex', settings: {} } },
      },
    })
    assert.deepEqual(readRuntimes().agents, {})
    assert.equal(planRun('s1', root).harness, 'claude-code')
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

  it('are a runtime entry’s to carry too', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        flows: { implement: 'cheap' },
        agents: { cheap: { harness: 'codex', settings: { args: '--search' } } },
      },
    })
    assert.ok(plan({ action: 'implement' }).argv.includes('--search'))
  })
})

describe('a resume', () => {
  it('stays on the agent it started on while its runtime still runs there', () => {
    config({
      harness: 'claude-code',
      runtimes: { names: ['default', 'cheap'], global: 'default', flows: { implement: 'cheap' } },
    })
    const plan = planResume('claude-code', 'abc', root, 'cheap')
    assert.equal(plan?.harness, 'claude-code')
    assert.equal(plan?.runtime, 'cheap')
    assert.ok(plan?.argv.includes('--resume'))
  })

  it('is not offered once that runtime runs something else', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        agents: { cheap: { harness: 'codex', settings: {} } },
      },
    })
    assert.equal(planResume('claude-code', 'abc', root, 'cheap'), null)
  })
})

describe('writing the runtime block', () => {
  beforeEach(() => config({ harness: 'claude-code' }))

  it('adds one without moving the global, so every flow runs what it ran', () => {
    assert.equal(addRuntime('cheap').ok, true)
    assert.deepEqual(readRuntimes().names, ['default', 'cheap'])
    assert.equal(readRuntimes().global, 'default')
    // And with nothing of its own it runs the board's agent.
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.harness, 'claude-code')
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

  it('drops what a removed runtime ran as, so re-adding it starts from the board’s agent', () => {
    addRuntime('cheap')
    setRuntimeHarness('cheap', 'codex')
    assert.equal(removeRuntime('cheap').ok, true)
    addRuntime('cheap')
    assert.deepEqual(readRuntimes().agents, {})
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.harness, 'claude-code')
  })

  it('drops the block entirely when it says no more than a board that never had one', () => {
    addRuntime('cheap')
    removeRuntime('cheap')
    assert.equal(held().runtimes, undefined)
    assert.equal(readRuntimes().named, false)
  })

  it('keeps a spec skill’s switch and settings when its runtime changes', () => {
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

  it('clears a removed runtime’s spec skills too, so re-adding it never puts them back', () => {
    config({ harness: 'claude-code', specAgents: { 'ui-design': { mockupStyle: 'ascii' } } })
    addRuntime('cheap')
    setSpecAgentRuntime('ui-design', 'cheap')
    assert.equal(removeRuntime('cheap').ok, true)
    assert.equal(readSpecSkills().find((s) => s.name === 'ui-design')?.runtime, 'default')
    addRuntime('cheap')
    assert.equal(readSpecSkills().find((s) => s.name === 'ui-design')?.runtime, 'default')
    assert.deepEqual(held().specAgents, { 'ui-design': { mockupStyle: 'ascii' } })
  })
})

// The agent one runtime runs, and its settings. The global runtime writes the board's own
// `harness` and `harnessSettings`; every other writes its own entry — so a name never has
// two homes and nothing can disagree about what it runs.
describe('setting what a runtime runs as', () => {
  beforeEach(() => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5' } },
      runtimes: { names: ['default', 'cheap'], global: 'default' },
    })
  })

  it('writes the board’s own harness for the global runtime, and no entry beside it', () => {
    assert.equal(setRuntimeHarness('default', 'codex').ok, true)
    assert.equal(held().harness, 'codex')
    assert.equal(block().agents, undefined)
    assert.equal(planRun('s1', root).harness, 'codex')
  })

  it('writes an entry for any other, leaving the board’s own alone', () => {
    assert.equal(setRuntimeHarness('cheap', 'codex').ok, true)
    assert.equal(held().harness, 'claude-code')
    assert.deepEqual(block().agents, { cheap: { harness: 'codex', settings: {} } })
  })

  it('drops the settings on a switch and keeps them on the agent it already ran', () => {
    setRuntimeHarness('cheap', 'codex')
    setRuntimeSetting('cheap', 'model', 'gpt-5.1-codex')
    // Re-picking the same agent is not a way to lose them.
    setRuntimeHarness('cheap', 'codex')
    assert.equal(readRuntimes().agents.cheap?.settings.model, 'gpt-5.1-codex')
    // A different one means something else entirely, so they go.
    setRuntimeHarness('cheap', 'claude-code')
    assert.deepEqual(readRuntimes().agents.cheap?.settings, {})
  })

  it('sends a global runtime’s setting to the agent’s own block', () => {
    assert.equal(setRuntimeSetting('default', 'model', 'claude-sonnet-5').ok, true)
    assert.deepEqual(held().harnessSettings, { 'claude-code': { model: 'claude-sonnet-5' } })
    assert.equal(block().agents, undefined)
  })

  it('clears a setting back to what the runtime inherits', () => {
    setRuntimeHarness('cheap', 'claude-code')
    setRuntimeSetting('cheap', 'model', 'claude-sonnet-5')
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.values.model, 'claude-sonnet-5')
    assert.equal(setRuntimeSetting('cheap', 'model', '').ok, true)
    assert.equal(agentInfo().runtimes.find((r) => r.name === 'cheap')?.values.model, 'claude-opus-5')
  })

  it('refuses a setting on a runtime that has no agent of its own yet', () => {
    const res = setRuntimeSetting('cheap', 'model', 'gpt-5.1-codex')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /one of its own/)
  })

  it('refuses a runtime the board doesn’t hold', () => {
    assert.equal(setRuntimeHarness('nope', 'codex').ok, false)
    assert.equal(setRuntimeSetting('nope', 'model', 'x').ok, false)
  })
})

// Making another runtime global swaps two homes. Both go on running exactly what they ran.
describe('making a runtime global', () => {
  beforeEach(() => {
    config({
      harness: 'claude-code',
      harnessSettings: { 'claude-code': { model: 'claude-opus-5' } },
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        agents: { cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } } },
      },
    })
  })

  it('leaves both running what they ran', () => {
    const before = agentInfo().runtimes.map((r) => [r.name, r.harness, r.values.model])
    assert.equal(setGlobalRuntime('cheap').ok, true)
    assert.equal(readRuntimes().global, 'cheap')
    assert.deepEqual(
      agentInfo().runtimes.map((r) => [r.name, r.harness, r.values.model]),
      before,
    )
  })

  it('moves the standing-down runtime into an entry, and the standing-up one out', () => {
    setGlobalRuntime('cheap')
    assert.equal(held().harness, 'codex')
    assert.deepEqual(block().agents, { default: { harness: 'claude-code', settings: {} } })
    // The new global's own settings became the board's answer for that agent.
    assert.deepEqual(held().harnessSettings, {
      'claude-code': { model: 'claude-opus-5' },
      codex: { model: 'gpt-5.1-codex' },
    })
  })

  it('does nothing when it is already the global one', () => {
    const before = JSON.stringify(held())
    assert.equal(setGlobalRuntime('default').ok, true)
    assert.equal(JSON.stringify(held()), before)
  })

  it('refuses a runtime the board doesn’t hold', () => {
    assert.equal(setGlobalRuntime('nope').ok, false)
  })
})

// A rename (#344). Everything the board holds under the old name moves whole.
describe('renaming a runtime', () => {
  beforeEach(() => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        flows: { implement: 'cheap' },
        agents: { cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } } },
      },
      specAgents: { 'ui-design': { runtime: 'cheap', mockupStyle: 'ascii' } },
    })
  })

  it('carries the flows and the spec skills that named it', () => {
    assert.equal(renameRuntime('cheap', 'plan').ok, true)
    assert.deepEqual(readRuntimes().names, ['default', 'plan'])
    assert.equal(runtimeFor({ action: 'implement' }), 'plan')
    assert.deepEqual(held().specAgents, { 'ui-design': { runtime: 'plan', mockupStyle: 'ascii' } })
  })

  it('carries what it runs as, so a rename is never a reset', () => {
    assert.equal(renameRuntime('cheap', 'plan').ok, true)
    assert.deepEqual(readRuntimes().agents, {
      plan: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } },
    })
    const run = plan({ action: 'implement' })
    assert.equal(run.runtime, 'plan')
    assert.equal(run.harness, 'codex')
    assert.equal(run.note, null)
  })

  it('follows the global pointer when the renamed one was global', () => {
    assert.equal(renameRuntime('default', 'build').ok, true)
    assert.equal(readRuntimes().global, 'build')
    assert.deepEqual(readRuntimes().names, ['build', 'cheap'])
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

// What a screen offering the runtimes is handed (#344): everything it needs to draw one and
// to change it, out of the board's own file.
describe('what the agent info says about a runtime', () => {
  it('carries the agent it runs and what that agent is set to', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        agents: { cheap: { harness: 'codex', settings: { model: 'gpt-5.1-codex' } } },
      },
    })
    const info = agentInfo()
    assert.equal(info.namedRuntimes, true)
    assert.equal(typeof info.machine, 'string')
    const cheap = info.runtimes.find((r) => r.name === 'cheap')
    assert.equal(cheap?.harness, 'codex')
    assert.equal(cheap?.values.model, 'gpt-5.1-codex')
    assert.equal(cheap?.unknownHarness, undefined)
    assert.ok(cheap?.command.startsWith('codex'))
  })

  it('never hands back a key, only which ones are set', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        agents: { cheap: { harness: 'codex', settings: { apiKey: 'sk-not-here' } } },
      },
    })
    const cheap = agentInfo().runtimes.find((r) => r.name === 'cheap')
    assert.equal(cheap?.values.apiKey, undefined)
    assert.deepEqual(cheap?.secretsSet, [])
  })

  it('says a board that names none names none', () => {
    config({ harness: 'claude-code' })
    assert.equal(agentInfo().namedRuntimes, false)
  })
})
