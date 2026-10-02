// ---- the project description's triggers (#1268) ------------------------------
//
// `memory/project.md` is rewritten only when there is something new to describe: the file has
// no body yet, or commits have landed since the last pass. Both are answered here, in code, so
// a day with no change starts no agent at all.

import fs from 'node:fs'

import { PROJECT_MD } from '../paths'
import { git } from './worktree'

/** Whether `project.md` holds a description — any `## ` section beyond the starter header. */
export function projectDescribed(): boolean {
  try {
    return /^## /m.test(fs.readFileSync(PROJECT_MD, 'utf8'))
  } catch {
    return false
  }
}

/** Whether the checked-out branch has a commit newer than `since` (ms since the epoch), by
 *  commit time. Null when the project is not a git repository, or has no commit yet. */
export function commitsSince(since: number): boolean | null {
  const out = git(['log', '-1', '--format=%H', `--since=${new Date(since).toISOString()}`, 'HEAD'])
  return out === null ? null : out.trim() !== ''
}
