// Which boards one project holds (#407).
//
// A folder with `todo/` and `config.md` in it is a board — the same test `resolveBoard` uses,
// so a folder the switcher offers is one a command can open. Nothing registers a board:
// installing one is what puts it on this list, and deleting the folder takes it off.
//
// Two levels down and no further. A repository is not a place to go looking, and the two
// layouts that exist — `docs/kanban` and `<solution>/kanban` — are both exactly two.

import fs from 'node:fs'
import path from 'node:path'

import { SOLUTION_WORK, type Solution } from './solution'

const SKIP = new Set(['node_modules'])
const DEPTH = 2

/** One board a project holds. */
export interface BoardEntry {
  /** The board folder, absolute. */
  path: string
  /** What its work is called — "Engineering", "Marketing" — and the short form for a
   *  window too narrow for the whole path. */
  work: string
  short: string
  solution: Solution
}

const isBoard = (dir: string): boolean =>
  fs.existsSync(path.join(dir, 'todo')) && fs.existsSync(path.join(dir, 'config.md'))

// The board's own `config.md` says what it is; one without a `Solution` line is `product`,
// which is every board installed before this existed. Read here rather than through
// `solution()` in ./solution.ts, because that one answers for the board this process has
// open and these are the OTHER boards.
const LINE = /^- \*\*Solution\*\*\s*[—-]\s*([a-z-]+)/m

function solutionOf(dir: string): Solution {
  try {
    const found = LINE.exec(fs.readFileSync(path.join(dir, 'config.md'), 'utf8'))?.[1]
    return found && found in SOLUTION_WORK ? (found as Solution) : 'product'
  } catch {
    return 'product'
  }
}

function entry(dir: string): BoardEntry {
  const name = solutionOf(dir)
  const work = SOLUTION_WORK[name]
  return { path: dir, solution: name, work: work.long, short: work.short }
}

/** Every board under `root`, the project's own `docs/kanban` first when it has one. */
export function listBoards(root: string): BoardEntry[] {
  const found: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (isBoard(dir)) return void found.push(dir)
    if (depth >= DEPTH) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const child of entries) {
      if (!child.isDirectory() || child.name.startsWith('.') || SKIP.has(child.name)) continue
      walk(path.join(dir, child.name), depth + 1)
    }
  }
  walk(path.resolve(root), 0)
  const standard = path.join(path.resolve(root), 'docs', 'kanban')
  return found
    .sort((a, b) => (a === standard ? -1 : b === standard ? 1 : a.localeCompare(b)))
    .map(entry)
}
