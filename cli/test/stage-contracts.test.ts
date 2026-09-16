// The four stage contracts and the shared flow nodes (#714).
//
// What is asked here: the classification is a total one — every flow this board can start is
// a stage's, a decision or an event and never two of them; the lead a contract names is the
// agent that ran that flow before contracts existed; a contract that
// names somebody the board hasn't says which stage and which name; and the completion check
// reads `requires`, asks once for what is missing, and then stops for the user.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { FLOWS } from '../src/lib/agent/flows.ts'
import { refinementRunsAfter, markBoard } from '../src/lib/agent/refine.ts'
import { roleForFlow, stageContractProblems } from '../src/lib/agent/roles.ts'
import { deliveryRules, ruleFor } from '../src/lib/agent/rules.ts'
import { endOfStage, missingRequired, stageOfAction } from '../src/lib/agent/stage-end.ts'
import {
  agentForFlow,
  contractProblems,
  flowNodes,
  flowsOfAgent,
  stageContract,
  stageContracts,
  stageOfFlow,
  type StageContract,
} from '../src/lib/agent/stages.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { findCard } from '../src/lib/view/read.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** One card on the board, with whatever body the case needs. */
function writeCard(id: number, body = 'A card.', opts: { folder?: string; status?: string } = {}): void {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: opts.status ?? 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
    schedule: null,
  }
  const dir = opts.folder ? path.join(kanban(), 'todo', opts.folder) : path.join(kanban(), 'todo')
  fs.mkdirSync(dir, { recursive: true })
  const file = opts.folder ? 'root.md' : `${id}-card-${id}.md`
  fs.writeFileSync(path.join(dir, file), `${serializeFrontmatter(meta)}\n\n${body}\n\n## Todo\n\n- [ ] Build it.\n`)
}

/** One run, as the record holds it. */
const aRun = (run: Partial<RunRecord> & Pick<RunRecord, 'sessionId' | 'action'>): RunRecord => ({
  cardId: null,
  status: 'done',
  startedAt: Date.now(),
  code: null,
  harness: 'claude',
  logPath: '',
  ...run,
})

/** Put one on the machine's own file. A finished run is kept only while its log is there,
 *  so the case writes one. */
const recordRun = (run: Partial<RunRecord> & Pick<RunRecord, 'sessionId' | 'action'>): void => {
  const logPath = logPathOf(run.sessionId)
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, '')
  withStore((store) => {
    store.runs.push(aRun({ ...run, logPath }))
  })
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-stages-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the classification', () => {
  it('puts every flow the board can start in exactly one of the three', () => {
    for (const flow of FLOWS) {
      const stage = stageOfFlow(flow.command)
      const node = flowNodes().find((n) => n.flow === flow.command)
      const places = [stage, node].filter(Boolean).length
      assert.equal(places, 1, `${flow.command} is in ${places} places`)
    }
  })

  it('claims the flows nobody types, too', () => {
    // Not commands under `akb card`, and the board's work all the same.
    assert.equal(stageOfFlow('chat'), 'discuss')
    assert.equal(flowNodes().find((n) => n.flow === 'reflect')?.kind, 'event')
    assert.equal(flowNodes().find((n) => n.flow === 'feedback')?.kind, 'event')
  })

  it('calls the gate and the decider decisions, and the six entries events', () => {
    const kinds = Object.fromEntries(flowNodes().map((n) => [n.flow, n.kind]))
    assert.deepEqual(kinds, {
      gate: 'decision',
      decide: 'decision',
      reflect: 'event',
      triage: 'event',
      unstick: 'event',
      feedback: 'event',
      'prune-memory': 'event',
      'review-memory': 'event',
    })
    // Neither kind belongs to a stage, so neither shows up in one.
    for (const flow of Object.keys(kinds)) assert.equal(stageOfFlow(flow), undefined, flow)
  })

  // The guard the todo asks for: a flow shipped later with no home fails here rather than
  // quietly becoming a flow nobody runs.
  it('fails when a flow is added and left unclassified', () => {
    const orphan = 'brand-new-flow'
    assert.equal(stageOfFlow(orphan), undefined)
    assert.equal(flowNodes().some((n) => n.flow === orphan), false)
    assert.equal(agentForFlow(orphan), undefined)
  })
})

describe('the lead a contract names', () => {
  // The whole point of this card: the board runs exactly as it ran before. This is the old
  // per-role table, flow by flow.
  const BOARD: Record<string, string> = {
    chat: 'discussion-helper',
    create: 'planner',
    refine: 'planner',
    resolve: 'planner',
    revise: 'planner',
    'plan-release': 'planner',
    changelog: 'planner',
    archive: 'planner',
    reject: 'planner',
    setup: 'planner',
    implement: 'builder',
    conflict: 'builder',
    run: 'builder',
    review: 'reviewer',
    'prune-memory': 'memory-pruner',
    'review-memory': 'memory-reviewer',
    unstick: 'sweeper',
    feedback: 'feedback',
    gate: 'gater',
    decide: 'decider',
    reflect: 'proposer',
    triage: 'triage',
  }

  it('is the agent that ran that flow before', () => {
    for (const [flow, agent] of Object.entries(BOARD)) {
      assert.equal(agentForFlow(flow), agent, flow)
      assert.equal(roleForFlow(flow)?.name, agent, flow)
    }
  })

  it('is what a role reads its own flows back off', () => {
    assert.deepEqual(flowsOfAgent('builder'), ['implement', 'conflict', 'run'])
    assert.deepEqual(flowsOfAgent('gater'), ['gate'])
    assert.deepEqual(flowsOfAgent('reviewer'), ['review'])
  })
})

describe('a contract that names somebody the board has not', () => {
  it('says which stage and which name, and passes on what the command ships', () => {
    assert.deepEqual(stageContractProblems(), [])
    const said = contractProblems([]).join('\n')
    for (const contract of stageContracts()) {
      assert.match(said, new RegExp(`the ${contract.stage} stage is led by \`${contract.lead}\``))
    }
  })
})

describe('the completion check', () => {
  it('requires nothing but the lead on everything the command ships', () => {
    for (const contract of stageContracts()) assert.deepEqual(contract.requires, [], contract.stage)
  })

  it('holds the stage open while a required helper has written nothing', () => {
    writeCard(1)
    const card = findCard(1)!
    const contract: StageContract = { ...stageContract('plan'), requires: ['ui-designer'] }
    assert.deepEqual(missingRequired(contract, card), ['ui-designer'])
    // Nothing has been asked yet, so the check asks — once.
    const first = endOfStage(contract, card)
    assert.ok('ask' in first)
    assert.equal(first.ask.action, 'spec')
    assert.equal(first.ask.specAgent, 'ui-designer')
    assert.equal(first.ask.id, 1)
  })

  it('stops for the user once it has asked and the section is still not there', () => {
    writeCard(1)
    recordRun({ sessionId: 's1', action: 'spec', cardId: 1, specAgent: 'ui-designer' })
    const contract: StageContract = { ...stageContract('plan'), requires: ['ui-designer'] }
    const end = endOfStage(contract, findCard(1)!)
    assert.ok('missing' in end)
    assert.deepEqual(end.missing, ['ui-designer'])
    assert.equal(end.stage, 'plan')
  })

  it('is satisfied by the helper’s own section on the card', () => {
    writeCard(1, 'A card.\n\n## By `ui-designer` agent\n\nThe screens.')
    const contract: StageContract = { ...stageContract('plan'), requires: ['ui-designer'] }
    assert.deepEqual(missingRequired(contract, findCard(1)!), [])
    assert.deepEqual(endOfStage(contract, findCard(1)!), { done: true })
  })

  it('puts a spec run in the planning stage, and a decision in no stage at all', () => {
    assert.equal(stageOfAction('spec'), 'plan')
    assert.equal(stageOfAction('clarify'), 'plan')
    assert.equal(stageOfAction('implement'), 'build')
    assert.equal(stageOfAction('review'), 'review')
    assert.equal(stageOfAction('decide'), undefined)
    assert.equal(stageOfAction('gate'), undefined)
  })

  // A stage nothing on this board requires anything of can never hold a card up — whatever
  // shape that card is in.
  it('asks a run with no card, a group root and a recurring card for no stage they have not', () => {
    writeCard(1)
    writeCard(2, 'A group.', { folder: '2-group' })
    fs.mkdirSync(path.join(kanban(), 'todo', 'recurring'), { recursive: true })
    const before = markBoard()
    const closes = [
      aRun({ sessionId: 'a', action: 'prune-memory' }),
      aRun({ sessionId: 'b', action: 'clarify', cardId: 2, refineRound: 1 }),
      aRun({ sessionId: 'c', action: 'run', cardId: 1 }),
    ]
    for (const run of closes) {
      const after = refinementRunsAfter(run, [], before)
      assert.doesNotMatch(after.stalled ?? '', /stage of #/, run.action)
    }
  })
})

describe('the helpers, one at a time', () => {
  // What the card asks for: helpers run in turn and the lead comes back once the LAST of
  // them is done, so one agent at a time is writing the conclusion.
  it('holds the lead back while another helper is still queued', () => {
    writeCard(1)
    const before = markBoard()
    const spec = aRun({ sessionId: 's1', action: 'spec', cardId: 1, specAgent: 'ui-designer' })
    // This helper's close still carries the ask for the next one.
    assert.deepEqual(refinementRunsAfter(spec, [], before, true).runs, [])
    // The last one carries none, and the lead resumes to fold the sections into one plan.
    assert.deepEqual(
      refinementRunsAfter(spec, [], before, false).runs.map((r) => [r.action, r.id]),
      [['clarify', 1]],
    )
  })
})

describe('the rules a delivery freezes', () => {
  it('keys them by the agent, and still reads one an older delivery keyed by flow', () => {
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'builder.md'), 'Install dependencies first.\n')
    fs.writeFileSync(path.join(RULES, 'reviewer.md'), 'Run the smoke tests.\n')
    assert.deepEqual(deliveryRules(), {
      builder: 'Install dependencies first.',
      reviewer: 'Run the smoke tests.',
    })
    // A delivery frozen before rules moved onto the agents holds them under the FLOW name,
    // and that key is untouched by the contracts (#420, #714).
    const frozen = { implement: 'The rule as it was frozen.' }
    assert.equal(ruleFor({ action: 'implement', id: 1 }, frozen), 'The rule as it was frozen.')
  })
})
