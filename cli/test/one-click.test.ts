// One Implement click, from the card to landed and off the board (#307).
//
// Three things are asked here, and all three are about the ends of the flow: the card is
// completed by the BOARD once its delivery has landed and not by the review that passed it,
// a card with an open question holds outside the landing queue until it is answered, and an
// answer that changed what the card asks for starts a fresh delivery instead of landing the
// old one.
//
// A real git repository with real worktrees, like the landing tests: every question below
// ends in what the target branch holds and what is left on the board.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cmdReviewVerdict } from '../src/commands/review-verdict.ts'
import { activeDelivery, listDeliveries, openQuestions } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { findCard } from '../src/lib/view/read.ts'

let root = ''

const cardText = (id: number, title: string, questions: string[] = [], scope = 'a requirement'): string =>
  [
    '---',
    `title: ${title}`,
    'track: features',
    'priority: med',
    'roi: med',
    'status: ready',
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    questions.length ? `questions:\n${questions.map((q) => `  - ${JSON.stringify(q)}`).join('\n')}` : 'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    `- **A requirement**: ${scope}.`,
    '',
  ].join('\n')

const cardPath = (id: number): string => path.join(root, 'docs', 'kanban', 'todo', 'features', `${id}-card.md`)

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-one-click-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '9\n')
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
  fs.writeFileSync(cardPath(2), cardText(2, 'card two'))
  setAutoCommit(true)
  delete process.env[RUN_ENV]
})

afterEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

function run(action: AgentAction, id: number, title: string): string {
  const opened = openRun({ action, id, title }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

function end(sessionId: string, status: 'done' | 'error' = 'done'): void {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  closeRun(sessionId, { status, ok: status === 'done', code: 0 })
}

// Build a card and pass its review — everything one click does before landing.
function reviewed(id: number, title: string, text: string, file = 'shared.txt'): DeliveryRecord {
  const built = run('implement', id, title)
  const delivery = activeDelivery(id)!
  fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), file), text)
  end(built)
  const review = run('review', id, title)
  process.env[RUN_ENV] = review
  try {
    cmdReviewVerdict([String(id), '--verdict', 'pass'])
  } finally {
    delete process.env[RUN_ENV]
  }
  end(review)
  return delivery
}

const landingOf = (deliveryId: string): DeliveryRecord['landing'] =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)?.landing

const log = (ref = 'main'): string[] => git(['log', '--format=%s', ref]).split('\n')

const archived = (id: number): boolean =>
  fs.existsSync(path.join(root, 'docs', 'kanban', '.archive', `${id}-card.md`))

describe('completion is the last step', () => {
  it('leaves the card on the board while review passes, and archives it once it has landed', () => {
    const delivery = reviewed(1, 'card one', 'one\n')
    // Review passed, and the card is still there: the code has not landed yet.
    assert.equal(fs.existsSync(cardPath(1)), true)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'waiting')

    advanceLanding()

    assert.deepEqual(log(), ['card one (#1)', 'start'])
    assert.equal(fs.existsSync(cardPath(1)), false)
    assert.equal(archived(1), true)
  })

  it('archives a card whose delivery passed review having changed nothing', () => {
    const built = run('implement', 1, 'card one')
    end(built)
    const review = run('review', 1, 'card one')
    process.env[RUN_ENV] = review
    cmdReviewVerdict(['1', '--verdict', 'pass'])
    delete process.env[RUN_ENV]
    end(review)

    advanceLanding()
    assert.deepEqual(log(), ['start'])
    assert.equal(archived(1), true)
  })
})

describe('a card with an open question', () => {
  it('holds at landing, takes no slot, and lands once the question is answered', () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const held = reviewed(1, 'card one', 'one\n')
    const other = reviewed(2, 'card two', 'two\n', 'other.txt')

    advanceLanding()
    // The held card is still on the board and still on its own branch; the other card
    // went past it and landed, so the hold cost the queue nothing.
    assert.equal(fs.existsSync(cardPath(1)), true)
    assert.equal(landingOf(held.deliveryId)?.status, 'waiting')
    assert.match(landingOf(held.deliveryId)?.why ?? '', /open question/)
    assert.equal(landingOf(other.deliveryId)?.status, 'landed')
    assert.deepEqual(log(), ['card two (#2)', 'start'])

    // The card page says what it waits on and what answers it.
    const state = deliveryState(listDeliveries().find((d) => d.deliveryId === held.deliveryId)!, 1)
    assert.equal(state.stage, 'held')
    assert.equal(state.label, 'Held at landing')
    assert.equal(state.paused, true)

    // Answered — the same delivery carries on, with no second click.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    assert.equal(openQuestions(1), 0)
    while (advanceLanding()) {
      // the rebase this one owes, and the review after it, are asked for by the pass
      const wants = listDeliveries().find((d) => d.deliveryId === held.deliveryId)
      if (!wants || wants.status !== 'active') break
      const session = run('review', 1, 'card one')
      process.env[RUN_ENV] = session
      cmdReviewVerdict(['1', '--verdict', 'pass'])
      delete process.env[RUN_ENV]
      end(session)
    }
    advanceLanding()
    assert.equal(landingOf(held.deliveryId)?.status, 'landed')
    assert.equal(archived(1), true)
  })

  it('says so before it starts, and warns rather than refusing', () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    assert.equal(findCard(1)?.questions.length, 1)
    const built = run('implement', 1, 'card one')
    // The click still starts the delivery: the question is a reason not to LAND one.
    assert.equal(activeDelivery(1)?.deliveryId !== undefined, true)
    end(built)
  })
})

describe('an answer that changed the plan', () => {
  it('ends the held delivery and starts a fresh one on the card as it now reads', () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = reviewed(1, 'card one', 'one\n')
    advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'waiting')

    // Answered, and the answer rewrote what the card asks for.
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', [], 'a different requirement'))
    const wants = advanceLanding()

    assert.deepEqual(wants, { action: 'implement', id: 1, title: 'card one' })
    const ended = listDeliveries().find((d) => d.deliveryId === first.deliveryId)!
    assert.equal(ended.status, 'cancelled')
    assert.equal(ended.steps[ended.steps.length - 1]?.step, 'superseded')
    // Nothing landed, and the card is still on the board for the fresh delivery to build.
    assert.deepEqual(log(), ['start'])
    assert.equal(fs.existsSync(cardPath(1)), true)
  })

  it('carries the same delivery on when the answer left the plan alone', () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['[user] which shade of blue?']))
    const first = reviewed(1, 'card one', 'one\n')
    advanceLanding()

    fs.writeFileSync(cardPath(1), cardText(1, 'card one'))
    assert.equal(advanceLanding(), null)

    assert.equal(listDeliveries().find((d) => d.deliveryId === first.deliveryId)?.status, 'finished')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    assert.equal(archived(1), true)
  })
})

describe('where a delivery stands', () => {
  it('reads its stage off what is already recorded', () => {
    const base: DeliveryRecord = {
      deliveryId: 'aaa',
      cardId: 1,
      title: 'card one',
      status: 'active',
      startedAt: 1,
      sessions: [],
      approved: '',
      steps: [],
      commitMode: 'auto',
      targetBranch: 'main',
    }
    assert.equal(deliveryState(base, 0).stage, 'working')
    assert.equal(deliveryState(base, 3).stage, 'working') // no landing yet — nothing to hold

    const queued = { ...base, landing: { status: 'waiting' as const, attempts: 0, at: 1 } }
    assert.equal(deliveryState(queued, 0).stage, 'working')
    assert.equal(deliveryState(queued, 1).stage, 'held')

    const landed = { ...base, landing: { status: 'landed' as const, attempts: 0, at: 1, commit: 'abc1234def' } }
    assert.equal(deliveryState(landed, 0).label, 'Landed as abc1234')
    assert.equal(deliveryState({ ...landed, landing: { ...landed.landing, commit: undefined } }, 0).label,
      'Landed — nothing to commit')

    const stopped = {
      ...queued,
      review: { rounds: [], corrections: 0, stopped: { reason: 'ask' as const, why: 'review found something', at: 1 } },
    }
    assert.equal(deliveryState(stopped, 1).stage, 'stopped')

    const manual: DeliveryRecord = { ...base, commitMode: 'manual', reviewed: { mark: 'x', at: 1 } }
    assert.equal(deliveryState(manual, 0).label, 'Waiting for your commit')
    assert.equal(deliveryState(manual, 0).paused, true)

    const changed: DeliveryRecord = {
      ...base,
      commitMode: 'manual',
      next: 'review',
      review: { rounds: [{ sessionId: 's', verdict: 'pass', findings: [], at: 1 }], corrections: 0 },
    }
    assert.equal(deliveryState(changed, 0).label, 'Code changed after review')
    assert.equal(deliveryState(changed, 0).paused, false)
  })
})
