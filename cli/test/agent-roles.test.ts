// The roles the board ships, and the rule each agent carries (#420).
//
// What is asked here: every flow the board can start belongs to exactly one agent, the
// roster names the roles before the specialists, a board written when rules were per flow
// is folded onto its agents once and says so, and `akb raw rule` writes the same file the
// board reads.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { FLOWS } from '../src/lib/agent/flows.ts'
import { buildRun } from '../src/lib/agent/prompts.ts'
import { agentNames, agentRoster, roleForFlow, roleNamed, roles, stageContractProblems } from '../src/lib/agent/roles.ts'
import { agentForFlow } from '../src/lib/agent/stages.ts'
import { migrateFlowRules, readRule, ruleFor, setAgentRule } from '../src/lib/agent/rules.ts'
import { setSpecAgentEnabled, specAgentProblems } from '../src/lib/agents/index.ts'
import { readAgents } from '../src/lib/agents/roster.ts'
import { RULES, setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { move, refuses } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** A rule file as a board written before #420 had it: named by the flow. */
const rule = (name: string, text: string): void => {
  fs.mkdirSync(RULES, { recursive: true })
  fs.writeFileSync(path.join(RULES, `${name}.md`), `${text}\n`)
}

const ruleText = (name: string): string => fs.readFileSync(path.join(RULES, `${name}.md`), 'utf8').trim()

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-roles-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the roles', () => {
  it('gives every flow the board can start exactly one agent', () => {
    for (const flow of FLOWS) {
      const owners = roles().filter((role) => role.name === agentForFlow(flow.command))
      const hidden = roleNamed(agentForFlow(flow.command) ?? '') && !owners.length ? 1 : 0
      assert.equal(owners.length + hidden, 1, `${flow.command} is run by ${owners.length} agents`)
    }
  })

  it('leaves the planner every flow that writes a card', () => {
    for (const flow of ['refine', 'resolve', 'plan-release', 'changelog', 'create']) {
      assert.equal(roleForFlow(flow)!.name, 'software-planner')
    }
  })

  it('names the builder, and every board flow beside it', () => {
    assert.deepEqual(
      roles().map((r) => r.name),
      [
        'discussion-helper',
        'software-planner',
        'builder',
        'memory-pruner',
        'memory-reviewer',
        'dismissal-reviewer',
        'project-writer',
        'feedback',
        'proposer',
      ],
    )
    assert.equal(roleForFlow('implement')!.name, 'builder')
    assert.equal(roleForFlow('prune-memory')!.name, 'memory-pruner')
    // Reading back over the conversations is the memory reviewer's (#748): a chat writes no
    // memory itself.
    assert.equal(roleForFlow('review-memory')!.name, 'memory-reviewer')
    assert.equal(roleForFlow('review-dismissals')!.name, 'dismissal-reviewer')
    assert.equal(roleForFlow('describe-project')!.name, 'project-writer')
    // Every conversation is the discussion helper's, and `chat` is no flow anyone types.
    assert.equal(roleForFlow('chat')!.name, 'discussion-helper')
    // And a reflection is the proposer's — no flow a person types either (#534).
    assert.equal(roleForFlow('reflect')!.name, 'proposer')
  })

  // The feedback agent still runs its flow, and is on no roster to be configured (#1358).
  it('keeps the feedback agent off the roster, with no rule and no runtime of its own', () => {
    assert.equal(roleForFlow('feedback')!.name, 'feedback')
    assert.ok(!agentNames().includes('feedback'))
    assert.deepEqual(stageContractProblems(), [])
    rule('feedback', 'quote the line')
    assert.equal(readRule('feedback'), '')
    assert.equal(setAgentRule('feedback', 'quote the line').ok, false)
  })

  // Memory belongs to whoever writes it (#805): all three planning files are the planner's,
  // and the builder — which never opened one — owns none.
  it('says what each role remembers, in files that are the board it is on', () => {
    assert.deepEqual(roles().find((r) => r.name === 'software-planner')!.memory, [
      'memory/agents/planner/decisions.md',
      'memory/agents/planner/rejected.md',
      'memory/agents/planner/redesign.md',
    ])
    assert.deepEqual(roles().find((r) => r.name === 'builder')!.memory, [])
  })

  // The builder writes no memory at all, so owns no folder either (#805).
  it('gives the builder no memory', () => {
    assert.deepEqual(agentRoster().find((a) => a.name === 'builder')!.memory, [])
  })

  it("refuses a project agent that takes a role's name, so no two share a rule", () => {
    const home = path.join(kanban(), 'agents', 'builder')
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(
      path.join(home, 'AGENT.md'),
      ['---', 'name: builder', 'description: Use when.', 'akb:', '  hook: plan', '---', '', 'You build.']
        .join('\n')
        .concat('\n'),
    )
    assert.deepEqual(agentNames(), [
      'discussion-helper',
      'software-planner',
      'builder',
      'memory-pruner',
      'memory-reviewer',
      'dismissal-reviewer',
      'project-writer',
      'proposer',
      'blog-illustrator',
      'blog-planner',
      'carousel-planner',
      'copywriting',
      'cover-designer',
      'deck-planner',
      'demo-rehearser',
      'email-planner',
      'hyperframes-editor',
      'prompt-writer',
      'qa-manager',
      'scriptwriter',
      'tech-stack-advisor',
      'ui-designer',
    ])
    assert.match(specAgentProblems().join('\n'), /`builder` is one of the roles the board ships/)
  })

  it('rosters the roles first, then the specialists the command ships', () => {
    const names = agentNames()
    assert.deepEqual(names.slice(0, 8), [
      'discussion-helper',
      'software-planner',
      'builder',
      'memory-pruner',
      'memory-reviewer',
      'dismissal-reviewer',
      'project-writer',
      'proposer',
    ])
    assert.deepEqual(names.slice(8), [
      'blog-illustrator',
      'blog-planner',
      'carousel-planner',
      'copywriting',
      'cover-designer',
      'deck-planner',
      'demo-rehearser',
      'email-planner',
      'hyperframes-editor',
      'prompt-writer',
      'qa-manager',
      'scriptwriter',
      'tech-stack-advisor',
      'ui-designer',
    ])
    assert.deepEqual(
      agentRoster().map((a) => a.kind),
      [...Array(8).fill('role'), 'spec', 'lead', 'lead', 'spec', 'spec', 'lead', 'spec', 'spec', 'spec', 'spec', 'spec', 'lead', 'spec', 'spec'],
    )
    // A role says which work it runs; a specialist is asked for by name and runs none.
    assert.ok(agentRoster()[0]!.flows.length > 0)
    assert.deepEqual(agentRoster()[9]!.flows, [])
    // No role has a switch (#1208), and no agent carrying a stage does (#749).
    assert.deepEqual(agentRoster().filter((a) => a.kind === 'role' && a.switchable).map((a) => a.name), [])
    assert.deepEqual(agentRoster().filter((a) => a.stage && a.switchable).map((a) => a.name), [])
  })
})

// The proposer and the memory reviewer used to have switches (#534, #748).
describe('the board helpers are always on (#1208)', () => {
  const on = async (name: string): Promise<boolean> =>
    (await readAgents()).agents.find((a) => a.name === name)!.enabled

  it('reads a key an earlier release wrote to switch one off as on', async () => {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ proposer: false, autoTriage: false, memoryReviewer: false }))
    for (const name of ['proposer', 'memory-reviewer', 'discussion-helper', 'software-planner', 'builder']) {
      assert.equal(await on(name), true, name)
    }
  })

  it('refuses to switch one off, the way every other role refuses', () => {
    for (const name of ['proposer', 'memory-reviewer']) {
      const res = setSpecAgentEnabled(name, false)
      assert.equal(res.ok, false, name)
      assert.match(res.error!, /can't be switched off/)
    }
  })

  // The retired roles are gone: nothing answers to their names.
  it('knows no gater, decider or code reviewer', () => {
    for (const name of ['gater', 'decider', 'code-reviewer']) {
      assert.equal(setSpecAgentEnabled(name, true).ok, false, name)
      assert.equal(agentNames().includes(name), false, name)
    }
  })

  it('refuses to switch off a role the board runs on', async () => {
    const refused = setSpecAgentEnabled('software-planner', false)
    assert.equal(refused.ok, false)
    assert.match(refused.error!, /can't be switched off/)
  })
})

describe("the one-time move onto the agents", () => {
  it('folds a per-flow rule file into its agent, in flow order, and deletes it', () => {
    rule('implement', 'Install dependencies first.')
    rule('conflict', 'Keep the target branch.')

    const notes = migrateFlowRules()
    assert.equal(ruleText('builder'), 'Install dependencies first.\n\nKeep the target branch.')
    for (const gone of ['implement', 'conflict']) {
      assert.equal(fs.existsSync(path.join(RULES, `${gone}.md`)), false, gone)
    }
    // Said out loud: what the user wrote for one flow now reaches two more.
    assert.equal(notes.length, 1)
    assert.match(notes.join('\n'), /implement\.md, conflict\.md/)
    assert.match(notes.join('\n'), /builder\.md/)
  })

  it('runs once — the second read finds nothing to move and says nothing', () => {
    rule('implement', 'Install dependencies first.')
    assert.equal(readRule('builder'), 'Install dependencies first.')
    assert.deepEqual(migrateFlowRules(), [])
    assert.deepEqual(buildRun({ action: 'create', description: 'a new card' }).notes, [])
  })

  it("keeps a rule the agent already had in front of the flows'", () => {
    rule('builder', 'The board rule.')
    rule('run', 'The recurring rule.')
    migrateFlowRules()
    assert.equal(ruleText('builder'), 'The board rule.\n\nThe recurring rule.')
  })

  it('reports the move in the run log the first time a run is built', () => {
    rule('implement', 'Run the smoke tests.')
    const { notes, prompt } = buildRun({ action: 'implement', id: 1, title: 'card one' })
    assert.match(notes.join('\n'), /a rule is one per agent now/)
    assert.match(prompt, /smoke tests/)
  })

  it('leaves a board that never had a rule alone', () => {
    assert.deepEqual(migrateFlowRules(), [])
    assert.equal(fs.existsSync(RULES), false)
    assert.equal(readRule('builder'), '')
    assert.equal(ruleFor({ action: 'implement', id: 1 }), '')
  })
})

describe('akb raw rule', () => {
  it('writes one agent\'s rule from a file, replaces it, and clears it', async () => {
    const file = path.join(root, 'rule.md')
    fs.writeFileSync(file, 'Install dependencies first.\n')
    const wrote = await move(root, ['rule', 'builder', '--file', file])
    assert.equal(wrote.agent, 'builder')
    assert.equal(ruleText('builder'), 'Install dependencies first.')

    await move(root, ['rule', 'builder', '--text', 'Something else.'])
    assert.equal(ruleText('builder'), 'Something else.')

    const cleared = await move(root, ['rule', 'builder', '--text', ''])
    assert.equal(cleared.cleared, true)
    assert.equal(fs.existsSync(path.join(RULES, 'builder.md')), false)
  })

  it('takes a spec agent by name too, and refuses a name no agent answers to', async () => {
    await move(root, ['rule', 'ui-designer', '--text', 'Keep to the existing palette.'])
    assert.equal(ruleText('ui-designer'), 'Keep to the existing palette.')
    await refuses(root, ['rule', 'designer', '--text', 'Anything.'], /software-planner, builder, memory-pruner/)
  })

  // The agent was renamed, and a rule is saved under the agent's name.
  it('moves a spec agent’s rule off the name it had before, once', async () => {
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'ui-design.md'), 'Keep to the existing palette.\n')
    assert.equal(readRule('ui-designer'), 'Keep to the existing palette.')
    assert.equal(ruleText('ui-designer'), 'Keep to the existing palette.')
    assert.equal(fs.existsSync(path.join(RULES, 'ui-design.md')), false)
  })

  it('refuses two sources, and no source at all', async () => {
    await refuses(root, ['rule', 'builder', '--file', 'a.md', '--text', 'b'], /not both/)
    await refuses(root, ['rule', 'builder'], /--file <path>/)
  })
})
