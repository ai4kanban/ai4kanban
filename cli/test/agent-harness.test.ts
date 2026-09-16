// Which runtime each agent runs, and what one runtime carries (#467).
//
// What is asked here is the whole of the promise: a board that picks nothing runs **Global
// default**; a flow, a pass a flow spawns, and a spec agent each come up on their own agent's
// row; two rows on one harness sit on two gateways and two keys; a resume stays on the CLI it
// started on; and a board written the old way is turned into rows once, running exactly what
// it ran.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { agentInfo, agentRun, openPlan, planResume, planRun, skillCall } from '../src/lib/agent/resolve.ts'
import { agentForRun } from '../src/lib/agent/runner.ts'
import { takeLocalModels } from '../src/lib/agent/local.ts'
import {
  addRuntime,
  deleteRuntime,
  migrateRuntimes,
  setRuntimeHarness,
  setRuntimeSecret,
  readAgentRuntime,
  readRuntimes,
  renameRuntime,
  repairEnvFile,
  secretVar,
  setAgentRuntime,
  setHarnessSecret,
  setHarnessSetting,
  setRuntimeSetting,
} from '../src/lib/agent/runtimes.ts'
import { readEnvFile } from '../src/lib/agent/settings.ts'
import { specAgentEntries } from '../src/lib/agent/settings.ts'
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

const env = (text: string): void => {
  fs.mkdirSync(kanban(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), '.env'), text)
}

const held = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(kanban(), 'ui.config.json'), 'utf8'))

const heldLocal = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(kanban(), '.local.json'), 'utf8'))

const runtime = (id: string, harness: string, settings: Record<string, string> = {}) => ({
  id,
  name: id === 'global' ? 'Global default' : id,
  harness,
  settings,
})

// What one flow spawns: the row it ran on, and the argv, so a setting that reached the run
// from the wrong row would show up here rather than pass.
const plan = (ask: Parameters<typeof agentForRun>[0]) => planRun('s1', root, agentForRun(ask))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-agent-harness-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a board where no agent picked a runtime', () => {
  it('runs every flow on Global default', () => {
    config({ runtimes: [runtime('global', 'codex', { model: 'gpt-5.1-codex' })] })
    for (const action of ['implement', 'review', 'clarify', 'setup', 'create'] as const) {
      const run = plan({ action })
      assert.equal(run.harness, 'codex')
      assert.equal(run.runtime, 'global')
      assert.equal(run.note, null)
      assert.ok(run.argv.includes('gpt-5.1-codex'))
    }
  })

  it('has Global default even when the file says nothing at all', () => {
    config({})
    assert.deepEqual(
      readRuntimes().map((r) => [r.id, r.name]),
      [['global', 'Global default']],
    )
    assert.deepEqual(readAgentRuntime(), {})
    assert.equal(agentRun('builder').own, false)
    assert.equal(agentRun('builder').runtime, 'global')
  })
})

describe('an agent with a runtime of its own', () => {
  const board = {
    runtimes: [
      runtime('global', 'claude-code', { model: 'claude-opus-5' }),
      runtime('cheap', 'codex', { model: 'gpt-5.1-codex' }),
    ],
    agentRuntime: { builder: 'cheap', 'ui-designer': 'cheap' },
    specAgents: { 'ui-designer': { mockupStyle: 'ascii' } },
  }

  beforeEach(() => config(board))

  it('spawns the row the board gave it, whole', () => {
    const run = plan({ action: 'implement' })
    assert.equal(run.agent, 'builder')
    assert.equal(run.harness, 'codex')
    assert.equal(run.runtime, 'cheap')
    assert.ok(run.argv.includes('gpt-5.1-codex'))
    assert.equal(run.note, null)
  })

  it('leaves every other agent on Global default', () => {
    const run = plan({ action: 'review' })
    assert.equal(run.agent, 'reviewer')
    assert.equal(run.runtime, 'global')
    assert.equal(run.harness, 'claude-code')
  })

  it('runs the passes a refine spawns as the planner, like refine itself', () => {
    for (const action of ['clarify', 'resolve', 'writing'] as const) {
      assert.equal(agentForRun({ action, refineRound: 1 }), 'planner')
    }
    assert.ok(plan({ action: 'clarify', refineRound: 1 }).argv.includes('claude-opus-5'))
  })

  it('runs a spec agent as itself, on its own row', () => {
    assert.equal(agentForRun({ action: 'spec', specAgent: 'ui-designer' }), 'ui-designer')
    assert.equal(plan({ action: 'spec', specAgent: 'ui-designer' }).runtime, 'cheap')
    assert.equal(plan({ action: 'spec', specAgent: 'tech-stack-advisor' }).runtime, 'global')
  })

  it('keeps the spec agent’s runtime out of its settings, and its switch a switch', () => {
    assert.deepEqual(specAgentEntries()['ui-designer'], { enabled: true, values: { mockupStyle: 'ascii' } })
    const view = readSpecAgents().find((s) => s.name === 'ui-designer')
    assert.equal(view?.enabled, true)
    assert.equal(view?.values.mockupStyle, 'ascii')
    assert.equal(view?.harness, 'codex')
  })

  it('calls the skill the way that row’s CLI expects', () => {
    assert.equal(skillCall(agentForRun({ action: 'implement' })), '$kanban')
    assert.equal(skillCall(agentForRun({ action: 'review' })), '/kanban')
  })

  it('says which agent runs each flow, for a front end that keeps no list', () => {
    const info = agentInfo()
    const flow = (command: string) => info.flows.find((f) => f.command === command)
    assert.deepEqual([flow('implement')?.agent, flow('implement')?.harness], ['builder', 'codex'])
    assert.deepEqual([flow('review')?.agent, flow('review')?.harness], ['reviewer', 'claude-code'])
  })

  it('falls back and says so when the pick is a row the board no longer has', () => {
    config({ ...board, agentRuntime: { builder: 'was-deleted' } })
    const run = plan({ action: 'implement' })
    assert.equal(run.runtime, 'global')
    assert.match(run.note ?? '', /was-deleted/)
    assert.equal(agentRun('builder').unknownRuntime, 'was-deleted')
  })
})

describe('two runtimes on one harness', () => {
  beforeEach(() => {
    config({
      runtimes: [
        runtime('global', 'claude-code', { provider: 'endpoint', baseUrl: 'https://one.example', model: 'a' }),
        runtime('gateway', 'claude-code', { provider: 'endpoint', baseUrl: 'https://two.example', model: 'b' }),
      ],
      agentRuntime: { builder: 'gateway' },
    })
    env(`${secretVar('ANTHROPIC_API_KEY', 'global')}=sk-one\n${secretVar('ANTHROPIC_API_KEY', 'gateway')}=sk-two\n`)
  })

  it('sit on two gateways and sign with two keys, with nothing inherited between them', () => {
    const reviewer = openPlan(plan({ action: 'review' }))
    const builder = openPlan(plan({ action: 'implement' }))
    assert.equal(reviewer.env.ANTHROPIC_BASE_URL, 'https://one.example')
    assert.equal(builder.env.ANTHROPIC_BASE_URL, 'https://two.example')
    assert.equal(reviewer.env.ANTHROPIC_AUTH_TOKEN, 'sk-one')
    assert.equal(builder.env.ANTHROPIC_AUTH_TOKEN, 'sk-two')
  })

  it('each says on its own row which of its keys this computer holds', () => {
    assert.deepEqual(
      agentInfo().runtimes.map((r) => [r.id, r.secretsSet]),
      [
        ['global', ['apiKey']],
        ['gateway', ['apiKey']],
      ],
    )
  })
})

describe('writing the list', () => {
  beforeEach(() => config({ runtimes: [runtime('global', 'claude-code')] }))

  it('adds a row on an id generated to what .env parses', () => {
    const added = addRuntime('My gateway!', 'codex')
    assert.equal(added.id, 'my_gateway')
    assert.equal(secretVar('OPENAI_API_KEY', added.id!), 'OPENAI_API_KEY__MY_GATEWAY')
  })

  it('refuses a second row on the same name', () => {
    addRuntime('Cheap', 'codex')
    assert.match(addRuntime('cheap', 'codex').error ?? '', /already has a runtime/)
  })

  it('renames without moving anything, and never renames Global default', () => {
    const { id } = addRuntime('Cheap', 'codex')
    setRuntimeSetting(id!, 'model', 'gpt-5.1-mini')
    setAgentRuntime('builder', id!)
    assert.equal(renameRuntime(id!, 'Cheaper').ok, true)
    assert.equal(agentRun('builder').runtime, id)
    assert.equal(agentRun('builder').runtimeName, 'Cheaper')
    assert.equal(agentRun('builder').model, 'gpt-5.1-mini')
    assert.match(renameRuntime('global', 'Something else').error ?? '', /keeps its name/)
  })

  it('deletes a row and puts the agents on it back on Global default', () => {
    const { id } = addRuntime('Cheap', 'codex')
    setAgentRuntime('builder', id!)
    assert.equal(deleteRuntime(id!).ok, true)
    assert.equal(agentRun('builder').runtime, 'global')
    assert.equal(held().agentRuntime, undefined)
    assert.match(deleteRuntime('global').error ?? '', /can't be deleted/)
  })

  it('takes the deleted row’s keys off this computer and leaves every other line alone', () => {
    const mine = addRuntime('Cheap', 'codex')
    const yours = addRuntime('Spare', 'codex')
    // A harness the row used to be on can have left a line behind — the id never moved, so
    // the delete has to look for that one too.
    setRuntimeSecret(mine.id!, 'apiKey', 'sk-old')
    setRuntimeHarness(mine.id!, 'claude-code')
    setRuntimeSecret(mine.id!, 'apiKey', 'sk-new')
    setRuntimeSecret(yours.id!, 'apiKey', 'sk-theirs')
    const before = readEnvFile()
    assert.ok(Object.keys(before).some((line) => line.endsWith('__CHEAP')))

    assert.equal(deleteRuntime(mine.id!).ok, true)
    const after = readEnvFile()
    assert.deepEqual(
      Object.keys(after).filter((line) => line.endsWith('__CHEAP')),
      [],
    )
    assert.equal(after[secretVar('OPENAI_API_KEY', yours.id!)], 'sk-theirs')
  })

  it('carries an older board’s agentHarness picks over on the first write', () => {
    config({ harness: 'claude-code', harnessSettings: { codex: {} }, agentHarness: { builder: 'codex' } })
    addRuntime('Cheap', 'cursor')
    assert.deepEqual(held().agentRuntime, { builder: 'codex' })
    assert.equal(held().agentHarness, undefined)
    assert.equal(agentRun('builder').harness, 'codex')
  })

  it('drops a pick back to Global default without writing one down', () => {
    const { id } = addRuntime('Cheap', 'codex')
    assert.equal(setAgentRuntime('builder', id!).ok, true)
    assert.deepEqual(held().agentRuntime, { builder: id })
    assert.equal(setAgentRuntime('builder', '').ok, true)
    assert.equal(held().agentRuntime, undefined)
    assert.equal(agentRun('builder').runtime, 'global')
  })

  // A picker lists Global default as a row, so it hands its id back rather than an empty
  // string. Both spellings have to drop the pick, or the row an agent already runs would be
  // written down as a pick of its own and counted against Global default.
  it('drops a pick handed Global default’s own id', () => {
    const { id } = addRuntime('Cheap', 'codex')
    setAgentRuntime('builder', id!)
    assert.equal(setAgentRuntime('builder', 'global').ok, true)
    assert.equal(held().agentRuntime, undefined)
    assert.equal(agentRun('builder').runtime, 'global')
    assert.equal(agentInfo().runtimes.find((r) => r.id === 'global')?.agents, 0)
  })
})

describe('the raw arguments', () => {
  it('go after the settings’ flags and before the CLI’s own', () => {
    config({ runtimes: [runtime('global', 'claude-code', { model: 'claude-opus-5', args: '--foo --bar=1' })] })
    const { argv } = plan({ action: 'implement' })
    const model = argv.indexOf('claude-opus-5')
    const foo = argv.indexOf('--foo')
    const session = argv.indexOf('--session-id')
    assert.ok(model >= 0 && foo > model, `expected --foo after the model flag: ${argv.join(' ')}`)
    assert.deepEqual(argv.slice(foo, foo + 2), ['--foo', '--bar=1'])
    assert.ok(session > foo, `expected the CLI's own arguments last: ${argv.join(' ')}`)
  })
})

describe('a resume', () => {
  it('stays on the CLI the run itself went on', () => {
    config({
      runtimes: [runtime('global', 'claude-code'), runtime('cheap', 'codex')],
      agentRuntime: { builder: 'cheap' },
    })
    // The builder runs Codex now; this run went on Claude Code, and picking it up spawns
    // Claude Code — the conversation belongs to the CLI that opened it.
    const picked = planResume('claude-code', 'abc', root, 'builder')
    assert.equal(picked?.harness, 'claude-code')
    assert.equal(picked?.runtime, 'global')
    assert.ok(picked?.argv.includes('--resume'))
  })

  it('is refused for a CLI this version doesn’t run', () => {
    config({ runtimes: [runtime('global', 'claude-code')] })
    assert.equal(planResume('some-tool-from-the-future', 'abc', root, 'builder'), null)
  })

  it('resolves the row the run pinned, inside that CLI', () => {
    config({
      runtimes: [
        runtime('global', 'claude-code', { model: 'a' }),
        runtime('strong', 'claude-code', { model: 'b' }),
      ],
    })
    const picked = planResume('claude-code', 'abc', root, 'planner', { pin: 'strong' })
    assert.equal(picked?.runtime, 'strong')
    assert.ok(picked?.argv.includes('b'))
  })

  it('reads a pin written before runtimes as the row that harness’s block became', () => {
    config({ harness: 'claude-code', harnessSettings: { codex: { model: 'gpt-5.1-codex' } } })
    const picked = planResume('codex', 'abc', root, 'builder', { pin: 'codex' })
    assert.equal(picked?.harness, 'codex')
    assert.ok(picked?.argv.includes('gpt-5.1-codex'))
  })
})

// The one-time move `akb update` makes (#467): how to reach a CLI was one block per harness and
// the model under it was this computer's, and both become rows.
describe('turning an older board into runtimes', () => {
  beforeEach(() =>
    config({
      harness: 'claude-code',
      harnessSettings: {
        'claude-code': { baseUrl: 'https://gw.example', command: 'claude -p' },
        codex: { provider: 'api' },
      },
      agentHarness: { builder: 'codex' },
    }),
  )

  it('writes one row per block, with the board’s own first', () => {
    const line = migrateRuntimes(kanban(), ['planner', 'builder'], takeLocalModels(kanban()))
    assert.match(line ?? '', /runtimes/)
    assert.deepEqual(
      readRuntimes().map((r) => [r.id, r.harness]),
      [
        ['global', 'claude-code'],
        ['codex', 'codex'],
      ],
    )
    assert.equal(held().harnessSettings, undefined)
    assert.equal(held().harness, undefined)
    assert.equal(held().agentHarness, undefined)
    assert.equal(agentRun('builder').harness, 'codex')
  })

  it('mints one row for each agent whose model differed, and no more', () => {
    local({
      agents: {
        builder: { codex: { model: 'gpt-5.1-codex' } },
        planner: { 'claude-code': { model: 'claude-opus-5' } },
        reviewer: { 'claude-code': {} },
      },
    })
    migrateRuntimes(kanban(), ['planner', 'builder', 'reviewer'], takeLocalModels(kanban()))
    assert.deepEqual(
      readRuntimes().map((r) => r.id),
      ['global', 'codex', 'planner', 'builder'],
    )
    assert.equal(agentRun('planner').model, 'claude-opus-5')
    assert.equal(agentRun('builder').model, 'gpt-5.1-codex')
    assert.equal(agentRun('reviewer').runtime, 'global')
    // …and the block it moved is cleared, so a second update finds nothing.
    assert.deepEqual(heldLocal(), {})
  })

  it('runs what this computer ran before the move — the block and the model together', () => {
    local({ agents: { builder: { codex: { model: 'gpt-5.1-codex' } } } })
    migrateRuntimes(kanban(), ['planner', 'builder', 'reviewer'], takeLocalModels(kanban()))
    setBoardRoot(root)
    const run = openPlan(plan({ action: 'implement' }))
    assert.ok(run.argv.includes('gpt-5.1-codex'))
    // …and the rest of what that block said about reaching the CLI came with it: the
    // provider Codex was set to, and the hand-edited command Global default ran.
    assert.equal(readRuntimes().find((r) => r.harness === 'codex')?.settings.provider, 'api')
    assert.deepEqual(readRuntimes()[0]!.settings, { baseUrl: 'https://gw.example', command: 'claude -p' })
    assert.deepEqual(plan({ action: 'review' }).argv.slice(0, 2), ['claude', '-p'])
  })

  it('moves once, so a second update finds nothing', () => {
    migrateRuntimes(kanban(), ['builder'], takeLocalModels(kanban()))
    assert.equal(migrateRuntimes(kanban(), ['builder'], takeLocalModels(kanban())), null)
  })

  it('discards a pre-#443 `runtimes` block rather than reading it under the new rules', () => {
    config({
      harness: 'claude-code',
      runtimes: { names: ['default', 'cheap'], global: 'default', agents: { cheap: { harness: 'codex' } } },
    })
    assert.deepEqual(
      readRuntimes().map((r) => [r.id, r.harness]),
      [['global', 'claude-code']],
    )
    assert.equal(plan({ action: 'implement' }).harness, 'claude-code')
  })
})

// The key file is brought over off the runtimes LIST, so a second computer — where the config
// was converted elsewhere and only `.env` is still old — is repaired there too.
describe('bringing this computer’s key lines to the id-scoped names', () => {
  it('moves one line onto every row that has none, and leaves what nothing claims', () => {
    config({
      runtimes: [runtime('global', 'claude-code'), runtime('gateway', 'claude-code'), runtime('cheap', 'codex')],
    })
    env('ANTHROPIC_API_KEY=sk-ant\nSOMETHING_ELSE=keep-me\n')
    assert.match(repairEnvFile() ?? '', /ANTHROPIC_API_KEY__GLOBAL/)
    const after = readEnvFile()
    assert.equal(after.ANTHROPIC_API_KEY__GLOBAL, 'sk-ant')
    assert.equal(after.ANTHROPIC_API_KEY__GATEWAY, 'sk-ant')
    assert.equal(after.ANTHROPIC_API_KEY, undefined)
    assert.equal(after.SOMETHING_ELSE, 'keep-me')
  })

  it('never writes over a key a row already has, and repairs once', () => {
    config({ runtimes: [runtime('global', 'claude-code')] })
    env('ANTHROPIC_API_KEY=sk-old\nANTHROPIC_API_KEY__GLOBAL=sk-new\n')
    repairEnvFile()
    assert.equal(readEnvFile().ANTHROPIC_API_KEY__GLOBAL, 'sk-new')
    assert.equal(repairEnvFile(), null)
  })
})

// The panes that still draw one row per harness write through these (kanban-ui). They name a
// HARNESS, not an id, so the row they land on has to be that harness's own — landing on
// whatever row is first would put one connector's settings under another's name.
describe('writing by harness name', () => {
  beforeEach(() =>
    config({
      runtimes: [runtime('global', 'claude-code'), runtime('cheap', 'codex', { model: 'gpt-5.1-codex' })],
    }),
  )

  it('writes the first row on that harness, and Global default when none is named', () => {
    assert.equal(setHarnessSetting('model', 'gpt-5.1-mini', 'codex').ok, true)
    assert.equal(setHarnessSetting('model', 'claude-opus-5').ok, true)
    assert.deepEqual(
      readRuntimes().map((r) => [r.id, r.settings.model]),
      [
        ['global', 'claude-opus-5'],
        ['cheap', 'gpt-5.1-mini'],
      ],
    )
  })

  it('saves a key on that row’s own id-scoped line, which is the line a run reads', () => {
    assert.equal(setHarnessSecret('apiKey', 'sk-cheap', 'codex').ok, true)
    assert.equal(readEnvFile().OPENAI_API_KEY__CHEAP, 'sk-cheap')
    assert.equal(readEnvFile().OPENAI_API_KEY, undefined)
    assert.deepEqual(
      agentInfo().runtimes.map((r) => [r.id, r.secretsSet]),
      [
        ['global', []],
        ['cheap', ['apiKey']],
      ],
    )
  })

  it('refuses a harness no runtime runs rather than writing another row', () => {
    const wrote = setHarnessSetting('model', 'cursor-fast', 'cursor')
    assert.equal(wrote.ok, false)
    assert.match(wrote.error ?? '', /no runtime on this board runs "cursor"/)
    assert.match(setHarnessSecret('apiKey', 'sk-x', 'cursor').error ?? '', /no runtime on this board runs/)
    assert.deepEqual(
      readRuntimes().map((r) => r.settings.model),
      [undefined, 'gpt-5.1-codex'],
    )
    assert.deepEqual(readEnvFile(), {})
  })
})
