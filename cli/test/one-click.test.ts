// One Implement click, from the card to landed and off the board (#307).
//
// Three things are asked here, and all three are about the ends of the flow: the card is
// completed by the BOARD once its delivery has landed and not by the build that made it,
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

import { recordAnswer } from '../src/lib/agent/answers.ts'
import {
  activeDelivery,
  adoptDirectCard,
  findDelivery,
  listDeliveries,
  openQuestions,
} from '../src/lib/agent/deliveries.ts'
import { cmdStartRun } from '../src/commands/run.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { claimCard, closeRun, cancelDelivery, openRun, peekRun, stopRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import { PLANS, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { move } from './helpers/board.ts'
import { findCard } from '../src/lib/view/read.ts'

let root = ''

const cardText = (
  id: number,
  title: string,
  questions: string[] = [],
  scope = 'a requirement',
  status = 'ready',
  // `## Worth noting after implementation` — decisions the build itself settled, which
  // sit outside the approved copy and travel to the next delivery on the card (#637).
  notes: string[] = [],
): string =>
  [
    '---',
    `title: ${title}`,
    'priority: med',
    `status: ${status}`,
    'blocked_by: []',
    'related: []',
    'modules: []',
    questions.length ? `questions:\n${questions.map((q) => `  - ${JSON.stringify(q)}`).join('\n')}` : 'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    ...(notes.length ? ['## Worth noting after implementation', ...notes, ''] : []),
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

async function end(sessionId: string, status: 'done' | 'error' = 'done'): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status, ok: status === 'done', code: 0 })
}

// Build a card — everything one click does before landing.
async function builtCard(id: number, title: string, text: string, file = 'shared.txt'): Promise<DeliveryRecord> {
  const built = run('implement', id, title)
  const delivery = activeDelivery(id)!
  // Auto mode builds in a worktree of its own; manual mode is the user's own checkout.
  fs.writeFileSync(path.join(delivery.worktree ? worktreeDir(delivery.worktree) : root, file), text)
  await end(built)
  return delivery
}

const landingOf = (deliveryId: string): DeliveryRecord['landing'] =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)?.landing

const log = (ref = 'main'): string[] => git(['log', '--format=%s', ref]).split('\n')

const archived = (id: number): boolean =>
  fs.existsSync(path.join(root, 'docs', 'kanban', '.archive', `${id}-card.md`))

const setStatus = (id: number, status: string): void =>
  fs.writeFileSync(cardPath(id), fs.readFileSync(cardPath(id), 'utf8').replace(/^status: .*$/m, `status: ${status}`))

// What the run that applied the answers concluded about them (#637). The board reads this
// rather than the card's text, so nothing carries on or reopens until it is written.
const said = (id: number, outcome: 'unchanged' | 'changed', why = 'what it is building is unchanged'): void => {
  recordAnswer(activeDelivery(id)!.deliveryId, outcome, why)
}

// The card as it reads once the question has been answered and the answer moved the plan.
const answered = (id: number, scope: string, status = 'ready'): void => {
  said(id, 'changed', 'the requirement it was approved to build is a different one now')
  fs.writeFileSync(cardPath(id), cardText(id, 'card one', [], scope, status))
}

describe('discarding a build', () => {
  it('puts the card back at the stage the delivery took it from, not at todo', async () => {
    const built = run('implement', 1, 'card one')
    setStatus(1, 'implementing') // what the run's claim writes
    await end(built, 'error')

    assert.equal((await cancelDelivery(activeDelivery(1)!.deliveryId)).ok, true)
    // `ready`: throwing the work away is not the same as unsettling the plan.
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: ready$/m)
  })

  it('rests the card at todo when a question is waiting on the user', async () => {
    fs.writeFileSync(cardPath(1), cardText(1, 'card one', ['which shade of blue?']))
    const built = run('implement', 1, 'card one')
    setStatus(1, 'implementing')
    await end(built, 'error')

    await cancelDelivery(activeDelivery(1)!.deliveryId)
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: todo$/m)
  })
})

describe('a build asked for inside a planning run', () => {
  for (const action of ['clarify', 'resolve'] as const) {
    it(`is refused inside a ${action} run`, async () => {
      const opened = openRun({ action, id: 1, title: 'card one', ...(action === 'clarify' ? { refineRound: 1 } : {}) }, 'prompt', [])
      if ('error' in opened) throw new Error(opened.error)
      const session = opened.run.sessionId
      process.env[RUN_ENV] = session
      await assert.rejects(() => cmdStartRun('implement', [1], { print: true }), /a planning run never builds/)
      assert.equal(peekRun(session)!.action, action)
      assert.equal(activeDelivery(1), undefined)
    })
  }
})

describe('a stopped delivery built again', () => {
  it('clears the stop once an implement run joins it', async () => {
    const first = run('implement', 1, 'card one')
    const id = activeDelivery(1)!.deliveryId
    await end(first, 'error')
    withStore((store) => {
      const live = store.deliveries.find((d) => d.deliveryId === id)!
      live.review = { rounds: [], stopped: { reason: 'uncommitted', why: 'the commit was refused', at: 1 } }
    })
    assert.equal(deliveryState(activeDelivery(1)!, 0).stage, 'stopped')

    const again = run('implement', 1, 'card one')
    const delivery = activeDelivery(1)!
    assert.equal(delivery.deliveryId, id)
    assert.equal(delivery.review?.stopped, undefined)
    assert.equal(delivery.sessions.length, 2)
    await end(again, 'error')
  })
})

describe('claiming the card for a run', () => {
  it('remembers the stage on the record and leaves the write to its caller', async () => {
    const started = run('implement', 1, 'card one')
    const record = peekRun(started)!
    // The card is `ready` on the board, and the claim only says what to write.
    const claim = claimCard(record)
    assert.deepEqual(claim, { cardId: 1, status: 'implementing' })
    assert.equal(record.priorStatus, 'ready')
    assert.match(fs.readFileSync(cardPath(1), 'utf8'), /^status: ready$/m)
  })

  it('claims nothing for a run with no card of its own', async () => {
    const opened = run('prune-memory', 0, '')
    assert.equal(claimCard(peekRun(opened)!), undefined)
  })
})

describe('a run that ends before it spawns', () => {
  it('is closed out by the watcher itself, which waits for that close', async () => {
    const started = run('implement', 1, 'card one')
    // A finished run with no log is pruned from the record, so give it one to be found by.
    fs.writeFileSync(peekRun(started)!.logPath, 'log\n')
    // No plan on disk is the watcher's first early exit: nothing to spawn, so it closes the
    // run out — and the close is awaited, so the record has settled by the time it returns.
    fs.rmSync(path.join(SESSIONS_DIR, `${started}.plan.json`))
    assert.equal(await watchRun(started), 1)
    assert.equal(peekRun(started)?.status, 'interrupted')
  })

  it('is closed out as stopped', async () => {
    const started = run('implement', 1, 'card one')
    // A finished run with no log is pruned from the record, so give it one to be found by.
    fs.writeFileSync(peekRun(started)!.logPath, 'log\n')
    assert.equal((await stopRun(started)).ok, true)
    assert.equal(peekRun(started)?.status, 'stopped')
  })

  it('is closed out as errored', async () => {
    const started = run('implement', 1, 'card one')
    await end(started, 'error')
    assert.equal(peekRun(started)?.status, 'error')
  })
})

describe('removed raw commands', () => {
  it('rejects run-blocker as an unknown command', async () => {
    await assert.rejects(() => move(root, ['run-blocker', '1']), /unknown command/)
  })
})
