// A delivery's own checkout: the git worktree it builds in, and the branch it builds on.
//
// Every run in a delivery works here instead of in the user's checkout, so two
// deliveries never write the same file and neither one mixes with the edits the user has
// open. The worktree lives under `.akb/worktrees/<cardID>/<deliveryID>` — ignored at the
// repository root, because it is this machine's build space and never something git
// carries — and its branch is `card/<cardID>/<deliveryID>`, forked from the delivery's
// recorded base.
//
// The board's OWN files are kept out of it. A delivery writes to the card, the delivery
// record and the run state as it works, and all three live in the repo root's copy —
// so the worktree is checked out without them, and a task commit that reaches one is
// refused rather than landed. That refusal is the boundary; sparse checkout is only what
// keeps the files out of the way.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { AKB_DIR, ensureAkbDir, KANBAN, REPO_ROOT, rel } from '../paths'

// A diff can be megabytes. Nothing here prints one — they are hashed, counted or written
// to a file — so the cap is about not holding a whole repository in memory.
const MAX_OUTPUT = 64 * 1024 * 1024

/** Run one git command and hand back its stdout, or null when it failed. */
export function git(args: string[], cwd = REPO_ROOT): string | null {
  try {
    const out = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_OUTPUT, windowsHide: true })
    if (out.error || out.status !== 0) return null
    return out.stdout
  } catch {
    return null
  }
}

/** Run one git diff and hand back what it printed. Unlike `git`, exit 1 is not a failure:
 *  `diff --no-index` answers 1 for "the two differ", which is the ordinary case. */
export function gitDiff(args: string[], cwd = REPO_ROOT): string | null {
  try {
    const out = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_OUTPUT, windowsHide: true })
    if (out.error || (out.status !== 0 && out.status !== 1)) return null
    return out.stdout
  } catch {
    return null
  }
}

/** Run one git command for its outcome, keeping what it said when it went wrong. */
function tryGit(args: string[], cwd = REPO_ROOT, env?: NodeJS.ProcessEnv): { ok: boolean; why?: string } {
  try {
    const out = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT,
      windowsHide: true,
      ...(env ? { env: { ...process.env, ...env } } : {}),
    })
    if (out.error) return { ok: false, why: String(out.error) }
    if (out.status !== 0) return { ok: false, why: (out.stderr || out.stdout || '').trim() }
    return { ok: true }
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) }
  }
}

// Git with nothing interactive left in it: no editor to open and no hook to run. Every
// command the landing runs goes through here — a rebase that stops on an editor is a
// process nobody is watching, waiting forever.
const scripted = (args: string[], cwd: string): { ok: boolean; why?: string } =>
  tryGit(['-c', 'core.hooksPath=/dev/null', ...args], cwd, { GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' })

// ---- what the board owns ----------------------------------------------------

/** Every path the BOARD writes, repo-relative and slash-spelled — the one list, read by
 *  the worktree's checkout, by the candidate's diff and by the commit check.
 *
 *  `docs/kanban/` is the board itself: the card, the delivery records, the run state.
 *  `.akb/` is delivery state that never belongs in git, the worktrees among it. A delivery
 *  changes both while it works, and neither is the code it is judged on. */
export function boardManagedPaths(): string[] {
  return [posix(rel(KANBAN)), posix(rel(AKB_DIR))]
}

const posix = (p: string): string => p.split(path.sep).join('/')

/** The pathspec that leaves the board's own files out of a git command. */
export const outsideBoard = (): string[] => [
  '--',
  '.',
  ...boardManagedPaths().map((p) => `:(exclude)${p}`),
]

/** The same pathspec for `git add`, which alone among these refuses a pathspec naming a
 *  git-ignored path — even one it is being told to leave out. An ignored folder is left
 *  out either way, so naming it is what has to go, not the exclusion. */
export function outsideBoardForAdd(cwd = REPO_ROOT): string[] {
  const kept = boardManagedPaths().filter(
    (p) =>
      spawnSync('git', ['check-ignore', '-q', p], { cwd, windowsHide: true }).status !== 0,
  )
  return ['--', '.', ...kept.map((p) => `:(exclude)${p}`)]
}

/** The board-managed paths one list of changed files touches — empty when a commit is
 *  free to land. Names them so a refusal says which file, not only that there was one. */
export function boardPathsAmong(files: string[]): string[] {
  const owned = boardManagedPaths()
  return files.filter((file) => {
    const p = posix(file)
    return owned.some((dir) => p === dir || p.startsWith(`${dir}/`))
  })
}

// ---- where a delivery's checkout lives --------------------------------------

/** The branch a delivery builds on. */
export const deliveryBranch = (cardId: number, deliveryId: string): string =>
  `card/${cardId}/${deliveryId}`

/** Where a delivery's worktree sits, repo-relative. */
export const deliveryWorktree = (cardId: number, deliveryId: string): string =>
  posix(path.join(rel(AKB_DIR), 'worktrees', String(cardId), deliveryId))

/** That path as it really is on this machine. */
export const worktreeDir = (relPath: string): string => path.resolve(REPO_ROOT, relPath)

// ---- the state of the user's own checkout -----------------------------------

/** This is a git repository with a commit in it. */
export const inGitRepo = (): boolean => git(['rev-parse', '--git-dir']) !== null

/** The commit a delivery starting now forks from — the repository's HEAD — or null
 *  outside a git repository and in one with no commit yet. */
export const headCommit = (cwd = REPO_ROOT): string | null =>
  git(['rev-parse', 'HEAD'], cwd)?.trim() || null

/** The branch checked out right now, or null on a detached HEAD (and outside git). */
export function currentBranch(cwd = REPO_ROOT): string | null {
  const name = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd)?.trim()
  return name || null
}

/** The files that differ from HEAD in this checkout, outside the board's own paths —
 *  tracked changes always, and untracked ones when asked for. Empty on a clean start.
 *
 *  A delivery bound for a worktree ignores untracked files: the worktree is checked out
 *  from a commit and cannot inherit one. Manual commit mode counts them, because it works
 *  in this very checkout and review would read them as the delivery's own work. */
export function dirtyPaths(withUntracked: boolean, cwd = REPO_ROOT): string[] {
  const args = ['status', '--porcelain', ...(withUntracked ? [] : ['--untracked-files=no']), ...outsideBoard()]
  const out = git(args, cwd)
  if (out === null) return []
  return out
    .split('\n')
    .filter(Boolean)
    // `XY path` — and `XY old -> new` for a rename, whose new name is the one that matters.
    .map((line) => line.slice(3).split(' -> ').pop()!.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

// ---- making one, and taking one away ----------------------------------------

/** Make a delivery's worktree and its branch, forked from `base`.
 *
 *  Never over an existing one: a retry reuses the worktree that is already there, and a
 *  changed card makes a new delivery with a new worktree. */
export function addWorktree(
  cardId: number,
  deliveryId: string,
  base: string,
): { ok: true; worktree: string; branch: string } | { ok: false; error: string } {
  const branch = deliveryBranch(cardId, deliveryId)
  const relPath = deliveryWorktree(cardId, deliveryId)
  const dir = worktreeDir(relPath)
  if (fs.existsSync(dir)) return { ok: true, worktree: relPath, branch }
  ensureAkbDir()
  fs.mkdirSync(path.dirname(dir), { recursive: true })
  // Checked out empty first, so the board's own paths are switched off before any file
  // lands — a full checkout followed by a delete would put the card into the worktree and
  // then take it away, and a run that read it in between read the wrong copy.
  const added = tryGit(['worktree', 'add', '--no-checkout', '-b', branch, dir, base])
  if (!added.ok) return { ok: false, error: `couldn't make the delivery's worktree: ${added.why ?? 'git refused'}` }
  keepBoardOut(dir)
  const checkedOut = tryGit(['checkout'], dir)
  if (!checkedOut.ok) {
    removeWorktree(relPath, branch, true)
    return { ok: false, error: `couldn't check the delivery's worktree out: ${checkedOut.why ?? 'git refused'}` }
  }
  return { ok: true, worktree: relPath, branch }
}

// Leave the board's own files out of this checkout. Best-effort: sparse checkout is what
// keeps them out of the way, and the commit check is what actually refuses one — so a git
// too old for `sparse-checkout` gives a full checkout, not a broken delivery.
function keepBoardOut(dir: string): void {
  if (!tryGit(['sparse-checkout', 'init', '--no-cone'], dir).ok) return
  tryGit(['sparse-checkout', 'set', '/*', ...boardManagedPaths().map((p) => `!/${p}/`)], dir)
}

/** True when this delivery's worktree is still on disk and still git's. */
export const worktreeExists = (relPath: string | undefined): boolean =>
  !!relPath && fs.existsSync(path.join(worktreeDir(relPath), '.git'))

/** True when this branch is still in the repository. */
export const branchExists = (branch: string | undefined): boolean =>
  !!branch && git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== null

/** Take a delivery's worktree and branch away.
 *
 *  Refused while the worktree still holds work — an uncommitted change, or a commit the
 *  branch has that nothing else does — unless the caller has already said what will be
 *  lost and been told to go ahead. Nothing here ever reaches the user's main checkout: the
 *  path is checked to be inside `.akb/` first. */
export function removeWorktree(
  relPath: string | undefined,
  branch: string | undefined,
  force = false,
): { ok: boolean; error?: string } {
  if (relPath) {
    const dir = worktreeDir(relPath)
    const inside = path.relative(AKB_DIR, dir)
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
      return { ok: false, error: `${rel(dir)} is not a delivery worktree — nothing was removed` }
    }
    if (fs.existsSync(dir)) {
      const removed = tryGit(['worktree', 'remove', ...(force ? ['--force'] : []), dir])
      if (!removed.ok) {
        return {
          ok: false,
          error: removed.why?.includes('contains modified or untracked files')
            ? `${rel(dir)} still holds uncommitted work`
            : `couldn't remove ${rel(dir)}: ${removed.why ?? 'git refused'}`,
        }
      }
    }
  }
  if (branch && branchExists(branch)) tryGit(['branch', force ? '-D' : '-d', branch])
  if (relPath) dropEmptyParents(path.dirname(worktreeDir(relPath)))
  return { ok: true }
}

// The `<card>/` folder a removed worktree leaves behind, and `worktrees/` once the last one
// goes. Only ever empty directories, and only ever inside `.akb/`.
function dropEmptyParents(dir: string): void {
  for (let at = dir; at.startsWith(AKB_DIR) && at !== AKB_DIR; at = path.dirname(at)) {
    try {
      if (fs.readdirSync(at).length) return
      fs.rmdirSync(at)
    } catch {
      return
    }
  }
}

/** Clear git's metadata for worktrees whose folder is already gone. It only ever forgets
 *  paths that are missing — it never decides a delivery's directory is safe to delete. */
export const pruneWorktreeMetadata = (): void => void git(['worktree', 'prune'])

// ---- committing a delivery's work -------------------------------------------

/** Everything changed in this worktree, tracked and untracked alike. */
export function pendingPaths(dir: string): string[] {
  const out = git(['status', '--porcelain'], dir)
  if (out === null) return []
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').pop()!.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

/** Commit whatever a run left in the delivery's worktree, so the branch IS the
 *  candidate and review reads a settled tree.
 *
 *  Refused outright when the change reaches a board-managed path: the board's own files
 *  are written in the repo root's copy, and a task commit carrying one would land the
 *  card's own edits on the delivery's branch. */
export function commitWork(
  relPath: string,
  message: string,
): { ok: true; committed: boolean } | { ok: false; error: string } {
  const dir = worktreeDir(relPath)
  const pending = pendingPaths(dir)
  if (!pending.length) return { ok: true, committed: false }
  const owned = boardPathsAmong(pending)
  if (owned.length) {
    return {
      ok: false,
      error:
        `the delivery changed ${owned.slice(0, 3).join(', ')}${owned.length > 3 ? ` and ${owned.length - 3} more` : ''} ` +
        `inside its worktree. Those are the board's own files — they are changed in the project itself, never on a task branch — so nothing was committed.`,
    }
  }
  const added = tryGit(['add', '-A'], dir)
  if (!added.ok) return { ok: false, error: `couldn't stage the delivery's work: ${added.why ?? 'git refused'}` }
  const committed = tryGit(['-c', 'core.hooksPath=/dev/null', 'commit', '--no-verify', '-m', message], dir)
  if (!committed.ok) return { ok: false, error: `couldn't commit the delivery's work: ${committed.why ?? 'git refused'}` }
  return { ok: true, committed: true }
}

// ---- the code as it stands, in manual commit mode ---------------------------

/** A fingerprint of the code in this checkout, board-managed paths left out — the same
 *  answer before and after the user commits it, because it is taken from the working tree
 *  rather than from a patch.
 *
 *  That is what lets manual commit mode tell "you committed what review passed" from "you
 *  committed something else": committing changes what git records, not what is on disk.
 *  Null when there is no reading it. */
export function treeMark(base: string, cwd = REPO_ROOT): string | null {
  const index = path.join(ensureAkbDir(), `index-${process.pid}-${Date.now()}`)
  try {
    const env = { ...process.env, GIT_INDEX_FILE: index }
    const run = (args: string[]): boolean =>
      spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_OUTPUT, windowsHide: true, env }).status === 0
    // The base tree first, so the board's own files carry their base content and drop out
    // of the comparison; then the working tree over the top of everything else.
    if (!run(['read-tree', base])) return null
    if (!run(['add', '-A', ...outsideBoardForAdd(cwd)])) return null
    const tree = spawnSync('git', ['write-tree'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT,
      windowsHide: true,
      env,
    })
    return tree.status === 0 ? tree.stdout.trim() || null : null
  } catch {
    return null
  } finally {
    try {
      fs.rmSync(index, { force: true })
    } catch {
      // a temp index that wouldn't go — it is inside .akb/ and never committed
    }
  }
}

// ---- landing a delivery on the target branch (#304) -------------------------

/** Where a branch points right now, or null when there is no such branch. */
export const branchTip = (branch: string): string | null =>
  git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])?.trim() || null

/** True when `older` is already in `newer`'s history — so nothing needs rebasing. */
export const isAncestor = (older: string, newer: string, cwd = REPO_ROOT): boolean =>
  spawnSync('git', ['merge-base', '--is-ancestor', older, newer], { cwd, windowsHide: true }).status === 0

/** The paths staged in this checkout's index, the board's own files left out. Landing
 *  refuses while any are: a fast-forward under a half-built commit would leave the user
 *  staring at staged files they did not stage.
 *
 *  The board's own files change as every card moves, and no landed commit ever contains
 *  one — a delivery's worktree leaves them out and `commitWork` refuses them — so a staged
 *  card file is never in a fast-forward's way. */
export const stagedPaths = (cwd = REPO_ROOT): string[] =>
  (git(['diff', '--cached', '--name-only', ...outsideBoard()], cwd) ?? '').split('\n').filter(Boolean)

/** The files between two commits, or null when git would not answer. The two are told
 *  apart deliberately: a landing decides what to review from this, and an unreadable
 *  comparison read as an empty one would land work nothing had judged. */
export const changedPaths = (base: string, branch: string, cwd = REPO_ROOT): string[] | null => {
  const out = git(['diff', '--name-only', base, branch, ...outsideBoard()], cwd)
  return out === null ? null : out.split('\n').filter(Boolean)
}

/** Squash everything this branch has since `base` into ONE commit on top of it.
 *
 *  Done before the rebase, not after: a single commit conflicts at most once, so the
 *  conflict step is one run and `--continue` finishes the replay. `empty` is a
 *  delivery whose tree is identical to its base — there is nothing to land.  */
export function squashOnto(
  dir: string,
  base: string,
  message: string,
): { ok: true; commit?: string } | { ok: false; error: string } {
  const reset = scripted(['reset', '--soft', base], dir)
  if (!reset.ok) return { ok: false, error: `couldn't reset the task branch onto ${base.slice(0, 12)}: ${reset.why ?? 'git refused'}` }
  const committed = scripted(['commit', '--no-verify', '-m', message], dir)
  if (!committed.ok) {
    if (/nothing to commit|no changes added/i.test(committed.why ?? '')) return { ok: true }
    return { ok: false, error: `couldn't squash the delivery's work: ${committed.why ?? 'git refused'}` }
  }
  return { ok: true, commit: headCommit(dir) ?? undefined }
}

/** Replay this branch's commits since `upstream` onto `onto`. */
export function rebaseOnto(
  dir: string,
  onto: string,
  upstream: string,
): { ok: true } | { conflict: string[] } | { ok: false; error: string } {
  const done = scripted(['rebase', '--onto', onto, upstream], dir)
  if (done.ok) return { ok: true }
  const clashing = conflictedPaths(dir)
  if (clashing.length) return { conflict: clashing }
  abortRebase(dir)
  return { ok: false, error: `couldn't rebase onto ${onto.slice(0, 12)}: ${done.why ?? 'git refused'}` }
}

/** Finish a rebase whose conflicts have been resolved and staged. */
export const continueRebase = (dir: string): { ok: boolean; why?: string } =>
  scripted(['rebase', '--continue'], dir)

/** Put the branch back as the rebase found it. */
export const abortRebase = (dir: string): void => void scripted(['rebase', '--abort'], dir)

/** A rebase is stopped part-way through in this checkout. */
export function rebaseInProgress(dir: string): boolean {
  for (const name of ['rebase-merge', 'rebase-apply']) {
    const at = git(['rev-parse', '--git-path', name], dir)?.trim()
    if (at && fs.existsSync(path.resolve(dir, at))) return true
  }
  return false
}

/** The files a stopped rebase is waiting on. */
export const conflictedPaths = (dir: string): string[] =>
  (git(['diff', '--name-only', '--diff-filter=U'], dir) ?? '').split('\n').filter(Boolean)

/** Move the target branch to a commit in the USER's own checkout, where it is the branch
 *  they have out — so their index and working tree follow it, as a `git pull` would. */
export const fastForward = (commit: string): { ok: boolean; why?: string } =>
  scripted(['merge', '--ff-only', commit], REPO_ROOT)

/** Move the target branch's ref, refusing unless it still points where the landing found
 *  it. `moved` is the target having moved again under us, which is retried rather than
 *  reported. */
export function moveBranchRef(
  branch: string,
  commit: string,
  expect: string,
): { ok: true } | { moved: true } | { ok: false; error: string } {
  const done = tryGit(['update-ref', `refs/heads/${branch}`, commit, expect])
  if (done.ok) return { ok: true }
  if (branchTip(branch) !== expect) return { moved: true }
  return { ok: false, error: `couldn't move ${branch} to ${commit.slice(0, 12)}: ${done.why ?? 'git refused'}` }
}
