// Reviewers instead of a review lead (#820).
//
// What is asked here: a workflow with no reviewers starts, builds and lands with no review run
// whatever was asked for; one with reviewers hands the hidden lead a list it can print each
// reviewer from; and a board saved before this keeps its reviewer, its rule and its lead.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { deliveryPlan } from '../src/lib/agent/commit-mode.ts'
import { activeDelivery, listDeliveries, manualSettled } from '../src/lib/agent/deliveries.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { agentForRun } from '../src/lib/agent/runner.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAiReview, setAutoCommit } from '../src/lib/agent/settings.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import {
  addWorkflowHelper,
  createWorkflow,
  duplicateWorkflow,
  setWorkflowLead,
  workflowById,
  workflowProblems,
} from '../src/lib/agent/workflows.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { RULES, setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { run as akb } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

const CARD = (id: number, workflow: string): string =>
  [
    '---',
    `title: card ${id}`,
    'priority: med',
    'roi: med',
    'status: ready',
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    ...(workflow ? [`workflow: ${workflow}`] : []),
    '---',
    '',
    'What this card is for.',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    `- **A requirement**: ${id}.`,
    '',
  ].join('\n')

const cardFile = (id: number): string => path.join(kanban(), 'todo', `${id}-card.md`)

const git = (args: string[]): string => {
  const out = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

// A project reviewer that only looks at screens.
const uiChecker = (): void => {
  const home = path.join(kanban(), 'agents', 'ui-checker')
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(home, 'AGENT.md'),
    [
      '---',
      'name: ui-checker',
      'description: Use on a delivery that changes .tsx files. Skip every other delivery.',
      'akb:',
      '  stage: review',
      '  owns: the screens a build changed',
      '---',
      '',
      'You check the screens.',
      '',
    ].join('\n'),
  )
}

// A board workflow with plan and execute led, and no reviewers.
const unreviewed = (): string => {
  const made = createWorkflow('Video')
  setWorkflowLead(made.id!, 'plan', 'planner')
  setWorkflowLead(made.id!, 'execute', 'builder')
  return made.id!
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-reviewers-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  uiChecker()
  setAutoCommit(true)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function card(id: number, workflow = ''): void {
  fs.writeFileSync(cardFile(id), CARD(id, workflow))
}

function open(action: 'implement' | 'review', id: number, aiReview?: boolean): string {
  const opened = openRun({ action, id, title: `card ${id}`, ...(aiReview === undefined ? {} : { aiReview }) }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status: 'done', ok: true, code: 0 })
}

async function printed(argv: string[]): Promise<string> {
  const sink = startCollecting()
  try {
    await akb(root, argv)
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

const recordOf = (id: string) => listDeliveries().find((d) => d.deliveryId === id)!

describe('a workflow with no reviewers', () => {
  it('starts with no review lead, while plan and execute still need theirs', () => {
    const id = unreviewed()
    assert.deepEqual(workflowProblems(id), [])
    const bare = createWorkflow('Bare')
    setWorkflowLead(bare.id!, 'plan', 'planner')
    assert.match(workflowProblems(bare.id!).join('\n'), /no agent leading its execute stage/)
  })

  it('freezes no review, over the board setting and the request alike', () => {
    card(1, unreviewed())
    setAiReview(true)
    open('implement', 1, true)
    assert.equal(activeDelivery(1)!.aiReview, false)
  })

  it('keeps the delivery unreviewed when a reviewer is added mid-flight', () => {
    const id = unreviewed()
    card(1, id)
    open('implement', 1)
    assert.equal(addWorkflowHelper(id, 'review', 'code-reviewer').ok, true)
    assert.equal(activeDelivery(1)!.aiReview, false)
    assert.deepEqual(activeDelivery(1)!.workflow!.stages.review!.helpers, [])
  })

  it('lands and archives the card after the build, with no review run', async () => {
    card(1, unreviewed())
    const session = open('implement', 1)
    const delivery = activeDelivery(1)!
    fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), 'one\n')
    await end(session)
    assert.equal(await advanceLanding(), null)
    assert.equal(recordOf(delivery.deliveryId).landing?.status, 'landed')
    assert.deepEqual(readStore().runs.map((r) => r.action), ['implement'])
    assert.equal(fs.existsSync(cardFile(1)), false)
  })

  it('in manual mode, asks for the commit without a review', async () => {
    setAutoCommit(false)
    card(1, unreviewed())
    const session = open('implement', 1)
    fs.writeFileSync(path.join(root, 'shared.txt'), 'one\n')
    await end(session)
    assert.match(manualSettled(activeDelivery(1)!) ?? '', /the build is done/)
  })

  it('refuses a review asked for by hand, and writes no run down', async () => {
    card(1, unreviewed())
    await end(open('implement', 1))
    const before = readStore().runs.length
    assert.throws(() => open('review', 1), /no reviewers/)
    assert.equal(readStore().runs.length, before)
    await assert.rejects(() => printed(['delivery', 'review', '1', '--print']), /no reviewers/)
  })

  it('tells the Implement dialog it will not be reviewed, and a coding card that it will', () => {
    card(1, unreviewed())
    card(2)
    assert.equal(deliveryPlan(1).aiReview, false)
    assert.equal(deliveryPlan(2).aiReview, true)
  })
})

describe('a workflow with reviewers', () => {
  it('reviews a coding delivery as the code reviewer', () => {
    card(1)
    open('implement', 1)
    assert.equal(activeDelivery(1)!.aiReview, true)
    assert.equal(agentForRun({ action: 'review', id: 1 }), 'code-reviewer')
  })

  it('lists every frozen reviewer for the lead, and prints each one', async () => {
    assert.equal(addWorkflowHelper('coding', 'review', 'ui-checker').ok, true)
    card(1)
    open('implement', 1)
    const flow = await printed(['delivery', 'review', '1', '--print'])
    assert.match(flow, /<reviewers>[\s\S]*`code-reviewer`[\s\S]*`ui-checker`[\s\S]*changes \.tsx files[\s\S]*<\/reviewers>/)
    assert.match(flow, /Pick the reviewers/)

    const code = await printed(['spec', 'code-reviewer', '1', '--print'])
    assert.match(code, /You review the code a build delivered/)
    assert.doesNotMatch(code, /You check the screens/)
    assert.doesNotMatch(code, /Be a spec agent/)
    const ui = await printed(['spec', 'ui-checker', '1', '--print'])
    assert.match(ui, /You check the screens/)
  })

  it('refuses to print a reviewer the delivery did not freeze', async () => {
    card(1)
    open('implement', 1)
    await assert.rejects(() => printed(['spec', 'ui-checker', '1', '--print']), /not a reviewer on a delivery/)
  })

  it('prints the rule the board wrote for the old reviewer', async () => {
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'reviewer.md'), 'Run the smoke tests.\n')
    card(1)
    open('implement', 1)
    const code = await printed(['spec', 'code-reviewer', '1', '--print'])
    assert.ok(code.trimEnd().endsWith('Run the smoke tests.'))
  })
})

describe('a board saved before reviewers', () => {
  it('folds a saved review lead into the reviewers, once, and drops the key', () => {
    fs.writeFileSync(
      UI_CONFIG,
      JSON.stringify({
        workflows: {
          added: [{ id: 'wf-2', name: 'Mine' }],
          stages: {
            'wf-2': {
              plan: { lead: 'planner' },
              execute: { lead: 'builder' },
              review: { lead: 'reviewer', helpers: [{ agent: 'ui-checker', extra: 'x' }] },
            },
          },
        },
      }),
    )
    const flow = workflowById('wf-2')!
    assert.equal(flow.stages.review.lead, '')
    assert.deepEqual(flow.stages.review.helpers.map((h) => h.agent), ['code-reviewer', 'ui-checker'])
    const saved = JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).workflows.stages['wf-2'].review
    assert.equal('lead' in saved, false)
    assert.deepEqual(saved.helpers, [
      { agent: 'code-reviewer', extra: '' },
      { agent: 'ui-checker', extra: 'x' },
    ])
  })

  it('copies a workflow with its reviewers and never a review lead', () => {
    const copy = duplicateWorkflow('coding')
    assert.deepEqual(workflowById(copy.id!)!.stages.review.helpers.map((h) => h.agent), ['code-reviewer'])
    const saved = JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).workflows.stages[copy.id!].review
    assert.equal('lead' in saved, false)
    assert.match(setWorkflowLead(copy.id!, 'review', 'code-reviewer').error!, /no lead, only reviewers/)
  })
})
