// The one commit going Cloud offers, and the one that brings the board back (#317).
//
// Nothing here reaches the service: what is checked is the repository half, which is where
// the promises are. Three of them, and each is the reason the commit is built in an index of
// its own rather than with `git add` on the user's:
//
//   • it carries THOSE THREE PATHS and nothing else the working tree holds,
//   • the cards leave git while STAYING ON DISK, because the copy is what the next read
//     overwrites — and come back tracked when the checkout leaves Cloud,
//   • `docs/kanban/.env` never enters git, either way.
//
// And the two checkouts that are not an ordinary repository: one with no git at all, which
// still takes the Cloud path, and one with no commit yet.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { commitCloudChange, readCloudChange, pointAtWorkspace, unpointCheckout } from '../src/lib/cloud/checkout.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' })

/** A checkout with a board committed in it, a secret the board keeps out of git, and one
 *  file of the user's own that no commit here may ever touch. */
function repo({ commit = true }: { commit?: boolean } = {}): void {
  git('init', '-q', '.')
  git('config', 'user.email', 'test@ai4kanban.dev')
  git('config', 'user.name', 'test')
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# board\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', '1-one.md'), 'one\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', '.gitignore'), '.env\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', '.env'), 'AKB_KEY=secret\n')
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules\n')
  fs.writeFileSync(path.join(root, 'app.ts'), 'export const x = 1\n')
  if (!commit) return
  git('add', '-A')
  git('commit', '-qm', 'init')
}

const tracked = (): string[] => git('ls-files').split('\n').filter(Boolean)
const carried = (): string[] =>
  git('show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean)

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-checkout-')))
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a checkout going Cloud', () => {
  it('carries the board out of git, the pointer in, and nothing else the tree holds', () => {
    repo()
    pointAtWorkspace(root, 'ws-1', 'rocket')

    const change = readCloudChange(root, 'go')
    assert.equal(change.git, true)
    assert.equal(change.clean, false)
    assert.equal(change.pointer, 'add')
    assert.equal(change.ignore, true)
    // README.md, 1-one.md and the board's own .gitignore — the three tracked board files.
    assert.equal(change.cards, 3)

    // Work of the user's own, staged before the offer is taken. It must survive as staged
    // work and must not reach this commit.
    fs.writeFileSync(path.join(root, 'app.ts'), 'export const x = 2\n')
    git('add', 'app.ts')

    const done = commitCloudChange(root, 'go')
    assert.equal(done.ok, true)

    assert.deepEqual(carried().sort(), [
      '.ai4kanban.json',
      '.gitignore',
      'docs/kanban/.gitignore',
      'docs/kanban/todo/1-one.md',
      'docs/kanban/todo/README.md',
    ])
    assert.deepEqual(tracked().sort(), ['.ai4kanban.json', '.gitignore', 'app.ts'])
    // Still staged, and still uncommitted: the offer took its three paths and left the rest.
    assert.match(git('status', '--porcelain'), /^M {2}app\.ts$/m)
  })

  it('leaves the cards on disk — the copy is what the next read overwrites', () => {
    repo()
    pointAtWorkspace(root, 'ws-1', 'rocket')
    assert.equal(commitCloudChange(root, 'go').ok, true)
    assert.equal(fs.existsSync(path.join(root, 'docs', 'kanban', 'todo', '1-one.md')), true)
    // And git is told to leave them alone from here on.
    assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^docs\/kanban\/$/m)
  })

  it('says there is nothing left to commit once the offer has been taken', () => {
    repo()
    pointAtWorkspace(root, 'ws-1', 'rocket')
    assert.equal(commitCloudChange(root, 'go').ok, true)
    assert.equal(readCloudChange(root, 'go').clean, true)
    assert.equal(commitCloudChange(root, 'go').ok, false)
  })

  it('stays taken when the user edits .gitignore for reasons of their own', () => {
    repo()
    pointAtWorkspace(root, 'ws-1', 'rocket')
    assert.equal(commitCloudChange(root, 'go').ok, true)

    // A line of the user's own, uncommitted. `.gitignore` now differs from HEAD — and an
    // offer that read that as the move would stand for ever and carry this line away.
    fs.appendFileSync(path.join(root, '.gitignore'), 'dist/\n')

    const change = readCloudChange(root, 'go')
    assert.equal(change.clean, true)
    assert.equal(change.ignore, false)
    assert.equal(commitCloudChange(root, 'go').ok, false)
    assert.match(git('status', '--porcelain'), /^ M \.gitignore$/m)
  })

  it('takes the Cloud path in a folder with no git repository, and says so', () => {
    fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
    pointAtWorkspace(root, 'ws-1', 'rocket')

    const change = readCloudChange(root, 'go')
    assert.equal(change.git, false)
    // The pointer is written and the board works; there is simply nowhere to commit it.
    assert.equal(fs.existsSync(path.join(root, '.ai4kanban.json')), true)
    const done = commitCloudChange(root, 'go')
    assert.equal(done.ok, false)
    assert.match(done.ok === false ? done.error : '', /no git repository/)
  })

  it('makes a first commit in a repository that has none yet', () => {
    repo({ commit: false })
    pointAtWorkspace(root, 'ws-1', 'rocket')
    assert.equal(commitCloudChange(root, 'go').ok, true)
    // Nothing was tracked, so the pointer and the ignore file are the whole of it — the
    // board files are already ignored and stay out.
    assert.deepEqual(carried().sort(), ['.ai4kanban.json', '.gitignore'])
  })
})

describe('a checkout leaving Cloud', () => {
  it('puts the cards back under git, takes the pointer off, and keeps the secret out', () => {
    repo()
    pointAtWorkspace(root, 'ws-1', 'rocket')
    assert.equal(commitCloudChange(root, 'go').ok, true)

    unpointCheckout(root)
    const change = readCloudChange(root, 'leave')
    assert.equal(change.pointer, 'remove')
    assert.equal(change.cards, 3)
    assert.equal(commitCloudChange(root, 'leave').ok, true)

    assert.deepEqual(tracked().sort(), [
      '.gitignore',
      'app.ts',
      'docs/kanban/.gitignore',
      'docs/kanban/todo/1-one.md',
      'docs/kanban/todo/README.md',
    ])
    // `docs/kanban/.gitignore` still keeps the key out, and no `--force` ever overrode it.
    assert.equal(tracked().includes('docs/kanban/.env'), false)
    assert.equal(fs.existsSync(path.join(root, '.ai4kanban.json')), false)
    assert.doesNotMatch(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /docs\/kanban\//)
  })
})
