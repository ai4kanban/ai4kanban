// What a board's work IS — the first of the two solutions the kernel carries (#406, #407).
//
// `product` is code: a card is a change, a build is a worktree and a branch, and the flows
// are the ones this command has always shipped. `marketing` is content: a card is a topic,
// a build is a file under `content/`, and a handful of flows read differently.
//
// It is one line in the board's own `config.md`, so a board is what its folder says it is
// and nothing registers one anywhere else. A board with no line is `product` — every board
// installed before this existed has none, and none of them should have to be edited.

import fs from 'node:fs'

import { CONFIG } from './paths'
import { SOLUTIONS, type Solution } from './view/types'

// The names themselves are in `view/types.ts`: a screen picks its face from them (#411) and
// that file is the one the browser gets a copy of.
export { SOLUTIONS }
export type { Solution }

// `- **Solution** — marketing`, the way every other setting in config.md is written.
const LINE = /^- \*\*Solution\*\*\s*[—-]\s*([a-z-]+)/m

const isSolution = (name: string): name is Solution => (SOLUTIONS as readonly string[]).includes(name)

/** This board's solution, read from its `config.md`. */
export function solution(): Solution {
  if (!fs.existsSync(CONFIG)) return 'product'
  const found = LINE.exec(fs.readFileSync(CONFIG, 'utf8'))?.[1]
  return found && isSolution(found) ? found : 'product'
}

/** The word the UI puts on the board's badge — the WORK, not the folder and not the
 *  solution's id: the chip already says which folder this is. */
export const SOLUTION_WORK: Record<Solution, { long: string; short: string }> = {
  product: { long: 'Engineering', short: 'Eng' },
  marketing: { long: 'Marketing', short: 'Mktg' },
}

/** Whether a build on this board is a git delivery — a worktree, a branch, a review against
 *  the diff and a landing. False on `marketing`, where the deliverable is a file the user
 *  edits and the review is that edit (#407). */
export const deliversWithGit = (): boolean => solution() !== 'marketing'
