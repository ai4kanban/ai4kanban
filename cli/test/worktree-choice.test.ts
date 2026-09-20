// Choosing where one build works, on the Implement dialog (#346).
//
// A real git repository, because every question here is a git question: what the dialog is
// told before the click, and what `prepareDelivery` does with the tick after it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { deliveryPlan, prepareDelivery, undoPrepared } from '../src/lib/agent/commit-mode.ts'
import { activeDelivery } from '../src/lib/agent/deliveries.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit, setDiffApproval } from '../src/lib/agent/settings.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

const CARD = [
  '---',
  'title: A card',
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
  '- **A requirement**: one line.',
  '',
].join('\n')

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-worktree-choice-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'code.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '7-a-card.md'), CARD)
  setAutoCommit(true)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('what the dialog is told', () => {
  it('offers the choice, and answers both sides at once', () => {
    setAutoCommit(false)
    setDiffApproval(true)
    const plan = deliveryPlan()
    assert.equal(plan.canChooseWorktree, true)
    // The setting picks the side the box opens on...
    assert.equal(plan.commitMode, 'manual')
    // ...and the other side is answered all the same, so ticking asks nothing more.
    assert.equal(plan.branch, 'main')
    assert.equal(plan.needsApproval, true)
    assert.equal(plan.manualWhy, undefined)
    assert.equal(plan.localChanges, false)
  })

  // What the tick's line adds while the project folder is not clean (#958). It refuses
  // nothing — it is only the difference between two sentences.
  it('says the project folder holds uncommitted changes', () => {
    assert.equal(deliveryPlan().localChanges, false)
    fs.writeFileSync(path.join(root, 'code.txt'), 'edited\n')
    assert.equal(deliveryPlan().localChanges, true)
    // Staged and still uncommitted is uncommitted.
    git(['add', 'code.txt'])
    assert.equal(deliveryPlan().localChanges, true)
    git(['commit', '--quiet', '-m', 'mine'])
    assert.equal(deliveryPlan().localChanges, false)
  })

  it('starts ticked when the repository allows automatic commits', () => {
    assert.equal(deliveryPlan().commitMode, 'auto')
  })

  it('offers no choice on a detached HEAD, and says why', () => {
    git(['checkout', '--quiet', '--detach'])
    const plan = deliveryPlan()
    assert.equal(plan.canChooseWorktree, false)
    assert.equal(plan.commitMode, 'manual')
    assert.match(plan.manualWhy ?? '', /detached HEAD/)
    assert.equal(plan.branch, undefined)
  })

  it('offers no choice outside a git repository', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-nogit-'))
    try {
      setBoardRoot(bare)
      const plan = deliveryPlan()
      assert.equal(plan.canChooseWorktree, false)
      assert.match(plan.manualWhy ?? '', /not a git repository/)
    } finally {
      setBoardRoot(root)
      fs.rmSync(bare, { recursive: true, force: true })
    }
  })
})

describe('what the tick does', () => {
  it('keeps this build out of a worktree where the setting would have given it one', () => {
    const got = prepareDelivery(7, 'manual')
    assert.ok('start' in got)
    assert.equal(got.start.commitMode, 'manual')
    assert.equal(got.start.worktree, undefined)
    // Nothing was chosen for it, so nothing is said about why.
    assert.equal(got.start.manualWhy, undefined)
  })

  it('gives this build a worktree where the setting would not have', () => {
    setAutoCommit(false)
    setDiffApproval(true)
    const got = prepareDelivery(7, 'auto')
    assert.ok('start' in got)
    assert.equal(got.start.commitMode, 'auto')
    assert.ok(got.start.worktree)
    assert.equal(got.start.targetBranch, 'main')
    // Approval follows the branch, not the commits switch.
    assert.equal(got.start.needsApproval, true)
    undoPrepared(got.start)
  })

  it('falls back to the setting when the request says nothing', () => {
    setAutoCommit(false)
    const got = prepareDelivery(7)
    assert.ok('start' in got)
    assert.equal(got.start.commitMode, 'manual')
  })

  // The user's own uncommitted work stops nothing here (#958): the worktree is checked out
  // from the commit, so it neither carries their changes in nor touches them.
  it('starts through staged, unstaged and untracked work in the project folder', () => {
    fs.writeFileSync(path.join(root, 'code.txt'), 'edited\n')
    fs.writeFileSync(path.join(root, 'staged.txt'), 'staged\n')
    git(['add', 'staged.txt'])
    fs.writeFileSync(path.join(root, 'untracked.txt'), 'new\n')

    const got = prepareDelivery(7, 'auto')
    assert.ok('start' in got, 'error' in got ? got.error : '')
    assert.ok(got.start.worktree)
    // Nothing of theirs was carried into the build, and nothing of theirs was touched.
    const inside = path.join(root, got.start.worktree!, 'code.txt')
    assert.equal(fs.readFileSync(inside, 'utf8'), 'base\n')
    assert.equal(fs.readFileSync(path.join(root, 'code.txt'), 'utf8'), 'edited\n')
    assert.equal(git(['diff', '--cached', '--name-only']), 'staged.txt')
    undoPrepared(got.start)
  })

  it('builds on a detached HEAD instead of refusing it', () => {
    git(['checkout', '--quiet', '--detach'])
    const got = prepareDelivery(7, 'auto')
    assert.ok('start' in got)
    assert.equal(got.start.commitMode, 'manual')
    assert.equal(got.start.worktree, undefined)
    assert.match(got.start.manualWhy ?? '', /detached HEAD/)
  })
})

// What a refusal carries besides its sentence (#706): a screen that says it in its own
// language reads the kind and lists the paths itself, so dropping either on the way out
// leaves every refusal generic.
describe('what a refused build carries', () => {
  // A build with no branch of its own works in the project folder itself, so a change
  // already sitting there would be read as its own work. It is the only one that refuses
  // for a dirty checkout now (#958).
  it('names the dirty checkout and the files in it', () => {
    fs.writeFileSync(path.join(root, 'code.txt'), 'edited\n')
    const got = prepareDelivery(7, 'manual')
    assert.ok('error' in got)
    assert.equal(got.reason, 'dirty')
    assert.deepEqual(got.paths, ['code.txt'])
  })

  it('reaches the run that asked for the build', () => {
    fs.writeFileSync(path.join(root, 'code.txt'), 'edited\n')
    const opened = openRun({ action: 'implement', id: 7, title: 'A card', commitMode: 'manual' }, 'prompt', [])
    assert.ok('error' in opened)
    assert.equal(opened.reason, 'dirty')
    assert.deepEqual(opened.paths, ['code.txt'])
  })
})

describe('the tick on the Implement request', () => {
  it('reaches the delivery the run opens', () => {
    setAutoCommit(false)
    const opened = openRun({ action: 'implement', id: 7, title: 'A card', commitMode: 'auto' }, 'prompt', [])
    assert.ok(!('error' in opened), 'error' in opened ? opened.error : '')
    const delivery = activeDelivery(7)
    assert.equal(delivery?.commitMode, 'auto')
    assert.ok(delivery?.worktree)
    assert.ok(fs.existsSync(path.join(root, delivery!.worktree!)))
  })

  it('leaves the setting where it was', () => {
    setAutoCommit(false)
    openRun({ action: 'implement', id: 7, title: 'A card', commitMode: 'auto' }, 'prompt', [])
    assert.equal(deliveryPlan().commitMode, 'manual')
  })
})
