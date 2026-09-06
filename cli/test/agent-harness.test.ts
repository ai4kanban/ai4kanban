// Which connector each agent runs, and where its model is kept (#443).
//
// What is asked here is the whole of the promise: a board that picks nothing runs exactly as
// it did before; a flow, a pass a flow spawns, and a spec agent each come up on their own
// agent's connector; the pick travels with the repository and the model does not; a resume
// stays on the connector it started on; and an older board's models move here once.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { agentInfo, agentRun, planResume, planRun, skillCall } from '../src/lib/agent/resolve.ts'
import { agentForRun } from '../src/lib/agent/runner.ts'
import { moveModelsLocal, setLocalAgentValue } from '../src/lib/agent/local.ts'
import { readAgentHarness, setAgentHarness, specAgentEntries } from '../src/lib/agent/settings.ts'
import { readSpecAgents } from '../src/lib/agents/index.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

const config = (cfg: Record<string, unknown>): void => {
  fs.mkdirSync(kanban(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

const local = (cfg: Record<string, unknown>): void => {
  fs.mkdirSync(kanban(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), '.local.json'), JSON.stringify(cfg, null, 2))
}

const held = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(kanban(), 'ui.config.json'), 'utf8'))

const heldLocal = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(kanban(), '.local.json'), 'utf8'))

// What one flow spawns: the connector it ran under, and the argv, so a setting that reached
// the run through the wrong block would show up here rather than pass.
const plan = (ask: Parameters<typeof agentForRun>[0]) => planRun('s1', root, agentForRun(ask))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-agent-harness-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a board where no agent picked a connector', () => {
  it('runs every flow on the board’s default', () => {
    config({ harness: 'codex' })
    local({ agents: { builder: { codex: { model: 'gpt-5.1-codex' } } } })
    for (const action of ['implement', 'review', 'clarify', 'setup', 'create'] as const) {
      const run = plan({ action })
      assert.equal(run.harness, 'codex')
      assert.equal(run.note, null)
    }
    // …and only the builder's own model reaches the builder's own run.
    assert.ok(plan({ action: 'implement' }).argv.includes('gpt-5.1-codex'))
    assert.ok(!plan({ action: 'review' }).argv.includes('gpt-5.1-codex'))
  })

  it('reads as no picks at all, with nothing written into the file', () => {
    config({ harness: 'claude-code' })
    assert.deepEqual(readAgentHarness(), {})
    assert.equal(agentRun('builder').own, false)
    assert.equal(agentRun('builder').harness, 'claude-code')
  })
})

describe('an agent with a connector of its own', () => {
  const board = {
    harness: 'claude-code',
    agentHarness: { builder: 'codex', 'ui-design': 'codex' },
    specAgents: { 'ui-design': { mockupStyle: 'ascii' } },
  }

  beforeEach(() => {
    config(board)
    local({
      agents: {
        builder: { codex: { model: 'gpt-5.1-codex' } },
        planner: { 'claude-code': { model: 'claude-opus-5' } },
      },
    })
  })

  it('spawns the connector the board gave it, with its own model', () => {
    const run = plan({ action: 'implement' })
    assert.equal(run.agent, 'builder')
    assert.equal(run.harness, 'codex')
    assert.ok(run.argv.includes('gpt-5.1-codex'))
    assert.equal(run.note, null)
  })

  it('leaves every other agent on the board’s default', () => {
    const run = plan({ action: 'review' })
    assert.equal(run.agent, 'reviewer')
    assert.equal(run.harness, 'claude-code')
  })

  it('runs the passes a refine spawns as the planner, like refine itself', () => {
    for (const action of ['clarify', 'resolve', 'writing'] as const) {
      assert.equal(agentForRun({ action, refineRound: 1 }), 'planner')
    }
    assert.ok(plan({ action: 'clarify', refineRound: 1 }).argv.includes('claude-opus-5'))
  })

  it('runs a spec agent as itself, on its own connector', () => {
    assert.equal(agentForRun({ action: 'spec', specAgent: 'ui-design' }), 'ui-design')
    assert.equal(plan({ action: 'spec', specAgent: 'ui-design' }).harness, 'codex')
    assert.equal(plan({ action: 'spec', specAgent: 'technology-selection' }).harness, 'claude-code')
  })

  it('keeps the spec agent’s connector out of its settings, and its switch a switch', () => {
    assert.deepEqual(specAgentEntries()['ui-design'], { enabled: true, values: { mockupStyle: 'ascii' } })
    const view = readSpecAgents().find((s) => s.name === 'ui-design')
    assert.equal(view?.enabled, true)
    assert.equal(view?.values.mockupStyle, 'ascii')
    assert.equal(view?.harness, 'codex')
  })

  it('calls the skill the way that agent’s connector expects', () => {
    assert.equal(skillCall(agentForRun({ action: 'implement' })), '$kanban')
    assert.equal(skillCall(agentForRun({ action: 'review' })), '/kanban')
  })

  it('says which agent runs each flow, for a front end that keeps no list', () => {
    const info = agentInfo()
    const flow = (command: string) => info.flows.find((f) => f.command === command)
    assert.deepEqual([flow('implement')?.agent, flow('implement')?.harness], ['builder', 'codex'])
    assert.deepEqual([flow('review')?.agent, flow('review')?.harness], ['reviewer', 'claude-code'])
  })

  it('falls back and says so when the pick is a connector we don’t ship', () => {
    config({ harness: 'claude-code', agentHarness: { builder: 'some-tool-from-the-future' } })
    const run = plan({ action: 'implement' })
    assert.equal(run.harness, 'claude-code')
    assert.match(run.note ?? '', /some-tool-from-the-future/)
    assert.equal(agentRun('builder').unknownHarness, 'some-tool-from-the-future')
  })
})

describe('a board written before agents picked one', () => {
  it('ignores a leftover `runtimes` block and runs the board’s harness', () => {
    config({
      harness: 'claude-code',
      runtimes: {
        names: ['default', 'cheap'],
        global: 'default',
        flows: { implement: 'cheap' },
        agents: { cheap: { harness: 'codex', settings: {} } },
      },
      specAgents: { 'ui-design': { runtime: 'cheap', mockupStyle: 'ascii' } },
    })
    assert.equal(plan({ action: 'implement' }).harness, 'claude-code')
    assert.equal(agentRun('ui-design').harness, 'claude-code')
    // And the leftover key is never read as one of the agent's settings.
    assert.deepEqual(specAgentEntries()['ui-design'], { enabled: true, values: { mockupStyle: 'ascii' } })
  })
})

describe('where a model is kept', () => {
  beforeEach(() => config({ harness: 'claude-code', agentHarness: { builder: 'codex' } }))

  it('writes it per agent and per connector, so switching back finds it again', () => {
    assert.equal(setLocalAgentValue('builder', 'codex', 'model', 'gpt-5.1-codex').ok, true)
    assert.equal(setLocalAgentValue('builder', 'claude-code', 'model', 'claude-opus-5').ok, true)
    assert.equal(agentRun('builder').values.model, 'gpt-5.1-codex')
    setAgentHarness('builder', 'claude-code')
    assert.equal(agentRun('builder').values.model, 'claude-opus-5')
    setAgentHarness('builder', 'codex')
    assert.equal(agentRun('builder').values.model, 'gpt-5.1-codex')
  })

  it('never writes a model into the file the repository carries', () => {
    setLocalAgentValue('builder', 'codex', 'model', 'gpt-5.1-codex')
    assert.equal(JSON.stringify(held()).includes('gpt-5.1-codex'), false)
    assert.deepEqual(heldLocal(), { agents: { builder: { codex: { model: 'gpt-5.1-codex' } } } })
  })

  it('clears back to the connector’s own default, leaving no empty husk', () => {
    setLocalAgentValue('builder', 'codex', 'model', 'gpt-5.1-codex')
    assert.equal(setLocalAgentValue('builder', 'codex', 'model', '').ok, true)
    assert.equal(agentRun('builder').values.model, undefined)
    assert.deepEqual(heldLocal(), {})
  })

  it('gives one agent a stronger model than another on the same connector', () => {
    setAgentHarness('builder', '')
    setLocalAgentValue('planner', 'claude-code', 'model', 'claude-opus-5')
    setLocalAgentValue('builder', 'claude-code', 'model', 'claude-sonnet-5')
    assert.ok(plan({ action: 'clarify', refineRound: 1 }).argv.includes('claude-opus-5'))
    assert.ok(plan({ action: 'implement' }).argv.includes('claude-sonnet-5'))
  })
})

describe('writing the pick', () => {
  beforeEach(() => config({ harness: 'claude-code' }))

  it('is the board’s answer, and drops the block when nothing picked', () => {
    assert.equal(setAgentHarness('builder', 'codex').ok, true)
    assert.deepEqual(held().agentHarness, { builder: 'codex' })
    assert.equal(setAgentHarness('builder', '').ok, true)
    assert.equal(held().agentHarness, undefined)
    assert.equal(agentRun('builder').harness, 'claude-code')
  })
})

describe('the raw arguments', () => {
  it('go after the settings’ flags and before the connector’s own', () => {
    config({ harness: 'claude-code', harnessSettings: { 'claude-code': { args: '--foo --bar=1' } } })
    local({ agents: { builder: { 'claude-code': { model: 'claude-opus-5' } } } })
    const { argv } = plan({ action: 'implement' })
    const model = argv.indexOf('claude-opus-5')
    const foo = argv.indexOf('--foo')
    const session = argv.indexOf('--session-id')
    assert.ok(model >= 0 && foo > model, `expected --foo after the model flag: ${argv.join(' ')}`)
    assert.deepEqual(argv.slice(foo, foo + 2), ['--foo', '--bar=1'])
    assert.ok(session > foo, `expected the connector's own arguments last: ${argv.join(' ')}`)
  })
})

describe('a resume', () => {
  it('stays on the connector the run itself went on', () => {
    config({ harness: 'claude-code', agentHarness: { builder: 'codex' } })
    // The builder runs Codex now; this run went on Claude Code, and picking it up spawns
    // Claude Code — the conversation belongs to the CLI that opened it.
    const plan = planResume('claude-code', 'abc', root, 'builder')
    assert.equal(plan?.harness, 'claude-code')
    assert.ok(plan?.argv.includes('--resume'))
  })

  it('is refused for a connector this version doesn’t run', () => {
    config({ harness: 'claude-code' })
    assert.equal(planResume('some-tool-from-the-future', 'abc', root, 'builder'), null)
  })

  it('stays there even when the conversation picked a connector of its own', () => {
    config({ harness: 'claude-code' })
    // A conversation pins one for itself (#272), and this session was opened by another.
    // The id belongs to the CLI that minted it, so that is what picks the turn up.
    const plan = planResume('claude-code', 'abc', root, 'planner', { pin: 'codex' })
    assert.equal(plan?.harness, 'claude-code')
  })
})

// The one-time move `akb update` makes (#443): a model used to be the board's, one per
// connector, and it becomes each agent's, on this machine.
describe('moving an older board’s models here', () => {
  const owned = (_harness: string, key: string): boolean => ['model', 'reasoning'].includes(key)

  beforeEach(() =>
    config({
      harness: 'claude-code',
      harnessSettings: {
        'claude-code': { model: 'claude-opus-5', reasoning: 'high', command: 'claude -p' },
        codex: { model: 'gpt-5.1-codex', provider: 'api' },
      },
    }),
  )

  it('writes the same values under every agent and takes them out of ui.config.json', () => {
    const line = moveModelsLocal(kanban(), ['planner', 'builder'], owned)
    assert.match(line ?? '', /\.local\.json/)
    assert.deepEqual(held().harnessSettings, {
      'claude-code': { command: 'claude -p' },
      codex: { provider: 'api' },
    })
    const values = { 'claude-code': { model: 'claude-opus-5', reasoning: 'high' }, codex: { model: 'gpt-5.1-codex' } }
    assert.deepEqual(heldLocal().agents, { planner: values, builder: values })
  })

  it('runs exactly what it ran before the move', () => {
    const before = plan({ action: 'implement' }).argv
    moveModelsLocal(kanban(), ['planner', 'builder', 'reviewer'], owned)
    setBoardRoot(root)
    assert.deepEqual(plan({ action: 'implement' }).argv, before)
  })

  it('moves once, so a second update finds nothing', () => {
    moveModelsLocal(kanban(), ['builder'], owned)
    assert.equal(moveModelsLocal(kanban(), ['builder'], owned), null)
  })

  it('never writes over a model this computer already picked', () => {
    local({ agents: { builder: { codex: { model: 'gpt-5.1-codex-mini' } } } })
    moveModelsLocal(kanban(), ['builder'], owned)
    assert.equal((heldLocal().agents as Record<string, Record<string, Record<string, string>>>).builder!.codex!.model, 'gpt-5.1-codex-mini')
  })
})
