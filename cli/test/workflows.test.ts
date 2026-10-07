// The workflows a board runs, and the workflow one card runs through (#715).
//
// What is asked here: the one the command ships is there with nobody having configured
// anything, a card carries its workflow through every rewrite, a stage resolves to the agent
// the workflow assigns rather than to the board's one answer, a built-in refuses a rename and
// a delete, and a delivery keeps the workflow it started with.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { buildAsk, leadBlock } from '../src/lib/agent/prompts.ts'
import { agentForFlow, stageContract } from '../src/lib/agent/stages.ts'
import { readDeliveryRow, readStore, withStore } from '../src/lib/agent/store.ts'
import { joinDelivery } from '../src/lib/agent/deliveries.ts'
import { findGuide } from '../src/lib/guide.ts'
import {
  addWorkflowHelper,
  createWorkflow,
  cardWorkflow,
  cardWorkflowId,
  DEFAULT_WORKFLOW,
  deleteWorkflow,
  dismissRetiredAssignment,
  duplicateWorkflow,
  frozenWorkflow,
  liveStage,
  scheduledAgent,
  switchWorkflowAgent,
  switchWorkflowScheduled,
  renameWorkflow,
  setWorkflowHelperExtra,
  setWorkflowLead,
  stageCandidates,
  workflowById,
  workflowIssues,
  workflowOwnAgents,
  workflowProblems,
  workflows,
  workflowViews,
} from '../src/lib/agent/workflows.ts'
import { cardsOnWorkflow, removeWorkflow } from '../src/lib/agent/workflow-cards.ts'
import { setSpecAgentEnabled, specAgentAssigned } from '../src/lib/agents/index.ts'
import { createAgent } from '../src/lib/agents/roster.ts'
import { cmdWorkflowDelete } from '../src/commands/workflow.ts'
import { startRun, workflowRefusal } from '../src/lib/agent/start.ts'
import { agentMemoryDir } from '../src/lib/memory.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'
import { patchCard } from '../src/lib/view/edit.ts'
import type { CardPatch } from '../src/lib/view/types.ts'
import { move, refuses, run, uiConfigOf } from './helpers/board.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

const solution = (name: string): void => {
  fs.writeFileSync(path.join(kanban(), 'config.md'), `- **Solution** — ${name}\n`)
}

// Project agents for the two later stages — the command ships none but its own roles there.
const stageAgent = (name: string, stage: string, lead = false): void => {
  const home = path.join(kanban(), 'agents', name)
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(home, 'AGENT.md'),
    [
      '---',
      `name: ${name}`,
      'description: Use when.',
      'akb:',
      `  ${lead ? 'lead' : 'hook'}: ${stage}`,
      '---',
      '',
      'You work.',
      '',
    ].join('\n'),
  )
}

// A workflow of the board's own that owes a file, the way a board-added one is saved.
const artifactWorkflow = (): string => {
  fs.writeFileSync(
    uiConfigOf(kanban()),
    JSON.stringify({
      workflows: {
        added: [{ id: 'wf-9', name: 'Video', needsArtifact: true }],
        stages: { 'wf-9': { plan: { lead: 'software-planner' }, execute: { lead: 'test-writer' } } },
      },
    }),
  )
  return 'wf-9'
}

const setWorkflow = (id: number, workflow: string): void => {
  const file = cardFile(id)
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  meta!.workflow = workflow
  fs.writeFileSync(file, `${serializeFrontmatter(meta!)}\n${body}`)
}

const cardFile = (id: number): string =>
  fs.readdirSync(path.join(kanban(), 'todo')).map((f) => path.join(kanban(), 'todo', f)).find((f) => path.basename(f).startsWith(`${id}-`))!

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-workflows-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  setBoardRoot(root)
  solution('product')
  stageAgent('test-writer', 'execute', true)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the workflows a board has', () => {
  it('ships five, configured by nobody, with both leads set', () => {
    assert.deepEqual(workflows().map((w) => w.id), ['coding', 'hyperframes-video', 'slide-deck', 'carousel-post', 'blog-post'])
    assert.equal(workflowById('coding')!.name, 'Coding')
    assert.deepEqual(workflowProblems('coding'), [])
    const deck = workflowById('slide-deck')!
    assert.deepEqual([deck.stages.plan.lead, deck.stages.execute.lead, deck.needsArtifact, deck.delivers], ['deck-planner', '', true, 'plan'])
    assert.deepEqual(workflowProblems('slide-deck'), [])
    const carousel = workflowById('carousel-post')!
    assert.deepEqual([carousel.stages.plan.lead, carousel.stages.execute.lead, carousel.needsArtifact, carousel.delivers], ['carousel-planner', '', true, 'plan'])
    assert.deepEqual(workflowProblems('carousel-post'), [])
    const blog = workflowById('blog-post')!
    assert.deepEqual([blog.stages.plan.lead, blog.stages.execute.lead, blog.needsArtifact, blog.delivers], ['blog-planner', '', true, 'plan'])
    assert.deepEqual(blog.stages.plan.helpers.map((h) => h.agent), ['blog-illustrator'])
    assert.deepEqual(workflowProblems('blog-post'), [])
    // The illustrator is the blog's own, never one of Coding's specialists.
    assert.ok(!workflowById('coding')!.stages.plan.helpers.some((h) => h.agent === 'blog-illustrator'))
    // Nothing was written to make that true: a board that never opened the pane still runs.
    assert.equal(fs.existsSync(uiConfigOf(kanban())), false)
  })

  it('leads each stage with the agents that workflow assigns, not with the board’s one answer', () => {
    const mine = artifactWorkflow()
    assert.equal(stageContract('build', 'coding').lead, 'builder')
    assert.equal(stageContract('build', mine).lead, 'test-writer')
    assert.equal(agentForFlow('implement', 'coding'), 'builder')
    assert.equal(agentForFlow('implement', mine), 'test-writer')
    // Two stages, and nothing reviews (#1203).
    assert.deepEqual(Object.keys(workflowById(mine)!.stages), ['plan', 'execute'])
    // A flow no workflow assigns is the board's whichever workflow asks.
    assert.equal(agentForFlow('chat', mine), 'discussion-helper')
  })

  it('offers a stage only the agents that declare it', () => {
    assert.deepEqual(stageCandidates('execute').map((a) => a.name), ['builder', 'test-writer'])
    // The two specialists the command ships fill part of a card's spec, which is planning.
    const plan = stageCandidates('plan').map((a) => a.name)
    assert.deepEqual(plan, ['software-planner', 'blog-illustrator', 'blog-planner', 'carousel-planner', 'competitor-research', 'copywriting', 'cover-designer', 'deck-planner', 'demo-rehearser', 'email-planner', 'hyperframes-editor', 'prompt-writer', 'scriptwriter', 'tech-stack-advisor', 'ui-designer', 'user-docs'])
  })

  it('refuses a lead that belongs to another stage, and one that already helps here', () => {
    const mine = createWorkflow('Mine')
    assert.match(setWorkflowLead(mine.id!, 'execute', 'software-planner').error!, /is a plan agent/)
    assert.equal(setWorkflowLead(mine.id!, 'plan', 'software-planner').ok, true)
    assert.equal(workflowById(mine.id!)!.stages.plan.lead, 'software-planner')
    assert.equal(addWorkflowHelper(mine.id!, 'plan', 'software-planner').ok, false)
  })

  it('keeps the specialists the coding plan stage offers until the board chooses for it', () => {
    const helpers = () => workflowViews()[0]!.stages[0]!.helpers.filter((h) => !h.off).map((h) => h.agent)
    assert.deepEqual(helpers(), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'ui-designer', 'user-docs'])
    // Disabling one IS choosing, and the choice sticks.
    assert.equal(switchWorkflowAgent('coding', 'plan', 'ui-designer', false).ok, true)
    assert.deepEqual(helpers(), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'user-docs'])
  })

  it('keeps an extra requirement per assignment, and clears it without touching the agent', () => {
    assert.equal(setWorkflowHelperExtra('coding', 'plan', 'ui-designer', 'Reuse the shipped components.').ok, true)
    const mine = (id: string) =>
      workflowById(id)!.stages.plan.helpers.find((h) => h.agent === 'ui-designer')?.extra ?? ''
    assert.equal(mine('coding'), 'Reuse the shipped components.')
    assert.equal(setWorkflowHelperExtra('coding', 'plan', 'ui-designer', '').ok, true)
    assert.equal(mine('coding'), '')
  })
})

// A built-in's name is a promise about who runs it (#774), so its three leads are the
// command's: the pane shows them, the terminal refuses them, and a board that changed one
// while it was still a picker gets the command's agent back.
describe('the leads of a workflow the command ships', () => {
  const config = (): Record<string, any> =>
    JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8'))

  it('refuses the change and says where a workflow of your own comes from', () => {
    const res = setWorkflowLead('coding', 'plan', 'ui-designer')
    assert.equal(res.ok, false)
    assert.match(res.error!, /built in .* fixed\. Duplicate it/)
    assert.equal(workflowById('coding')!.stages.plan.lead, 'software-planner')
    assert.equal(fs.existsSync(uiConfigOf(kanban())), false)
  })

  it('still takes helpers, and writes no lead beside them', () => {
    const helpers = (stage: number) => workflowViews()[0]!.stages[stage]!.helpers.filter((h) => !h.off).map((h) => h.agent)
    assert.equal(switchWorkflowAgent('coding', 'plan', 'ui-designer', false).ok, true)
    assert.deepEqual(helpers(0), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'user-docs'])
    assert.equal(config().workflows.stages.coding.plan.lead, undefined)
  })

  it('runs the command’s agent again on a board that had changed one, and drops the key', () => {
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({
        workflows: {
          stages: {
            coding: {
              plan: { lead: 'ui-designer', helpers: [{ agent: 'software-planner', extra: 'x' }] },
              execute: { lead: 'test-writer' },
            },
          },
        },
      }),
    )
    const coding = workflowViews()[0]!
    assert.equal(coding.stages[0]!.lead, 'software-planner')
    assert.equal(coding.stages[1]!.lead, 'builder')
    // The lead is never also a helper, so the agent it had been moved aside for is gone; the
    // plan helpers no workflow lists wait there, disabled (#1095) — all but a newly shipped one (#1099).
    assert.deepEqual(coding.stages[0]!.helpers.filter((h) => !h.off).map((h) => h.agent), ['prompt-writer', 'email-planner', 'user-docs', 'competitor-research'])
    // A stage that held nothing but a lead goes with it.
    assert.equal(config().workflows.stages.coding.execute, undefined)
    assert.equal(config().workflows.stages.coding.plan.lead, undefined)
    assert.deepEqual(config().workflows.stages.coding.plan.helpers, [
      { agent: 'software-planner', extra: 'x' },
      { agent: 'prompt-writer', extra: '' },
      { agent: 'email-planner', extra: '' },
      { agent: 'user-docs', extra: '' },
      { agent: 'competitor-research', extra: '' },
    ])
  })

  it('leaves a copy of one free to pick its own', () => {
    const copy = duplicateWorkflow('coding')
    assert.equal(workflowById(copy.id!)!.stages.plan.lead, 'software-planner')
    assert.equal(setWorkflowLead(copy.id!, 'execute', 'test-writer').ok, true)
    assert.equal(workflowById(copy.id!)!.stages.execute.lead, 'test-writer')
    assert.equal(workflowById('coding')!.stages.execute.lead, 'builder')
  })
})

// `storyboard-designer` (#945), `hyperframes-assets` and `video-reviewer` (#1057) are retired.
// A board that had assigned one loses the assignment on the upgrade, and the workflows it came
// off say so once.
describe('an assignment an upgrade retired', () => {
  const config = (): Record<string, any> =>
    JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8'))

  const saveConfig = (cfg: Record<string, unknown>): void =>
    fs.writeFileSync(uiConfigOf(kanban()), JSON.stringify(cfg, null, 2))

  const marked = (): string[] => workflowViews().filter((w) => w.retiredAssignment).map((w) => w.id)

  const assigned = (): Record<string, unknown> => ({
    workflows: {
      stages: {
        'hyperframes-video': {
          plan: {
            helpers: [
              { agent: 'storyboard-designer', extra: 'x' },
              { agent: 'hyperframes-assets', extra: 'z' },
              { agent: 'video-assets', extra: 'y' },
            ],
          },
          review: { helpers: [{ agent: 'video-reviewer', extra: 'r' }] },
        },
      },
    },
  })

  it('comes off every saved stage, and marks only the workflows it came off', () => {
    saveConfig(assigned())
    const video = workflowViews().find((w) => w.id === 'hyperframes-video')!
    // The old name of the agent that stays is rewritten, with its own requirement kept.
    assert.deepEqual(video.stages[0]!.helpers, [
      { agent: 'hyperframes-editor', extra: 'y' },
      { agent: 'cover-designer', extra: '' },
      { agent: 'demo-rehearser', extra: '' },
    ])
    assert.equal(video.stages.length, 2, 'the saved review stage is not read at all')
    assert.deepEqual(marked(), ['hyperframes-video'])
    assert.deepEqual(config().workflows.retired, ['hyperframes-video'])
  })

  it('leaves a workflow that never assigned it alone', () => {
    saveConfig({ workflows: { stages: { coding: { plan: { helpers: [{ agent: 'ui-designer', extra: '' }] } } } } })
    assert.deepEqual(marked(), [])
    assert.equal(config().workflows.retired, undefined)
  })

  it('runs once: a second read writes nothing and the mark does not come back', () => {
    saveConfig(assigned())
    assert.deepEqual(marked(), ['hyperframes-video'])
    assert.equal(dismissRetiredAssignment('hyperframes-video').ok, true)
    assert.deepEqual(marked(), [])
    assert.equal(config().workflows.retired, undefined)
    // The assignment is gone, so nothing re-marks it.
    assert.deepEqual(marked(), [])
    assert.deepEqual(
      workflowViews().find((w) => w.id === 'hyperframes-video')!.stages[0]!.helpers.map((h) => h.agent),
      ['hyperframes-editor', 'cover-designer', 'demo-rehearser'],
    )
  })

  it('ships the video workflow with its demo rehearser, editor and cover designer and nothing retired', () => {
    assert.deepEqual(
      liveStage(workflowById('hyperframes-video')!, 'plan').helpers.map((h) => h.agent),
      ['demo-rehearser', 'hyperframes-editor', 'cover-designer'],
    )
    assert.deepEqual(marked(), [])
    assert.equal(fs.existsSync(uiConfigOf(kanban())), false)
  })
})

// A board written before #749 kept a switch per workflow agent beside its stage assignment.
// The assignment is the only answer now, so the switch is folded into it once and the key
// goes — and an agent switched off then must not come back on the upgrade.
describe('a switch a board saved before the assignment was the answer', () => {
  const config = (): Record<string, any> =>
    JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8'))

  const saveConfig = (cfg: Record<string, unknown>): void =>
    fs.writeFileSync(uiConfigOf(kanban()), JSON.stringify(cfg, null, 2))

  // What the stage OFFERS, which is what a run is handed — an inherited stage has nothing
  // saved in it.
  const planHelpers = (id = 'coding'): string[] =>
    workflowViews()
      .find((w) => w.id === id)!
      .stages[0]!.helpers.filter((h) => !h.off)
      .map((h) => h.agent)

  it('comes off every stage that was offering the agent, and the key goes with it', () => {
    saveConfig({ specAgents: { 'ui-designer': false } })
    assert.deepEqual(planHelpers(), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'user-docs'])
    assert.equal(config().specAgents, undefined)
    // Written down, not worked out again: the stage is chosen from here.
    assert.deepEqual(config().workflows.stages.coding.plan.helpers, [
      { agent: 'competitor-research', extra: '' },
      { agent: 'copywriting', extra: '' },
      { agent: 'email-planner', extra: '' },
      { agent: 'prompt-writer', extra: '' },
      { agent: 'tech-stack-advisor', extra: '' },
      { agent: 'user-docs', extra: '' },
    ])
    // The lead is not written with it — a built-in's is the command's own (#774).
    assert.equal(config().workflows.stages.coding.plan.lead, undefined)
  })

  it('leaves everything else the entry held, and touches no other agent', () => {
    saveConfig({ specAgents: { 'ui-designer': { enabled: false, mockupStyle: 'ascii' } } })
    assert.deepEqual(planHelpers(), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'user-docs'])
    assert.deepEqual(config().specAgents, { 'ui-designer': { mockupStyle: 'ascii' } })
  })

  it('takes the agent off a stage the board had already chosen for', () => {
    saveConfig({
      specAgents: { 'tech-stack-advisor': false },
      workflows: { stages: { coding: { plan: { lead: 'software-planner', helpers: [{ agent: 'tech-stack-advisor', extra: 'x' }] } } } },
    })
    assert.deepEqual(planHelpers(), ['prompt-writer', 'email-planner', 'user-docs', 'competitor-research'])
    assert.equal(config().specAgents, undefined)
  })

  it('does not put the agent back, and adding it again is the board’s own choice', () => {
    saveConfig({ specAgents: { 'ui-designer': false } })
    assert.deepEqual(planHelpers(), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'user-docs'])
    assert.equal(addWorkflowHelper('coding', 'plan', 'ui-designer').ok, true)
    assert.deepEqual(planHelpers(), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'user-docs', 'ui-designer'])
    assert.equal(config().specAgents, undefined)
  })

  it('is refused where a workflow agent is switched off by name', () => {
    const refused = setSpecAgentEnabled('ui-designer', false)
    assert.equal(refused.ok, false)
    assert.match(refused.error!, /workflow agent, so it has no board switch/)
    assert.deepEqual(planHelpers(), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'ui-designer', 'user-docs'])
  })
})

describe('a workflow the board adds', () => {
  it('starts with both stages empty, and says so rather than starting a card', () => {
    const made = createWorkflow('Weekly newsletter')
    assert.ok(made.ok)
    const mine = workflowById(made.id!)!
    assert.equal(mine.builtIn, false)
    assert.deepEqual(Object.values(mine.stages).map((s) => s.lead), ['', ''])
    assert.equal(workflowProblems(mine.id).length, 2)
    assert.match(workflowProblems(mine.id)[0]!, /no agent leading its plan stage/)
  })

  it('copies one whole, under a free name, and the copy is the board’s own', () => {
    assert.equal(setWorkflowHelperExtra('coding', 'execute', 'ui-designer', 'x').ok, false)
    const copy = duplicateWorkflow('coding')
    assert.ok(copy.ok)
    assert.equal(copy.name, 'Coding 2')
    const mine = workflowById(copy.id!)!
    assert.equal(mine.builtIn, false)
    assert.equal(mine.stages.execute.lead, 'builder')
    // Including the helpers the original was OFFERING, each copied so the two share none (#1095).
    assert.deepEqual(mine.stages.plan.helpers.map((h) => h.agent), ['competitor-research-2', 'copywriting-2', 'email-planner-2', 'prompt-writer-2', 'tech-stack-advisor-2', 'ui-designer-2', 'user-docs-2'])
    assert.ok(fs.existsSync(path.join(kanban(), 'agents', 'ui-designer-2', 'AGENT.md')))
    // Its own configuration from here: changing the copy leaves the built-in alone.
    assert.equal(setWorkflowLead(copy.id!, 'execute', 'test-writer').ok, true)
    assert.equal(workflowById(copy.id!)!.stages.execute.lead, 'test-writer')
    assert.equal(workflowById('coding')!.stages.execute.lead, 'builder')
    // And a third copy numbers up rather than clashing.
    assert.equal(duplicateWorkflow('coding').name, 'Coding 3')
  })

  it('carries the file a workflow owes into its copies', () => {
    const mine = artifactWorkflow()
    assert.equal(workflowById('coding')!.needsArtifact, false)
    assert.equal(workflowById(mine)!.needsArtifact, true)
    const copy = duplicateWorkflow(mine)
    assert.equal(workflowById(copy.id!)!.needsArtifact, true)
  })

  it('renames and deletes one of its own, and refuses both on a built-in', () => {
    const made = createWorkflow('Weekly newsletter')
    assert.equal(renameWorkflow(made.id!, 'Monthly newsletter').ok, true)
    assert.equal(workflowById(made.id!)!.name, 'Monthly newsletter')
    assert.equal(deleteWorkflow(made.id!).ok, true)
    assert.equal(workflowById(made.id!), undefined)

    assert.match(renameWorkflow('coding', 'Building').error!, /built in/)
    assert.match(deleteWorkflow('coding').error!, /built in and cannot be deleted/)
  })

  it('refuses a name already taken, and a name that is nothing but spaces', () => {
    assert.ok(createWorkflow('Weekly newsletter').ok)
    assert.match(createWorkflow('  weekly newsletter ').error!, /already has a workflow/)
    assert.match(createWorkflow('   ').error!, /needs a name/)
  })
})

describe('the workflow a card carries', () => {
  it('is written into its frontmatter, and read back off it', async () => {
    const mine = createWorkflow('Newsletter').id!
    const made = await move(root, ['create', '--title', 'Write the launch note', '--workflow', mine])
    const id = made.id as number
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), new RegExp(`^workflow: ${mine}$`, 'm'))
    assert.equal(cardWorkflowId(id), mine)
  })

  it('is left off the file when it is the default, and reads as the default when absent', async () => {
    const made = await move(root, ['create', '--title', 'Fix the header'])
    const id = made.id as number
    assert.equal(/^workflow:/m.test(fs.readFileSync(cardFile(id), 'utf8')), false)
    assert.equal(cardWorkflowId(id), '')
    assert.equal(workflowById(DEFAULT_WORKFLOW)!.id, 'coding')
  })

  it('survives a rewrite of the card — parse and serialize both know the key', async () => {
    const mine = createWorkflow('Newsletter').id!
    const made = await move(root, ['create', '--title', 'Write the launch note', '--workflow', mine])
    const id = made.id as number
    const file = cardFile(id)
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    assert.equal(meta!.workflow, mine)
    // The round trip every card rewrite makes.
    fs.writeFileSync(file, `${serializeFrontmatter(meta!)}\n${body}`)
    assert.equal(cardWorkflowId(id), mine)
    // And through a real one.
    await move(root, ['update', String(id), '--priority', 'high'])
    assert.equal(cardWorkflowId(id), mine)
  })

  it('refuses a workflow this board does not have', async () => {
    await refuses(root, ['create', '--title', 'A note', '--workflow', 'nonesuch'], /no workflow called "nonesuch"/)
    // Nor the one the command stopped shipping (#821).
    await refuses(root, ['create', '--title', 'A note', '--workflow', 'content'], /no workflow called "content"/)
  })

  it('is fixed once the card exists — nothing moves it, and a workflow lists what it holds', async () => {
    const other = createWorkflow('Newsletter').id!
    const made = await move(root, ['create', '--title', 'Write the launch note'])
    const id = made.id as number
    assert.deepEqual(cardsOnWorkflow('coding'), [id])

    // `update` has no `--workflow` any more (#744): a card's workflow is settled at create.
    await refuses(root, ['update', String(id), '--workflow', other], /unknown option/)
    assert.equal(cardWorkflowId(id), '')
    assert.deepEqual(cardsOnWorkflow('coding'), [id])
    assert.deepEqual(cardsOnWorkflow(other), [])

    // And neither does the direct edit a screen makes.
    patchCard(id, { workflow: other } as unknown as CardPatch)
    assert.equal(cardWorkflowId(id), '')
  })
})

describe('the workflow `akb create` hands its run', () => {
  const printed = async (argv: string[]): Promise<string> => {
    const sink = startCollecting()
    try {
      await run(root, argv)
    } finally {
      stopCollecting()
    }
    return sink.out.join('\n')
  }

  it('tells the run to pass the named workflow, the default too', async () => {
    const mine = createWorkflow('Newsletter').id!
    assert.match(await printed(['create', 'a launch note', '--workflow', mine, '--print']), new RegExp(`--workflow ${mine}\``))
    assert.match(await printed(['create', 'fix the header', '--workflow', DEFAULT_WORKFLOW, '--print']), /`--workflow coding`/)
    assert.doesNotMatch(await printed(['create', 'fix the header', '--print']), /Put the new card/)
  })

  it('refuses a workflow this board does not have before anything starts', async () => {
    await assert.rejects(() => run(root, ['create', 'a note', '--workflow', 'nonesuch', '--print']), /no workflow called "nonesuch"/)
  })
})

describe('what a workflow changes about a run', () => {
  it('reads the shared flows whatever the workflow', () => {
    assert.match(findGuide('implement')!.text, /Build the approved card/)
  })

  it('freezes the workflow onto the delivery, and reads every field of it back', () => {
    assert.equal(setWorkflowHelperExtra('coding', 'plan', 'tech-stack-advisor', 'Prefer what we already use.').ok, true)
    const frozen = frozenWorkflow('coding')!
    assert.equal(frozen.id, 'coding')
    assert.equal(frozen.name, 'Coding')
    assert.equal(frozen.stages.execute!.lead, 'builder')
    assert.equal(frozen.stages.plan!.helpers.find((h) => h.agent === 'tech-stack-advisor')!.extra, 'Prefer what we already use.')

    // Through the record's own reader, which drops any field it does not know.
    const mine = artifactWorkflow()
    const row = readDeliveryRow({ deliveryId: 'd1', workflow: frozenWorkflow(mine) })!
    assert.equal(row.workflow!.id, mine)
    assert.equal(row.workflow!.needsArtifact, true)
    assert.equal(row.workflow!.stages.execute!.lead, 'test-writer')

    // Reassigning afterwards leaves the frozen copy alone — that is the whole point of it.
    assert.equal(switchWorkflowAgent('coding', 'plan', 'tech-stack-advisor', false).ok, true)
    assert.ok(frozen.stages.plan!.helpers.some((h) => h.agent === 'tech-stack-advisor'))
  })
})

describe("the QA manager, Coding's scheduled agent (#1402)", () => {
  const hooks = (id: string): string[] => frozenWorkflow(id)!.stages.execute!.helpers.map((h) => h.agent)
  const qa = () => scheduledAgent('coding', 'qa-manager')!
  // A board as it was saved while the QA manager still followed every build.
  const savedBefore = (execute?: unknown): void => {
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({ workflows: { agentsOwned: true, stages: execute ? { coding: { execute } } : {} } }),
    )
  }
  const savedNow = () => JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8')).workflows

  it('runs on auto on a board that saved nothing, follows no build, and is no other built-in’s', () => {
    assert.deepEqual(hooks('coding'), [])
    assert.deepEqual({ off: qa().off, cadence: qa().cadence, extra: qa().extra }, { off: undefined, cadence: 'auto', extra: '' })
    for (const flow of workflowViews().filter((w) => w.builtIn && w.id !== 'coding')) assert.deepEqual(flow.scheduled, [])
    savedBefore()
    assert.equal(qa().off, undefined)
  })

  it('moves a saved hook over with its switch and extra requirements, once', () => {
    stageAgent('test-fixer', 'execute')
    savedBefore({ helpers: [{ agent: 'qa-manager', extra: 'Only the CLI.', off: true }, { agent: 'test-fixer', extra: '' }] })
    assert.deepEqual({ off: qa().off, extra: qa().extra }, { off: true, extra: 'Only the CLI.' })
    assert.deepEqual(savedNow().stages.coding.execute.helpers, [{ agent: 'test-fixer', extra: '' }])
    // A saved hook after the build is ignored (#1507).
    assert.deepEqual(hooks('coding'), [])

    savedBefore({ helpers: [{ agent: 'qa-manager', extra: '' }] })
    assert.equal(qa().off, undefined)
    assert.deepEqual(hooks('coding'), [])
  })

  it('stays off on a board that chose its hooks without it, and is not moved twice', () => {
    stageAgent('test-fixer', 'execute')
    savedBefore({ helpers: [{ agent: 'test-fixer', extra: '' }] })
    assert.equal(qa().off, true)
    assert.equal(switchWorkflowScheduled('coding', 'qa-manager', true).ok, true)
    assert.equal(qa().off, undefined)
  })

  it('cannot go back after a build', () => {
    assert.equal(switchWorkflowAgent('coding', 'execute', 'qa-manager', true).reason, 'agentCannotHelp')
  })
})

describe('an agent a workflow no longer has', () => {
  it('drops a helper that is gone and keeps a missing lead as an error somebody has to see', () => {
    const copy = duplicateWorkflow('coding')
    // A helper nobody answers to is simply not offered — a delivery held up over an optional
    // agent is a delivery held up by nothing.
    assert.equal(addWorkflowHelper(copy.id!, 'plan', 'nobody-here').ok, false)
    assert.deepEqual(
      workflowById(copy.id!)!.stages.plan.helpers.map((h) => h.agent),
      ['competitor-research-2', 'copywriting-2', 'email-planner-2', 'prompt-writer-2', 'tech-stack-advisor-2', 'ui-designer-2', 'user-docs-2'],
    )
    // A LEAD nobody answers to is left exactly as assigned and reported, rather than quietly
    // running as somebody else.
    assert.equal(setWorkflowLead(copy.id!, 'plan', 'nobody-here').ok, false)
    assert.equal(workflowById(copy.id!)!.stages.plan.lead, 'software-planner')
  })

  it('refuses to delete a workflow an open card still runs on, and says which', async () => {
    const copy = duplicateWorkflow('coding')
    const made = await move(root, ['create', '--title', 'A piece', '--workflow', copy.id!])
    // `akb workflow delete` refuses it by name, and says which cards are in the way.
    assert.throws(() => cmdWorkflowDelete(copy.id!), new RegExp(`#${made.id}`))
    assert.deepEqual(cardsOnWorkflow(copy.id!), [made.id])
    // And so does the one the pane presses — the check is the board's, not the screen's.
    const refused = removeWorkflow(copy.id!)
    assert.equal(refused.ok, false)
    assert.deepEqual(refused.cards, [made.id])
    assert.equal(workflowById(copy.id!)!.id, copy.id)
    // Once nothing runs on it, it goes. A card's workflow is fixed (#744), so the way there
    // is to finish the card rather than to move it off.
    assert.match(refused.error!, /finish or drop it first/)
    await move(root, ['archive', String(made.id)])
    assert.equal(removeWorkflow(copy.id!).ok, true)
    assert.equal(workflowById(copy.id!), undefined)
  })
})

describe('deleting a workflow with its own agents (#1248)', () => {
  it('deletes the copies it owns and keeps every other agent', () => {
    const copy = duplicateWorkflow('coding')
    const other = duplicateWorkflow('coding')
    const own = workflowOwnAgents(copy.id!)
    assert.ok(own.includes('ui-designer-2'))
    assert.ok(!own.some((name) => name.endsWith('-3')), 'the other copy owns its own agents')
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'ui-designer-2.md'), 'Be brief.\n')
    fs.mkdirSync(agentMemoryDir('ui-designer-2'), { recursive: true })
    fs.writeFileSync(path.join(agentMemoryDir('ui-designer-2'), 'notes.md'), '- one\n')

    assert.deepEqual(cmdWorkflowDelete(copy.id!).agents, own)
    for (const gone of [path.join(kanban(), 'agents', 'ui-designer-2'), path.join(RULES, 'ui-designer-2.md'), agentMemoryDir('ui-designer-2')]) {
      assert.equal(fs.existsSync(gone), false, gone)
    }
    assert.doesNotMatch(fs.readFileSync(uiConfigOf(kanban()), 'utf8'), /ui-designer-2/)
    // Another workflow's copies, the bundled originals and a project agent it never had stay.
    assert.ok(fs.existsSync(path.join(kanban(), 'agents', 'ui-designer-3')))
    assert.ok(workflowById(other.id!)!.stages.plan.helpers.some((h) => h.agent === 'ui-designer-3'))
    assert.ok(workflowById('coding')!.stages.plan.helpers.some((h) => h.agent === 'ui-designer'))
    assert.ok(fs.existsSync(path.join(kanban(), 'agents', 'test-writer')))
  })

  it('owns nothing on a built-in or a workflow with no agents', () => {
    assert.deepEqual(workflowOwnAgents('coding'), [])
    assert.deepEqual(workflowOwnAgents(createWorkflow('Empty').id!), [])
  })
})

describe('copying a workflow', () => {
  it('numbers the copy in the words the screen calls it, and keeps numbering after that', () => {
    // Asked for with no name, a copy takes the one on disk — the English the command ships.
    assert.equal(duplicateWorkflow('coding').name, 'Coding 2')
    // Asked for from a screen reading the board in another language, it takes those words.
    // A number after a Han character is written onto the name rather than spaced off it.
    assert.equal(duplicateWorkflow('coding', '软件开发').name, '软件开发2')
    assert.equal(duplicateWorkflow('coding', '软件开发').name, '软件开发3')
    assert.equal(duplicateWorkflow('coding').name, 'Coding 3')
  })
})

describe('starting a run on an unfinished workflow', () => {
  it('is refused before anything is written down, and says where to assign the lead', async () => {
    const made = createWorkflow('Weekly newsletter')
    const card = await move(root, ['create', '--title', 'A piece', '--workflow', made.id!])
    const started = await startRun({ action: 'implement', id: card.id as number })
    assert.ok('error' in started, 'a workflow with no lead cannot start a run')
    assert.match((started as { error: string }).error, /no agent leading its plan stage/)
    assert.match((started as { error: string }).error, /Configuration → Workflows/)
    // Nothing was written down: a refused run leaves no record and no card lock behind.
    assert.deepEqual(readStore().runs, [])

    // With plan and execute led it starts like any other card.
    stageAgent('outliner', 'plan', true)
    for (const [stage, agent] of [['plan', 'outliner'], ['execute', 'test-writer']] as const) {
      assert.equal(setWorkflowLead(made.id!, stage, agent).ok, true)
    }
    assert.deepEqual(workflowProblems(made.id!), [])
  })

  it('is refused outright on a card naming a workflow this board no longer has', async () => {
    const card = await move(root, ['create', '--title', 'A piece'])
    setWorkflow(card.id as number, 'gone-since')
    // It still READS as the default, so the card is not unreadable — but it does not run.
    assert.equal(cardWorkflow(card.id as number)!.id, DEFAULT_WORKFLOW)
    const started = await startRun({ action: 'implement', id: card.id as number })
    assert.ok('error' in started, 'a card naming a workflow nobody has cannot start a run')
    assert.match((started as { error: string }).error, /no such workflow/)
    assert.deepEqual(readStore().runs, [])
  })

  // The command stopped shipping `content` (#821), and a card's workflow cannot be changed, so
  // a card still naming it runs on the default rather than being stuck.
  it('runs a card naming the retired content workflow on the default', async () => {
    const card = await move(root, ['create', '--title', 'A piece'])
    const id = card.id as number
    setWorkflow(id, 'content')
    assert.equal(workflowRefusal({ action: 'implement', id }), null)
    assert.equal(cardWorkflow(id)!.id, DEFAULT_WORKFLOW)
    const frozen = frozenWorkflow(cardWorkflowId(id))!
    assert.deepEqual(
      (['plan', 'execute'] as const).map((stage) => frozen.stages[stage]!.lead),
      ['software-planner', 'builder'],
    )
    assert.equal(agentForFlow('implement', 'content'), 'builder')
  })
})

describe('what a helper is asked for', () => {
  it("carries this assignment's extra requirements into its own run, and nothing else's", () => {
    assert.equal(setWorkflowHelperExtra('coding', 'plan', 'ui-designer', 'Reuse the shipped components.').ok, true)
    const asked = buildAsk({ action: 'spec', id: 1, specAgent: 'ui-designer' })
    assert.match(asked, /what this workflow asks of you here/)
    assert.match(asked, /Reuse the shipped components\./)
    // An agent this workflow does not call in carries none of it.
    assert.equal(/what this workflow asks of you here/.test(buildAsk({ action: 'spec', id: 1, specAgent: 'tech-stack-advisor' })), false)
  })
})

describe('a card a delivery is already building', () => {
  it('keeps the workflow that delivery froze', async () => {
    const mine = artifactWorkflow()
    const made = await move(root, ['create', '--title', 'Write the launch note', '--workflow', mine])
    const id = made.id as number
    // A delivery in flight on the card, the way `openRun` opens one.
    const run = {
      sessionId: 's1',
      cardId: id,
      action: 'implement' as const,
      status: 'running' as const,
      startedAt: 1_000,
      harness: 'claude-code',
      logPath: path.join(kanban(), '.sessions', 's1.log'),
    }
    const deliveryId = withStore((store) => {
      store.runs.push(run)
      return joinDelivery(store, run, 'Write the launch note', 'implement').deliveryId
    })
    const frozen = readStore().deliveries.find((d) => d.deliveryId === deliveryId)!.workflow!
    assert.equal(frozen.id, mine)
    assert.equal(frozen.stages.execute!.lead, 'test-writer')

    // The card's own workflow is fixed at create (#744), so the frozen copy and the card
    // always agree — the freeze is what keeps a mid-flight reassignment of the WORKFLOW's
    // stages off this delivery.
    assert.equal(cardWorkflowId(id), mine)
  })
})

describe('an agent that can lead never helps (#858)', () => {
  const config = (): Record<string, any> =>
    JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8'))
  const planView = (id: string) => workflowViews().find((w) => w.id === id)!.stages[0]!

  it('refuses it as a helper with a reason, and leaves it out of every inherited stage', () => {
    stageAgent('outliner', 'plan', true)
    const mine = createWorkflow('Mine')
    for (const agent of ['outliner', 'software-planner', 'scriptwriter']) {
      assert.match(addWorkflowHelper(mine.id!, 'plan', agent).error!, /can lead a stage, so it is never a hook/)
    }
    // Coding's own, so another workflow cannot take it (#1095).
    assert.match(addWorkflowHelper(mine.id!, 'plan', 'ui-designer').error!, /belongs to the "Coding" workflow/)
    const helpers = liveStage(workflowById('coding')!, 'plan').helpers.map((h) => h.agent)
    assert.ok(!helpers.includes('outliner'))
    assert.ok(helpers.includes('ui-designer'))
    assert.ok(planView(mine.id!).candidates.find((a) => a.name === 'outliner')!.canLead)
  })

  // Only a `stage` + `lead: true` file was ever both; `lead: <stage>` is a lead alone (#1341).
  it('drops a lead saved as a helper before the rule', () => {
    stageAgent('outliner', 'plan', true)
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({
        workflows: {
          added: [{ id: 'wf-5', name: 'Old' }],
          stages: { 'wf-5': { plan: { lead: 'ui-designer', helpers: [{ agent: 'outliner', extra: '' }] } } },
        },
      }),
    )
    assert.deepEqual(planView('wf-5').helpers, [])
  })

  it('moves a workflow saved under `planner` onto `software-planner`, once', () => {
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({
        workflows: {
          agentsOwned: true,
          added: [{ id: 'wf-5', name: 'Old' }],
          stages: { 'wf-5': { plan: { lead: 'planner', helpers: [{ agent: 'ui-designer', extra: 'x' }] }, execute: { lead: 'builder' } } },
        },
      }),
    )
    assert.equal(workflowById('wf-5')!.stages.plan.lead, 'software-planner')
    assert.deepEqual(config().workflows.stages['wf-5'].plan, {
      lead: 'software-planner',
      helpers: [{ agent: 'ui-designer', extra: 'x' }],
    })
    assert.deepEqual(workflowProblems('wf-5'), [])
  })
})

describe('a lead whose file the board refuses (#1342)', () => {
  const leadBy = (lead: string): void => {
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({
        workflows: {
          agentsOwned: true,
          added: [{ id: 'wf-5', name: 'Docs' }],
          stages: { 'wf-5': { plan: { lead: 'software-planner' }, execute: { lead } } },
        },
      }),
    )
  }
  const issue = () => workflowIssues('wf-5')[0]!

  it('names the one line that replaces the old keys, and offers no other agent', async () => {
    const home = path.join(kanban(), 'agents', 'docs-pruner')
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(
      path.join(home, 'AGENT.md'),
      ['---', 'name: docs-pruner', 'description: Use when.', 'akb:', '  stage: execute', '  kind: lead', '---', '', 'You work.', ''].join('\n'),
    )
    leadBy('docs-pruner')
    assert.equal(issue().reason, 'workflowLeadRefused')
    assert.equal(
      issue().error,
      "`docs-pruner`, the lead of `Docs`' execute stage, can't be used: in docs/kanban/agents/docs-pruner/AGENT.md, replace `stage`, `kind` with `lead: execute`.",
    )
    assert.deepEqual(
      [issue().args!.cause, issue().args!.keys, issue().args!.line],
      ['oldKeys', 'stage,kind', 'lead: execute'],
    )
    const id = (await move(root, ['create', '--title', 'A doc'])).id as number
    assert.equal(workflowRefusal({ action: 'implement', id }), null)
    setWorkflow(id, 'wf-5')
    assert.equal(workflowRefusal({ action: 'implement', id })!.error, issue().error)
  })

  it('says a folder with no AGENT.md is missing its file', () => {
    fs.mkdirSync(path.join(kanban(), 'agents', 'docs-pruner'), { recursive: true })
    leadBy('docs-pruner')
    assert.equal(issue().args!.cause, 'noFile')
    assert.match(issue().error, /can't be used: docs\/kanban\/agents\/docs-pruner\/AGENT\.md is missing — add it\.$/)
  })

  it('still says a name nothing answers to is no agent of this board', async () => {
    leadBy('docs-pruner')
    assert.equal(issue().reason, 'workflowLeadMissing')
    assert.match(issue().error, /this board has no such agent/)
    const id = (await move(root, ['create', '--title', 'A doc'])).id as number
    setWorkflow(id, 'wf-5')
    assert.match(workflowRefusal({ action: 'implement', id })!.error, /Assign it in Configuration → Workflows/)
  })
})

describe('who may lead a stage (#846)', () => {
  const planView = (id: string) => workflowViews().find((w) => w.id === id)!.stages[0]!

  it('offers only the agents that declare it, and the helpers stay as they were', () => {
    stageAgent('outliner', 'plan', true)
    const mine = createWorkflow('Mine')
    const leads = planView(mine.id!).candidates.filter((a) => a.canLead).map((a) => a.name)
    // Never another workflow's (#1095): the video and deck leads are theirs.
    assert.deepEqual(leads, ['software-planner', 'outliner'])
    assert.deepEqual(
      stageCandidates('execute').filter((a) => a.canLead).map((a) => a.name),
      ['builder', 'test-writer'],
    )
    assert.match(setWorkflowLead(mine.id!, 'plan', 'ui-designer').error!, /can only help/)
  })

  it('keeps running a lead saved before the declaration, and says so', () => {
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({
        workflows: {
          agentsOwned: true,
          added: [{ id: 'wf-5', name: 'Old' }],
          stages: { 'wf-5': { plan: { lead: 'ui-designer' }, execute: { lead: 'builder' } } },
        },
      }),
    )
    assert.deepEqual(workflowProblems('wf-5'), [])
    assert.equal(workflowById('wf-5')!.stages.plan.lead, 'ui-designer')
    const lead = planView('wf-5').candidates.find((a) => a.name === 'ui-designer')!
    assert.equal(lead.canLead, undefined)
    // Saving it again is not a new pick.
    assert.equal(setWorkflowLead('wf-5', 'plan', 'ui-designer').ok, true)
  })

  it('gives a declared lead its own instructions when leading, and never when helping', () => {
    stageAgent('outliner', 'plan', true)
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({
        workflows: {
          added: [{ id: 'wf-6', name: 'Outline' }],
          stages: { 'wf-6': { plan: { lead: 'outliner' }, execute: { lead: 'builder' } } },
        },
      }),
    )
    assert.match(leadBlock({ action: 'clarify', id: 1, workflow: 'wf-6' }), /the `outliner` agent/)
    assert.equal(leadBlock({ action: 'spec', id: 1, specAgent: 'outliner' }), '')
  })
})

describe('one workflow per agent (#1095)', () => {
  const saved = (): Record<string, any> => JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8'))
  const write = (cfg: Record<string, unknown>): void =>
    fs.writeFileSync(uiConfigOf(kanban()), JSON.stringify(cfg))
  const members = (id: string, stage: 'plan' | 'execute' = 'plan') =>
    liveStage(workflowById(id)!, stage).helpers.map((h) => `${h.agent}${h.off ? ' (off)' : ''}`)

  it('keeps who runs where, and puts an agent nobody listed in Coding, disabled', () => {
    stageAgent('outliner', 'plan')
    write({ workflows: { stages: { coding: { plan: { helpers: [{ agent: 'ui-designer', extra: '' }] } } } } })
    assert.deepEqual(members('coding'), ['ui-designer', 'prompt-writer', 'email-planner', 'user-docs', 'competitor-research', 'copywriting (off)', 'tech-stack-advisor (off)', 'outliner (off)'])
    assert.equal(specAgentAssigned('outliner', 'coding'), false)
    assert.equal(saved().workflows.agentsOwned, true)
  })

  it('turns a newly shipped agent on in a Coding the board already chose, once (#1099)', () => {
    write({ workflows: { stages: { coding: { plan: { helpers: [{ agent: 'ui-designer', extra: '' }] } } } } })
    assert.deepEqual(members('coding').slice(0, 3), ['ui-designer', 'prompt-writer', 'email-planner'])
    assert.deepEqual(saved().workflows.shipped, ['prompt-writer', 'email-planner', 'user-docs', 'competitor-research', 'cover-designer', 'demo-rehearser'])
    assert.equal(switchWorkflowAgent('coding', 'plan', 'prompt-writer', false).ok, true)
    assert.ok(members('coding').includes('prompt-writer (off)'))
    const cfg = saved()
    cfg.workflows.stages.coding.plan.helpers = [{ agent: 'ui-designer', extra: '' }]
    write(cfg)
    assert.ok(members('coding').includes('prompt-writer (off)'))
  })

  it('turns a newly shipped video agent on in a Product video the board already chose, once (#1115)', () => {
    write({ workflows: { stages: { 'hyperframes-video': { plan: { helpers: [{ agent: 'hyperframes-editor', extra: 'x' }] } } } } })
    assert.deepEqual(members('hyperframes-video'), ['hyperframes-editor', 'cover-designer', 'demo-rehearser'])
    assert.ok(saved().workflows.shipped.includes('cover-designer'))
    assert.ok(saved().workflows.shipped.includes('demo-rehearser'))
    assert.ok(!members('coding').some((m) => m.startsWith('cover-designer') || m.startsWith('demo-rehearser')))
    const cfg = saved()
    cfg.workflows.stages['hyperframes-video'].plan.helpers = [{ agent: 'hyperframes-editor', extra: 'x' }]
    write(cfg)
    assert.deepEqual(members('hyperframes-video'), ['hyperframes-editor'])
  })

  it('gives every later workflow its own copy of a shared agent, once', () => {
    write({
      workflows: {
        added: [{ id: 'wf-2', name: 'Mine' }],
        stages: { 'wf-2': { plan: { lead: 'software-planner', helpers: [{ agent: 'ui-designer', extra: 'x' }] } } },
      },
    })
    assert.deepEqual(members('coding'), ['competitor-research', 'copywriting', 'email-planner', 'prompt-writer', 'tech-stack-advisor', 'ui-designer', 'user-docs'])
    assert.deepEqual(liveStage(workflowById('wf-2')!, 'plan').helpers, [{ agent: 'ui-designer-2', extra: 'x' }])
    assert.ok(fs.existsSync(path.join(kanban(), 'agents', 'ui-designer-2', 'AGENT.md')))
    assert.deepEqual(members('wf-2'), ['ui-designer-2'])
    assert.equal(fs.readdirSync(path.join(kanban(), 'agents')).filter((n) => n.startsWith('ui-designer')).length, 1)
  })

  it('stops running a disabled agent, and never disables a lead', () => {
    assert.equal(switchWorkflowAgent('hyperframes-video', 'plan', 'hyperframes-editor', false).ok, true)
    assert.deepEqual(members('hyperframes-video'), ['demo-rehearser', 'hyperframes-editor (off)', 'cover-designer'])
    assert.equal(specAgentAssigned('hyperframes-editor', 'hyperframes-video'), false)
    assert.equal(frozenWorkflow('hyperframes-video')!.stages.plan!.helpers.length, 2)
    assert.equal(switchWorkflowAgent('hyperframes-video', 'plan', 'hyperframes-editor', true).ok, true)
    assert.equal(specAgentAssigned('hyperframes-editor', 'hyperframes-video'), true)
    assert.match(switchWorkflowAgent('hyperframes-video', 'plan', 'scriptwriter', false).error!, /always on/)
  })

  it('puts a new agent in the workflow it was made in, and nowhere else', () => {
    const mine = createWorkflow('Mine').id!
    assert.equal(createAgent('outliner', 'plan').ok, true)
    assert.equal(addWorkflowHelper(mine, 'plan', 'outliner').ok, true)
    assert.deepEqual(members(mine), ['outliner'])
    assert.ok(!members('coding').some((m) => m.startsWith('outliner')))
    assert.match(addWorkflowHelper('coding', 'plan', 'outliner').error!, /belongs to the "Mine" workflow/)
  })

  it('copies each agent with its rule, memory and settings', () => {
    write({ workflows: { agentsOwned: true }, specAgents: { 'ui-designer': { output: 'human' } } })
    fs.mkdirSync(path.join(kanban(), 'rules'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'rules', 'ui-designer.md'), 'Be brief.\n')
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents', 'ui-designer'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'memory', 'agents', 'ui-designer', 'notes.md'), 'x\n')
    assert.equal(switchWorkflowAgent('coding', 'plan', 'copywriting', false).ok, true)
    const copy = duplicateWorkflow('coding').id!
    assert.deepEqual(members(copy), ['competitor-research-2', 'copywriting-2 (off)', 'email-planner-2', 'prompt-writer-2', 'tech-stack-advisor-2', 'ui-designer-2', 'user-docs-2'])
    assert.equal(fs.readFileSync(path.join(kanban(), 'rules', 'ui-designer-2.md'), 'utf8'), 'Be brief.\n')
    assert.ok(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'ui-designer-2', 'notes.md')))
    assert.deepEqual(saved().specAgents['ui-designer-2'], { output: 'human' })
    assert.match(fs.readFileSync(path.join(kanban(), 'agents', 'ui-designer-2', 'AGENT.md'), 'utf8'), /^name: ui-designer-2$/m)
  })
})
