// Which boards one project holds (#407).
//
// A folder with `todo/` and `config.md` in it is a board — the same test `resolveBoard` uses,
// so a folder the switcher offers is one a command can open. Nothing registers a board:
// installing one is what puts it on this list, and deleting the folder takes it off.
//
// Two levels down and no further. A repository is not a place to go looking, and a board
// folder is `docs/kanban` or one folder deep beside it.

import fs from 'node:fs'
import path from 'node:path'

const SKIP = new Set(['node_modules'])
const DEPTH = 2

/** One board a project holds. */
export interface BoardEntry {
  /** The board folder, absolute. */
  path: string
  /** The same folder from the project root — `docs/kanban` — which is what tells two
   *  boards of one project apart. Every board folder is called `kanban`, so the name is
   *  the path and not its last part. */
  name: string
}

const isBoard = (dir: string): boolean =>
  fs.existsSync(path.join(dir, 'todo')) && fs.existsSync(path.join(dir, 'config.md'))

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
  const base = path.resolve(root)
  walk(base, 0)
  const standard = path.join(base, 'docs', 'kanban')
  return found
    .sort((a, b) => (a === standard ? -1 : b === standard ? 1 : a.localeCompare(b)))
    .map((dir) => ({ path: dir, name: path.relative(base, dir) || path.basename(dir) }))
}
