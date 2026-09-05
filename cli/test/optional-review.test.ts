// Turning AI review off, per board and per implementation (#416).
//
// A real git repository, because the whole point of the setting is what the delivery does
// after the build: it goes to landing itself, and a rebase on the way there starts no run
// either.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { deliveryPlan, prepareDelivery, undoPrepared } from '../src/lib/agent/commit-mode.ts'
import {
  activeDelivery,
  listDeliveries,
  manualSettled,
  settleManualCommit,
} from '../src/lib/agent/deliveries.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { aiReviewEnabled, setAiReview, setAutoCommit } from '../src/lib/agent/settings.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import type { DeliveryRecord } from '../src/lib/agent/types.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import { DELIVERIES, setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'

let root = ''

const CARD = (id: number): string =>
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
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-optional-review-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  for (const id of [1, 2]) {
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', `${id}-card.md`), CARD(id))
  }
  setAutoCommit(true)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

// One session of a delivery, opened and closed the way the command and the watcher do.
function run(action: 'implement' | 'review', id: number): string {
  const opened = openRun({ action, id, title: `card ${id}` }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string, status: 'done' | 'error' = 'done'): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status, ok: status === 'done', code: 0 })
}

// Build a card with AI review off, leaving one changed file behind.
async function built(id: number, text: string): Promise<DeliveryRecord> {
  const session = run('implement', id)
  const delivery = activeDelivery(id)!
  fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), text)
  await end(session)
  return delivery
}

const recordOf = (deliveryId: string): DeliveryRecord =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)!

const readAudit = (id: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(DELIVERIES, `${id}.json`), 'utf8'))

const actions = (): string[] => readStore().runs.map((r) => r.action)

const log = (ref = 'main'): string[] => git(['log', '--format=%s', ref]).split('\n')

// One printed flow, as the terminal would show it.
function flow(action: 'implement' | 'conflict', id: number): string {
  const sink = startCollecting()
  try {
    printFlow({ action, id, title: `card ${id}` })
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

describe('the setting', () => {
  it('is on until somebody turns it off', () => {
    assert.equal(aiReviewEnabled(), true)
    assert.equal(deliveryPlan().aiReview, true)
  })

  it('is written down only when off, and turning it back on drops the key', () => {
    assert.equal(setAiReview(false).ok, true)
    assert.equal(aiReviewEnabled(), false)
    assert.equal(JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).aiReview, false)

    assert.equal(setAiReview(true).ok, true)
    assert.equal(aiReviewEnabled(), true)
    assert.equal('aiReview' in JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')), false)
  })

  it('reads as on when the file will not parse', () => {
    fs.writeFileSync(UI_CONFIG, '{ not json')
    assert.equal(aiReviewEnabled(), true)
  })
})

describe("the Implement dialog's tick", () => {
  it('turns this one build round without moving the setting', () => {
    const off = prepareDelivery(1, undefined, false)
    assert.ok('start' in off)
    assert.equal(off.start.aiReview, false)
    undoPrepared(off.start)
    assert.equal(aiReviewEnabled(), true)

    setAiReview(false)
    const on = prepareDelivery(1, undefined, true)
    assert.ok('start' in on)
    assert.equal(on.start.aiReview, true)
    undoPrepared(on.start)
    assert.equal(aiReviewEnabled(), false)
  })

  it('falls back to the setting when the request says nothing', () => {
    setAiReview(false)
    const got = prepareDelivery(1)
    assert.ok('start' in got)
    assert.equal(got.start.aiReview, false)
    undoPrepared(got.start)
  })

  it('reaches the delivery the run opens, and is frozen there', async () => {
    const opened = openRun({ action: 'implement', id: 1, title: 'card 1', aiReview: false }, 'prompt', [])
    assert.ok(!('error' in opened), 'error' in opened ? opened.error : '')
    const delivery = activeDelivery(1)!
    assert.equal(delivery.aiReview, false)
    assert.equal(readAudit(delivery.deliveryId).aiReview, false)

    // The setting moving underneath it changes the next delivery, never this one.
    setAiReview(true)
    assert.equal(activeDelivery(1)!.aiReview, false)
  })
})

describe('a delivery with review off', () => {
  beforeEach(() => {
    setAiReview(false)
  })

  it('goes from implementation straight to landing, with no review run', async () => {
    const delivery = await built(1, 'one\n')

    // Nothing was handed on to start, and the delivery is queued rather than reviewing.
    const closed = readStore().runs.find((r) => r.sessionId === delivery.sessions[0])
    assert.equal(closed?.action, 'implement')
    assert.equal(recordOf(delivery.deliveryId).next, undefined)
    assert.equal(recordOf(delivery.deliveryId).landing?.status, 'waiting')

    assert.equal(await advanceLanding(), null)

    const landing = recordOf(delivery.deliveryId).landing!
    assert.equal(landing.status, 'landed')
    assert.equal(recordOf(delivery.deliveryId).status, 'finished')
    assert.deepEqual(log(), ['card 1 (#1)', 'start'])
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'one\n')
    // Not one review ran, and the landing check is named for the run that did.
    assert.deepEqual(actions().filter((a) => a === 'review'), [])
    assert.equal(recordOf(delivery.deliveryId).review, undefined)
    assert.match(landing.checks?.[0]?.name ?? '', /^implement /)
  })

  it('starts no review after a rebase, and lands on the next pass', async () => {
    const delivery = await built(1, 'one\n')
    // The target branch moves under it, so landing has to replay onto the new tip.
    fs.writeFileSync(path.join(root, 'other.txt'), 'theirs\n')
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'someone else'])

    // The pass that rebases asks for nothing: it keeps the slot and says nothing to start.
    assert.equal(await advanceLanding(), null)
    const rebased = recordOf(delivery.deliveryId)
    assert.equal(rebased.landing?.status, 'landing')
    assert.equal(rebased.landing?.attempts, 1)
    assert.equal(rebased.review?.stopped, undefined)
    assert.equal(rebased.next, undefined)
    assert.deepEqual(actions().filter((a) => a === 'review'), [])

    // And the next pass carries on against the new base.
    assert.equal(await advanceLanding(), null)
    assert.equal(recordOf(delivery.deliveryId).landing?.status, 'landed')
    assert.deepEqual(log(), ['card 1 (#1)', 'someone else', 'start'])
    assert.deepEqual(actions().filter((a) => a === 'review'), [])
  })

  it('tells the build nothing reviews it, and offers it no review to run', () => {
    run('implement', 1)
    const printed = flow('implement', 1)
    assert.doesNotMatch(printed, /review comes next/)
    assert.doesNotMatch(printed, /delivery review 1 --print/)
    assert.match(printed, /leave the card on the board — the board archives the card itself/)
    assert.match(printed, /the landing takes that branch/)
  })

  it('tells a conflict run the composed result lands unreviewed', () => {
    run('implement', 1)
    const printed = flow('conflict', 1)
    assert.doesNotMatch(printed, /reviews the composed result/)
    assert.match(printed, /and lands the composed result/)
  })

  it('still reviews when an explicit review is asked for', async () => {
    await built(1, 'one\n')
    const session = run('review', 1)
    assert.ok(session)
    assert.equal(readStore().runs.find((r) => r.sessionId === session)?.action, 'review')
  })
})

describe('a delivery with review off, in manual commit mode', () => {
  beforeEach(() => {
    setAiReview(false)
    setAutoCommit(false)
  })

  it('waits for the commit without claiming a review passed', async () => {
    const session = run('implement', 1)
    const delivery = activeDelivery(1)!
    assert.equal(delivery.commitMode, 'manual')
    fs.writeFileSync(path.join(root, 'shared.txt'), 'one\n')
    await end(session)

    const live = recordOf(delivery.deliveryId)
    assert.ok(live.reviewed, 'the implementation should leave the snapshot')
    assert.equal(live.status, 'active')
    const said = manualSettled(live)
    assert.match(said ?? '', /the build is done/)
    assert.doesNotMatch(said ?? '', /review passed/i)
    const state = deliveryState(live, 0)
    assert.equal(state.stage, 'commit')
    assert.doesNotMatch(state.line, /[Rr]eview passed/)
  })

  it('still waits for the commit after a review asked for by hand', async () => {
    const session = run('implement', 1)
    const delivery = activeDelivery(1)!
    fs.writeFileSync(path.join(root, 'shared.txt'), 'one\n')
    await end(session)

    // `akb delivery review <id>` runs one whichever way the setting is set, and it is the
    // run that ends the delivery's WORK — not one that ends the delivery. The commit is
    // still the user's, and the card is still theirs to close by making it.
    await end(run('review', 1))
    const live = recordOf(delivery.deliveryId)
    assert.equal(live.status, 'active')
    assert.ok(live.reviewed, 'the review should leave a fresh snapshot to match the commit against')
    assert.match(manualSettled(live) ?? '', /commit the change in your own checkout/)
  })

  it('ends on whatever the user commits, since nothing would judge the difference', async () => {
    const session = run('implement', 1)
    const delivery = activeDelivery(1)!
    fs.writeFileSync(path.join(root, 'shared.txt'), 'one\n')
    await end(session)

    // They commit something other than what the board built.
    fs.writeFileSync(path.join(root, 'shared.txt'), 'mine instead\n')
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'my own'])

    await settleManualCommit(1)
    assert.equal(recordOf(delivery.deliveryId).status, 'finished')
    assert.equal(activeDelivery(1), undefined)
    assert.deepEqual(actions().filter((a) => a === 'review'), [])
  })
})
