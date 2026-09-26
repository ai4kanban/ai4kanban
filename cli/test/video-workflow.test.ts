// The built-in product video workflow (#822, #1057): `lead` agents, the `<board-state>` path
// constant, and which flows print a lead's own instructions.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { useBoard, resolveBoard } from '../src/lib/board-cli.ts'
import { parseSpecAgent } from '../src/lib/agents/parse.ts'
import { findSpecAgent } from '../src/lib/agents/index.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk, buildPrompt } from '../src/lib/agent/prompts.ts'
import { refinementRequest } from '../src/lib/agent/refine.ts'
import { agentForRun } from '../src/lib/agent/runner.ts'
import {
  addWorkflowHelper,
  createWorkflow,
  liveStage,
  setWorkflowLead,
  workflowById,
  workflowProblems,
} from '../src/lib/agent/workflows.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { boardText, setBoardRoot } from '../src/lib/paths.ts'
import type { AgentRequest } from '../src/lib/agent/types.ts'
import { move, run } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-video-')))
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

// What `akb card <action> --print` prints; a refine prints the pass it would start.
const printed = (action: 'refine' | 'implement', id: number): string => {
  const req: AgentRequest | { error: string } = action === 'refine' ? refinementRequest({ action: 'refine', id }) : { action, id }
  if ('error' in req) throw new Error(req.error)
  const sink = startCollecting()
  try {
    printFlow(req)
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

const videoCard = async (): Promise<number> =>
  (await move(root, ['create', '--title', 'Show the board', '--workflow', 'hyperframes-video'])).id as number

const lead = (stage: string): string =>
  ['---', 'name: x', 'description: Leads.', 'akb:', '  kind: lead', ...(stage ? [`  stage: ${stage}`] : []), '---', '', 'You lead.', ''].join('\n')

describe('a lead agent', () => {
  it('parses with a plan or execute stage, and is refused without one', () => {
    const read = parseSpecAgent(lead('plan'), 'x', () => null)
    assert.ok('agent' in read)
    assert.equal(read.agent.kind, 'lead')
    assert.equal(read.agent.stage, 'plan')
    for (const stage of ['', 'review']) {
      const bad = parseSpecAgent(lead(stage), 'x', () => null)
      assert.ok('problem' in bad)
      assert.match(bad.problem, /`lead` agent — give it `akb.stage: plan`/)
    }
  })

  it('only leads: never a helper, never run by `akb spec`', async () => {
    const mine = createWorkflow('Mine').id!
    assert.match(addWorkflowHelper(mine, 'plan', 'scriptwriter').error!, /can lead a stage, so it never helps/)
    assert.equal(setWorkflowLead(mine, 'plan', 'scriptwriter').ok, true)
    assert.match(setWorkflowLead(mine, 'execute', 'scriptwriter').error!, /is a plan agent/)
    const id = await videoCard()
    await assert.rejects(() => run(root, ['spec', 'scriptwriter', String(id), '--print']), /not a spec agent/)
  })
})

describe('the hyperframes-video workflow', () => {
  it('plans with its own lead, calls in hyperframes-editor, and builds nothing', () => {
    const flow = workflowById('hyperframes-video')!
    assert.equal(flow.name, 'Product video')
    assert.equal(flow.builtIn, true)
    assert.equal(flow.needsArtifact, true)
    assert.equal(flow.delivers, 'plan')
    assert.equal(flow.stages.plan.lead, 'scriptwriter')
    assert.equal(flow.stages.execute.lead, '')
    assert.deepEqual(liveStage(flow, 'plan').helpers.map((h) => h.agent), ['hyperframes-editor'])
    assert.deepEqual(liveStage(flow, 'execute').helpers, [])
    assert.deepEqual(liveStage(flow, 'review').helpers, [])
    assert.deepEqual(workflowProblems('hyperframes-video'), [])
  })

  it("keeps its agents off coding's default helpers", () => {
    const helpers = liveStage(workflowById('coding')!, 'plan').helpers.map((h) => h.agent)
    for (const name of ['scriptwriter', 'hyperframes-editor']) assert.ok(!helpers.includes(name), name)
    assert.ok(helpers.includes('ui-designer'))
    assert.deepEqual(liveStage(workflowById('coding')!, 'review').helpers.map((h) => h.agent), ['code-reviewer'])
  })

  it('runs its lead under its own name', async () => {
    const id = await videoCard()
    assert.equal(agentForRun({ action: 'clarify', id, refineRound: 1 }), 'scriptwriter')
  })

  it("prints the lead's instructions after the shared flow, and only on its own cards", async () => {
    const video = await videoCard()
    const coding = (await move(root, ['create', '--title', 'Fix the header'])).id as number

    const refine = printed('refine', video)
    assert.match(refine, /you, the `scriptwriter` agent[\s\S]*## By `scriptwriter` agent/)
    assert.match(refine, /Your output is set to be reviewed by me: write it in ``## By `scriptwriter` agent``, above `<!-- agent -->`/)
    assert.ok(refine.indexOf('`scriptwriter` agent —') > refine.indexOf('——— akb guide'))
    assert.match(refine, /hyperframes-editor/)
    assert.doesNotMatch(refine, /ui-designer|tech-stack-advisor/)
    assert.throws(() => printed('implement', video), /archived rather than built/)

    for (const action of ['refine', 'implement'] as const) {
      const text = printed(action, coding)
      assert.doesNotMatch(text, /you, the `scriptwriter` agent/)
      assert.doesNotMatch(text, /hyperframes-editor/)
    }
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: coding }), /hyperframes-editor/)
  })

  it("prints the lead's instructions on a board's own workflow too", async () => {
    const mine = createWorkflow('Clips').id!
    assert.equal(setWorkflowLead(mine, 'plan', 'deck-planner').ok, true)
    const id = (await move(root, ['create', '--title', 'A clip', '--workflow', mine])).id as number
    assert.match(printed('refine', id), /you, the `deck-planner` agent/)
    assert.doesNotMatch(printed('refine', id), /you, the `scriptwriter` agent/)
  })
})

describe('the <board-state> path constant', () => {
  it('spells the asset folder in the video editor’s prompt', async () => {
    const id = await videoCard()
    const editor = buildAsk({ action: 'spec', id, specAgent: 'hyperframes-editor' })
    assert.match(editor, /`\.akb\/boards\/docs\/kanban\/assets\/<card id>\/`/)
    assert.doesNotMatch(editor, /<board-state>/)
  })

  it("leaves ui-designer's prompt as it read before", () => {
    const body = findSpecAgent('ui-designer')!.body
    assert.match(body, /<board-state>\/assets/)
    const before = body.split('<board-state>/assets').join('docs/kanban/.assets')
    assert.equal(boardText(body), boardText(before))
    assert.match(boardText(body), /`\.akb\/boards\/docs\/kanban\/assets\/<card id>\/`/)
  })

  it("names another board's own state folder", () => {
    const marketing = path.join(root, 'marketing', 'kanban')
    fs.mkdirSync(path.join(marketing, 'todo'), { recursive: true })
    fs.writeFileSync(path.join(marketing, 'config.md'), '# Configuration\n')
    useBoard(resolveBoard('list', { board: marketing, dir: null, cwd: root, installHint: '' }), false)
    assert.equal(
      boardText('<board-state>/assets and docs/kanban/memory and docs/kanban/.assets'),
      '.akb/boards/marketing/kanban/assets and marketing/kanban/memory and .akb/boards/marketing/kanban/assets',
    )
  })
})
