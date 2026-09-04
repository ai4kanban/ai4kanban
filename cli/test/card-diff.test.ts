// A delivery's diff on the card (#305).
//
// Every question here is a git question — what the branch holds against its base, what the
// squash commit holds against the tip it landed onto, what a working tree with a brand new
// file in it looks like — so the board is a real repository with real worktrees.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { activeDelivery, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { deliveryDiff } from '../src/lib/view/diff.ts'
import { findCard } from '../src/lib/view/read.ts'

let root = ''

const card = (id: number, title: string): string =>
  [
    '---',
    `title: ${title}`,
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
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-diff-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md'), card(1, 'card one'))
  setAutoCommit(true)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function run(action: AgentAction, id: number, title: string): string {
  const opened = openRun({ action, id, title }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status: 'done', ok: true, code: 0 })
}

// Build the card and pass its review, leaving `write` behind in whichever checkout the
// delivery works in.
async function reviewed(
  write: (dir: string) => void,
  reviewWrite?: (dir: string) => void,
): Promise<DeliveryRecord> {
  const built = run('implement', 1, 'card one')
  const delivery = activeDelivery(1)!
  const dir = delivery.worktree ? worktreeDir(delivery.worktree) : root
  write(dir)
  await end(built)
  const review = run('review', 1, 'card one')
  reviewWrite?.(dir)
  await end(review)
  return delivery
}

const recordOf = (deliveryId: string): DeliveryRecord =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)!

function reviewFlow(): string {
  const sink = startCollecting()
  try {
    printFlow({ action: 'review', id: 1, title: 'card one' })
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

describe('while a delivery builds', () => {
  it('keeps technical discoveries with the reviewing agent', async () => {
    await reviewed(() => {})

    const flow = reviewFlow()
    assert.match(flow, /answered material decision surfaced by the build/)
    assert.match(flow, /resolve technical details yourself/)
    assert.doesNotMatch(flow, /needs awareness but no decision/)
  })

  it('diffs its own branch against the base it forked from', async () => {
    const delivery = await reviewed((dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n'))

    const diff = deliveryDiff(delivery.deliveryId)!
    assert.equal(diff.id, delivery.deliveryId)
    assert.match(diff.stat, /1 file changed/)
    assert.match(diff.diff, /^\+one$/m)
    assert.match(diff.diff, /^-base$/m)
    // Committed on its branch, so nothing here is called uncommitted.
    assert.equal(diff.uncommitted, undefined)

    const flow = reviewFlow()
    assert.match(flow, /shared\.txt \(\+1 -1\)/)
    assert.match(flow, /diff:/)
    assert.match(flow, /^\s*\+one$/m)
  })

  it('leaves the board out of it', async () => {
    const delivery = await reviewed((dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n'))
    assert.equal(deliveryDiff(delivery.deliveryId)!.diff.includes('docs/kanban'), false)
  })

  it('commits fixes made by the review before landing', async () => {
    const delivery = await reviewed(
      (dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'built\n'),
      (dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'fixed by review\n'),
    )

    const diff = deliveryDiff(delivery.deliveryId)!
    assert.match(diff.diff, /^\+fixed by review$/m)
    assert.doesNotMatch(diff.diff, /^\+built$/m)
    assert.equal(git(['status', '--porcelain'], worktreeDir(delivery.worktree!)), '')
  })

  it('says so plainly when the worktree is gone', async () => {
    const delivery = await reviewed((dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n'))
    fs.rmSync(worktreeDir(delivery.worktree!), { recursive: true, force: true })

    const diff = deliveryDiff(delivery.deliveryId)!
    assert.match(diff.note ?? '', /worktree is gone/)
    assert.equal(diff.diff, '')
  })

  it('is nothing at all for a delivery nobody has heard of', async () => {
    assert.equal(deliveryDiff('d-nope'), null)
  })
})

describe('manual commit mode', () => {
  beforeEach(() => setAutoCommit(false))

  it('snapshots the working tree, counts in the files git has never seen, and labels it', async () => {
    const delivery = await reviewed((dir) => {
      fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n')
      fs.writeFileSync(path.join(dir, 'brand-new.txt'), 'whole new module\n')
    })
    assert.equal(delivery.worktree, undefined)

    const diff = deliveryDiff(delivery.deliveryId)!
    assert.equal(diff.uncommitted, true)
    assert.match(diff.stat, /1 new file not yet added/)
    // Both halves: the tracked change, and the file a plain diff against the base cannot
    // show at all.
    assert.match(diff.diff, /^\+one$/m)
    assert.match(diff.diff, /brand-new\.txt/)
    assert.match(diff.diff, /^\+whole new module$/m)

    const flow = reviewFlow()
    assert.match(flow, /shared\.txt \(\+1 -1\)/)
    assert.match(flow, /brand-new\.txt \(\+1 -0, new\)/)
  })
})

describe('once it has landed', () => {
  it('diffs the commit that landed against the tip it landed onto', async () => {
    const delivery = await reviewed((dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n'))
    await advanceLanding()
    const landing = recordOf(delivery.deliveryId).landing!
    assert.equal(landing.status, 'landed')

    // The worktree and the branch are gone, so this can only be the commit's own diff.
    const diff = deliveryDiff(delivery.deliveryId)!
    assert.match(diff.stat, /1 file changed/)
    assert.match(diff.diff, /^\+one$/m)
    assert.match(diff.whole ?? '', /^$|git diff/)
  })

  it('is reachable from the card, which still names the delivery that landed', async () => {
    const delivery = await reviewed((dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n'))
    await advanceLanding()
    // The board archives a landed card in the same breath, so the card page only ever sees
    // this in the blink between the two — or when the archive itself could not be made,
    // which is the state put back here.
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md'), card(1, 'card one'))

    const finished = findCard(1)!.finished!
    assert.equal(finished.id, delivery.deliveryId)
    assert.equal(finished.commit, recordOf(delivery.deliveryId).landing!.commit)
    assert.equal(finished.targetBranch, 'main')
    assert.ok(deliveryDiff(finished.id))
  })

  it('says so plainly when the commit is no longer there', async () => {
    const delivery = await reviewed((dir) => fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n'))
    await advanceLanding()
    // Rewritten history: the commit that landed is not in this repository any more.
    withStore((store) => {
      const held = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)!
      held.landing!.commit = '0'.repeat(40)
    })

    const diff = deliveryDiff(delivery.deliveryId)!
    assert.match(diff.note ?? '', /can no longer be read/)
    assert.equal(diff.diff, '')
  })
})

describe('a diff too long for the page', () => {
  it('is cut at a line, and says where the whole of it is', async () => {
    const delivery = await reviewed((dir) =>
      fs.writeFileSync(path.join(dir, 'shared.txt'), Array.from({ length: 40_000 }, (_, i) => `line ${i}`).join('\n')),
    )

    const diff = deliveryDiff(delivery.deliveryId)!
    assert.equal(diff.truncated, true)
    assert.ok(diff.diff.length < 130_000)
    assert.ok(diff.diff.endsWith('\n'))
    assert.match(diff.whole ?? '', /git -C .* diff [0-9a-f]{7}\.\.card\/1\//)

    const flow = reviewFlow()
    assert.match(flow, /shared\.txt \(\+40000 -1\)/)
    assert.match(flow, /diff omitted at/)
    assert.doesNotMatch(flow, /line 39999/)
  })
})
