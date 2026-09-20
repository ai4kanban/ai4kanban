// Landing a reviewed delivery on the target branch (#304).
//
// The board here is a real git repository with real worktrees, because every question this
// file asks is a git question: what the target branch ends up holding, whether the user's
// own checkout followed it, and what is left behind afterwards.

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { activeDelivery, adoptDirectCard, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { advanceLanding, repairLanding } from '../src/lib/agent/landing.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { rebaseInProgress, worktreeDir } from '../src/lib/agent/worktree.ts'
import type { AgentAction, DeliveryRecord } from '../src/lib/agent/types.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'

let root = ''

// PATH as the suite found it, and the throwaway `git` shims one test puts in front of it.
const PATH = process.env.PATH ?? ''
const shims: string[] = []

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
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  process.env.PATH = PATH
  for (const dir of shims) fs.rmSync(dir, { recursive: true, force: true })
  shims.length = 0
})

// One session of a delivery, opened and closed the way the command and the watcher do.
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

async function passReview(id: number, title: string): Promise<string> {
  const review = run('review', id, title)
  await end(review)
  return review
}

// Build a card and pass its review: everything that happens before a landing.
async function reviewed(id: number, title: string, text: string, file = 'shared.txt'): Promise<DeliveryRecord> {
  const built = run('implement', id, title)
  const delivery = activeDelivery(id)!
  fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), file), text)
  await end(built)
  await passReview(id, title)
  return delivery
}

const landingOf = (deliveryId: string): DeliveryRecord['landing'] =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)?.landing

const statusOf = (deliveryId: string): string =>
  listDeliveries().find((d) => d.deliveryId === deliveryId)!.status

const log = (ref = 'main'): string[] => git(['log', '--format=%s', ref]).split('\n')

const cardPath = (id: number): string => path.join(root, 'docs', 'kanban', 'todo', 'features', `${id}-card.md`)

const cardText = (id: number): string => fs.readFileSync(cardPath(id), 'utf8')

const write = (id: number, title: string): void => fs.writeFileSync(cardPath(id), card(id, title))

// Where the card page would say this delivery stands (`agent/pause.ts`).
const stageOf = (deliveryId: string): string =>
  deliveryState(listDeliveries().find((d) => d.deliveryId === deliveryId)!, 0).stage

// The clock, moved on to the end of a conflict's wait. Real time would cost the suite a
// minute of doing nothing, and the wait is the only thing being held still.
const waitOver = (deliveryId: string): void => {
  withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)!
    delivery.landing!.conflictAt = Date.now() - 1
  })
}

// The same, for the wait a moved target branch leaves behind (#665).
const retryOver = (deliveryId: string): void => {
  withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)!
    delivery.landing!.retryAt = Date.now() - 1
  })
}

// Move `main` on once, in the middle of the landing pass that is running — the race the
// landing cannot win, at a moment a test cannot otherwise pick. Landing's own git calls run
// with hooks off, so the seam is a `git` in front of the real one on PATH: it moves the
// branch around the single command named here and then steps out of the way. The commit it
// makes carries the tree `main` already has, so only the ref moves.
const GIT = (spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout || '').trim()

const raceOn = (arg: string, when: 'before' | 'after'): void => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-race-'))
  const mark = path.join(bin, 'armed')
  fs.writeFileSync(mark, '')
  const move = [
    `T=$("${GIT}" -C "${root}" rev-parse main^{tree})`,
    `C=$("${GIT}" -C "${root}" commit-tree "$T" -p main -m 'someone else')`,
    `"${GIT}" -C "${root}" update-ref refs/heads/main "$C"`,
  ].join('\n')
  fs.writeFileSync(
    path.join(bin, 'git'),
    [
      '#!/bin/sh',
      `case " $* " in *" ${arg} "*)`,
      `  if [ -f "${mark}" ]; then`,
      `    rm -f "${mark}"`,
      ...(when === 'before' ? [move, `    exec "${GIT}" "$@"`] : [`    "${GIT}" "$@"; s=$?`, move, '    exit $s']),
      '  fi',
      '  ;;',
      'esac',
      `exec "${GIT}" "$@"`,
      '',
    ].join('\n'),
  )
  fs.chmodSync(path.join(bin, 'git'), 0o755)
  shims.push(bin)
  process.env.PATH = `${bin}:${process.env.PATH}`
}

// A build with no card (#428): a **Build now** run that ended before it wrote its own card
// (#470). It lands the same way and leaves nothing on the board behind it — there is no card
// to hold, none to put back, and none to archive.
describe('a build with no card', () => {
  const typed = 'Rename the Runs panel heading to Activity'

  // And the ordinary way round: the run writes its card first, so the delivery lands on a
  // card and archives it — still with nothing reviewing or approving the work (#470).
  it('archives the card its run wrote, and is reviewed by nothing on the way', async () => {
    const opened = openRun({ action: 'implement', description: typed }, 'prompt', [])
    assert.ok(!('error' in opened), 'a card-less build should start')
    const built = (opened as { run: { sessionId: string } }).run.sessionId
    const delivery = listDeliveries().find((d) => d.cardId === null && d.status === 'active')!

    // What the run's first act leaves behind: the card, and the board handing it to the
    // delivery already in flight.
    const file = path.join(root, 'docs', 'kanban', 'todo', 'features', '3-direct.md')
    fs.writeFileSync(file, card(3, typed))
    assert.equal(adoptDirectCard(built, 3), true)
    assert.equal(activeDelivery(3)?.deliveryId, delivery.deliveryId)

    fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), 'renamed\n')
    await end(built)
    const live = listDeliveries().find((d) => d.deliveryId === delivery.deliveryId)!
    assert.equal(live.aiReview, false, 'the card arriving must not turn review on')
    assert.equal(live.approval?.required, false)
    assert.equal(live.landing?.status, 'waiting', 'it goes straight to landing, unreviewed')

    assert.equal(await advanceLanding(), null)
    assert.equal(statusOf(delivery.deliveryId), 'finished')
    assert.equal(fs.existsSync(file), false, 'the card it wrote is archived with the delivery')
  })

  it('lands its own commit, named by the delivery, and archives nothing', async () => {
    const opened = openRun({ action: 'implement', description: typed }, 'prompt', [])
    assert.ok(!('error' in opened), 'a card-less build should start')
    const built = (opened as { run: { sessionId: string } }).run.sessionId
    const delivery = listDeliveries().find((d) => d.cardId === null && d.status === 'active')!

    // Its checkout and its branch are named by the delivery — there is no card number.
    assert.equal(delivery.worktree, `.akb/worktrees/delivery/${delivery.deliveryId}`)
    assert.equal(delivery.branch, `delivery/${delivery.deliveryId}`)
    // And nothing gates it: no review run reads the code, nothing waits to be approved.
    assert.equal(delivery.aiReview, false)
    assert.equal(delivery.approval?.required, false)

    fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), 'renamed\n')
    await end(built)
    // The build itself finishes the delivery's work — it queues to land with no review.
    assert.equal(landingOf(delivery.deliveryId)?.status, 'waiting')

    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
    assert.equal(statusOf(delivery.deliveryId), 'finished')
    assert.deepEqual(log(), [typed, 'start'])
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'renamed\n')
    // Nothing was written to the board: the two cards the fixture set up are still the
    // only ones there.
    assert.deepEqual(
      fs.readdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features')).sort(),
      ['1-card.md', '2-card.md'],
    )
  })

  it('is reviewed and landed by its own id when a landing has to be put back in motion', async () => {
    const opened = openRun({ action: 'implement', description: typed }, 'prompt', [])
    const built = (opened as { run: { sessionId: string } }).run.sessionId
    const delivery = listDeliveries().find((d) => d.cardId === null && d.status === 'active')!
    fs.writeFileSync(path.join(worktreeDir(delivery.worktree!), 'shared.txt'), 'renamed\n')
    await end(built)

    // What `akb delivery review <delivery>` opens: a review run named by the delivery,
    // never by a card there is none of.
    const review = openRun(
      { action: 'review', deliveryId: delivery.deliveryId, title: typed },
      'prompt',
      [],
    )
    assert.ok(!('error' in review), 'the review should join the delivery it names')
    assert.equal(
      listDeliveries().find((d) => d.deliveryId === delivery.deliveryId)!.sessions.length,
      2,
    )
    await end((review as { run: { sessionId: string } }).run.sessionId)
    assert.equal(await advanceLanding(), null)
    assert.equal(statusOf(delivery.deliveryId), 'finished')
  })
})

describe('one card at a time', () => {
  it('lands as one squash commit and takes the delivery with it', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    assert.equal(landingOf(delivery.deliveryId)?.status, 'waiting')

    assert.equal(await advanceLanding(), null)

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

  it('records the commit, the base it landed against and the check that let it', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    const before = git(['rev-parse', 'main'])
    await advanceLanding()
    const landing = landingOf(delivery.deliveryId)!
    assert.equal(landing.onto, before)
    assert.equal(landing.commit, git(['rev-parse', 'main']))
    assert.equal(landing.checks?.length, 1)
    assert.equal(landing.checks?.[0]?.ok, true)
  })

  // The user's own work in the checkout (#958). A landing is a fast-forward, so it walks
  // straight past changes on paths the landed commit does not touch, and stops only where
  // it would write over one. Nothing here is ever committed, stashed or discarded for them.
  it('lands past the user\'s staged, unstaged and untracked work on other paths', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    fs.writeFileSync(path.join(root, 'staged.txt'), 'staged\n')
    git(['add', 'staged.txt'])
    fs.writeFileSync(path.join(root, 'mergeable.txt'), 'unstaged\n')
    fs.writeFileSync(path.join(root, 'untracked.txt'), 'untracked\n')
    // Half of one file staged and half of it not — the split has to survive too.
    fs.writeFileSync(path.join(root, 'split.txt'), 'first\n')
    git(['add', 'split.txt'])
    fs.writeFileSync(path.join(root, 'split.txt'), 'first\nsecond\n')

    await advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    // Every file, and the staged/unstaged split, exactly as the user left it.
    assert.equal(fs.readFileSync(path.join(root, 'staged.txt'), 'utf8'), 'staged\n')
    assert.equal(fs.readFileSync(path.join(root, 'mergeable.txt'), 'utf8'), 'unstaged\n')
    assert.equal(fs.readFileSync(path.join(root, 'untracked.txt'), 'utf8'), 'untracked\n')
    assert.equal(fs.readFileSync(path.join(root, 'split.txt'), 'utf8'), 'first\nsecond\n')
    assert.equal(git(['diff', '--cached', '--name-only']), ['split.txt', 'staged.txt'].join('\n'))
    assert.equal(git(['diff', '--name-only']), ['mergeable.txt', 'split.txt'].join('\n'))
  })

  it('waits, holding no slot, when landing would overwrite a change of the user\'s', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    fs.writeFileSync(path.join(root, 'shared.txt'), 'mine\n')

    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'waiting')
    assert.match(landingOf(first.deliveryId)?.why ?? '', /^your changes to `shared\.txt` in your checkout would be overwritten by landing — commit or stash it$/)
    assert.deepEqual(landingOf(first.deliveryId)?.wait, { kind: 'overwrite', files: ['shared.txt'] })
    assert.deepEqual(log(), ['start'])
    // Their change is still theirs: not committed, not stashed, not reverted.
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'mine\n')
    assert.equal(git(['stash', 'list']), '')

    // Stashed, and the next pass lands it. (Committing instead moves the target branch, so
    // that path rebases and reviews again — "a target branch that moved" below.)
    git(['checkout', '--quiet', '--', 'shared.txt'])
    await advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.equal(landingOf(first.deliveryId)?.wait, undefined)
    assert.deepEqual(log(), ['card one (#1)', 'start'])
  })

  it('waits when the landed commit adds a path the user already has a file on', async () => {
    const first = await reviewed(1, 'card one', 'one\n', 'fresh.txt')
    fs.writeFileSync(path.join(root, 'fresh.txt'), 'mine\n')

    assert.equal(await advanceLanding(), null)
    assert.match(landingOf(first.deliveryId)?.why ?? '', /^`fresh\.txt` in your checkout is not in git, and landing would write over it — move or delete it$/)
    assert.deepEqual(landingOf(first.deliveryId)?.wait, { kind: 'untracked', files: ['fresh.txt'] })
    assert.equal(fs.readFileSync(path.join(root, 'fresh.txt'), 'utf8'), 'mine\n')
    assert.deepEqual(log(), ['start'])

    fs.rmSync(path.join(root, 'fresh.txt'))
    await advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
  })

  // Both refusals in one message, which git really does write when both apply. The kind has
  // to be read off the heading the listed files sit under: paired with the other heading's,
  // a change of the user's reads back as a file of theirs to move or delete.
  it('names the change of the user\'s when git refuses over both at once', async () => {
    const built = run('implement', 1, 'card one')
    const delivery = activeDelivery(1)!
    const dir = worktreeDir(delivery.worktree!)
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n')
    fs.writeFileSync(path.join(dir, 'fresh.txt'), 'added\n')
    await end(built)
    await passReview(1, 'card one')
    fs.writeFileSync(path.join(root, 'shared.txt'), 'mine\n')
    fs.writeFileSync(path.join(root, 'fresh.txt'), 'mine too\n')

    assert.equal(await advanceLanding(), null)
    assert.deepEqual(landingOf(delivery.deliveryId)?.wait, { kind: 'overwrite', files: ['shared.txt'] })
    assert.match(landingOf(delivery.deliveryId)?.why ?? '', /commit or stash it$/)
    assert.equal(fs.readFileSync(path.join(root, 'fresh.txt'), 'utf8'), 'mine too\n')
  })

  // An IGNORED file of theirs on a path the landed commit writes. Git guards an untracked
  // file and refuses; an ignored one it overwrites without a word, so this is the one thing
  // a fast-forward would destroy in silence — and it is asked for before the move.
  it('waits rather than write over an ignored file of the user\'s', async () => {
    fs.appendFileSync(path.join(root, '.gitignore'), 'secret.env\n')
    git(['add', '.gitignore'])
    git(['commit', '--quiet', '-m', 'ignore secret.env'])
    const built = run('implement', 1, 'card one')
    const delivery = activeDelivery(1)!
    const dir = worktreeDir(delivery.worktree!)
    fs.writeFileSync(path.join(dir, 'secret.env'), 'from the build\n')
    git(['add', '-f', 'secret.env'], dir)
    await end(built)
    await passReview(1, 'card one')
    fs.writeFileSync(path.join(root, 'secret.env'), 'mine\n')

    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'waiting')
    assert.deepEqual(landingOf(delivery.deliveryId)?.wait, { kind: 'untracked', files: ['secret.env'] })
    assert.equal(fs.readFileSync(path.join(root, 'secret.env'), 'utf8'), 'mine\n')
    assert.deepEqual(log(), ['ignore secret.env', 'start'])

    fs.rmSync(path.join(root, 'secret.env'))
    await advanceLanding()
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
    assert.equal(fs.readFileSync(path.join(root, 'secret.env'), 'utf8'), 'from the build\n')
  })

  // `merge.autoStash` on would have git stash the user's change, fast-forward, and re-apply
  // it — and a re-apply that conflicts leaves conflict markers in their file. The landing
  // closes the config on the command, so their setting cannot reach their files.
  it('leaves the checkout alone even with merge.autoStash on', async () => {
    git(['config', 'merge.autoStash', 'true'])
    const first = await reviewed(1, 'card one', 'one\n')
    fs.writeFileSync(path.join(root, 'shared.txt'), 'mine\n')

    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'waiting')
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'mine\n')
    assert.equal(git(['stash', 'list']), '')
    assert.deepEqual(log(), ['start'])
  })

  // The target branch checked out somewhere else of the user's. Moving the ref under it
  // would leave that working tree reading as a checkout full of changes nobody made, so the
  // fast-forward is run there instead — the same move, in the checkout it belongs to.
  it('fast-forwards the worktree the target branch is checked out in', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-elsewhere-'))
    git(['checkout', '--quiet', '-b', 'scratch'])
    git(['worktree', 'add', '--quiet', elsewhere, 'main'])

    await advanceLanding()
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
    assert.deepEqual(log('main'), ['card one (#1)', 'start'])
    assert.equal(fs.readFileSync(path.join(elsewhere, 'shared.txt'), 'utf8'), 'one\n')
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: elsewhere, encoding: 'utf8' }).stdout, '')
    git(['worktree', 'remove', '--force', elsewhere])
  })

  it('lands over the board\'s own staged files, which never land themselves', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    git(['add', path.join('docs', 'kanban')])
    assert.notEqual(git(['diff', '--cached', '--name-only']), '')

    await advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    // The fast-forward left the staged card files exactly as they were.
    assert.notEqual(git(['diff', '--cached', '--name-only']), '')
  })

  it('leaves the user\'s own checkout alone when the target is not the branch they have out', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    git(['checkout', '--quiet', '-b', 'scratch'])

    await advanceLanding()
    assert.deepEqual(log('main'), ['card one (#1)', 'start'])
    assert.deepEqual(log('scratch'), ['start'])
    assert.equal(git(['branch', '--show-current']), 'scratch')
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'base\n')
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
  })
})

describe('a target branch that moved', () => {
  it('warns about overlap, lands the first, and rebases the second', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    assert.equal(first.base, second.base)

    const wants = await advanceLanding()
    // The first landed; the second took the slot and found the target moved under it.
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.deepEqual(landingOf(first.deliveryId)?.overlap, [2])
    assert.equal(landingOf(second.deliveryId)?.status, 'landing')
    assert.deepEqual(log(), ['card one (#1)', 'start'])
    // Both cards changed the same lines, so this one is a conflict rather than a rebase.
    assert.equal(wants?.action, 'conflict')
    assert.equal(wants?.id, 2)
  })

  it('lands with no review when a clean rebase touches different files', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    // A second card that touches a different file rebases cleanly.
    const built = run('implement', 2, 'card two')
    const second = activeDelivery(2)!
    fs.writeFileSync(path.join(worktreeDir(second.worktree!), 'other.txt'), 'two\n')
    await end(built)
    const review = run('review', 2, 'card two')
    await end(review)

    // Nothing the target brought in is a file this delivery changes, so the verdict it
    // already has still covers the tree — one pass rebases and lands it.
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    const landing = landingOf(second.deliveryId)!
    assert.equal(landing.status, 'landed')
    assert.equal(landing.attempts, 1)
    assert.equal(landing.rebaseKind, 'disjoint')
    assert.equal(landing.rebasedFrom, first.base)
    assert.deepEqual(log(), ['card two (#2)', 'card one (#1)', 'start'])
    // The one review it ever needed is the one it passed in its worktree.
    assert.equal(landing.checks?.length, 1)
  })

  it('lands with no review when a clean rebase touches the same file', async () => {
    const base = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
    const firstText = [...base]
    firstText[1] = 'first changed this'
    const secondText = [...base]
    secondText[18] = 'second changed this'
    const first = await reviewed(1, 'card one', `${firstText.join('\n')}\n`, 'mergeable.txt')
    const second = await reviewed(2, 'card two', `${secondText.join('\n')}\n`, 'mergeable.txt')

    // Git composed both edits by itself, so the verdict this delivery already has still
    // covers the tree — sharing a file is no longer a reason to judge it again (#665).
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    const landing = landingOf(second.deliveryId)!
    assert.equal(landing.status, 'landed')
    assert.equal(landing.attempts, 1)
    // The overlap is still written down — it is what the replay WAS, not a gate on it.
    assert.equal(landing.rebaseKind, 'overlap')
    assert.equal(landing.rebasedFrom, first.base)
    assert.deepEqual(log(), ['card two (#2)', 'card one (#1)', 'start'])
    // The one review it ever needed is the one it passed in its worktree.
    assert.equal(landing.checks?.length, 1)
  })

  it('lands even when the file comparison cannot be read', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    const built = run('implement', 2, 'card two')
    const second = activeDelivery(2)!
    fs.writeFileSync(path.join(worktreeDir(second.worktree!), 'other.txt'), 'two\n')
    await end(built)
    await passReview(2, 'card two')
    // Git cannot say which files either side changed, because the ref the comparison names
    // is not there.
    withStore((store) => {
      store.deliveries.find((d) => d.deliveryId === second.deliveryId)!.branch = 'no-such-branch'
    })

    // The record notes that as `overlap`, the honest answer when the comparison could not be
    // made — and the rebase git composed without a conflict lands all the same (#665).
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.equal(landingOf(second.deliveryId)?.status, 'landed')
    assert.equal(landingOf(second.deliveryId)?.rebaseKind, 'overlap')
  })

  it('waits and retries, rather than asking, when the target moves under the move', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    // Off main, so the landing moves the ref rather than fast-forwarding a checkout — and
    // the ref move is the write that loses the race.
    git(['checkout', '--quiet', '-b', 'scratch'])
    raceOn('--no-verify', 'before')

    assert.equal(await advanceLanding(), null)
    // Nothing asked, nothing stopped: the slot went back and the next attempt is a wait away.
    const landing = landingOf(delivery.deliveryId)!
    assert.equal(landing.status, 'waiting')
    assert.match(landing.why ?? '', /moved again while this landing was going through/)
    const wait = landing.retryAt! - Date.now()
    assert.ok(wait > 0 && wait <= 15_000, `the first wait was ${wait}ms`)
    assert.equal(listDeliveries().find((d) => d.deliveryId === delivery.deliveryId)!.review?.stopped, undefined)
    assert.doesNotMatch(cardText(1), /\[user\]/)
    assert.equal(stageOf(delivery.deliveryId), 'retry')
    // And nothing picks it up while it waits.
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'waiting')

    // The wait is over: it replays onto the new tip and lands, with no review in between.
    retryOver(delivery.deliveryId)
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
    assert.equal(landingOf(delivery.deliveryId)?.retryAt, undefined)
    assert.deepEqual(log(), ['card one (#1)', 'someone else', 'start'])
  })

  it('waits rather than rebasing twice in one pass', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    // Someone else commits first, so this pass has to rebase — and main moves again the
    // moment that rebase finishes, so the pass's second look finds the target gone once more.
    fs.writeFileSync(path.join(root, 'other.txt'), 'someone else\n')
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'someone else'])
    raceOn('--onto', 'after')

    assert.equal(await advanceLanding(), null)
    const landing = landingOf(delivery.deliveryId)!
    assert.equal(landing.status, 'waiting')
    assert.equal(landing.attempts, 1, 'one rebase per pass, and the next one is a wait away')
    assert.ok(landing.retryAt! > Date.now())
    assert.equal(stageOf(delivery.deliveryId), 'retry')

    retryOver(delivery.deliveryId)
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
  })
})

describe('queued behind the slot', () => {
  // The slot's holder, stopped for the review its overlapping rebase owes — so it keeps the
  // slot across every pass, which is exactly when a waiter is never looked at.
  async function holdTheSlot(): Promise<{ first: DeliveryRecord; session: string }> {
    const first = await reviewed(1, 'card one', 'card one\n')
    // Someone else changed the same lines, so the rebase stops on a conflict and an agent
    // opens on it — a run of its own, which holds the slot across every pass.
    fs.writeFileSync(path.join(root, 'shared.txt'), 'someone else\n')
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'someone else'])
    assert.equal((await advanceLanding())?.action, 'conflict')
    const session = run('conflict', 1, 'card one')
    assert.equal(landingOf(first.deliveryId)?.status, 'landing')
    return { first, session }
  }

  async function waiting(): Promise<DeliveryRecord> {
    const built = run('implement', 2, 'card two')
    const second = activeDelivery(2)!
    fs.writeFileSync(path.join(worktreeDir(second.worktree!), 'other.txt'), 'two\n')
    await end(built)
    await passReview(2, 'card two')
    return second
  }

  it('says which card it is behind rather than nothing at all', async () => {
    await holdTheSlot()
    const second = await waiting()

    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(second.deliveryId)?.status, 'waiting')
    assert.match(landingOf(second.deliveryId)?.why ?? '', /^in line behind #1 —/)
  })

  it('replaces the refusal of the last pass that looked at it', async () => {
    await holdTheSlot()
    const second = await waiting()
    // What the queue used to leave on the card: a refusal from before the slot was taken,
    // naming a checkout the user has since cleaned up.
    withStore((store) => {
      store.deliveries.find((d) => d.deliveryId === second.deliveryId)!.landing!.why =
        'your checkout has uncommitted changes in 10 files — commit or stash them'
    })

    assert.equal(await advanceLanding(), null)
    assert.match(landingOf(second.deliveryId)?.why ?? '', /^in line behind #1 —/)
  })

  it('drops the note as soon as the slot is its own', async () => {
    const { first, session } = await holdTheSlot()
    const second = await waiting()
    assert.equal(await advanceLanding(), null)
    assert.match(landingOf(second.deliveryId)?.why ?? '', /^in line behind #1/)

    // The conflict is resolved, and the delivery in front lands.
    const dir = worktreeDir(first.worktree!)
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'someone else\ncard one\n')
    git(['add', 'shared.txt'], dir)
    await end(session)
    assert.equal((await advanceLanding())?.action, 'review')
    await passReview(1, 'card one')
    await advanceLanding()
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.doesNotMatch(landingOf(second.deliveryId)?.why ?? '', /^in line behind/)
  })

  it('leaves a delivery waiting on a person out of the queue', async () => {
    await holdTheSlot()
    const second = await waiting()
    // Its own landing already handed over to the user; the queue is not what it waits on.
    withStore((store) => {
      const live = store.deliveries.find((d) => d.deliveryId === second.deliveryId)!
      live.landing!.why = 'a tree nobody could commit is waiting on you'
      live.review = { ...(live.review ?? { rounds: [] }), stopped: { reason: 'landing', why: 'x', at: 1 } }
    })

    assert.equal(await advanceLanding(), null)
    assert.match(landingOf(second.deliveryId)?.why ?? '', /^a tree nobody could commit/)
  })
})

describe('a conflict', () => {
  it('allows only one concurrent landing pass in this process', async () => {
    await reviewed(1, 'card one', 'one\n')
    await reviewed(2, 'card two', 'two\n')
    const requests = await Promise.all([advanceLanding(), advanceLanding()])
    assert.equal(requests.filter((r) => r?.action === 'conflict').length, 1)
    assert.equal(requests.filter((r) => r === null).length, 1)
  })

  it('leaves another process’s rebase alone, including during startup recovery', async () => {
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    await advanceLanding()
    const dir = worktreeDir(second.worktree!)
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\ntwo\n')
    git(['add', 'shared.txt'], dir)
    const lock = path.join(SESSIONS_DIR, '.landing.lock')
    const child = spawn(process.execPath, ['-e', `
      const fs = require('node:fs');
      const dir = process.argv[1];
      fs.mkdirSync(dir);
      fs.writeFileSync(dir + '/' + process.pid + '-' + require('node:crypto').randomUUID(), '');
      process.send('locked');
      process.on('message', () => process.exit(0));
    `, lock], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] })
    try {
      await once(child, 'message')
      const old = new Date(Date.now() - 120_000)
      fs.utimesSync(lock, old, old)
      assert.equal(await advanceLanding(), null)
      assert.deepEqual(repairLanding(), [])
      assert.equal(rebaseInProgress(dir), true)
      assert.equal(fs.readFileSync(path.join(dir, 'shared.txt'), 'utf8'), 'one\ntwo\n')
    } finally {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
    // The dead owner leaves its lock behind; the next pass recovers it.
    assert.equal((await advanceLanding())?.action, 'review')
    assert.equal(fs.existsSync(lock), false)
    await passReview(2, 'card two')
    await advanceLanding()
    assert.equal(landingOf(second.deliveryId)?.status, 'landed')
  })

  it('is resolved by a session and reviewed again before landing', async () => {
    const first = await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    assert.equal((await advanceLanding())?.action, 'conflict')

    const dir = worktreeDir(second.worktree!)
    const session = run('conflict', 2, 'card two')
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\ntwo\n')
    git(['add', 'shared.txt'], dir)
    await end(session)

    // The board finishes the rebase, then reviews the composed tree before landing it. A
    // resolved conflict names itself rather than reading as an ordinary rebase (#417).
    const wants = await advanceLanding()
    assert.equal(wants?.action, 'review')
    assert.equal(wants?.id, 2)
    assert.equal(wants?.trigger, 'conflict')
    assert.equal(rebaseInProgress(dir), false)

    // And that review is briefed on the intersection, not on the delivery all over again.
    const sink = startCollecting()
    try {
      printFlow({ action: 'review', id: 2, title: 'card two' })
    } finally {
      stopCollecting()
    }
    const brief = sink.out.join('\n')
    assert.match(brief, /focused post-rebase review after a conflict an agent resolved/)
    assert.match(brief, /shared paths?: shared\.txt/)
    assert.match(brief, /target delta: `git diff /)
    assert.match(brief, /patch omitted for this focused rebase review/)
    assert.doesNotMatch(brief, /build THIS, not the card file/)
    // And so is the ask: it never claims the print carries the approved requirements.
    assert.match(brief, /Judge only how those changes interact/)
    assert.doesNotMatch(brief, /supplies the approved requirements/)

    // If the caller dies before starting that review, another landing tick cannot reuse the
    // verdict from before the rebase.
    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(second.deliveryId)?.status, 'landing')
    await passReview(2, 'card two')
    assert.equal(await advanceLanding(), null)


    assert.deepEqual(log(), ['card two (#2)', 'card one (#1)', 'start'])
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'one\ntwo\n')
    assert.equal(landingOf(first.deliveryId)?.status, 'landed')
    assert.equal(landingOf(second.deliveryId)?.status, 'landed')
  })

  it('waits before reopening an unresolved conflict, and never asks the user', async () => {
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    await advanceLanding()

    await end(run('conflict', 2, 'card two'), 'error')
    // No second run back to back: the slot goes back and the next attempt is a wait away.
    assert.equal(await advanceLanding(), null)
    const first = landingOf(second.deliveryId)!
    assert.equal(first.status, 'waiting')
    assert.equal(first.conflictFails, 1)
    const wait = first.conflictAt! - Date.now()
    assert.ok(wait > 0 && wait <= 15_000, `first wait was ${wait}ms`)
    assert.equal(await advanceLanding(), null)

    // The work and the rebase are untouched, and nothing was asked of anybody.
    assert.equal(listDeliveries().find((d) => d.deliveryId === second.deliveryId)!.review?.stopped, undefined)
    assert.equal(rebaseInProgress(worktreeDir(second.worktree!)), true)
    assert.deepEqual(log(second.branch!), ['card two (#2)', 'start'])
    assert.doesNotMatch(cardText(2), /\[user\]/)

    // The wait is over: the agent opens again, and the wait after the next failure is longer.
    waitOver(second.deliveryId)
    assert.equal((await advanceLanding())?.action, 'conflict')
    assert.equal(landingOf(second.deliveryId)?.conflictAt, undefined)
    await end(run('conflict', 2, 'card two'), 'error')
    assert.equal(await advanceLanding(), null)
    const again = landingOf(second.deliveryId)!
    assert.equal(again.conflictFails, 2)
    assert.ok(again.conflictAt! - Date.now() > 15_000, 'the second wait is longer than the first')
    assert.doesNotMatch(cardText(2), /\[user\]/)
  })

  it('gives the landing slot up while it waits, and says so rather than "in line"', async () => {
    write(3, 'card three')
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    const third = await reviewed(3, 'card three', 'three\n')
    await advanceLanding()
    await end(run('conflict', 2, 'card two'), 'error')

    // The waiter is passed over and the delivery behind it takes the slot.
    assert.equal((await advanceLanding())?.action, 'conflict')
    assert.equal(landingOf(second.deliveryId)?.status, 'waiting')
    assert.equal(landingOf(third.deliveryId)?.status, 'landing')

    // And the pass that finds the slot taken leaves the waiter's own line alone: it is
    // waiting on its next attempt, not queued behind card three.
    run('conflict', 3, 'card three')
    assert.equal(await advanceLanding(), null)
    assert.match(landingOf(second.deliveryId)?.why ?? '', /is not resolved yet/)
    assert.equal(stageOf(second.deliveryId), 'retry')
    assert.equal(stageOf(third.deliveryId), 'conflict')

    // Still its own line once the wait is over and the slot is somebody else's: the failure
    // is what the next attempt opens on, and the queue must not write over it.
    waitOver(second.deliveryId)
    assert.equal(await advanceLanding(), null)
    assert.match(landingOf(second.deliveryId)?.why ?? '', /is not resolved yet/)
    assert.equal(stageOf(second.deliveryId), 'retry')
  })

  it('lets a disjoint delivery land while a conflict waits', async () => {
    write(3, 'card three')
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    const third = await reviewed(3, 'card three', 'three\n', 'mergeable.txt')
    await advanceLanding()
    await end(run('conflict', 2, 'card two'), 'error')

    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(third.deliveryId)?.status, 'landed')
    assert.equal(landingOf(second.deliveryId)?.status, 'waiting')
    assert.equal(rebaseInProgress(worktreeDir(second.worktree!)), true)
  })

  it('clears the wait and the failure count once the rebase goes through', async () => {
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    await advanceLanding()
    await end(run('conflict', 2, 'card two'), 'error')
    assert.equal(await advanceLanding(), null)

    waitOver(second.deliveryId)
    assert.equal((await advanceLanding())?.action, 'conflict')
    const dir = worktreeDir(second.worktree!)
    const session = run('conflict', 2, 'card two')
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\ntwo\n')
    git(['add', 'shared.txt'], dir)
    await end(session)

    assert.equal((await advanceLanding())?.action, 'review')
    const landing = landingOf(second.deliveryId)!
    assert.equal(landing.conflictFails, undefined)
    assert.equal(landing.conflictAt, undefined)
    assert.equal(landing.conflictFiles, undefined)
    await passReview(2, 'card two')
    await advanceLanding()
    assert.equal(landingOf(second.deliveryId)?.status, 'landed')
  })

  it('leaves a rebase between two attempts alone as the board comes up', async () => {
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    await advanceLanding()
    const dir = worktreeDir(second.worktree!)
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\n<<<<<<< still conflicted\n')
    await end(run('conflict', 2, 'card two'), 'error')
    assert.equal(await advanceLanding(), null)

    assert.deepEqual(repairLanding(), [])
    assert.equal(rebaseInProgress(dir), true)
    assert.equal(landingOf(second.deliveryId)?.conflictFails, 1)
  })

  it('hands damaged rebase state back to the agent and reviews after recovery', async () => {
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    await advanceLanding()
    const dir = worktreeDir(second.worktree!)
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'one\ntwo\n')
    git(['add', 'shared.txt'], dir)
    const headName = path.resolve(dir, git(['rev-parse', '--git-path', 'rebase-merge/head-name'], dir))
    const saved = fs.readFileSync(headName)
    fs.unlinkSync(headName)

    assert.equal(await advanceLanding(), null)
    const live = listDeliveries().find((d) => d.deliveryId === second.deliveryId)!
    assert.match(live.landing?.why ?? '', /head-name/)
    assert.equal(live.review?.stopped, undefined)
    assert.equal(fs.readFileSync(path.join(dir, 'shared.txt'), 'utf8'), 'one\ntwo\n')
    waitOver(second.deliveryId)
    assert.equal((await advanceLanding())?.action, 'conflict')
    const sink = startCollecting()
    try {
      printFlow({ action: 'conflict', id: 2, deliveryId: second.deliveryId })
    } finally {
      stopCollecting()
    }
    assert.match(sink.out.join('\n'), /head-name/)
    fs.writeFileSync(headName, saved)
    assert.equal((await advanceLanding())?.action, 'review')
    await passReview(2, 'card two')
    await advanceLanding()
    assert.equal(landingOf(second.deliveryId)?.status, 'landed')
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'one\ntwo\n')
  })
})

describe('picking up after a crash', () => {
  it('puts an interrupted rebase back and lets the landing try again', async () => {
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    await advanceLanding()
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
    assert.equal((await advanceLanding())?.action, 'conflict')
  })
})

// The change reached the target branch under someone else's commit while this delivery was
// queued, stopped or ended (#569). There is nothing to land, and the delivery is over.
describe('work that is already on the target branch', () => {
  // Put the delivery's own change on main directly, as a separate commit.
  const alsoOnMain = (text: string, file = 'shared.txt'): string => {
    fs.writeFileSync(path.join(root, file), text)
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'someone else landed it'])
    return git(['rev-parse', 'main'])
  }

  it('ends the delivery on the commit that carries it, and lands nothing', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    const carrier = alsoOnMain('one\n')

    assert.equal(await advanceLanding(), null)

    const landing = landingOf(delivery.deliveryId)!
    assert.equal(landing.status, 'landed')
    assert.equal(landing.commit, carrier, 'the commit that carries the change is the landing')
    assert.equal(landing.onto, carrier)
    assert.match(landing.why ?? '', /already on main/)
    assert.equal(statusOf(delivery.deliveryId), 'finished')
    // Nothing was rebuilt: main still holds one commit of its own, not a squash on top.
    assert.deepEqual(log(), ['someone else landed it', 'start'])
    assert.equal(git(['rev-parse', 'main']), carrier)
  })

  it('archives the card and clears the checkout up after it (#720)', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    alsoOnMain('one\n')
    await advanceLanding()
    assert.equal(fs.existsSync(cardPath(1)), false, 'the card is archived')
    // The change is on main, so the delivery is finished and there is nothing left in its
    // checkout that only its checkout has.
    assert.equal(fs.existsSync(worktreeDir(delivery.worktree!)), false)
    assert.equal(git(['branch', '--list', delivery.branch!]), '')
  })

  it('settles a delivery stopped on a landing conflict instead of resolving it again', async () => {
    await reviewed(1, 'card one', 'one\n')
    const second = await reviewed(2, 'card two', 'two\n')
    // The first lands, so the second meets a conflict on the same file.
    await advanceLanding()
    assert.equal(rebaseInProgress(worktreeDir(second.worktree!)), true)
    assert.equal(landingOf(second.deliveryId)?.conflictFiles?.length, 1)

    // …and while it sits there, the second card's change reaches main by hand.
    const carrier = alsoOnMain('two\n')
    waitOver(second.deliveryId)

    assert.equal(await advanceLanding(), null, 'no conflict run is asked for')
    assert.equal(landingOf(second.deliveryId)?.status, 'landed')
    assert.equal(landingOf(second.deliveryId)?.commit, carrier)
    assert.equal(statusOf(second.deliveryId), 'finished')
    assert.deepEqual(log(), ['someone else landed it', 'card one (#1)', 'start'])
  })

  it('lands the ordinary way when what the delivery built is not there', async () => {
    const delivery = await reviewed(1, 'card one', 'one\n')
    // Main moved on, but not to what this delivery built — so the check must not hold.
    alsoOnMain('a line of its own\n', 'mergeable.txt')

    assert.equal(await advanceLanding(), null)
    assert.equal(landingOf(delivery.deliveryId)?.status, 'landed')
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'one\n')
    assert.equal(log()[0], 'card one (#1)', 'a squash commit really landed')
  })
})
