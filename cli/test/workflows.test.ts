// The workflows a board runs, and the workflow one card runs through (#715, #2152, #2154).
//
// What is asked here: the built-ins list their agents as previews, land and scheduled; a card's
// approvals come from the previews it chose and their `after`; Approve moves a card one approval
// on, then builds it or archives it; a built-in refuses a rename and a delete; and a delivery
// keeps the workflow it started with.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { buildAsk, buildPrompt } from '../src/lib/agent/prompts.ts'
import { agentForFlow } from '../src/lib/agent/stages.ts'
import { readDeliveryRow, readStore, withStore } from '../src/lib/agent/store.ts'
import { joinDelivery } from '../src/lib/agent/deliveries.ts'
import { approvalRequest, advancePhase } from '../src/lib/agent/approve.ts'
import {
  agentAfter,
  agentKeyProblems,
  archivesOnApproval,
  cardWorkflow,
  cardWorkflowId,
  createWorkflow,
  DEFAULT_WORKFLOW,
  deleteWorkflow,
  duplicateWorkflow,
  frozenWorkflow,
  landAgents,
  previewMembers,
  previewStages,
  renameWorkflow,
  scheduledAgent,
  scheduledMembers,
  setWorkflowAgentExtra,
  switchWorkflowAgent,
  workflowById,
  workflowFileProblems,
  workflowIssues,
  workflowOwnAgents,
  workflowPurpose,
  workflowRules,
  workflows,
} from '../src/lib/agent/workflows.ts'
import { cardsOnWorkflow, removeWorkflow } from '../src/lib/agent/workflow-cards.ts'
import { BUILTIN_DEFS, parseWorkflowFile, workflowFileText, type WorkflowDef } from '../src/lib/agent/workflow-file.ts'
import { specAgentAssigned, specAgentSelector } from '../src/lib/agents/index.ts'
import { specAgentCatalog } from '../src/lib/agents/catalog.ts'
import { forgetFileMemos } from '../src/lib/file-memo.ts'
import { cmdWorkflowDelete } from '../src/commands/workflow.ts'
import { startRun, workflowRefusal } from '../src/lib/agent/start.ts'
import { agentMemoryDir } from '../src/lib/memory.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'
import { findCard } from '../src/lib/view/read.ts'
import { awaitingApproval, canImplement } from '../src/lib/view/rules.ts'
import { move, refuses, run, uiConfigOf } from './helpers/board.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** A project agent. `akb` lines go under `akb:` as written. */
const agent = (name: string, akb: string[] = []): string => {
  const home = path.join(kanban(), 'agents', name)
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(home, 'AGENT.md'),
    ['---', `name: ${name}`, 'description: Use when.', ...(akb.length ? ['akb:', ...akb.map((l) => `  ${l}`)] : []), '---', '', 'You work.', ''].join('\n'),
  )
  forgetFileMemos()
  return name
}

const workflowFile = (id: string): string => path.join(kanban(), 'workflows', id, 'WORKFLOW.md')
const writeWorkflow = (id: string, text: string): void => {
  fs.mkdirSync(path.dirname(workflowFile(id)), { recursive: true })
  fs.writeFileSync(workflowFile(id), text)
  forgetFileMemos()
}

const config = (): Record<string, any> => JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8'))

const setWorkflow = (id: number, workflow: string): void => {
  const file = cardFile(id)
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  meta!.workflow = workflow
  fs.writeFileSync(file, `${serializeFrontmatter(meta!)}\n${body}`)
}

const cardFile = (id: number): string =>
  fs.readdirSync(path.join(kanban(), 'todo')).map((f) => path.join(kanban(), 'todo', f)).find((f) => path.basename(f).startsWith(`${id}-`))!

const names = (rows: { agent: string }[]): string[] => rows.map((h) => h.agent)

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-workflows-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'config.md'), '- **Solution** — product\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the workflows a board has', () => {
  it('ships seven, each with its previews, their approvals and what lands it', () => {
    assert.deepEqual(workflows().map((w) => w.id), ['coding', 'hyperframes-video', 'slide-deck', 'carousel-post', 'blog-post', 'video-clone', 'workflow-builder'])
    const of = (id: string) => workflowById(id)!
    const all = (id: string) => previewStages(of(id), names(previewMembers(of(id))))
    assert.deepEqual(names(previewMembers(of('coding'))), ['copywriting', 'tech-stack-advisor', 'email-planner', 'ui-designer', 'api-designer', 'schema-designer', 'prompt-writer', 'competitor-research', 'illustrator'])
    assert.deepEqual(all('coding'), [['copywriting', 'tech-stack-advisor', 'email-planner', 'api-designer', 'schema-designer', 'prompt-writer', 'competitor-research', 'illustrator'], ['ui-designer']])
    assert.deepEqual(landAgents(of('coding')).map((h) => h.agent), ['builder'])
    assert.deepEqual(scheduledMembers(of('coding')).map((h) => h.agent), ['qa-manager'])
    assert.deepEqual(all('hyperframes-video'), [['scriptwriter', 'demo-rehearser'], ['hyperframes-editor']])
    assert.deepEqual(landAgents(of('hyperframes-video')).map((h) => h.agent), ['cover-designer'])
    assert.deepEqual(all('blog-post'), [['blog-planner'], ['blog-illustrator'], ['blog-writer']])
    assert.deepEqual(all('carousel-post'), [['carousel-planner'], ['social-illustrator'], ['carousel-renderer']])
    assert.deepEqual(all('slide-deck'), [['deck-planner'], ['deck-builder']])
    assert.deepEqual(all('video-clone'), [['video-cloner'], ['video-template-builder']])
    assert.deepEqual(all('workflow-builder'), [['workflow-writer']])
    for (const flow of workflows().filter((w) => !['coding', 'hyperframes-video'].includes(w.id))) assert.equal(archivesOnApproval(flow), true, flow.id)
    assert.equal(archivesOnApproval(of('coding')), false)
    assert.deepEqual(workflowIssues('coding'), [])
    assert.deepEqual(agentKeyProblems(), [])
  })

  it('drops the approval an unchosen agent would have made', () => {
    const blog = workflowById('blog-post')!
    assert.deepEqual(previewStages(blog, ['blog-planner', 'blog-writer']), [['blog-planner'], ['blog-writer']])
    assert.deepEqual(previewStages(blog, ['blog-writer']), [['blog-writer']])
    assert.deepEqual(previewStages(workflowById('hyperframes-video')!, ['scriptwriter', 'hyperframes-editor']), [['scriptwriter'], ['hyperframes-editor']])
    assert.deepEqual(previewStages(workflowById('coding')!, ['ui-designer']), [['ui-designer']])
    assert.deepEqual(previewStages(blog, []), [[]])
  })

  it('writes every card by the board’s planner, and builds with what lands it', () => {
    assert.equal(agentForFlow('refine', 'hyperframes-video'), 'planner')
    assert.equal(agentForFlow('implement', 'coding'), 'builder')
  })

  it('gives planning its workflow’s rules, then the user’s own', () => {
    assert.match(workflowRules(workflowById('coding')!), /## Explainer diagram/)
    fs.mkdirSync(path.join(RULES, 'workflows'), { recursive: true })
    fs.writeFileSync(path.join(RULES, 'workflows', 'coding.md'), 'Titles in English.\n')
    assert.match(workflowRules(workflowById('coding')!), /## Research-only cards[\s\S]*Titles in English\.$/)
    const prompt = buildPrompt({ action: 'clarify', id: 1 })
    assert.match(prompt, /how a card on the "Coding" workflow is written/)
    assert.match(prompt, /Titles in English\./)
    assert.doesNotMatch(buildPrompt({ action: 'spec', id: 1, specAgent: 'ui-designer' }), /how a card on the/)
  })

  it('keeps an extra requirement per agent, and clears it without touching the agent', () => {
    assert.equal(setWorkflowAgentExtra('coding', 'ui-designer', 'Reuse the shipped components.').ok, true)
    const asked = buildAsk({ action: 'spec', id: 1, specAgent: 'ui-designer' })
    assert.match(asked, /what this workflow asks of you here[\s\S]*Reuse the shipped components\./)
    assert.doesNotMatch(buildAsk({ action: 'spec', id: 1, specAgent: 'tech-stack-advisor' }), /what this workflow asks/)
    assert.equal(setWorkflowAgentExtra('coding', 'ui-designer', '').ok, true)
    assert.doesNotMatch(buildAsk({ action: 'spec', id: 1, specAgent: 'ui-designer' }), /what this workflow asks/)
  })

  it('switches a built-in’s agent off in the settings, and takes a new one onto its previews', () => {
    assert.equal(switchWorkflowAgent('coding', 'ui-designer', false).ok, true)
    assert.equal(specAgentAssigned('ui-designer', 'coding'), false)
    assert.deepEqual(config().workflows.stages.coding.previews.helpers.find((h: any) => h.agent === 'ui-designer'), { agent: 'ui-designer', extra: '', off: true })
    agent('reviewer')
    // An agent no workflow lists sits in Coding, off.
    assert.ok(previewMembers(workflowById('coding')!).some((h) => h.agent === 'reviewer' && h.off))
    assert.equal(switchWorkflowAgent('blog-post', 'reviewer', true).ok, true)
    assert.deepEqual(names(previewMembers(workflowById('blog-post')!)), ['blog-planner', 'blog-illustrator', 'blog-writer', 'reviewer'])
    assert.equal(specAgentAssigned('reviewer', 'blog-post'), true)
    // Now Blog post's, so Coding no longer has it and cannot take it.
    assert.equal(switchWorkflowAgent('coding', 'reviewer', true).reason, 'agentOtherWorkflow')
    assert.equal(switchWorkflowAgent('coding', 'nobody-here', true).reason, 'agentNotFound')
  })
})

describe('the approvals a card goes through (#2154)', () => {
  const create = async (title: string, workflow?: string): Promise<number> =>
    (await move(root, ['create', '--title', title, ...(workflow ? ['--workflow', workflow] : [])])).id as number

  it('derives its approvals from the previews it chose, and writes how many', async () => {
    const id = await create('Launch post', 'blog-post')
    assert.equal(findCard(id)!.stages, undefined)
    await move(root, ['update', String(id), '--previews', 'blog-writer,blog-planner'])
    const text = fs.readFileSync(cardFile(id), 'utf8')
    assert.match(text, /^previews: \[blog-planner, blog-writer\]$/m)
    assert.match(text, /^stages: 2$/m)
    assert.deepEqual([findCard(id)!.stages, findCard(id)!.stage], [2, 1])
    await move(root, ['update', String(id), '--previews', 'blog-planner,blog-illustrator,blog-writer'])
    assert.equal(findCard(id)!.stages, 3)
    await assert.rejects(move(root, ['update', String(id), '--previews', 'ui-designer']), /`ui-designer` is not a preview of its workflow/)
    await move(root, ['update', String(id), '--previews', ''])
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), /^previews: \[\]$/m)
    assert.equal(findCard(id)!.stages, undefined)
  })

  it('waits on Approve after each approval but the last, and moves one on', async () => {
    const id = await create('Launch post', 'blog-post')
    await move(root, ['update', String(id), '--previews', 'blog-planner,blog-writer'])
    assert.equal(awaitingApproval(findCard(id)!), null)
    assert.match((approvalRequest({ action: 'approve', id }) as { error: string }).error, /still planning stage 1/)
    await move(root, ['update', String(id), '--status', 'ready'])
    const card = findCard(id)!
    assert.equal(awaitingApproval(card), 1)
    assert.deepEqual(approvalRequest({ action: 'approve', id }), { action: 'approve', id, title: 'Launch post', notes: undefined })
    assert.equal(advancePhase(id), null)
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), /^phase: 2$/m)
    const next = findCard(id)!
    assert.deepEqual([next.stage, next.status, awaitingApproval(next)], [2, 'todo', null])
    assert.match(advancePhase(id)!.error, /no longer waiting/)
  })

  it('archives a card whose workflow lands nothing on its last approval', async () => {
    const id = await create('Launch post', 'blog-post')
    await move(root, ['update', String(id), '--previews', 'blog-planner,blog-writer', '--phase', '2'])
    assert.equal((approvalRequest({ action: 'approve', id }) as { action: string }).action, 'archive')
    assert.equal(canImplement(findCard(id)!), false)
    assert.equal(workflowRefusal({ action: 'implement', id })?.reason, 'planDelivered')
    await assert.rejects(move(root, ['update', String(id), '--phase', '3']), /--phase must be 1 to 2/)
  })

  it('builds a card whose workflow lands, on its last approval', async () => {
    const id = await create('Launch video', 'hyperframes-video')
    await move(root, ['update', String(id), '--previews', 'scriptwriter,hyperframes-editor', '--phase', '2'])
    assert.equal((approvalRequest({ action: 'approve', id }) as { action: string }).action, 'implement')
    const one = await create('Fix the header')
    const card = findCard(one)!
    assert.deepEqual([card.stages, card.stage, awaitingApproval(card)], [undefined, undefined, null])
    assert.equal((approvalRequest({ action: 'approve', id: one }) as { action: string }).action, 'implement')
  })

  it('has one approval when the agent an `after` names was not chosen', async () => {
    const id = await create('Launch post', 'blog-post')
    await move(root, ['update', String(id), '--previews', 'blog-writer', '--status', 'ready'])
    assert.equal(findCard(id)!.stages, undefined)
    assert.equal(awaitingApproval(findCard(id)!), null)
    assert.equal((approvalRequest({ action: 'approve', id }) as { action: string }).action, 'archive')
  })

  it('refuses Approve with a question open', async () => {
    const id = await create('Launch video', 'hyperframes-video')
    fs.writeFileSync(cardFile(id), fs.readFileSync(cardFile(id), 'utf8').replace('questions: []', 'questions:\n  - "[user] Which voice?"'))
    assert.match((approvalRequest({ action: 'approve', id }) as { error: string }).error, /open questions/)
  })

  it('lists every preview to a first planning, then only the current stage’s chosen ones', async () => {
    const id = await create('Launch video', 'hyperframes-video')
    const first = specAgentSelector(id, 'hyperframes-video', null)
    assert.match(first, /`scriptwriter`[\s\S]*When: always/)
    assert.match(first, /`hyperframes-editor`[\s\S]*After: scriptwriter, demo-rehearser/)
    assert.match(first, /choose and run them as `akb guide refine` says/)
    const chosen = { previews: ['scriptwriter', 'hyperframes-editor'], phase: 0 }
    const stage1 = specAgentSelector(id, 'hyperframes-video', chosen)
    assert.match(stage1, /`scriptwriter`/)
    assert.doesNotMatch(stage1, /demo-rehearser|hyperframes-editor|After:/)
    assert.match(specAgentSelector(id, 'hyperframes-video', { ...chosen, phase: 2 }), /`hyperframes-editor`/)
    // A preview that asks for a session of its own is run apart.
    assert.match(specAgentSelector(id, 'video-clone', null), /`video-cloner`[\s\S]*runs in a session of its own: leave out `--print`/)
  })
})

describe('what an agent declares and its place reads (#2151, #2152)', () => {
  it('drops an `after` across workflows, and says which key its group ignores', () => {
    agent('early', ['when: Early.'])
    agent('late', ['when: Late.', 'after: [early]'])
    agent('nightly', ['when: Never.', 'reads: archived-cards'])
    writeWorkflow('wf-2', '---\nname: Two\npreviews: [late]\nscheduled:\n  - agent: nightly\n---\n')
    writeWorkflow('wf-3', '---\nname: Three\npreviews: [early]\n---\n')
    assert.deepEqual(agentAfter('late'), [])
    const problems = agentKeyProblems()
    assert.ok(problems.some((p) => /`akb.after` names `early`, which is not a preview of the same workflow/.test(p)), problems.join('\n'))
    assert.ok(problems.some((p) => /nightly[\s\S]*`akb.when` is read only on a preview/.test(p)), problems.join('\n'))
  })

  it('keeps an `after` inside one workflow, and refuses one that makes a loop', () => {
    agent('early', ['when: Early.'])
    agent('late', ['after: [early]'])
    writeWorkflow('wf-2', '---\nname: One\npreviews: [late, early]\n---\n')
    assert.deepEqual(agentAfter('late'), ['early'])
    assert.deepEqual(agentKeyProblems(), [])
    assert.deepEqual(previewStages(workflowById('wf-2')!, ['late', 'early']), [['early'], ['late']])
    agent('early', ['when: Early.', 'after: [late]'])
    assert.match(agentKeyProblems().join('\n'), /`akb.after` names `\w+`, which waits on `\w+` already, so the two make a loop/)
    assert.equal(previewStages(workflowById('wf-2')!, ['late', 'early']).length, 2)
  })

  it('refuses an agent that still declares its role', () => {
    agent('old', ['hook: plan', 'when: A card needs it.'])
    assert.equal(specAgentAssigned('old'), false)
    assert.match(specAgentCatalog().problems.join('\n'), /declares `akb.hook`, which the board no longer reads/)
  })
})

describe('a workflow the board adds', () => {
  it('starts with no agents, and its card is archived on approval', async () => {
    const made = createWorkflow('Newsletter')
    assert.equal(made.ok, true)
    const flow = workflowById(made.id!)!
    assert.deepEqual([flow.previews, flow.land, flow.needsArtifact], [[], [], true])
    assert.equal(archivesOnApproval(flow), true)
  })

  it('copies one whole, under a free name, and the copy is the board’s own', () => {
    const copy = duplicateWorkflow('hyperframes-video')
    assert.equal(copy.name, 'Product video 2')
    const flow = workflowById(copy.id!)!
    assert.equal(flow.builtIn, false)
    assert.deepEqual(names(previewMembers(flow)), ['scriptwriter-2', 'demo-rehearser-2', 'hyperframes-editor-2'])
    assert.deepEqual(landAgents(flow).map((h) => h.agent), ['cover-designer-2'])
    // The copies wait on each other's approval, as the originals do.
    assert.deepEqual(agentAfter('hyperframes-editor-2'), ['scriptwriter-2', 'demo-rehearser-2'])
    assert.deepEqual(previewStages(flow, names(previewMembers(flow))), [['scriptwriter-2', 'demo-rehearser-2'], ['hyperframes-editor-2']])
    assert.equal(duplicateWorkflow('coding', '软件开发').name, '软件开发2')
    assert.equal(duplicateWorkflow('coding', '软件开发').name, '软件开发3')
    assert.deepEqual(landAgents(workflowById('wf-4')!).map((h) => h.agent), ['builder'])
  })

  it('renames and deletes one of its own, and refuses both on a built-in', () => {
    const id = createWorkflow('Newsletter').id!
    assert.equal(renameWorkflow(id, 'Weekly').ok, true)
    assert.match(fs.readFileSync(workflowFile(id), 'utf8'), /^name: Weekly$/m)
    assert.equal(renameWorkflow('coding', 'Mine').reason, 'workflowBuiltInRename')
    assert.equal(deleteWorkflow('coding').reason, 'workflowBuiltInDelete')
    assert.equal(deleteWorkflow(id).ok, true)
    assert.equal(workflowById(id), undefined)
  })

  it('refuses a name already taken, and a name that is nothing but spaces', () => {
    assert.equal(createWorkflow('coding ').reason, 'workflowTaken')
    assert.equal(createWorkflow('   ').reason, 'workflowUnnamed')
  })

  it('deletes the copies it owns with it, and keeps every other agent', () => {
    const copy = duplicateWorkflow('slide-deck')
    const own = workflowOwnAgents(copy.id!)
    assert.deepEqual(own, ['deck-planner-2', 'deck-builder-2'])
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'deck-planner-2.md'), 'Be brief.\n')
    fs.mkdirSync(agentMemoryDir('deck-planner-2'), { recursive: true })
    assert.deepEqual(cmdWorkflowDelete(copy.id!).agents, own)
    for (const gone of [path.join(kanban(), 'agents', 'deck-planner-2'), path.join(RULES, 'deck-planner-2.md'), agentMemoryDir('deck-planner-2')]) {
      assert.equal(fs.existsSync(gone), false, gone)
    }
    assert.deepEqual(workflowOwnAgents('coding'), [])
  })

  it('refuses to delete a workflow an open card still runs on, and says which', async () => {
    const copy = duplicateWorkflow('workflow-builder')
    const made = await move(root, ['create', '--title', 'A piece', '--workflow', copy.id!])
    assert.throws(() => cmdWorkflowDelete(copy.id!), new RegExp(`#${made.id}`))
    const refused = removeWorkflow(copy.id!)
    assert.deepEqual([refused.ok, refused.cards], [false, [made.id]])
    await move(root, ['update', String(made.id), '--workflow', ''])
    assert.equal(removeWorkflow(copy.id!).ok, true)
  })
})

describe('the workflow a card carries', () => {
  it('is written into its frontmatter, and read back off it', async () => {
    const mine = createWorkflow('Newsletter').id!
    const id = (await move(root, ['create', '--title', 'Write the launch note', '--workflow', mine])).id as number
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), new RegExp(`^workflow: ${mine}$`, 'm'))
    assert.equal(cardWorkflowId(id), mine)
    await move(root, ['update', String(id), '--priority', 'high'])
    assert.equal(cardWorkflowId(id), mine)
  })

  it('is left off the file when it is the default, and reads as the default when absent', async () => {
    const id = (await move(root, ['create', '--title', 'Fix the header'])).id as number
    assert.equal(/^workflow:/m.test(fs.readFileSync(cardFile(id), 'utf8')), false)
    assert.equal(cardWorkflow(id)!.id, DEFAULT_WORKFLOW)
  })

  it('refuses a workflow this board does not have', async () => {
    await refuses(root, ['create', '--title', 'A note', '--workflow', 'nonesuch'], /no workflow called "nonesuch"/)
    await refuses(root, ['create', '--title', 'A note', '--workflow', 'content'], /no workflow called "content"/)
  })

  it('moves to another workflow: back to `todo`, its previews cleared, a refine scheduled', async () => {
    const id = (await move(root, ['create', '--title', 'Write the launch note', '--workflow', 'hyperframes-video'])).id as number
    await move(root, ['update', String(id), '--status', 'ready', '--previews', 'scriptwriter,hyperframes-editor', '--phase', '2'])
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), /^phase: 2$/m)
    await refuses(root, ['update', String(id), '--phase', '3'], /--phase must be 1 to 2/)
    await move(root, ['update', String(id), '--workflow', 'blog-post'])
    const { meta } = parseFrontmatter(fs.readFileSync(cardFile(id), 'utf8'))
    assert.deepEqual([meta!.workflow, meta!.status, meta!.previews, meta!.stages, meta!.phase], ['blog-post', 'todo', undefined, 0, 0])
    assert.deepEqual(meta!.schedule, { action: 'refine', notes: '' })
    assert.deepEqual(cardsOnWorkflow('blog-post'), [id])
  })

  it('drops the stages a card named before #2152', async () => {
    const id = (await move(root, ['create', '--title', 'Old card'])).id as number
    fs.writeFileSync(cardFile(id), fs.readFileSync(cardFile(id), 'utf8').replace('---\n', '---\nphases:\n  - Outline\n  - Draft\nphase: 2\n'))
    await move(root, ['update', String(id), '--priority', 'low'])
    const text = fs.readFileSync(cardFile(id), 'utf8')
    assert.doesNotMatch(text, /^phases:/m)
    // It chose no previews, so it has one approval.
    assert.equal(findCard(id)!.stage, undefined)
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

  it('tells the run to pass the named workflow, and gives it that workflow’s rules', async () => {
    const out = await printed(['create', 'a launch note', '--workflow', 'coding', '--print'])
    assert.match(out, /`--workflow coding`/)
    assert.match(out, /how a card on the "Coding" workflow is written/)
  })
})

describe('what a delivery freezes', () => {
  it('freezes the previews and land onto the delivery, and reads every field of it back', () => {
    assert.equal(setWorkflowAgentExtra('coding', 'tech-stack-advisor', 'Prefer what we already use.').ok, true)
    const frozen = frozenWorkflow('coding')!
    assert.deepEqual([frozen.id, frozen.name], ['coding', 'Coding'])
    assert.deepEqual(frozen.land, [{ agent: 'builder', extra: '' }])
    assert.equal(frozen.previews!.find((h) => h.agent === 'tech-stack-advisor')!.extra, 'Prefer what we already use.')
    const row = readDeliveryRow({ deliveryId: 'd1', workflow: frozen })!
    assert.deepEqual(row.workflow!.land, frozen.land)
    assert.deepEqual(row.workflow!.previews, frozen.previews)
    assert.equal(switchWorkflowAgent('coding', 'tech-stack-advisor', false).ok, true)
    assert.ok(frozen.previews!.some((h) => h.agent === 'tech-stack-advisor'))
  })

  it('reads a delivery frozen before rounds, its execute lead what lands it', () => {
    const row = readDeliveryRow({
      deliveryId: 'd1',
      workflow: { id: 'video-clone', name: 'Video clone', stages: { plan: { lead: 'video-cloner', helpers: [] }, execute: { lead: 'video-template-publisher', helpers: [] } } },
    })!
    assert.deepEqual(row.workflow!.land, [{ agent: 'video-template-publisher', extra: '' }])
    assert.deepEqual(row.workflow!.previews, [])
  })

  it('keeps the workflow on a card a delivery is building, and refuses to move it', async () => {
    const id = (await move(root, ['create', '--title', 'Write the launch note', '--workflow', 'hyperframes-video'])).id as number
    const started = {
      sessionId: 's1',
      cardId: id,
      action: 'implement' as const,
      status: 'stopped' as const,
      startedAt: 1_000,
      harness: 'claude-code',
      logPath: path.join(kanban(), '.sessions', 's1.log'),
    }
    const deliveryId = withStore((store) => {
      store.runs.push(started)
      return joinDelivery(store, started, 'Write the launch note', 'implement').deliveryId
    })
    assert.equal(readStore().deliveries.find((d) => d.deliveryId === deliveryId)!.workflow!.id, 'hyperframes-video')
    await refuses(root, ['update', String(id), '--workflow', ''], /delivery/i)
  })
})

describe('what lands a workflow', () => {
  it('builds with a land agent of its own, its instructions over the shared flow', async () => {
    agent('publisher')
    writeWorkflow('wf-2', '---\nname: Templates\nneedsArtifact: true\npreviews: [ui-designer]\nland: [publisher]\n---\n\nWrite one card per template.\n')
    assert.equal(agentForFlow('implement', 'wf-2'), 'publisher')
    const id = (await move(root, ['create', '--title', 'A template', '--workflow', 'wf-2'])).id as number
    assert.match(buildPrompt({ action: 'implement', id, workflow: 'wf-2' }), /you, the `publisher` agent[\s\S]*You work\./)
    assert.match(buildPrompt({ action: 'clarify', id, workflow: 'wf-2' }), /Write one card per template\./)
  })

  it('refuses a build while a land agent cannot be run, and says why', async () => {
    writeWorkflow('wf-2', '---\nname: Templates\nland: [publisher]\n---\n')
    assert.equal(workflowIssues('wf-2')[0]!.reason, 'workflowLandMissing')
    agent('publisher', ['lead: execute'])
    const issue = workflowIssues('wf-2')[0]!
    assert.equal(issue.reason, 'workflowLandRefused')
    assert.match(issue.error, /remove `lead`/)
    const id = (await move(root, ['create', '--title', 'A template', '--workflow', 'wf-2'])).id as number
    const started = await startRun({ action: 'implement', id })
    assert.ok('error' in started)
    assert.deepEqual(readStore().runs, [])
  })

  it('takes over the land a board gave a built-in’s empty execute stage', () => {
    agent('publisher')
    fs.writeFileSync(
      uiConfigOf(kanban()),
      JSON.stringify({
        workflows: {
          agentsOwned: true,
          stages: {
            coding: { plan: { helpers: [{ agent: 'ui-designer', extra: 'Two languages.' }] }, execute: { lead: 'builder' } },
            'video-clone': { execute: { lead: 'publisher' } },
          },
        },
      }),
    )
    assert.deepEqual(landAgents(workflowById('video-clone')!).map((h) => h.agent), ['publisher'])
    assert.equal(archivesOnApproval(workflowById('video-clone')!), false)
    assert.equal(previewMembers(workflowById('coding')!).find((h) => h.agent === 'ui-designer')!.extra, 'Two languages.')
    const saved = config().workflows
    assert.deepEqual(saved.stages.coding, { previews: { helpers: [{ agent: 'ui-designer', extra: 'Two languages.' }] } })
    assert.deepEqual(saved.stages['video-clone'], { land: { helpers: [{ agent: 'publisher', extra: '' }] } })
    assert.equal(saved.agentsOwned, undefined)
  })
})

describe('starting a run', () => {
  it('is refused outright on a card naming a workflow this board no longer has', async () => {
    const id = (await move(root, ['create', '--title', 'A piece'])).id as number
    setWorkflow(id, 'gone-since')
    assert.equal(cardWorkflow(id)!.id, DEFAULT_WORKFLOW)
    const started = await startRun({ action: 'implement', id })
    assert.match((started as { error: string }).error, /no such workflow/)
  })

  it('runs a card naming the retired content workflow on the default', async () => {
    const id = (await move(root, ['create', '--title', 'A piece'])).id as number
    setWorkflow(id, 'content')
    assert.equal(workflowRefusal({ action: 'implement', id }), null)
    assert.equal(agentForFlow('implement', 'content'), 'builder')
  })
})

describe('the QA manager, Coding’s scheduled agent (#1402)', () => {
  it('runs on auto, and is no other built-in’s', () => {
    const qa = scheduledAgent('coding', 'qa-manager')!
    assert.deepEqual({ off: qa.off, cadence: qa.cadence, extra: qa.extra }, { off: undefined, cadence: 'auto', extra: '' })
    for (const flow of workflows().filter((w) => w.builtIn && w.id !== 'coding')) assert.deepEqual(scheduledMembers(flow), [])
    assert.equal(switchWorkflowAgent('coding', 'qa-manager', true).reason, 'agentNotListed')
  })
})

describe('workflows in files (#1890)', () => {
  it('reads back what it writes', () => {
    const def: WorkflowDef = {
      id: 'wf-2',
      name: 'Release #2: notes',
      description: 'Use for release notes.',
      needsArtifact: true,
      previews: [{ agent: 'ui-designer', extra: 'Line one #1\nline two', off: true }, { agent: 'copywriting', extra: '' }, { agent: 'illustrator', extra: '' }],
      land: [{ agent: 'builder', extra: '' }],
      scheduled: [{ agent: 'qa-manager', cadence: '2d' }],
      rules: 'Write it short.',
    }
    assert.deepEqual(parseWorkflowFile('wf-2', workflowFileText(def), 'x'), { def })
    const one = { ...def, previews: [{ agent: 'copywriting', extra: '' }], land: [] }
    assert.match(workflowFileText(one), /^previews: \[copywriting\]$/m)
    assert.doesNotMatch(workflowFileText(one), /^land:/m)
    assert.deepEqual(parseWorkflowFile('wf-2', workflowFileText(one), 'x'), { def: one })
    assert.match(JSON.stringify(parseWorkflowFile('Bad_Id', workflowFileText(def), 'x')), /not a workflow id/)
  })

  it('ships the built-ins as the same files', () => {
    assert.deepEqual(BUILTIN_DEFS.map((d) => d.id), workflows().filter((w) => w.builtIn).map((w) => w.id))
    const coding = BUILTIN_DEFS[0]!
    assert.deepEqual([coding.land, coding.scheduled], [[{ agent: 'builder', extra: '' }], [{ agent: 'qa-manager' }]])
    assert.match(coding.rules, /^You plan cards that change software\./)
  })

  it('refuses a file written before #2152, one in rounds, and one listing an agent twice', () => {
    writeWorkflow('old', '---\nname: Old\ndelivers: plan\nstages:\n  plan:\n    lead: software-planner\n---\n')
    writeWorkflow('rounds', '---\nname: Rounds\npreviews:\n  - [copywriting]\n  - [illustrator]\n---\n')
    writeWorkflow('twice', '---\nname: Twice\npreviews: [copywriting]\nland: [copywriting]\n---\n')
    writeWorkflow('broken', '---\ndescription: no name\n---\n')
    writeWorkflow('coding', '---\nname: Mine\n---\n')
    assert.equal(workflowById('old'), undefined)
    const problems = workflowFileProblems()
    assert.equal(problems.length, 5)
    assert.match(problems.join('\n'), /`stages`, `delivers` are no longer read — list the agents under `previews`, `land` and `scheduled`/)
    assert.match(problems.join('\n'), /rounds\/WORKFLOW\.md: `previews` is one list of agents, not a list of lists/)
    assert.match(problems.join('\n'), /`copywriting` is listed more than once/)
    assert.equal(workflowById('coding')!.name, 'Coding')
  })

  it('keeps its body as its rules through a rename, and reads its description', () => {
    agent('note-taker')
    writeWorkflow('notes', '---\nname: Notes\ndescription: Use for notes.\npreviews: [note-taker]\n---\n\nWhy it exists.\n')
    const flow = workflowById('notes')!
    assert.equal(workflowPurpose(flow), 'Use for notes.')
    assert.equal(flow.rules, 'Why it exists.')
    assert.equal(renameWorkflow('notes', 'Team notes').ok, true)
    assert.match(fs.readFileSync(workflowFile('notes'), 'utf8'), /---\n\nWhy it exists.\n$/)
    assert.equal(switchWorkflowAgent('notes', 'note-taker', false).ok, true)
    assert.match(fs.readFileSync(workflowFile('notes'), 'utf8'), /previews:\n {2}- agent: note-taker\n {4}off: true/)
  })
})

describe('`akb update` on a board saved before rounds (#2152)', () => {
  it('makes each plan agent’s rule its workflow’s card rule, once, and names the files it no longer reads', async () => {
    const { movePlanRules, noteOldWorkflows } = await import('../src/commands/install.ts')
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'software-planner.md'), 'Titles in English.\n')
    fs.writeFileSync(path.join(RULES, 'scriptwriter.md'), 'Keep it under a minute.\n')
    writeWorkflow('wf-2', '---\nname: Old\nstages:\n  plan:\n    lead: outliner\n---\n')
    fs.writeFileSync(path.join(RULES, 'outliner.md'), 'One page.\n')
    agent('outliner', ['lead: plan'])
    const report = { did: [] as string[], notes: [] as string[] }
    movePlanRules(kanban(), report)
    const rule = (id: string) => fs.readFileSync(path.join(RULES, 'workflows', `${id}.md`), 'utf8')
    assert.equal(rule('coding'), 'Titles in English.\n')
    assert.equal(rule('hyperframes-video'), 'Keep it under a minute.\n')
    assert.equal(rule('wf-2'), 'One page.\n')
    assert.equal(fs.existsSync(path.join(RULES, 'software-planner.md')), false)
    assert.ok(fs.existsSync(path.join(RULES, 'scriptwriter.md')), 'a lead that is now a preview keeps its own')
    assert.match(report.did.join('\n'), /software-planner → coding/)
    movePlanRules(kanban(), report)
    assert.equal(rule('hyperframes-video'), 'Keep it under a minute.\n')
    noteOldWorkflows(kanban(), report)
    assert.match(report.notes.join('\n'), /docs\/kanban\/workflows\/wf-2\/WORKFLOW\.md, docs\/kanban\/agents\/outliner\/AGENT\.md/)
  })
})
