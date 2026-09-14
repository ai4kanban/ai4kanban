// The workflows a board runs, and the workflow one card runs through (#715).
//
// What is asked here: the two the command ships are there with nobody having configured
// anything, a card carries its workflow through every rewrite, a stage resolves to the agent
// the workflow assigns rather than to the board's one answer, a built-in refuses a rename and
// a delete, and a delivery keeps the workflow it started with.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
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
import { cmdWorkflowDelete } from '../src/commands/workflow.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { move, refuses } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

const solution = (name: string): void => {
  fs.writeFileSync(path.join(kanban(), 'config.md'), `- **Solution** — ${name}\n`)
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
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the workflows a board has', () => {
  it('ships two, configured by nobody, each with all three stages led', () => {
    assert.deepEqual(workflows().map((w) => w.id), ['coding', 'content'])
    assert.equal(workflowById('coding')!.name, 'Coding')
    assert.equal(workflowById('content')!.name, 'Content creation')
    for (const id of ['coding', 'content']) {
      assert.deepEqual(workflowProblems(id), [], id)
    }
    // Nothing was written to make that true: a board that never opened the pane still runs.
    assert.equal(fs.existsSync(path.join(kanban(), 'ui.config.json')), false)
  })

  it('leads each stage with the agents that workflow assigns, not with the board’s one answer', () => {
    assert.equal(stageContract('build', 'coding').lead, 'builder')
    assert.equal(stageContract('build', 'content').lead, 'content-writer')
    assert.equal(agentForFlow('implement', 'coding'), 'builder')
    assert.equal(agentForFlow('implement', 'content'), 'content-writer')
    assert.equal(agentForFlow('review', 'content'), 'content-reviewer')
    // A flow no workflow assigns is the board's whichever workflow asks.
    assert.equal(agentForFlow('chat', 'content'), 'discussion-helper')
    assert.equal(agentForFlow('decide', 'content'), 'decider')
  })

  it('offers a stage only the agents that declare it', () => {
    assert.deepEqual(stageCandidates('execute').map((a) => a.name), ['builder', 'content-writer'])
    assert.deepEqual(stageCandidates('review').map((a) => a.name), ['reviewer', 'content-reviewer'])
    // The two specialists the command ships fill part of a card's spec, which is planning.
    const plan = stageCandidates('plan').map((a) => a.name)
    assert.deepEqual(plan, ['planner', 'content-planner', 'tech-stack-advisor', 'ui-designer'])
  })

  it('refuses a lead that belongs to another stage, and one that already helps here', () => {
    assert.match(setWorkflowLead('coding', 'execute', 'planner').error!, /is a plan agent/)
    assert.equal(setWorkflowLead('coding', 'plan', 'content-planner').ok, true)
    assert.equal(workflowById('coding')!.stages.plan.lead, 'content-planner')
    assert.equal(addWorkflowHelper('coding', 'plan', 'content-planner').ok, false)
  })

  it('keeps the specialists the coding plan stage offers until the board chooses for it', () => {
    const helpers = () => workflowViews()[0]!.stages[0]!.helpers.map((h) => h.agent)
    assert.deepEqual(helpers(), ['tech-stack-advisor', 'ui-designer'])
    // Assigning a lead is not choosing helpers: the stage still offers every one it had.
    assert.equal(setWorkflowLead('coding', 'plan', 'planner').ok, true)
    assert.deepEqual(helpers(), ['tech-stack-advisor', 'ui-designer'])
    // Removing one IS choosing, and the choice sticks.
    assert.equal(removeWorkflowHelper('coding', 'plan', 'ui-designer').ok, true)
    assert.deepEqual(helpers(), ['tech-stack-advisor'])
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

describe('a workflow the board adds', () => {
  it('starts with all three stages empty, and says so rather than starting a card', () => {
    const made = createWorkflow('Weekly newsletter')
    assert.ok(made.ok)
    const mine = workflowById(made.id!)!
    assert.equal(mine.builtIn, false)
    assert.deepEqual(Object.values(mine.stages).map((s) => s.lead), ['', '', ''])
    assert.equal(workflowProblems(mine.id).length, 3)
    assert.match(workflowProblems(mine.id)[0]!, /no agent leading its plan stage/)
  })

  it('copies one whole, under a free name, and the copy is the board’s own', () => {
    assert.equal(setWorkflowHelperExtra('content', 'plan', 'ui-designer', 'x').ok, false)
    const copy = duplicateWorkflow('coding')
    assert.ok(copy.ok)
    assert.equal(copy.name, 'Coding 2')
    const mine = workflowById(copy.id!)!
    assert.equal(mine.builtIn, false)
    assert.equal(mine.stages.execute.lead, 'builder')
    // Including the helpers the original was OFFERING, not only the ones it had saved: a
    // copy of a stage still inheriting its default has to open with the same team.
    assert.deepEqual(mine.stages.plan.helpers.map((h) => h.agent), ['tech-stack-advisor', 'ui-designer'])
    // Its own configuration from here: changing the copy leaves the built-in alone.
    assert.equal(setWorkflowLead(copy.id!, 'execute', 'content-writer').ok, true)
    assert.equal(workflowById(copy.id!)!.stages.execute.lead, 'content-writer')
    assert.equal(workflowById('coding')!.stages.execute.lead, 'builder')
    // And a third copy numbers up rather than clashing.
    assert.equal(duplicateWorkflow('coding').name, 'Coding 3')
  })

  it('carries the file a content workflow owes into its copies', () => {
    assert.equal(workflowById('coding')!.needsArtifact, false)
    assert.equal(workflowById('content')!.needsArtifact, true)
    const copy = duplicateWorkflow('content')
    assert.equal(workflowById(copy.id!)!.needsArtifact, true)
  })

  it('renames and deletes one of its own, and refuses both on a built-in', () => {
    const made = createWorkflow('Weekly newsletter')
    assert.equal(renameWorkflow(made.id!, 'Monthly newsletter').ok, true)
    assert.equal(workflowById(made.id!)!.name, 'Monthly newsletter')
    assert.equal(deleteWorkflow(made.id!).ok, true)
    assert.equal(workflowById(made.id!), undefined)

    assert.match(renameWorkflow('coding', 'Building').error!, /built in/)
    assert.match(deleteWorkflow('content').error!, /built in and cannot be deleted/)
  })

  it('refuses a name already taken, and a name that is nothing but spaces', () => {
    assert.ok(createWorkflow('Weekly newsletter').ok)
    assert.match(createWorkflow('  weekly newsletter ').error!, /already has a workflow/)
    assert.match(createWorkflow('   ').error!, /needs a name/)
  })
})

describe('the workflow a card carries', () => {
  it('is written into its frontmatter, and read back off it', async () => {
    const made = await move(root, ['create', '--title', 'Write the launch note', '--workflow', 'content'])
    const id = made.id as number
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), /^workflow: content$/m)
    assert.equal(cardWorkflowId(id), 'content')
  })

  it('is left off the file when it is the default, and reads as the default when absent', async () => {
    const made = await move(root, ['create', '--title', 'Fix the header'])
    const id = made.id as number
    assert.equal(/^workflow:/m.test(fs.readFileSync(cardFile(id), 'utf8')), false)
    assert.equal(cardWorkflowId(id), '')
    assert.equal(workflowById(DEFAULT_WORKFLOW)!.id, 'coding')
  })

  it('survives a rewrite of the card — parse and serialize both know the key', async () => {
    const made = await move(root, ['create', '--title', 'Write the launch note', '--workflow', 'content'])
    const id = made.id as number
    const file = cardFile(id)
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    assert.equal(meta!.workflow, 'content')
    // The round trip every card rewrite makes.
    fs.writeFileSync(file, `${serializeFrontmatter(meta!)}\n${body}`)
    assert.equal(cardWorkflowId(id), 'content')
    // And through a real one.
    await move(root, ['update', String(id), '--priority', 'high'])
    assert.equal(cardWorkflowId(id), 'content')
  })

  it('refuses a workflow this board does not have', async () => {
    await refuses(root, ['create', '--title', 'A note', '--workflow', 'nonesuch'], /no workflow called "nonesuch"/)
  })

  it('re-plans the card when it moves, and lists which cards a workflow still holds', async () => {
    const made = await move(root, ['create', '--title', 'Write the launch note'])
    const id = made.id as number
    await move(root, ['update', String(id), '--status', 'ready'])
    assert.deepEqual(cardsOnWorkflow('coding'), [id])

    await move(root, ['update', String(id), '--workflow', 'content'])
    assert.equal(parseFrontmatter(fs.readFileSync(cardFile(id), 'utf8')).meta!.status, 'todo')
    assert.deepEqual(cardsOnWorkflow('content'), [id])
    assert.deepEqual(cardsOnWorkflow('coding'), [])
  })
})

describe('what a workflow changes about a run', () => {
  it('gives the execute and review stages the workflow’s own words', () => {
    assert.match(findGuide('implement', 'coding')!.text, /Build the approved card/)
    assert.match(findGuide('implement', 'content')!.text, /the deliverable is a FILE/)
    assert.match(findGuide('review', 'content')!.text, /whose files are identical to the base has produced nothing/)
    // A flow no workflow says differently is the shared text in both.
    assert.equal(findGuide('board', 'content')!.text, findGuide('board', 'coding')!.text)
  })

  it('freezes the workflow onto the delivery, and reads every field of it back', () => {
    assert.equal(setWorkflowHelperExtra('coding', 'plan', 'tech-stack-advisor', 'Prefer what we already use.').ok, true)
    const frozen = frozenWorkflow('coding')!
    assert.equal(frozen.id, 'coding')
    assert.equal(frozen.name, 'Coding')
    assert.equal(frozen.stages.execute!.lead, 'builder')
    assert.equal(frozen.stages.plan!.helpers.find((h) => h.agent === 'tech-stack-advisor')!.extra, 'Prefer what we already use.')

    // Through the record's own reader, which drops any field it does not know.
    const row = readDeliveryRow({ deliveryId: 'd1', workflow: frozenWorkflow('content') })!
    assert.equal(row.workflow!.id, 'content')
    assert.equal(row.workflow!.needsArtifact, true)
    assert.equal(row.workflow!.stages.execute!.lead, 'content-writer')

    // Reassigning afterwards leaves the frozen copy alone — that is the whole point of it.
    assert.equal(setWorkflowLead('coding', 'execute', 'content-writer').ok, true)
    assert.equal(frozen.stages.execute!.lead, 'builder')
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
      ['tech-stack-advisor', 'ui-designer'],
    )
    // A LEAD nobody answers to is left exactly as assigned and reported, rather than quietly
    // running as somebody else.
    assert.equal(setWorkflowLead(copy.id!, 'plan', 'nobody-here').ok, false)
    assert.equal(workflowById(copy.id!)!.stages.plan.lead, 'planner')
  })

  it('refuses to delete a workflow an open card still runs on, and says which', async () => {
    const copy = duplicateWorkflow('content')
    const made = await move(root, ['create', '--title', 'A piece', '--workflow', copy.id!])
    // `akb workflow delete` refuses it by name, and says which cards are in the way.
    assert.throws(() => cmdWorkflowDelete(copy.id!), new RegExp(`#${made.id}`))
    assert.deepEqual(cardsOnWorkflow(copy.id!), [made.id])
    // And so does the one the pane presses — the check is the board's, not the screen's.
    const refused = removeWorkflow(copy.id!)
    assert.equal(refused.ok, false)
    assert.deepEqual(refused.cards, [made.id])
    assert.equal(workflowById(copy.id!)!.id, copy.id)
    // Once nothing runs on it, it goes.
    await move(root, ['update', String(made.id), '--workflow', ''])
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

    // With all three assigned it starts like any other card.
    for (const [stage, agent] of [['plan', 'content-planner'], ['execute', 'content-writer'], ['review', 'content-reviewer']] as const) {
      assert.equal(setWorkflowLead(made.id!, stage, agent).ok, true)
    }
    assert.deepEqual(workflowProblems(made.id!), [])
  })

  it('is refused outright on a card naming a workflow this board no longer has', async () => {
    const card = await move(root, ['create', '--title', 'A piece'])
    const file = cardFile(card.id as number)
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    meta!.workflow = 'gone-since'
    fs.writeFileSync(file, `${serializeFrontmatter(meta!)}\n${body}`)
    // It still READS as the default, so the card is not unreadable — but it does not run.
    assert.equal(cardWorkflow(card.id as number)!.id, DEFAULT_WORKFLOW)
    const started = await startRun({ action: 'implement', id: card.id as number })
    assert.ok('error' in started, 'a card naming a workflow nobody has cannot start a run')
    assert.match((started as { error: string }).error, /no such workflow/)
    assert.deepEqual(readStore().runs, [])
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
  it('keeps the workflow that delivery froze, and refuses to be moved off it', async () => {
    const made = await move(root, ['create', '--title', 'Write the launch note', '--workflow', 'content'])
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
    assert.equal(frozen.id, 'content')
    assert.equal(frozen.stages.execute!.lead, 'content-writer')

    // And the card cannot be moved while it is in flight: this delivery builds under the
    // workflow it started with, whatever the card says afterwards.
    await refuses(root, ['update', String(id), '--workflow', 'coding'], /delivery/i)
    assert.equal(cardWorkflowId(id), 'content')
  })
})

describe('a board that picks no workflows', () => {
  it('has none, and refuses to put one on a card', async () => {
    solution('marketing')
    assert.deepEqual(workflows(), [])
    assert.equal(workflowById('coding'), undefined)
    await refuses(root, ['create', '--title', 'A topic', '--workflow', 'content'], /not a `marketing` board's/)
  })
})
