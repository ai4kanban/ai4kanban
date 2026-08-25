// Landing a reviewed delivery on the target branch (#304).
//
// The board here is a real git repository with real worktrees, because every question this
// file asks is a git question: what the target branch ends up holding, whether the user's
// own checkout followed it, and what is left behind afterwards.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cmdReviewVerdict } from '../src/commands/review-verdict.ts'
import { activeDelivery, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { advanceLanding, repairLanding } from '../src/lib/agent/landing.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { rebaseInProgress, worktreeDir } from '../src/lib/agent/worktree.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
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
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-landing-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  fs.writeFileSync(path.join(root, 'mergeable.txt'), Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n') + '\n')
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
  delete process.env[RUN_ENV]
})

afterEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

// One session of a delivery, opened and closed the way the command and the watcher do.
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

// Build a card and pass its review: everything that happens before a landing.
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

const statusOf = (deliveryId: string): string =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)!.status

const log = (ref = 'main'): string[] => git(['log', '--format=%s', ref]).split('\n')

describe('one card at a time', () => {
  it('lands as one squash commit and takes the delivery with it', () => {
    const delivery = reviewed(1, 'card one', 'one\n')
    assert.equal(landingOf(delivery.deliveryId)?.status, 'waiting')

    assert.equal(advanceLanding(), null)

    const landing = landingOf(delivery.deliveryId)!
    assert.equal(landing.status, 'landed')
    assert.equal(statusOf(delivery.deliveryId), 'finished')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    assert.equal(git(['rev-parse', 'main']), landing.commit)
    // The user's own checkout is on that branch, so their working tree followed it — and
    // nothing of the landing was left staged in it.
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'one\n')
    assert.equal(git(['status', '--porcelain', '--', 'shared.txt']), '')
    // And its checkout is gone.
    assert.equal(fs.existsSync(worktreeDir(delivery.worktree!)), false)
    assert.equal(git(['branch', '--list', delivery.branch!]), '')
  })

  it('records the commit, the base it landed against and the check that let it', () => {
    const delivery = reviewed(1, 'card one', 'one\n')
    const before = git(['rev-parse', 'main'])
    advanceLanding()
    const landing = landingOf(delivery.deliveryId)!
    assert.equal(landing.onto, before)
    assert.equal(landing.commit, git(['rev-parse', 'main']))
    assert.equal(landing.checks?.length, 1)
    assert.equal(landing.checks?.[0]?.ok, true)
  })

  it('waits on its branch, holding no slot, while the checkout is dirty', () => {
    const first = reviewed(1, 'card one', 'one\n')
    fs.writeFileSync(path.join(root, 'shared.txt'), 'mine\n')

    assert.equal(advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'waiting')
    assert.match(landingOf(first.deliveryId)?.why ?? '', /uncommitted changes in `shared\.txt` — commit or stash it$/)
    assert.deepEqual(log(), ['start'])

    // Stashed, and the next pass lands it. (Committing instead moves the target branch, so
    // that path rebases and reviews again — "a target branch that moved" below.)
    git(['checkout', '--quiet', '--', 'shared.txt'])
    advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
  })

  it('waits while the index holds anything of the user\'s', () => {
    const first = reviewed(1, 'card one', 'one\n')
    fs.writeFileSync(path.join(root, 'staged.txt'), 'x\n')
    git(['add', 'staged.txt'])

    assert.equal(advanceLanding(), null)
    assert.match(landingOf(first.deliveryId)?.why ?? '', /^`staged\.txt` is staged in your checkout/)
    assert.deepEqual(log(), ['start'])
  })

  it('leaves the user\'s own checkout alone when the target is not the branch they have out', () => {
    const delivery = reviewed(1, 'card one', 'one\n')
    git(['checkout', '--quiet', '-b', 'scratch'])

    advanceLanding()
    assert.deepEqual(log('main'), ['card one (#1)', 'start'])
    assert.deepEqual(log('scratch'), ['start'])
    assert.equal(git(['branch', '--show-current']), 'scratch')
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'base\n')
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
  })
})

describe('a target branch that moved', () => {
  it('warns about overlap, lands the first, and rebases the second', () => {
    const first = reviewed(1, 'card one', 'one\n')
    const second = reviewed(2, 'card two', 'two\n')
    assert.equal(first.base, second.base)

    const wants = advanceLanding()
    // The first landed; the second took the slot and found the target moved under it.
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.deepEqual(landingOf(first.deliveryId)?.overlap, [2])
    assert.equal(landingOf(second.deliveryId)?.status, 'landing')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    // Both cards changed the same lines, so this one is a conflict rather than a rebase.
    assert.equal(wants?.action, 'conflict')
    assert.equal(wants?.id, 2)
  })

  it('keeps the passed review when a clean rebase touches different files', () => {
    const first = reviewed(1, 'card one', 'one\n')
    // A second card that touches a different file rebases cleanly.
    const built = run('implement', 2, 'card two')
    const second = activeDelivery(2)!
    fs.writeFileSync(path.join(worktreeDir(second.worktree!), 'other.txt'), 'two\n')
    end(built)
    const review = run('review', 2, 'card two')
    process.env[RUN_ENV] = review
    cmdReviewVerdict(['2', '--verdict', 'pass'])
    delete process.env[RUN_ENV]
    end(review)

    const wants = advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.equal(wants, null)
    const landing = landingOf(second.deliveryId)!
    assert.equal(landing.status, 'landed')
    assert.equal(landing.attempts, 1)
    assert.deepEqual(log(), ['card two (#2)', 'card one (#1)', 'start'])
    assert.equal(landing.checks?.length, 1)
    assert.equal(landing.rebaseKind, 'disjoint')
  })

  it('focuses the re-review when a clean rebase touches the same file', () => {
    const base = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
    const firstText = [...base]
    firstText[1] = 'first changed this'
    const secondText = [...base]
    secondText[18] = 'second changed this'
    reviewed(1, 'card one', `${firstText.join('\n')}\n`, 'mergeable.txt')
    const second = reviewed(2, 'card two', `${secondText.join('\n')}\n`, 'mergeable.txt')

    const wants = advanceLanding()
    assert.equal(wants?.action, 'review')
    assert.equal(wants?.id, 2)
    assert.equal(landingOf(second.deliveryId)?.rebaseKind, 'overlap')

    const sink = startCollecting()
    let flow = ''
    try {
      printFlow({ action: 'review', id: 2, title: 'card two' })
      flow = sink.out.join('\n')
    } finally {
      stopCollecting()
    }
    assert.match(flow, /focused post-rebase integration review/)
    assert.match(flow, /shared path: mergeable\.txt/)
    assert.match(flow, /patch omitted for this focused rebase review/)
    assert.doesNotMatch(flow, /build THIS, not the card file/)

    const again = run('review', 2, 'card two')
    process.env[RUN_ENV] = again
    cmdReviewVerdict(['2', '--verdict', 'pass'])
    delete process.env[RUN_ENV]
    end(again)
    advanceLanding()
    assert.deepEqual(log(), ['card two (#2)', 'card one (#1)', 'start'])
    assert.equal(landingOf(second.deliveryId)?.checks?.length, 2)
  })

  it('hands over rather than looping when the target keeps moving', () => {
    const delivery = reviewed(1, 'card one', 'one\n')
    withStore((store) => {
      store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)!.landing!.attempts = 3
    })
    fs.writeFileSync(path.join(root, 'other.txt'), 'someone else\n')
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'someone else'])

    assert.equal(advanceLanding(), null)
    const live = listDeliveries().find((d) => d.deliveryId === delivery.deliveryId)!
    assert.match(live.landing?.why ?? '', /moved again after 3 rebases/)
    assert.equal(live.review?.stopped?.reason, 'landing')
    assert.deepEqual(log(), ['someone else', 'start'])
    // And nothing picks it up again while it waits on the user.
    assert.equal(advanceLanding(), null)
  })
})

describe('a conflict', () => {
  it('is resolved by a session, finished by the board, and reviewed from scratch', () => {
    const first = reviewed(1, 'card one', 'one\n')
    const second = reviewed(2, 'card two', 'two\n')
    assert.equal(advanceLanding()?.action, 'conflict')

    const dir = worktreeDir(second.worktree!)
    const session = run('conflict', 2, 'card two')
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\ntwo\n')
    git(['add', 'shared.txt'], dir)
    end(session)

    assert.equal(advanceLanding()?.action, 'review')
    assert.equal(rebaseInProgress(dir), false)

    const review = run('review', 2, 'card two')
    process.env[RUN_ENV] = review
    cmdReviewVerdict(['2', '--verdict', 'pass'])
    delete process.env[RUN_ENV]
    end(review)
    advanceLanding()

    assert.deepEqual(log(), ['card two (#2)', 'card one (#1)', 'start'])
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'one\ntwo\n')
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.equal(landingOf(second.deliveryId)?.status, 'landed')
  })

  it('leaves a question and the branch whole when it stays unresolved', () => {
    reviewed(1, 'card one', 'one\n')
    const second = reviewed(2, 'card two', 'two\n')
    advanceLanding()

    const session = run('conflict', 2, 'card two')
    end(session, 'error')
    assert.equal(advanceLanding(), null)

    const live = listDeliveries().find((d) => d.deliveryId === second.deliveryId)!
    assert.equal(live.landing?.status, 'conflict')
    assert.equal(live.review?.stopped?.reason, 'landing')
    assert.equal(rebaseInProgress(worktreeDir(second.worktree!)), false)
    // Its work is still whole on its own branch, and the card carries the question.
    assert.deepEqual(log(second.branch!), ['card two (#2)', 'start'])
    const text = fs.readFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '2-card.md'), 'utf8')
    assert.match(text, /\[user\] Delivery .* could not land on main/)
  })
})

describe('picking up after a crash', () => {
  it('puts an interrupted rebase back and lets the landing try again', () => {
    reviewed(1, 'card one', 'one\n')
    const second = reviewed(2, 'card two', 'two\n')
    advanceLanding()
    const dir = worktreeDir(second.worktree!)
    assert.equal(rebaseInProgress(dir), true)

    // Nothing is running: the process that would have resolved it died.
    const said = repairLanding()
    assert.equal(said.length, 1)
    assert.match(said[0]!, /left half-done and has been put back/)
    assert.equal(rebaseInProgress(dir), false)
    assert.equal(landingOf(second.deliveryId)?.status, 'waiting')
    assert.deepEqual(log(second.branch!), ['card two (#2)', 'start'])

    // And the landing is simply tried again.
    assert.equal(advanceLanding()?.action, 'conflict')
  })
})
