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
  duplicateWorkflow,
  frozenWorkflow,
  removeWorkflowHelper,
  renameWorkflow,
  setWorkflowHelperExtra,
  setWorkflowLead,
  stageCandidates,
  workflowById,
  workflowProblems,
  workflows,
  workflowViews,
} from '../src/lib/agent/workflows.ts'
import { cardsOnWorkflow, removeWorkflow } from '../src/lib/agent/workflow-cards.ts'
import { setSpecAgentEnabled } from '../src/lib/agents/index.ts'
import { cmdWorkflowDelete } from '../src/commands/workflow.ts'
import { startRun, workflowRefusal } from '../src/lib/agent/start.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { patchCard } from '../src/lib/view/edit.ts'
import type { CardPatch } from '../src/lib/view/types.ts'
import { move, refuses } from './helpers/board.ts'

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
      `  stage: ${stage}`,
      ...(lead ? ['  lead: true'] : []),
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
    path.join(kanban(), 'ui.config.json'),
    JSON.stringify({
      workflows: {
        added: [{ id: 'wf-9', name: 'Video', needsArtifact: true }],
        stages: { 'wf-9': { plan: { lead: 'planner' }, execute: { lead: 'test-writer' }, review: { lead: 'test-checker' } } },
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
  stageAgent('test-checker', 'review')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the workflows a board has', () => {
  it('ships two, configured by nobody, with both leads set', () => {
    assert.deepEqual(workflows().map((w) => w.id), ['coding', 'hyperframes-video'])
    assert.equal(workflowById('coding')!.name, 'Coding')
    assert.deepEqual(workflowProblems('coding'), [])
    // Nothing was written to make that true: a board that never opened the pane still runs.
    assert.equal(fs.existsSync(path.join(kanban(), 'ui.config.json')), false)
  })

  it('leads each stage with the agents that workflow assigns, not with the board’s one answer', () => {
    const mine = artifactWorkflow()
    assert.equal(stageContract('build', 'coding').lead, 'builder')
    assert.equal(stageContract('build', mine).lead, 'test-writer')
    assert.equal(agentForFlow('implement', 'coding'), 'builder')
    assert.equal(agentForFlow('implement', mine), 'test-writer')
    // Review is led by the hidden lead; the saved lead became the first reviewer (#820).
    assert.equal(agentForFlow('review', mine), 'review-lead')
    assert.deepEqual(workflowById(mine)!.stages.review.helpers.map((h) => h.agent), ['test-checker'])
    // A flow no workflow assigns is the board's whichever workflow asks.
    assert.equal(agentForFlow('chat', mine), 'discussion-helper')
    assert.equal(agentForFlow('decide', mine), 'decider')
  })

  it('offers a stage only the agents that declare it', () => {
    assert.deepEqual(stageCandidates('execute').map((a) => a.name), ['builder', 'hyperframes-editor', 'test-writer'])
    assert.deepEqual(stageCandidates('review').map((a) => a.name), ['code-reviewer', 'video-reviewer', 'test-checker'])
    // The two specialists the command ships fill part of a card's spec, which is planning.
    const plan = stageCandidates('plan').map((a) => a.name)
    assert.deepEqual(plan, ['planner', 'copywriting', 'scriptwriter', 'tech-stack-advisor', 'ui-designer', 'video-assets'])
  })

  it('refuses a lead that belongs to another stage, and one that already helps here', () => {
    const mine = createWorkflow('Mine')
    assert.match(setWorkflowLead(mine.id!, 'execute', 'planner').error!, /is a plan agent/)
    assert.equal(setWorkflowLead(mine.id!, 'plan', 'planner').ok, true)
    assert.equal(workflowById(mine.id!)!.stages.plan.lead, 'planner')
    assert.equal(addWorkflowHelper(mine.id!, 'plan', 'planner').ok, false)
  })

  it('keeps the specialists the coding plan stage offers until the board chooses for it', () => {
    const helpers = () => workflowViews()[0]!.stages[0]!.helpers.map((h) => h.agent)
    assert.deepEqual(helpers(), ['copywriting', 'tech-stack-advisor', 'ui-designer'])
    // Removing one IS choosing, and the choice sticks.
    assert.equal(removeWorkflowHelper('coding', 'plan', 'ui-designer').ok, true)
    assert.deepEqual(helpers(), ['copywriting', 'tech-stack-advisor'])
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
    JSON.parse(fs.readFileSync(path.join(kanban(), 'ui.config.json'), 'utf8'))

  it('refuses the change and says where a workflow of your own comes from', () => {
    const res = setWorkflowLead('coding', 'plan', 'ui-designer')
    assert.equal(res.ok, false)
    assert.match(res.error!, /built in .* fixed\. Duplicate it/)
    assert.equal(workflowById('coding')!.stages.plan.lead, 'planner')
    assert.equal(fs.existsSync(path.join(kanban(), 'ui.config.json')), false)
  })

  it('still takes helpers, and writes no lead beside them', () => {
    const helpers = (stage: number) => workflowViews()[0]!.stages[stage]!.helpers.map((h) => h.agent)
    assert.equal(addWorkflowHelper('coding', 'review', 'test-checker').ok, true)
    assert.deepEqual(helpers(2), ['code-reviewer', 'test-checker'])
    assert.equal(removeWorkflowHelper('coding', 'plan', 'ui-designer').ok, true)
    assert.deepEqual(helpers(0), ['copywriting', 'tech-stack-advisor'])
    assert.equal(config().workflows.stages.coding.plan.lead, undefined)
    assert.equal(config().workflows.stages.coding.review.lead, undefined)
  })

  it('runs the command’s agent again on a board that had changed one, and drops the key', () => {
    fs.writeFileSync(
      path.join(kanban(), 'ui.config.json'),
      JSON.stringify({
        workflows: {
          stages: {
            coding: {
              plan: { lead: 'ui-designer', helpers: [{ agent: 'planner', extra: 'x' }] },
              execute: { lead: 'test-writer' },
            },
          },
        },
      }),
    )
    const coding = workflowViews()[0]!
    assert.equal(coding.stages[0]!.lead, 'planner')
    assert.equal(coding.stages[1]!.lead, 'builder')
    // The lead is never also a helper, so the agent it had been moved aside for is gone.
    assert.deepEqual(coding.stages[0]!.helpers.map((h) => h.agent), [])
    // A stage that held nothing but a lead goes with it.
    assert.equal(config().workflows.stages.coding.execute, undefined)
    assert.equal(config().workflows.stages.coding.plan.lead, undefined)
    assert.deepEqual(config().workflows.stages.coding.plan.helpers, [{ agent: 'planner', extra: 'x' }])
  })

  it('leaves a copy of one free to pick its own', () => {
    const copy = duplicateWorkflow('coding')
    assert.equal(workflowById(copy.id!)!.stages.plan.lead, 'planner')
    assert.equal(setWorkflowLead(copy.id!, 'execute', 'test-writer').ok, true)
    assert.equal(workflowById(copy.id!)!.stages.execute.lead, 'test-writer')
    assert.equal(workflowById('coding')!.stages.execute.lead, 'builder')
  })
})

// A board written before #749 kept a switch per workflow agent beside its stage assignment.
// The assignment is the only answer now, so the switch is folded into it once and the key
// goes — and an agent switched off then must not come back on the upgrade.
describe('a switch a board saved before the assignment was the answer', () => {
  const config = (): Record<string, any> =>
    JSON.parse(fs.readFileSync(path.join(kanban(), 'ui.config.json'), 'utf8'))

  const saveConfig = (cfg: Record<string, unknown>): void =>
    fs.writeFileSync(path.join(kanban(), 'ui.config.json'), JSON.stringify(cfg, null, 2))

  // What the stage OFFERS, which is what a run is handed — an inherited stage has nothing
  // saved in it.
  const planHelpers = (id = 'coding'): string[] =>
    workflowViews().find((w) => w.id === id)!.stages[0]!.helpers.map((h) => h.agent)

  it('comes off every stage that was offering the agent, and the key goes with it', () => {
    saveConfig({ specAgents: { 'ui-designer': false } })
    assert.deepEqual(planHelpers(), ['copywriting', 'tech-stack-advisor'])
    assert.equal(config().specAgents, undefined)
    // Written down, not worked out again: the stage is chosen from here.
    assert.deepEqual(config().workflows.stages.coding.plan.helpers, [
      { agent: 'copywriting', extra: '' },
      { agent: 'tech-stack-advisor', extra: '' },
    ])
    // The lead is not written with it — a built-in's is the command's own (#774).
    assert.equal(config().workflows.stages.coding.plan.lead, undefined)
  })

  it('leaves everything else the entry held, and touches no other agent', () => {
    saveConfig({ specAgents: { 'ui-designer': { enabled: false, mockupStyle: 'ascii' } } })
    assert.deepEqual(planHelpers(), ['copywriting', 'tech-stack-advisor'])
    assert.deepEqual(config().specAgents, { 'ui-designer': { mockupStyle: 'ascii' } })
  })

  it('takes the agent off a stage the board had already chosen for', () => {
    saveConfig({
      specAgents: { 'tech-stack-advisor': false },
      workflows: { stages: { coding: { plan: { lead: 'planner', helpers: [{ agent: 'tech-stack-advisor', extra: 'x' }] } } } },
    })
    assert.deepEqual(planHelpers(), [])
    assert.equal(config().specAgents, undefined)
  })

  it('does not put the agent back, and adding it again is the board’s own choice', () => {
    saveConfig({ specAgents: { 'ui-designer': false } })
    assert.deepEqual(planHelpers(), ['copywriting', 'tech-stack-advisor'])
    assert.equal(addWorkflowHelper('coding', 'plan', 'ui-designer').ok, true)
    assert.deepEqual(planHelpers(), ['copywriting', 'tech-stack-advisor', 'ui-designer'])
    assert.equal(config().specAgents, undefined)
  })

  it('is refused where a workflow agent is switched off by name', () => {
    const refused = setSpecAgentEnabled('ui-designer', false)
    assert.equal(refused.ok, false)
    assert.match(refused.error!, /workflow agent, so it has no switch/)
    assert.deepEqual(planHelpers(), ['copywriting', 'tech-stack-advisor', 'ui-designer'])
  })
})

describe('a workflow the board adds', () => {
  it('starts with all three stages empty, and says so rather than starting a card', () => {
    const made = createWorkflow('Weekly newsletter')
    assert.ok(made.ok)
    const mine = workflowById(made.id!)!
    assert.equal(mine.builtIn, false)
    assert.deepEqual(Object.values(mine.stages).map((s) => s.lead), ['', '', ''])
    // Review has no lead to miss (#820).
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
    // Including the helpers the original was OFFERING, not only the ones it had saved: a
    // copy of a stage still inheriting its default has to open with the same team.
    assert.deepEqual(mine.stages.plan.helpers.map((h) => h.agent), ['copywriting', 'tech-stack-advisor', 'ui-designer'])
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
    assert.equal(addWorkflowHelper('coding', 'execute', 'test-writer').ok, true)
    assert.deepEqual(frozen.stages.execute!.helpers, [])
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
      ['copywriting', 'tech-stack-advisor', 'ui-designer'],
    )
    // A LEAD nobody answers to is left exactly as assigned and reported, rather than quietly
    // running as somebody else.
    assert.equal(setWorkflowLead(copy.id!, 'plan', 'nobody-here').ok, false)
    assert.equal(workflowById(copy.id!)!.stages.plan.lead, 'planner')
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

    // With plan and execute led it starts like any other card — review needs nobody (#820).
    for (const [stage, agent] of [['plan', 'scriptwriter'], ['execute', 'test-writer']] as const) {
      assert.equal(setWorkflowLead(made.id!, stage, agent).ok, true)
    }
    assert.deepEqual(workflowProblems(made.id!), [])
    assert.match(setWorkflowLead(made.id!, 'review', 'test-checker').error!, /no lead, only reviewers/)
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
      ['plan', 'execute', 'review'].map((stage) => frozen.stages[stage as 'plan']!.lead),
      ['planner', 'builder', ''],
    )
    assert.deepEqual(frozen.stages.review!.helpers.map((h) => h.agent), ['code-reviewer'])
    assert.equal(agentForFlow('implement', 'content'), 'builder')
    assert.equal(agentForFlow('review', 'content'), 'review-lead')
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

describe('who may lead a stage (#846)', () => {
  const planView = (id: string) => workflowViews().find((w) => w.id === id)!.stages[0]!

  it('offers only the agents that declare it, and the helpers stay as they were', () => {
    stageAgent('outliner', 'plan', true)
    const mine = createWorkflow('Mine')
    const leads = planView(mine.id!).candidates.filter((a) => a.canLead).map((a) => a.name)
    assert.deepEqual(leads, ['planner', 'scriptwriter', 'outliner'])
    assert.deepEqual(
      stageCandidates('execute').filter((a) => a.canLead).map((a) => a.name),
      ['builder', 'hyperframes-editor', 'test-writer'],
    )
    assert.match(setWorkflowLead(mine.id!, 'plan', 'ui-designer').error!, /can only help/)
    // A declared lead still helps.
    assert.equal(addWorkflowHelper(mine.id!, 'plan', 'outliner').ok, true)
    assert.equal(addWorkflowHelper(mine.id!, 'plan', 'planner').ok, true)
  })

  it('keeps running a lead saved before the declaration, and says so', () => {
    fs.writeFileSync(
      path.join(kanban(), 'ui.config.json'),
      JSON.stringify({
        workflows: {
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
      path.join(kanban(), 'ui.config.json'),
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
