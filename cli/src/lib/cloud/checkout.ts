// ---- a checkout going Cloud, and coming back (#317) -------------------------
//
// Going Cloud changes three things in the repository, and this is where the change is made
// and where it is committed:
//
//   • the board files stop being tracked — `docs/kanban/` is a copy of the workspace from
//     the first read (#316), and a copy git carries is a copy the next read overwrites;
//   • `.ai4kanban.json` is added, so every clone opens the same workspace;
//   • the root `.gitignore` gains the `docs/kanban/` block.
//
// Leaving reverses all three, in the same one commit. Nothing here deletes a card: the
// cards are in git history whichever way the user answers, and what the offer decides is
// whether git records what already happened.
//
// **The commit is built in an index of its own.** `git add` on the real index would sweep in
// whatever the user had staged, and a `git commit -- <path>` would put the ignored copy back
// under git. So the tree is assembled in a temporary index seeded from HEAD, and the commit
// is written from that — the working tree and the user's own staged work are never touched.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { COPY_IGNORE_LINE, ignoreBoardCopyIfMissing, unignoreBoardCopy } from '../paths'
import { POINTER_FILE, pointerPath, writePointer } from './pointer'

/** The three paths going Cloud touches, and the only paths a commit here may carry. */
const BOARD_DIR = 'docs/kanban'
const IGNORE_FILE = '.gitignore'

/** Which way the change runs. */
export type CloudChangeKind = 'go' | 'leave'

/** What the one commit would carry, so the offer can say it before it is taken. */
export interface CloudChange {
  kind: CloudChangeKind
  /** There is a git repository over this checkout. Without one there is nothing to commit
   *  to, and the board still works. */
  git: boolean
  /** Board files entering or leaving git. */
  cards: number
  /** The pointer file — added going Cloud, removed leaving it, `none` when git already
   *  reads it the way this change would leave it. */
  pointer: 'add' | 'remove' | 'none'
  /** The `.gitignore` block moves. */
  ignore: boolean
  /** Nothing for a commit to carry. */
  clean: boolean
}

export type CloudCommit = { ok: true; commit: string } | { ok: false; error: string }

const NOTHING: Omit<CloudChange, 'kind'> = {
  git: false,
  cards: 0,
  pointer: 'none',
  ignore: false,
  clean: true,
}

// ---- pointing a checkout at a workspace, and taking the pointer off ----------

/** Bind this checkout to `workspace`, and keep the copy out of git. Every clone of the
 *  repository reaches the same Cloud board once the pointer is committed. */
export function pointAtWorkspace(root: string, workspace: string, name = ''): void {
  writePointer(root, { workspace, ...(name ? { name } : {}) })
  ignoreBoardCopyIfMissing()
}

/** Stop pointing at it — what a leave and a delete both do. The board files are left
 *  exactly as they stand; only the pointer and the ignore block go. */
export function unpointCheckout(root: string): void {
  fs.rmSync(pointerPath(root), { force: true })
  unignoreBoardCopy()
}

// ---- the one commit ---------------------------------------------------------

/** What the commit would carry right now. */
export function readCloudChange(root: string, kind: CloudChangeKind): CloudChange {
  if (!insideRepo(root)) return { kind, ...NOTHING }
  const staged = stage(root, kind)
  if (!staged) return { kind, ...NOTHING, git: true }
  try {
    return { kind, ...count(root, staged.tree, kind) }
  } finally {
    fs.rmSync(staged.index, { force: true })
  }
}

/**
 * Take the offer: one commit carrying those three paths and nothing else.
 *
 * The message is the repository's, so it is English whatever the board is read in.
 */
export function commitCloudChange(root: string, kind: CloudChangeKind): CloudCommit {
  if (!insideRepo(root)) {
    return { ok: false, error: 'There is no git repository here to commit to.' }
  }
  const staged = stage(root, kind)
  if (!staged) return { ok: false, error: 'git would not read this checkout.' }
  try {
    const changed = count(root, staged.tree, kind)
    if (changed.clean) return { ok: false, error: 'There is nothing left to commit.' }
    const head = run(root, ['rev-parse', '--verify', 'HEAD'])
    const parent = head.ok ? head.out.trim() : ''
    const message =
      kind === 'go'
        ? 'chore: move the board to a Cloud workspace\n\nThe cards now live in the workspace .ai4kanban.json names; docs/kanban/ is a\ngit-ignored copy of it.\n'
        : 'chore: bring the board back out of Cloud\n\nThe cards are markdown in docs/kanban/ again, and git tracks them.\n'
    const commit = run(root, [
      'commit-tree',
      staged.tree,
      ...(parent ? ['-p', parent] : []),
      '-m',
      message,
    ])
    if (!commit.ok) return { ok: false, error: commit.error }
    const sha = commit.out.trim()
    const moved = run(root, ['update-ref', '-m', message.split('\n')[0], 'HEAD', sha])
    if (!moved.ok) return { ok: false, error: moved.error }
    // The real index still holds what those three paths were BEFORE the commit, so without
    // this `git status` would show the change staged again, backwards. `reset <paths>` takes
    // the new HEAD's version of just those paths and leaves every other staged path — the
    // user's own work — exactly where it was.
    run(root, ['reset', '-q', 'HEAD', '--', BOARD_DIR, POINTER_FILE, IGNORE_FILE])
    return { ok: true, commit: sha }
  } finally {
    fs.rmSync(staged.index, { force: true })
  }
}

// ---- how the tree is built --------------------------------------------------

/** HEAD's tree with the three paths brought up to date, in an index of its own. Null when
 *  git would not answer at all. */
function stage(root: string, kind: CloudChangeKind): { index: string; tree: string } | null {
  const gitDir = run(root, ['rev-parse', '--absolute-git-dir'])
  if (!gitDir.ok) return null
  const index = path.join(gitDir.out.trim(), `akb-cloud-${process.pid}.index`)
  fs.rmSync(index, { force: true })
  const env = { GIT_INDEX_FILE: index }

  const head = run(root, ['rev-parse', '--verify', 'HEAD'])
  const seeded = head.ok
    ? run(root, ['read-tree', 'HEAD'], env)
    : run(root, ['read-tree', '--empty'], env)
  if (!seeded.ok) {
    fs.rmSync(index, { force: true })
    return null
  }

  if (kind === 'go') {
    // Untracked, not deleted: the copy is still on disk and the next read overwrites it, so
    // what leaves is the index entry and not the file.
    run(root, ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', BOARD_DIR], env)
    if (fs.existsSync(pointerPath(root))) run(root, ['add', '--', POINTER_FILE], env)
  } else {
    // No `--force`: the root block is out of the working tree's `.gitignore` by now, so the
    // cards go in — and `docs/kanban/.gitignore` still keeps `.env` and the run state out.
    run(root, ['add', '-A', '--', BOARD_DIR], env)
    run(root, ['rm', '--cached', '--quiet', '--ignore-unmatch', '--', POINTER_FILE], env)
  }
  if (fs.existsSync(path.join(root, IGNORE_FILE))) run(root, ['add', '--', IGNORE_FILE], env)

  const tree = run(root, ['write-tree'], env)
  if (!tree.ok) {
    fs.rmSync(index, { force: true })
    return null
  }
  return { index, tree: tree.out.trim() }
}

/** What that tree changes against HEAD, read back as the three things the offer names. */
function count(root: string, tree: string, kind: CloudChangeKind): Omit<CloudChange, 'kind'> {
  const head = run(root, ['rev-parse', '--verify', 'HEAD'])
  const diff = head.ok
    ? run(root, ['diff', '--name-status', '-z', 'HEAD', tree])
    : run(root, ['diff', '--name-status', '-z', EMPTY_TREE, tree])
  if (!diff.ok) return { ...NOTHING, git: true }

  const held = { ...NOTHING, git: true, clean: true }
  // `-z` writes `<status>\0<path>\0`, which is what keeps a card whose filename is not
  // ASCII off git's own quoting.
  const fields = diff.out.split('\0').filter(Boolean)
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i]
    const file = fields[i + 1]
    if (file === POINTER_FILE) held.pointer = kind === 'go' ? 'add' : 'remove'
    else if (file === IGNORE_FILE) held.ignore = movesBlock(root, tree, kind)
    else if (file.startsWith(`${BOARD_DIR}/`) && status[0] !== 'M') held.cards++
  }
  // Only the three things the offer names make it a change. A `.gitignore` the user edited
  // for their own reasons differs from HEAD too, and counting that would leave the offer
  // standing for ever on a checkout that has already taken it — and carry their line away
  // with it when they finally pressed it.
  held.clean = held.cards === 0 && held.pointer === 'none' && !held.ignore
  return held
}

/** Whether THIS change is what moves the `docs/kanban/` block, as against a `.gitignore`
 *  that differs from HEAD for reasons of the user's own. */
function movesBlock(root: string, tree: string, kind: CloudChangeKind): boolean {
  const was = blocks(run(root, ['show', `HEAD:${IGNORE_FILE}`]))
  const now = blocks(run(root, ['show', `${tree}:${IGNORE_FILE}`]))
  return kind === 'go' ? !was && now : was && !now
}

const blocks = (read: { ok: boolean; out: string }): boolean =>
  read.ok && read.out.split('\n').some((line) => line.trim() === COPY_IGNORE_LINE)

/** git's own name for a tree with nothing in it — what the first commit in a repository is
 *  compared against. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const insideRepo = (root: string): boolean =>
  run(root, ['rev-parse', '--is-inside-work-tree']).out.trim() === 'true'

function run(
  root: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): { ok: boolean; out: string; error: string } {
  try {
    const done = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, ...env },
    })
    if (done.error) return { ok: false, out: '', error: String(done.error) }
    if (done.status !== 0) return { ok: false, out: done.stdout ?? '', error: (done.stderr || done.stdout || '').trim() }
    return { ok: true, out: done.stdout ?? '', error: '' }
  } catch (e) {
    return { ok: false, out: '', error: e instanceof Error ? e.message : String(e) }
  }
}
