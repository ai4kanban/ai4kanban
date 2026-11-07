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
import { buildAsk, buildPrompt, landBlock } from '../src/lib/agent/prompts.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { findSpecAgent } from '../src/lib/agents/index.ts'
import { agentRoster } from '../src/lib/agent/roles.ts'
import { findGuide } from '../src/lib/guide.ts'
import { agentForFlow } from '../src/lib/agent/stages.ts'
import { readDeliveryRow, readStore, withStore } from '../src/lib/agent/store.ts'
import { joinDelivery } from '../src/lib/agent/deliveries.ts'
import { approvalRequest, advancePhase } from '../src/lib/agent/approve.ts'
import {
  agentAfter,
  agentWorkflow,
  agentKeyProblems,
  archivesOnApproval,
  cardWorkflow,
  cardWorkflowId,
  frozenWorkflow,
  landAgents,
  previewMembers,
  previewStages,
  scheduledAgent,
  scheduledMembers,
  workflowById,
  workflowFileProblems,
  workflowIssues,
  workflowPurpose,
  workflowWhen,
  userWorkflowRules,
  workflows,
} from '../src/lib/agent/workflows.ts'
import { parseWorkflowFile, workflowFileText, type WorkflowDef } from '../src/lib/agent/workflow-file.ts'
import { specAgentAssigned, specAgentSelector } from '../src/lib/agents/index.ts'
import { specAgentCatalog } from '../src/lib/agents/catalog.ts'
import { forgetFileMemos } from '../src/lib/file-memo.ts'
import { startRun, workflowRefusal } from '../src/lib/agent/start.ts'
import { agentMemoryDir } from '../src/lib/memory.ts'
import { BOARD_STATE, RULES, setBoardRoot } from '../src/lib/paths.ts'
import { backfillCardWorkflows } from '../src/lib/card-workflow-backfill.ts'
import { findCard } from '../src/lib/view/read.ts'
import { awaitingApproval, canImplement } from '../src/lib/view/rules.ts'
import { move, refuses, uiConfigOf } from './helpers/board.ts'
import { editWorkflow, editableOfficial, resetOfficial, switchAgent, writeOfficial } from './helpers/official.ts'
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

const workflowFile = (id: string): string => path.join(editableOfficial(), 'workflows', id, 'WORKFLOW.md')
const writeWorkflow = (id: string, text: string): void => writeOfficial(`workflows/${id}/WORKFLOW.md`, text)

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
  resetOfficial()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the workflows a board has', () => {
  it('ships seven, each with its previews, their approvals and what lands it', () => {
    assert.deepEqual(workflows().map((w) => w.id), ['blog-post', 'carousel-post', 'coding', 'hyperframes-video', 'slide-deck', 'video-clone', 'workflow-builder'])
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
    fs.mkdirSync(path.join(RULES, 'workflows'), { recursive: true })
    fs.writeFileSync(path.join(RULES, 'workflows', 'coding.md'), 'Titles in English.\n')
    assert.equal(userWorkflowRules(workflowById('coding')!), 'Titles in English.')
    const prompt = buildPrompt({ action: 'clarify', id: 1, workflow: 'coding' })
    assert.match(prompt, /<workflow name="Coding">[\s\S]*## Explainer diagram[\s\S]*<\/workflow>\n\n<rules>[\s\S]*Titles in English\.\n<\/rules>/)
    assert.doesNotMatch(prompt, /^\/kanban|^\$kanban/)
    assert.doesNotMatch(buildPrompt({ action: 'spec', id: 1, specAgent: 'ui-designer' }), /<workflow name=/)
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
    fs.writeFileSync(cardFile(id), fs.readFileSync(cardFile(id), 'utf8').replace('questions: []', 'questions:\n  - "Which voice?"'))
    assert.match((approvalRequest({ action: 'approve', id }) as { error: string }).error, /open questions/)
  })

  it('has a first planning choose its previews, then lists only the current stage’s chosen ones', async () => {
    const id = await create('Launch video', 'hyperframes-video')
    const first = specAgentSelector(id, 'hyperframes-video', null)
    assert.match(first, /akb previews --triggers --workflow hyperframes-video/)
    assert.doesNotMatch(first, /`scriptwriter`|`hyperframes-editor`/)
    const chosen = { previews: ['scriptwriter', 'hyperframes-editor'], phase: 0 }
    const stage1 = specAgentSelector(id, 'hyperframes-video', chosen)
    assert.match(stage1, /`scriptwriter`/)
    assert.doesNotMatch(stage1, /demo-rehearser|hyperframes-editor|After:/)
    assert.match(specAgentSelector(id, 'hyperframes-video', { ...chosen, phase: 2 }), /`hyperframes-editor`/)
    // A preview that asks for a session of its own is run apart.
    assert.match(specAgentSelector(id, 'video-clone', { previews: ['video-cloner'], phase: 0 }), /`video-cloner`[\s\S]*runs in a session of its own: leave out `--print`/)
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

describe('the workflow a card carries', () => {
  it('is written into its frontmatter, and read back off it', async () => {
    writeWorkflow('newsletter', '---\nname: Newsletter\n---\n')
    const mine = 'newsletter'
    const id = (await move(root, ['create', '--title', 'Write the launch note', '--workflow', mine])).id as number
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), new RegExp(`^workflow: ${mine}$`, 'm'))
    assert.equal(cardWorkflowId(id), mine)
    await move(root, ['update', String(id), '--priority', 'high'])
    assert.equal(cardWorkflowId(id), mine)
  })

  it('is always written, and never guessed among several', async () => {
    const coding = (await move(root, ['create', '--title', 'Fix the header', '--workflow', 'coding'])).id as number
    assert.match(fs.readFileSync(cardFile(coding), 'utf8'), /^workflow: coding$/m)
    await refuses(root, ['create', '--title', 'Fix the footer', '--workflow='], /--workflow is required/)
  })

  it('refuses a workflow this board does not have', async () => {
    await refuses(root, ['create', '--title', 'A note', '--workflow', 'nonesuch'], /no workflow called "nonesuch"/)
    await refuses(root, ['create', '--title', 'A note', '--workflow', 'content'], /no workflow called "content"/)
  })

  it('moves to another workflow: back to `todo`, its previews cleared', async () => {
    const id = (await move(root, ['create', '--title', 'Write the launch note', '--workflow', 'hyperframes-video'])).id as number
    await move(root, ['update', String(id), '--status', 'ready', '--previews', 'scriptwriter,hyperframes-editor', '--phase', '2'])
    assert.match(fs.readFileSync(cardFile(id), 'utf8'), /^phase: 2$/m)
    await refuses(root, ['update', String(id), '--phase', '3'], /--phase must be 1 to 2/)
    await move(root, ['update', String(id), '--workflow', 'blog-post'])
    const { meta } = parseFrontmatter(fs.readFileSync(cardFile(id), 'utf8'))
    assert.deepEqual([meta!.workflow, meta!.status, meta!.previews, meta!.stages, meta!.phase], ['blog-post', 'todo', undefined, 0, 0])
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

describe('what a delivery freezes', () => {
  it('freezes the previews and land onto the delivery, and reads every field of it back', () => {
    editWorkflow('coding', (def) => {
      def.previews.find((h) => h.agent === 'tech-stack-advisor')!.extra = 'Prefer what we already use.'
    })
    const frozen = frozenWorkflow('coding')!
    assert.deepEqual([frozen.id, frozen.name], ['coding', 'Coding'])
    assert.deepEqual(frozen.land, [{ agent: 'builder', extra: '' }])
    assert.equal(frozen.previews!.find((h) => h.agent === 'tech-stack-advisor')!.extra, 'Prefer what we already use.')
    const row = readDeliveryRow({ deliveryId: 'd1', workflow: frozen })!
    assert.deepEqual(row.workflow!.land, frozen.land)
    assert.deepEqual(row.workflow!.previews, frozen.previews)
    switchAgent('coding', 'tech-stack-advisor', false)
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
    await refuses(root, ['update', String(id), '--workflow', 'coding'], /delivery/i)
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

})

describe('no default workflow (#494)', () => {
  it('writes a prompt for planning and for building on every official workflow', () => {
    for (const flow of workflows().filter((w) => w.builtIn)) {
      assert.match(buildPrompt({ action: 'clarify', id: 1, workflow: flow.id }), new RegExp(`<workflow name="${flow.name}">`), flow.id)
      const lands = landAgents(flow)[0]?.agent
      if (lands) assert.match(buildPrompt({ action: 'implement', id: 1, workflow: flow.id }), new RegExp(`you, the \`${lands}\` agent`), flow.id)
    }
  })

  it('says Coding is not installed when a card on it is built without it', async () => {
    const id = (await move(root, ['create', '--title', 'Fix it'])).id as number
    fs.rmSync(path.join(editableOfficial(), 'workflows', 'coding'), { recursive: true })
    forgetFileMemos()
    await refuses(root, ['create', '--title', 'Another', '--workflow', 'coding'], /no workflow called "coding"/)
    assert.equal(workflowRefusal({ action: 'implement', id })!.error, 'This task\'s workflow "coding" is not installed.')
  })

  it('writes Coding onto every open card naming no workflow, once', () => {
    const file = path.join(kanban(), 'todo', '7-old.md')
    const old = '---\ntitle: Old\npriority: med\nstatus: todo\nblocked_by: []\nrelated: []\nmodules: []\nquestions: []\n---\n\nBody.\n'
    fs.writeFileSync(file, old)
    backfillCardWorkflows()
    assert.equal(cardWorkflow(7)!.id, 'coding')
    assert.ok(fs.existsSync(path.join(BOARD_STATE, 'card-workflows-backfilled')))
    fs.writeFileSync(file, old)
    backfillCardWorkflows()
    assert.equal(cardWorkflowId(7), '')
  })
})

describe('starting a run', () => {
  it('is refused outright on a card naming a workflow this board no longer has', async () => {
    const id = (await move(root, ['create', '--title', 'A piece'])).id as number
    setWorkflow(id, 'gone-since')
    assert.equal(cardWorkflow(id), undefined)
    const started = await startRun({ action: 'implement', id })
    assert.match((started as { error: string }).error, /workflow "gone-since" is not installed/)
  })
})

describe('the QA manager, Coding’s scheduled agent (#1402)', () => {
  it('runs on auto, and is no other built-in’s', () => {
    const qa = scheduledAgent('coding', 'qa-manager')!
    assert.deepEqual({ off: qa.off, cadence: qa.cadence, extra: qa.extra }, { off: undefined, cadence: 'auto', extra: '' })
    for (const flow of workflows().filter((w) => w.builtIn && w.id !== 'coding')) assert.deepEqual(scheduledMembers(flow), [])
  })
})

describe('workflows in files (#1890)', () => {
  it('reads back what it writes', () => {
    const def: WorkflowDef = {
      id: 'wf-2',
      name: 'Release #2: notes',
      description: 'Writes release notes.',
      when: 'Release notes # not a comment.',
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

  it('refuses a file written before #2152, one in rounds, and one listing an agent twice', () => {
    const problem = (id: string, text: string) => {
      const read = parseWorkflowFile(id, text, `${id}/WORKFLOW.md`)
      return 'problem' in read ? read.problem : ''
    }
    assert.match(problem('old', '---\nname: Old\ndelivers: plan\nstages:\n  plan:\n    lead: software-planner\n---\n'), /`stages`, `delivers` are no longer read — list the agents under `previews`, `land` and `scheduled`/)
    assert.match(problem('rounds', '---\nname: Rounds\npreviews:\n  - [copywriting]\n  - [illustrator]\n---\n'), /rounds\/WORKFLOW\.md: `previews` is one list of agents, not a list of lists/)
    assert.match(problem('twice', '---\nname: Twice\npreviews: [copywriting]\nland: [copywriting]\n---\n'), /`copywriting` is listed more than once/)
    assert.match(problem('broken', '---\ndescription: no name\n---\n'), /no `name`/)
  })

  it('keeps its body as its rules, and reads its description and when', () => {
    agent('note-taker')
    writeWorkflow('notes', '---\nname: Notes\ndescription: Takes notes.\nwhen: Meeting notes.\npreviews: [note-taker]\n---\n\nWhy it exists.\n')
    const flow = workflowById('notes')!
    assert.equal(workflowPurpose(flow), 'Takes notes.')
    assert.equal(workflowWhen(flow), 'Meeting notes.')
    assert.equal(flow.rules, 'Why it exists.')
  })
})

describe('`akb update` on a board saved before rounds (#2152)', () => {
  it('makes each plan agent’s rule its workflow’s card rule, once, and names the files it no longer reads', async () => {
    const { movePlanRules, noteOldWorkflows } = await import('../src/commands/update.ts')
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'software-planner.md'), 'Titles in English.\n')
    fs.writeFileSync(path.join(RULES, 'scriptwriter.md'), 'Keep it under a minute.\n')
    fs.mkdirSync(path.join(kanban(), 'workflows', 'wf-2'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'workflows', 'wf-2', 'WORKFLOW.md'), '---\nname: Old\nstages:\n  plan:\n    lead: outliner\n---\n')
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

describe('builder 专属指令', () => {
  const heading = 'you, the `builder` agent'
  const once = (text: string): void => {
    assert.equal(text.split(heading).length - 1, 1)
    assert.ok(text.includes(findSpecAgent('builder')!.body))
  }

  it('实现、Start now 和冲突处理都注入一次，其他流程不注入', async () => {
    const id = (await move(root, ['create', '--title', 'Build it'])).id as number
    for (const action of ['implement'] as const) {
      for (const req of [{ action, id }, { action, description: '构建功能', workflow: 'coding' }]) {
        once(buildPrompt(req))
        const sink = startCollecting()
        try {
          printFlow(req)
          once(sink.out.join('\n'))
        } finally {
          stopCollecting()
        }
      }
    }
    assert.doesNotMatch(buildPrompt({ action: 'clarify', id }), /you, the `builder` agent/)
    assert.doesNotMatch(findGuide('implement')!.text, /Approved mockups|Approved API previews|Approved schema preview|Building is not shipping|What needs it live|repository-required check/)
    assert.match(findGuide('implement')!.text, /Start now|User-action blockers/)
  })

  it('其他执行者隔离，混合交付按顺序注入各自正文', () => {
    agent('publisher')
    writeWorkflow('solo', '---\nname: Solo\nland: [publisher]\n---\n')
    const solo = buildPrompt({ action: 'implement', workflow: 'solo' })
    assert.match(solo, /you, the `publisher` agent/)
    assert.doesNotMatch(solo, /已批准的界面预览|仓库要求的全部检查|you, the `builder` agent/)
    writeWorkflow('mixed', '---\nname: Mixed\nland:\n  - agent: publisher\n    extra: Deliver the article.\n  - agent: builder\n    extra: Check the code.\n---\n')
    const mixed = landBlock({ action: 'implement', workflow: 'mixed' })
    assert.match(mixed, /you, the `publisher` agent[\s\S]*Deliver the article\./)
    assert.doesNotMatch(mixed, /you, the `builder` agent/)
    assert.equal(agentWorkflow('builder'), 'coding')
    assert.equal(agentRoster().filter((a) => a.name === 'builder').length, 1)
    assert.deepEqual(agentRoster().find((a) => a.name === 'builder')!.ownMemory, [])
  })

  it('冻结的旧工作流仍加载内置正文，并忽略当前工作流的修改', async () => {
    const id = (await move(root, ['create', '--title', 'Build it'])).id as number
    const deliveryId = withStore((store) => {
      const started = { sessionId: 's-builder', cardId: id, action: 'implement' as const, status: 'stopped' as const, startedAt: 1000, harness: 'claude-code', logPath: 'builder.log' }
      store.runs.push(started)
      return joinDelivery(store, started, 'Build it', 'implement').deliveryId
    })
    agent('publisher')
    writeWorkflow('solo', '---\nname: Solo\nland: [publisher]\n---\n')
    for (const action of ['implement'] as const) {
      const req = { action, id, deliveryId, workflow: 'solo' }
      once(buildPrompt(req))
      assert.doesNotMatch(landBlock(req), /publisher/)
      const sink = startCollecting()
      try {
        printFlow(req)
        once(sink.out.join('\n'))
      } finally {
        stopCollecting()
      }
    }
  })
})
