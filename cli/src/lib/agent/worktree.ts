import { spawnSync, type SpawnSyncOptions } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { AKB_DIR, KANBAN, REPO_ROOT, rel } from '../paths'

// A diff can be megabytes. Nothing here prints one — they are hashed, counted or written
// to a file — so the cap is about not holding a whole repository in memory.
const MAX_OUTPUT = 64 * 1024 * 1024
export const gitLimits = { timeoutMs: 30_000 }

export class GitTimeoutError extends Error {}

function spawnGit(args: string[], options: SpawnSyncOptions) {
  const out = spawnSync('git', args, {
    ...options, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: gitLimits.timeoutMs, killSignal: 'SIGKILL',
  })
  if ((out.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT') throw new GitTimeoutError(`Git ${args[0]} timed out after ${gitLimits.timeoutMs / 1000}s; the command was killed.`)
  return out
}

/** Run one git command and hand back its stdout, or null when it failed. */
export function git(args: string[], cwd = REPO_ROOT): string | null {
  try {
    const out = spawnGit(args, { cwd, encoding: 'utf8', maxBuffer: MAX_OUTPUT, windowsHide: true })
    if (out.error || out.status !== 0) return null
    return out.stdout
  } catch (error) {
    if (error instanceof GitTimeoutError) throw error
    return null
  }
}

/** Run one git diff and hand back what it printed. Unlike `git`, exit 1 is not a failure:
 *  `diff --no-index` answers 1 for "the two differ", which is the ordinary case. */
export function gitDiff(args: string[], cwd = REPO_ROOT): string | null {
  try {
    const out = spawnGit(args, { cwd, encoding: 'utf8', maxBuffer: MAX_OUTPUT, windowsHide: true })
    if (out.error || (out.status !== 0 && out.status !== 1)) return null
    return out.stdout
  } catch (error) {
    if (error instanceof GitTimeoutError) throw error
    return null
  }
}

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

/** That path as it really is on this machine. */
export const worktreeDir = (relPath: string): string => path.resolve(REPO_ROOT, relPath)

// ---- the state of the user's own checkout -----------------------------------

/** The commit a delivery starting now forks from — the repository's HEAD — or null
 *  outside a git repository and in one with no commit yet. */
export const headCommit = (cwd = REPO_ROOT): string | null =>
  git(['rev-parse', 'HEAD'], cwd)?.trim() || null

/** The branch checked out right now, or null on a detached HEAD (and outside git). */
export function currentBranch(cwd = REPO_ROOT): string | null {
  const name = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd)?.trim()
  return name || null
}

/** True when this delivery's worktree is still on disk and still git's. */
export const worktreeExists = (relPath: string | undefined): boolean =>
  !!relPath && fs.existsSync(path.join(worktreeDir(relPath), '.git'))
