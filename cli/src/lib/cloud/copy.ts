// ---- what this machine knows about its copy of a workspace (#316) -----------
//
// `~/.ai4kanban/copies.json`, beside the sign-in and the boards list. One row per checkout:
// which workspace it holds a copy of, the revision that copy was read at, when it was read,
// and this machine's node row in that workspace.
//
// It lives here rather than in `docs/kanban/` for the reason every other machine-level file
// does: a board file would be uploaded on the next write and taken back by every other
// machine, and "when THIS machine last read the workspace" is true of this machine alone.
// It is also what lets a board that opened offline say how old the screen is before any
// call has been made.

import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'

export interface BoardCopy {
  /** The checkout, in one spelling (see `canonical` below). */
  path: string
  workspaceId: string
  /** The workspace revision the copy was hydrated at. */
  revision: string
  /** When the copy was last read from the workspace, as an ISO timestamp. */
  readAt: string
  /** This machine's node row in that workspace, once it has registered. */
  nodeId?: string
}

interface Held {
  version: 1
  copies: BoardCopy[]
}

export const copiesFile = (): string => path.join(machineHome(), 'copies.json')

/** One spelling of a folder, so two names for it are one copy. The board points itself at
 *  the real path it found (`setBoardRoot`), and on macOS `/tmp` is a symlink. */
function canonical(root: string): string {
  try {
    return fs.realpathSync(root)
  } catch {
    return path.resolve(root)
  }
}

function held(): Held {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(copiesFile(), 'utf8'))
    const copies = (parsed as Held)?.copies
    if (!Array.isArray(copies)) return { version: 1, copies: [] }
    return {
      version: 1,
      copies: copies.filter(
        (c) => c && typeof c.path === 'string' && typeof c.workspaceId === 'string',
      ),
    }
  } catch {
    return { version: 1, copies: [] }
  }
}

function write(next: Held): void {
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = copiesFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, file)
  } catch {
    // A machine with no home directory to write to still opens its board; what it loses is
    // being able to say how old the copy is after a restart.
  }
}

/** What this machine knows about the copy in `root`, or null when it has never read one. */
export function readBoardCopy(root: string): BoardCopy | null {
  const here = canonical(root)
  return held().copies.find((c) => canonical(c.path) === here) ?? null
}

/** Write down that the copy in `root` was just read from `workspaceId`. */
export function rememberBoardCopy(
  root: string,
  fields: Omit<BoardCopy, 'path'> & Partial<Pick<BoardCopy, 'path'>>,
): BoardCopy {
  const resolved = canonical(root)
  const state = held()
  const at = state.copies.findIndex((c) => canonical(c.path) === resolved)
  const next: BoardCopy = { ...fields, path: resolved }
  if (at < 0) state.copies.push(next)
  else state.copies[at] = { ...state.copies[at], ...next }
  write(state)
  return next
}

/** Forget it — a checkout that stopped pointing at a workspace, or one being torn down. */
export function forgetBoardCopy(root: string): void {
  const resolved = canonical(root)
  const state = held()
  const at = state.copies.findIndex((c) => canonical(c.path) === resolved)
  if (at < 0) return
  state.copies.splice(at, 1)
  write(state)
}
