// The commit guard (#324): the `pre-commit` hook that refuses a commit on the branch a
// delivery is landing on.
//
// The board here is a real git repository and the commits are real `git commit` runs,
// because the whole of this card is what git does with a hook file — which branch it reports
// to it, that a linked worktree shares it, and that `--no-verify` skips it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { installCommitHook, readCommitHook } from '../src/lib/skill/hook.ts'
import type { DeliveryRecord } from '../src/lib/agent/types.ts'

let root = ''

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

const HOOK = path.join('.git', 'hooks', 'pre-commit')

/** One delivery row, with only the fields the hook reads filled in. */
const delivery = (over: Partial<DeliveryRecord> = {}): DeliveryRecord =>
  ({
    deliveryId: 'a1b2c3d4',
    cardId: 7,
    title: 'card seven',
    status: 'active',
    startedAt: 1,
    sessions: [],
    approved: '',
    steps: [],
    commitMode: 'auto',
    targetBranch: 'main',
    ...over,
  }) as DeliveryRecord

const record = (deliveries: DeliveryRecord[]): void => {
  fs.writeFileSync(path.join(root, 'docs', 'kanban', '.sessions.json'), JSON.stringify({ runs: [], deliveries, marks: {} }))
}

/** Try to commit a change, and hand back what git said. */
function commit(message: string, cwd = root, args: string[] = []): { ok: boolean; err: string } {
  fs.writeFileSync(path.join(cwd, 'a.txt'), `${message}\n`)
  const out = spawnSync('git', ['commit', '--quiet', '-a', ...args, '-m', message], { cwd, encoding: 'utf8' })
  return { ok: out.status === 0, err: out.stderr }
}

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-hook-')))
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  fs.writeFileSync(path.join(root, 'a.txt'), 'start\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
})

afterEach(() => {
  spawnSync('git', ['worktree', 'prune'], { cwd: root })
  fs.rmSync(root, { recursive: true, force: true })
})

describe('what the guard refuses', () => {
  beforeEach(() => {
    assert.equal(installCommitHook(root).wrote?.refreshed, false)
  })

  it('refuses a commit on the branch a delivery is landing on, and names it', () => {
    record([delivery()])
    const { ok, err } = commit('on the target')
    assert.equal(ok, false)
    assert.match(err, /delivery a1b2c3d4/)
    assert.match(err, /#7/)
    assert.match(err, /main/)
    assert.match(err, /--no-verify/)
    // Nothing was committed: the tree still says what it said.
    assert.equal(git(['log', '--format=%s', '-1']), 'start')
  })

  it('lets `--no-verify` through', () => {
    record([delivery()])
    assert.equal(commit('past the guard', root, ['--no-verify']).ok, true)
  })

  it('lets a commit on another branch through', () => {
    record([delivery()])
    git(['checkout', '--quiet', '-b', 'side'])
    assert.equal(commit('elsewhere').ok, true)
  })

  it('lets a commit through with no delivery in flight', () => {
    record([delivery({ status: 'finished' })])
    assert.equal(commit('nothing in flight').ok, true)
  })

  it('lets a commit through once the delivery has landed', () => {
    record([delivery({ landing: { status: 'landed', attempts: 1, at: 1 } })])
    assert.equal(commit('already landed').ok, true)
  })

  it('lets a commit through for a delivery in manual commit mode', () => {
    record([delivery({ commitMode: 'manual', worktree: undefined })])
    assert.equal(commit('the commit is the user’s').ok, true)
  })

  it("lets a commit through inside a delivery's own worktree", () => {
    // The worktree is on the very branch the delivery is landing on, so only the worktree
    // itself can be what lets this through.
    record([delivery({ targetBranch: 'card/7/a1b2c3d4' })])
    const where = path.join(root, '.akb', 'worktrees', '7', 'a1b2c3d4')
    git(['worktree', 'add', '--quiet', '-b', 'card/7/a1b2c3d4', where, 'main'])
    git(['config', 'user.email', 'test@example.com'], where)
    git(['config', 'user.name', 'test'], where)
    assert.equal(commit('inside the worktree', where).ok, true)
  })

  it('lets a commit through when it cannot read the record', () => {
    fs.writeFileSync(path.join(root, 'docs', 'kanban', '.sessions.json'), 'half a file {')
    assert.equal(commit('malformed').ok, true)
    fs.rmSync(path.join(root, 'docs', 'kanban', '.sessions.json'))
    assert.equal(commit('no record at all').ok, true)
  })
})

describe('where it is installed', () => {
  it('writes an executable hook carrying the board’s marker and the board’s path', () => {
    const result = installCommitHook(root)
    assert.deepEqual(result.wrote, { path: '.git/hooks/pre-commit', refreshed: false })
    assert.equal(result.note, undefined)
    const text = fs.readFileSync(path.join(root, HOOK), 'utf8')
    assert.match(text, /^# ai4kanban commit guard /m)
    assert.ok(text.includes(path.join(root, 'docs', 'kanban', '.sessions.json')))
    assert.ok(fs.statSync(path.join(root, HOOK)).mode & 0o111)
  })

  it('rewrites its own older hook in place, and says it was a refresh', () => {
    fs.mkdirSync(path.join(root, '.git', 'hooks'), { recursive: true })
    fs.writeFileSync(path.join(root, HOOK), '#!/bin/sh\n# ai4kanban commit guard 0.0.1 — an older one\nexit 0\n')
    const result = installCommitHook(root)
    assert.deepEqual(result.wrote, { path: '.git/hooks/pre-commit', refreshed: true })
    assert.ok(!fs.readFileSync(path.join(root, HOOK), 'utf8').includes('an older one'))
    // And it guards, so an out-of-date copy is not a copy that stopped working.
    record([delivery()])
    assert.equal(commit('after the refresh').ok, false)
  })

  it('leaves a hook the board did not write alone, and hands over the line to add', () => {
    const theirs = '#!/bin/sh\necho theirs\n'
    fs.writeFileSync(path.join(root, HOOK), theirs)
    const result = installCommitHook(root)
    assert.equal(result.wrote, undefined)
    assert.equal(fs.readFileSync(path.join(root, HOOK), 'utf8'), theirs)
    assert.match(result.note!, /did not write/)
    assert.ok(result.note!.includes('node -e'))
    assert.equal(readCommitHook(root).state, 'foreign')
  })

  it('writes nothing when the repository runs its hooks from core.hooksPath', () => {
    git(['config', 'core.hooksPath', '.githooks'])
    const result = installCommitHook(root)
    assert.equal(result.wrote, undefined)
    assert.equal(fs.existsSync(path.join(root, HOOK)), false)
    assert.equal(fs.existsSync(path.join(root, '.githooks')), false)
    assert.match(result.note!, /core\.hooksPath/)
    const hook = readCommitHook(root)
    assert.equal(hook.state, 'hooks-path')
    assert.equal(hook.path, '.githooks/pre-commit')
  })

  // The line is pasted into a hook of the user's, and the natural place is the end — where
  // its own exit status becomes the hook's. So it has to be 0 on a machine with no `node`.
  it('hands over a line that refuses, and lets a machine with no node through', () => {
    git(['config', 'core.hooksPath', '.githooks'])
    const line = readCommitHook(root).line!
    const script = path.join(root, 'as-last-line.sh')
    fs.writeFileSync(script, `#!/bin/sh\nset -e\n${line}\n`, { mode: 0o755 })
    record([delivery()])
    assert.equal(spawnSync(script, [], { cwd: root, encoding: 'utf8' }).status, 1)
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-nopath-'))
    assert.equal(spawnSync(script, [], { cwd: root, env: { PATH: bare }, encoding: 'utf8' }).status, 0)
    fs.rmSync(bare, { recursive: true, force: true })
  })

  it('writes nothing, and says nothing, outside a git repository', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-nogit-'))
    assert.deepEqual(installCommitHook(plain), {})
    assert.deepEqual(readCommitHook(plain), { state: 'no-git' })
    fs.rmSync(plain, { recursive: true, force: true })
  })

  it('reads back as absent before an install and as the board’s after one', () => {
    assert.equal(readCommitHook(root).state, 'absent')
    installCommitHook(root)
    assert.equal(readCommitHook(root).state, 'ours')
  })
})
