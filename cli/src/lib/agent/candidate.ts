// The candidate: the code a delivery has built so far, and the base it is judged against.
//
// A delivery records the repository's HEAD the moment it starts. Everything the delivery
// writes after that — committed or not — is the difference between that commit and the
// working tree, and that difference is what review reads. #303 gives each delivery its own
// worktree; until then the working tree is the candidate, which is also why review is told
// to check whether anything ELSE is in it.

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { KANBAN, rel, REPO_ROOT } from '../paths'

// A diff can be megabytes. This is only ever hashed or counted, never printed, so the cap
// is about not holding a whole repository in memory.
const MAX_DIFF = 64 * 1024 * 1024

// The board is not the candidate. `docs/kanban/` holds the card, the delivery records and
// the session state, and every one of them moves while a delivery works — so a diff that
// counted them would show the delivery changing the moment it wrote its own audit line, and
// "this correction changed nothing" could never be true. Review judges code.
const outsideBoard = (): string[] => ['--', '.', `:(exclude)${rel(KANBAN).split(path.sep).join('/')}`]

function git(args: string[]): string | null {
  try {
    const out = spawnSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: MAX_DIFF,
      windowsHide: true,
    })
    if (out.error || out.status !== 0) return null
    return out.stdout
  } catch {
    return null
  }
}

/** The commit a delivery starting now would be compared against, or null outside a git
 *  repository — a board kept in a folder nobody versioned still delivers, it just has no
 *  diff to show for it. */
export function candidateBase(): string | null {
  return git(['rev-parse', 'HEAD'])?.trim() || null
}

/** The candidate's diff against its base, as text. Null when there is no base, no git, or
 *  the command failed. Tracked changes only — a file the delivery created has never been
 *  in the index, so `git diff` says nothing about it; `untrackedFiles` is the other half. */
export function candidateDiff(base: string | undefined): string | null {
  if (!base) return null
  return git(['diff', base, ...outsideBoard()])
}

/** Files the delivery created that git has never seen. A whole new module is exactly the
 *  work review most needs to look at, and a diff against a base cannot show it. */
export function untrackedFiles(): string[] {
  return (git(['ls-files', '--others', '--exclude-standard', ...outsideBoard()]) ?? '')
    .split('\n')
    .filter(Boolean)
}

/** One line saying how big the candidate is — files changed, and the insertions and
 *  deletions — so a flow can say what is waiting without printing the diff itself. */
export function candidateStat(base: string | undefined): string | null {
  if (!base) return null
  const stat = git(['diff', '--shortstat', base, ...outsideBoard()])
  if (stat === null) return null
  const untracked = untrackedFiles().length
  const changed = stat.trim() || 'no tracked file changed'
  return untracked ? `${changed}, ${untracked} new file${untracked === 1 ? '' : 's'} not yet added` : changed
}

/** A short fingerprint of the candidate as it stands. Two corrections that left the tree
 *  byte-identical share one, which is how "no progress" is told from work that moved.
 *  Null when there is nothing to fingerprint. */
export function candidateMark(base: string | undefined): string | null {
  const diff = candidateDiff(base)
  if (diff === null) return null
  const hash = crypto.createHash('sha256').update(diff)
  // The new files too, by content: a correction that only rewrote a file git has never
  // seen changed the candidate, and a mark blind to it would read as no progress.
  for (const file of untrackedFiles()) {
    hash.update(file)
    try {
      hash.update(fs.readFileSync(path.join(REPO_ROOT, file)))
    } catch {
      // gone between the listing and the read — the next mark will see it either way
    }
  }
  return hash.digest('hex').slice(0, 16)
}
