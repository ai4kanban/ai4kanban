// One project's machine state — where the board keeps what it cleans up itself (#590).
//
// The run record and its logs, the chats, the working drawings, the comment batches and the
// locks are this machine's answer to what has been done in one project. None of it is the
// repository's, and all of it used to sit in `docs/kanban/` behind a list of ignore rules
// that grew with every new kind of local state. It lives under the machine folder now, one
// folder per project, so a checkout carries only what it commits.
//
// A project IS its board folder, resolved through symlinks: two checkouts of one repository
// are two projects, `docs/kanban` and `marketing/kanban` in one repository are two, and a
// board reached through a symlinked path is the same project as the board itself. Rename or
// move the folder and it is a new project — the old folder stays where it is, and the path
// written into its `board.json` is how someone finds it again.
//
// Nothing here moves anything. A board that held all of this in `docs/kanban/` keeps holding
// it: the old files are not read, not merged and not deleted, and the history a new folder
// lists starts empty. Finish the runs in flight on the old version, stop it, then switch —
// the old files are the user's to delete once they are sure they are done with them.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from './home'

/** The folder under the machine home that holds them all. */
const PROJECTS = 'projects'

/** How much of the hash names the folder. Ten hex digits over the board paths on one
 *  machine: short enough to read, far past anything that collides. */
const ID_LENGTH = 10

/** The path record, so a user who moved a project can find what the old one left. */
const RECORD = 'board.json'

/** What the board keeps in there. The locks are folders like the rest — `withLock` makes
 *  one with `mkdir` and removes it when the write is done. */
export const SESSIONS_FILE = 'sessions.json'
export const SESSIONS_FOLDER = 'sessions'
export const CHATS_FOLDER = 'chats'
export const MOCKUPS_FOLDER = 'mockups'
export const COMMENTS_FOLDER = 'comments'
export const BOARD_LOCK = 'board.lock'
export const SESSIONS_LOCK = 'sessions.lock'
export const INDEX_LOCK = 'index.lock'

/** The path with every symlink resolved.
 *
 *  A folder that is not there yet is resolved as far as it goes and rebuilt from there: the
 *  board `init` is about to make, and the board a test has just deleted, are the same project
 *  as the board itself. Resolving only what exists would make the answer depend on WHEN it is
 *  asked — on macOS `/var` is a symlink, so `init` would pick one folder and the next command
 *  another. */
function realPathOf(dir: string): string {
  const here = path.resolve(dir)
  const rest: string[] = []
  let at = here
  for (;;) {
    try {
      return path.join(fs.realpathSync(at), ...rest)
    } catch {
      const up = path.dirname(at)
      if (up === at) return here
      rest.unshift(path.basename(at))
      at = up
    }
  }
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'board'

/** The readable half of the folder name, off the SAME real path the id is taken from — a
 *  board reached through a symlink is one project, name and all. Every board folder on earth
 *  is called `kanban`, so the name that means something is the project's, or the folder
 *  holding a second board (`marketing/kanban` reads as `marketing-kanban`). */
function readableName(real: string): string {
  const here = path.basename(real)
  const up = path.dirname(real)
  if (here !== 'kanban') return slug(here)
  return path.basename(up) === 'docs' ? slug(path.basename(path.dirname(up))) : slug(`${path.basename(up)}-kanban`)
}

/** Where this board's machine state lives — `<name>-<id>`, the id being sha256 over the
 *  board's real path cut to ten hex digits.
 *
 *  Copied in `desktop/src/lib/projects.ts`, which reads the run record from the main process
 *  without loading the rules: change one and the app stops seeing runs.
 *
 *  Pure — it makes nothing and reads nothing but the symlinks on the way to the board — so
 *  every command can work it out up front. */
export function projectStateDir(board: string): string {
  const real = realPathOf(board)
  const id = createHash('sha256').update(real).digest('hex').slice(0, ID_LENGTH)
  return path.join(machineHome(), PROJECTS, `${readableName(real)}-${id}`)
}

/** Make this board's machine folder and record which board it is for. It reads and writes
 *  nothing under the board folder.
 *
 *  Idempotent, and asked of every command rather than remembered: one `mkdir` and one read
 *  of the record, against a process that would otherwise go on believing an answer someone
 *  has since deleted the folder for. */
export function ensureProjectState(board: string): string {
  const dir = projectStateDir(board)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeRecord(dir, board)
  return dir
}

/** Which board a machine folder belongs to, as it was recorded. Null when the folder has no
 *  record — one made by hand, or one from a version before the record. */
export function recordedBoard(dir: string): string | null {
  try {
    const held: unknown = JSON.parse(fs.readFileSync(path.join(dir, RECORD), 'utf8'))
    const board = (held as { board?: unknown } | null)?.board
    return typeof board === 'string' && board ? board : null
  } catch {
    return null
  }
}

function writeRecord(dir: string, board: string): void {
  const real = realPathOf(board)
  if (recordedBoard(dir) === real) return
  try {
    fs.writeFileSync(path.join(dir, RECORD), `${JSON.stringify({ board: real, recordedAt: new Date().toISOString() }, null, 2)}\n`)
  } catch {
    // A folder that cannot be written is a folder nothing else here will manage either;
    // the failure belongs to whatever tries to use it, not to the note about it.
  }
}
