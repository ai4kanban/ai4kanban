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
import { agentNames, agentRoster, REVIEW_LEAD, roleForFlow, roleNamed, roles } from '../src/lib/agent/roles.ts'
import { agentForFlow } from '../src/lib/agent/stages.ts'
import { migrateFlowRules, readRule, ruleFor } from '../src/lib/agent/rules.ts'
import { setSpecAgentEnabled, specAgentProblems } from '../src/lib/agents/index.ts'
import { readAgents } from '../src/lib/agents/roster.ts'
import { aiReviewEnabled, deciderOn, readyGateOn, setAiReview } from '../src/lib/agent/settings.ts'
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

  // The review stage is led by a role no roster shows (#820).
  it('leads review with a hidden role that is on no roster', () => {
    assert.equal(roleForFlow('review')!.name, REVIEW_LEAD)
    assert.equal(agentNames().includes(REVIEW_LEAD), false)
    assert.equal(roles().some((r) => r.name === REVIEW_LEAD), false)
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
        'sweeper',
        'dismissal-reviewer',
        'feedback',
        'gater',
        'decider',
        'proposer',
        'triage',
      ],
    )
    assert.equal(roleForFlow('implement')!.name, 'builder')
    assert.equal(roleForFlow('prune-memory')!.name, 'memory-pruner')
    // Reading back over the conversations is the memory reviewer's (#748): a chat writes no
    // memory itself.
    assert.equal(roleForFlow('review-memory')!.name, 'memory-reviewer')
    // Settling a stale card is the sweeper's (#118).
    assert.equal(roleForFlow('unstick')!.name, 'sweeper')
    assert.equal(roleForFlow('review-dismissals')!.name, 'dismissal-reviewer')
    // Every conversation is the discussion helper's, and `chat` is no flow anyone types.
    assert.equal(roleForFlow('chat')!.name, 'discussion-helper')
    assert.equal(roleForFlow('gate')!.name, 'gater')
    assert.equal(roleForFlow('decide')!.name, 'decider')
    // And a reflection is the proposer's — no flow a person types either (#534).
    assert.equal(roleForFlow('reflect')!.name, 'proposer')
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

  // The two that write no memory at all own no folder either (#805).
  it('gives the builder and the code reviewer no memory', () => {
    const memoryOf = (name: string): string[] => agentRoster().find((a) => a.name === name)!.memory
    for (const name of ['builder', 'code-reviewer']) {
      assert.deepEqual(memoryOf(name), [], name)
    }
  })

  it("refuses a project agent that takes a role's name, so no two share a rule", () => {
    const home = path.join(kanban(), 'agents', 'builder')
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(
      path.join(home, 'AGENT.md'),
      ['---', 'name: builder', 'description: Use when.', 'akb:', '  kind: spec', '---', '', 'You build.']
        .join('\n')
        .concat('\n'),
    )
    assert.deepEqual(agentNames(), [
      'discussion-helper',
      'software-planner',
      'builder',
      'memory-pruner',
      'memory-reviewer',
      'sweeper',
      'dismissal-reviewer',
      'feedback',
      'gater',
      'decider',
      'proposer',
      'triage',
      'code-reviewer',
      'copywriting',
      'deck-builder',
      'deck-planner',
      'hyperframes-editor',
      'scriptwriter',
      'tech-stack-advisor',
      'ui-designer',
    ])
    assert.match(specAgentProblems().join('\n'), /`builder` is one of the roles the board ships/)
  })

  it('rosters the roles first, then the specialists the command ships', () => {
    const names = agentNames()
    assert.deepEqual(names.slice(0, 12), [
      'discussion-helper',
      'software-planner',
      'builder',
      'memory-pruner',
      'memory-reviewer',
      'sweeper',
      'dismissal-reviewer',
      'feedback',
      'gater',
      'decider',
      'proposer',
      'triage',
    ])
    assert.deepEqual(names.slice(12), [
      'code-reviewer',
      'copywriting',
      'deck-builder',
      'deck-planner',
      'hyperframes-editor',
      'scriptwriter',
      'tech-stack-advisor',
      'ui-designer',
    ])
    assert.deepEqual(
      agentRoster().map((a) => a.kind),
      [...Array(12).fill('role'), 'spec', 'spec', 'lead', 'lead', 'spec', 'lead', 'spec', 'spec'],
    )
    // A role says which work it runs; a specialist is asked for by name and runs none.
    assert.ok(agentRoster()[0]!.flows.length > 0)
    assert.deepEqual(agentRoster()[12]!.flows, [])
    // Five roles can be switched off, and each reads a key of its own (#447, #493, #534,
    // #562, #748). None of them belongs to a workflow: an agent a stage assigns has no
    // switch, the reviewer included (#749, #783).
    assert.deepEqual(
      agentRoster().filter((a) => a.kind === 'role' && a.switchable).map((a) => [a.name, a.setting]),
      [
        ['memory-reviewer', 'memoryReviewer'],
        ['gater', 'readyGate'],
        ['decider', 'decider'],
        ['proposer', 'proposer'],
        ['triage', 'autoTriage'],
      ],
    )
    // And no agent carrying a stage carries a switch.
    assert.deepEqual(agentRoster().filter((a) => a.stage && a.switchable).map((a) => a.name), [])
    // And three of them ask before their switch moves — the direction included, and a
    // property of the role, so no screen keeps a list of names (#562, #748).
    assert.deepEqual(
      agentRoster().filter((a) => a.confirm).map((a) => [a.name, a.confirm]),
      [
        ['memory-reviewer', 'off'],
        ['decider', 'on'],
        ['triage', 'on'],
      ],
    )
  })
})

// The gater and the decider (#493), the proposer (#534), the triager (#562) and the memory
// reviewer (#748) — five board agents, five switches, five keys. The keys are the ones the
// board has always written, so a project that answered any of them before the split finds
// the same agent as it left it.
describe('the roles that can be switched off', () => {
  const on = async (name: string): Promise<boolean> =>
    (await readAgents()).agents.find((a) => a.name === name)!.enabled

  it('starts on the side its role ships, and every role that has no switch stays on', async () => {
    assert.equal(await on('gater'), false)
    assert.equal(await on('decider'), false)
    assert.equal(await on('proposer'), false)
    // The one switchable role that ships ON: a conversation is remembered unless you say
    // otherwise.
    assert.equal(await on('memory-reviewer'), true)
    // And a workflow agent is always on here: its stage assignment is the whole answer
    // (#749, #783).
    for (const always of ['discussion-helper', 'software-planner', 'builder', 'code-reviewer']) {
      assert.equal(await on(always), true, always)
    }
  })

  it('reads the key the board already wrote, so a switch survives the split', async () => {
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ readyGate: true }))
    assert.equal(await on('gater'), true)
    assert.equal(await on('decider'), false)

    fs.writeFileSync(UI_CONFIG, JSON.stringify({ decider: true }))
    assert.equal(await on('gater'), false)
    assert.equal(await on('decider'), true)

    // And the memory reviewer the other way round: its key is only ever written to turn it
    // off.
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryReviewer: false }))
    assert.equal(await on('memory-reviewer'), false)
  })

  it('switches one without touching the other, each under its own key', async () => {
    assert.equal(setSpecAgentEnabled('gater', true).ok, true)
    assert.equal(readyGateOn(), true)
    assert.equal(deciderOn(), false)

    assert.equal(setSpecAgentEnabled('decider', true).ok, true)
    assert.equal(setSpecAgentEnabled('gater', false).ok, true)
    assert.equal(readyGateOn(), false)
    assert.equal(deciderOn(), true)
  })

  // The reviewer has no switch of its own (#783). Asking for one says so, and says where
  // whether a build is reviewed at all is actually answered — a delivery setting, under
  // General → Delivery, which `aiReview` still reads.
  it('refuses to switch the code reviewer, and points at the delivery setting', async () => {
    const refused = setSpecAgentEnabled('code-reviewer', false)
    assert.equal(refused.ok, false)
    assert.match(refused.error!, /has no switch/)
    assert.match(refused.error!, /Configuration → General → Delivery/)
    assert.equal(fs.existsSync(UI_CONFIG), false, 'a refusal writes nothing')

    // And the setting itself is untouched by any of it.
    assert.equal(aiReviewEnabled(), true)
    setAiReview(false)
    assert.equal(aiReviewEnabled(), false)
    assert.equal(await on('code-reviewer'), true)
    // Its old name reaches the same refusal.
    assert.match(setSpecAgentEnabled('reviewer', false).error!, /has no switch/)
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
    rule('review', 'Run the smoke tests.')

    const notes = migrateFlowRules()
    assert.equal(ruleText('builder'), 'Install dependencies first.\n\nKeep the target branch.')
    assert.equal(ruleText('code-reviewer'), 'Run the smoke tests.')
    for (const gone of ['implement', 'conflict', 'review']) {
      assert.equal(fs.existsSync(path.join(RULES, `${gone}.md`)), false, gone)
    }
    // Said out loud: what the user wrote for one flow now reaches two more.
    assert.equal(notes.length, 2)
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
