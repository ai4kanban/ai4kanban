// The candidate: the code a delivery has built so far, and the base it is judged against.
//
// A delivery records the repository's HEAD the moment it starts, and everything it writes
// after that is the difference from there. WHERE that difference is read depends on how the
// delivery works. With automatic commits it builds on its own branch in its own worktree
// (#303), so the candidate is `git diff <base> <branch>` — settled, committed, and free of
// anything the user has open. In manual commit mode it works in the user's checkout, so the
// candidate is the working tree, which is also why review is told to check whether anything
// ELSE is in it.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { KANBAN, rel, REPO_ROOT } from '../paths'
import type { DeliveryRecord } from './types'
import { git, gitDiff, outsideBoard, worktreeDir } from './worktree'

// The board is not the candidate. `docs/kanban/` holds the card, the delivery records and
// the run state, and every one of them moves while a delivery works — so a diff that
// counted them would show the delivery changing the moment it wrote its own audit line, and
// Review judges code, so board bookkeeping must not appear in the candidate. The list is
// `agent/worktree.ts`'s, shared with the checkout and the commit check.

/** Where one delivery's code is read from. */
export interface Candidate {
  /** The commit it forked from. */
  base?: string
  /** The branch its work is committed on, when it has one. */
  branch?: string
  /** The checkout to run git in — its worktree, or the project itself. */
  cwd: string
}

/** How to read this delivery's code. */
export function candidateOf(delivery: DeliveryRecord): Candidate {
  return {
    base: delivery.base,
    branch: delivery.worktree ? delivery.branch : undefined,
    cwd: delivery.worktree ? worktreeDir(delivery.worktree) : REPO_ROOT,
  }
}

/** The commit a delivery starting now would be compared against, or null outside a git
 *  repository — a board kept in a folder nobody versioned still delivers, it just has no
 *  diff to show for it. */
export function candidateBase(): string | null {
  return git(['rev-parse', 'HEAD'])?.trim() || null
}

/** The candidate's diff against its base, as text. Null when there is no base, no git, or
 *  the command failed. On a branch that is the whole of it; in the working tree it is
 *  tracked changes only — a file the delivery created has never been in the index, so
 *  `git diff` says nothing about it, and `untrackedFiles` is the other half. */
export function candidateDiff(candidate: Candidate): string | null {
  if (!candidate.base) return null
  const range = candidate.branch ? [candidate.base, candidate.branch] : [candidate.base]
  return git(['diff', ...range, ...outsideBoard()], candidate.cwd)
}

/** Files the delivery created that git has never seen. A whole new module is exactly the
 *  work review most needs to look at, and a diff against a base cannot show it. None on a
 *  branch: everything a delivery built is committed before it is reviewed. */
export function untrackedFiles(candidate: Candidate): string[] {
  if (candidate.branch) return []
  return (git(['ls-files', '--others', '--exclude-standard', ...outsideBoard()], candidate.cwd) ?? '')
    .split('\n')
    .filter(Boolean)
}

/** One file git has never seen, drawn as a diff against nothing. `git diff <base>` cannot
 *  show one — the file has never been in the index — and a whole new module is often the
 *  work itself, so the snapshot of a working tree is the two put together.
 *
 *  `/dev/null` is git's own spelling for "against nothing" on every platform, and
 *  `--no-index` answers 1 for "they differ", which is why this is not `git`. */
export function untrackedDiff(candidate: Candidate, file: string): string {
  return gitDiff(['diff', '--no-index', '--', '/dev/null', file], candidate.cwd) ?? ''
}

/** The complete patch review judges, including files a manual delivery has not added. */
export function candidatePatch(candidate: Candidate): string | null {
  const tracked = candidateDiff(candidate)
  if (tracked === null) return null
  if (candidate.branch) return tracked
  return [tracked, ...untrackedFiles(candidate).map((file) => untrackedDiff(candidate, file))]
    .filter(Boolean)
    .join('')
}

/** Each changed file with its added and removed lines, ready for a printed review flow. */
export function candidateFileStats(candidate: Candidate): string[] | null {
  if (!candidate.base) return null
  const range = candidate.branch ? [candidate.base, candidate.branch] : [candidate.base]
  const tracked = git(['diff', '--numstat', ...range, ...outsideBoard()], candidate.cwd)
  if (tracked === null) return null

  const format = (line: string, fresh = false): string => {
    const [added = '?', removed = '?', ...rest] = line.split('\t')
    const file = rest.join('\t') || '(unknown file)'
    const change = added === '-' || removed === '-' ? 'binary' : `+${added} -${removed}`
    return `${file} (${change}${fresh ? ', new' : ''})`
  }
  const files = tracked.split('\n').filter(Boolean).map((line) => format(line))
  for (const file of untrackedFiles(candidate)) {
    const stat = gitDiff(['diff', '--no-index', '--numstat', '--', '/dev/null', file], candidate.cwd)?.trim()
    files.push(stat ? format(stat, true) : `${file} (new)`)
  }
  return files
}

/** One line saying how big the candidate is — files changed, and the insertions and
 *  deletions — so a flow can say what is waiting without printing the diff itself. */
export function candidateStat(candidate: Candidate): string | null {
  if (!candidate.base) return null
  const range = candidate.branch ? [candidate.base, candidate.branch] : [candidate.base]
  const stat = git(['diff', '--shortstat', ...range, ...outsideBoard()], candidate.cwd)
  if (stat === null) return null
  const untracked = untrackedFiles(candidate).length
  const changed = stat.trim() || 'no tracked file changed'
  return untracked ? `${changed}, ${untracked} new file${untracked === 1 ? '' : 's'} not yet added` : changed
}

/** A short fingerprint of the code changes as they stand. */
export function candidateMark(candidate: Candidate): string | null {
  const diff = candidateDiff(candidate)
  if (diff === null) return null
  const hash = crypto.createHash('sha256').update(diff)
  // New files count too: approval covers the whole tree, not only tracked files.
  for (const file of untrackedFiles(candidate)) {
    hash.update(file)
    try {
      hash.update(fs.readFileSync(path.join(candidate.cwd, file)))
    } catch {
      // gone between the listing and the read — the next mark will see it either way
    }
  }
  return hash.digest('hex').slice(0, 16)
}

/** Where the board's own files sit, for a flow that has to say they are not the
 *  candidate. */
export const boardFolder = (): string => rel(KANBAN)
