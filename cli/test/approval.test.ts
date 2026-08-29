// Requiring the user's approval of the tree before it lands (#308).
//
// A real git repository with real worktrees, like the landing tests: every question here is
// about what the target branch ends up holding, and about the two things an approval is
// bound to — the delivery's base commit and the candidate's fingerprint.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { approveDelivery } from '../src/lib/agent/approval.ts'
import { activeDelivery, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit, setDiffApproval } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const card = (id: number, title: string): string =>
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
    'questions: []',
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

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-approval-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  for (const [id, title] of [
    [1, 'card one'],
    [2, 'card two'],
  ] as const) {
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', `${id}-card.md`), card(id, title))
  }
  setAutoCommit(true)
  setDiffApproval(true)
})

afterEach(() => {
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

async function passReview(id: number, title: string): Promise<void> {
  const review = run('review', id, title)
  await end(review)
}

// Build a card and pass its review: everything that happens before a landing.
async function reviewed(id: number, title: string, text: string): Promise<DeliveryRecord> {
  const built = run('implement', id, title)
  const delivery = activeDelivery(id)!
  fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), text)
  await end(built)
  await passReview(id, title)
  return delivery
}

const live = (deliveryId: string): DeliveryRecord => listDeliveries().find((d) => d.deliveryId === deliveryId)!
const log = (ref = 'main'): string[] => git(['log', '--format=%s', ref]).split('\n')

describe('the setting', () => {
  it('is off by default, and a delivery started then lands unasked', async () => {
    setDiffApproval(false)
    const delivery = await reviewed(1, 'card one', 'one\n')
    assert.equal(live(delivery.deliveryId).approval?.required, false)

    await advanceLanding()
    assert.equal(live(delivery.deliveryId).landing?.status, 'landed')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
  })

  it('is frozen when the delivery starts, so flipping it changes only the next one', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    assert.equal(live(delivery.deliveryId).approval?.required, true)

    // Switched off while this one is in flight: it still waits, because the answer it
    // started under is the answer it keeps.
    setDiffApproval(false)
    await advanceLanding()
    assert.equal(live(delivery.deliveryId).landing?.status, 'waiting')
    assert.deepEqual(log(), ['start'])
  })

  it('has nothing to hold in manual commit mode — the user\'s own commit is the approval', async () => {
    setAutoCommit(false)
    const built = run('implement', 1, 'card one')
    assert.equal(activeDelivery(1)!.approval?.required, false)
    await end(built)
  })
})

describe('waiting on the approval', () => {
  it('holds outside the queue, taking no slot, so every other card still lands', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    approveDelivery(second.deliveryId, 'test')

    await advanceLanding()

    // The unapproved one is still waiting, and says what on; the approved one landed past it.
    assert.equal(live(first.deliveryId).landing?.status, 'waiting')
    assert.match(live(first.deliveryId).landing?.why ?? '', /held on your approval/)
    assert.equal(live(second.deliveryId).landing?.status, 'landed')
    assert.deepEqual(log(), ['card two (#2)', 'start'])
  })

  it('says what it waits on, and that there is something to press', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    const state = deliveryState(live(delivery.deliveryId), 0)
    assert.equal(state.stage, 'approval')
    assert.equal(state.paused, true)
    assert.match(state.label, /approval/i)
    assert.match(state.line, /Diff/)
  })

  it('lands once approved, and the record says what the approval covered', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    assert.deepEqual(log(), ['start'])

    const approved = approveDelivery(delivery.deliveryId, 'test')
    assert.equal(approved.ok, true)

    await advanceLanding()
    assert.equal(live(delivery.deliveryId).landing?.status, 'landed')
    assert.deepEqual(log(), ['card one (#1)', 'start'])

    const events = live(delivery.deliveryId).approval!.events
    assert.equal(events.length, 1)
    assert.equal(events[0]!.kind, 'approved')
    assert.equal(events[0]!.from, 'test')
    assert.equal(events[0]!.base, delivery.base)
    assert.ok(events[0]!.mark)
  })

  it('refuses to approve a delivery that was never asked to be approved', async () => {
    setDiffApproval(false)
    const delivery = await reviewed(1, 'card one', 'one\n')
    const res = approveDelivery(delivery.deliveryId, 'test')
    assert.equal(res.ok, false)
    assert.match('error' in res ? res.error : '', /needs no approval/)
  })
})

describe('what cancels an approval', () => {
  it('the tree moving after approval sends it back to waiting', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    approveDelivery(delivery.deliveryId, 'test')

    // Somebody changed the candidate after it was signed off.
    fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), 'something else\n')
    git(['add', '-A'], worktreeDir(delivery.worktree!))
    git(['commit', '--quiet', '-m', 'after the approval'], worktreeDir(delivery.worktree!))

    await advanceLanding()

    assert.deepEqual(log(), ['start'])
    const approval = live(delivery.deliveryId).approval!
    assert.equal(approval.granted, undefined)
    const cancelled = approval.events.filter((e) => e.kind === 'cancelled')
    assert.equal(cancelled.length, 1)
    assert.equal(cancelled[0]!.moved, 'tree')
    assert.match(live(delivery.deliveryId).landing?.why ?? '', /held on your approval/)
  })

  it('the base moving requires a new review and cancels approval', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    approveDelivery(delivery.deliveryId, 'test')

    // The target branch moved under it, so landing rebases — and the base it was approved
    // against is not the base it would land on any more.
    fs.writeFileSync(path.join(root, 'other.txt'), 'theirs\n')
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'someone else'])

    // The rebase invalidates both judgments of the old tree: review runs again first,
    // then the old-base approval is cancelled.
    const asked = await advanceLanding()
    assert.equal(asked?.action, 'review')
    assert.equal(asked?.id, 1)
    await passReview(1, 'card one')
    assert.equal(await advanceLanding(), null)

    // Nothing landed: the approval went with the base.
    assert.deepEqual(log(), ['someone else', 'start'])
    const approval = live(delivery.deliveryId).approval!
    assert.equal(approval.granted, undefined)
    assert.ok(approval.events.some((e) => e.kind === 'cancelled' && e.moved === 'base'))

    // Approving the rebased tree lands it.
    approveDelivery(delivery.deliveryId, 'test')
    await advanceLanding()
    assert.deepEqual(log(), ['card one (#1)', 'someone else', 'start'])
  })

  it('a cancelled approval is only recorded once, however many passes go by', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    await advanceLanding()
    approveDelivery(delivery.deliveryId, 'test')
    fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), 'else\n')
    git(['add', '-A'], worktreeDir(delivery.worktree!))
    git(['commit', '--quiet', '-m', 'after'], worktreeDir(delivery.worktree!))

    await advanceLanding()
    await advanceLanding()
    await advanceLanding()

    const cancelled = live(delivery.deliveryId).approval!.events.filter((e) => e.kind === 'cancelled')
    assert.equal(cancelled.length, 1)
  })
})
