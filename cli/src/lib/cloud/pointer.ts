// ---- which board a checkout opens (#316) ------------------------------------
//
// `.ai4kanban.json` at the repository root names the workspace this checkout's board lives
// in. A checkout with no pointer is a Local board and always was; a checkout with one opens
// the workspace, whatever markdown is sitting in `docs/kanban/`.
//
// Why the root, and not inside the board's own folder: on a Cloud checkout `docs/kanban/`
// is a git-ignored copy of the workspace, so a pointer in there would be both uncommitted
// and unreachable — board discovery has to find the board BEFORE anything is hydrated. The
// root is already where the board keeps its one line outside its own folder, beside `.akb/`.
//
// It carries no secret and no address of any machine: a workspace id means nothing without
// the sign-in this machine holds in `~/.ai4kanban/` (../machine/home.ts). That is what lets
// it be committed and shared with everyone on the repository.

import fs from 'node:fs'
import path from 'node:path'

/** The one file a Cloud checkout commits. */
export const POINTER_FILE = '.ai4kanban.json'

export interface BoardPointer {
  version: 1
  /** The workspace this checkout's board lives in. */
  workspace: string
  /** The service it lives in, when it is not the one this build carries. Kept so a checkout
   *  pointed at a throwaway project stays pointed at it. */
  service?: string
  /** What to call the board before anything has been read. */
  name?: string
}

export const pointerPath = (root: string): string => path.join(root, POINTER_FILE)

/**
 * The pointer this checkout carries, or null for a Local board.
 *
 * Anything that is not a pointer — absent, half-written, naming no workspace — reads as
 * none: a damaged file must leave the board Local rather than take the whole board down,
 * and `akb install` in the same folder is what a person does next either way.
 */
export function readPointer(root: string): BoardPointer | null {
  let raw: string
  try {
    raw = fs.readFileSync(pointerPath(root), 'utf8')
  } catch {
    return null
  }
  try {
    const held = JSON.parse(raw) as Partial<BoardPointer>
    const workspace = typeof held.workspace === 'string' ? held.workspace.trim() : ''
    if (!workspace) return null
    return {
      version: 1,
      workspace,
      ...(typeof held.service === 'string' && held.service ? { service: held.service } : {}),
      ...(typeof held.name === 'string' && held.name ? { name: held.name } : {}),
    }
  } catch {
    return null
  }
}

/** Point a checkout at a workspace. #317 is what calls this; nothing here creates, imports
 *  or names a workspace. */
export function writePointer(root: string, pointer: Omit<BoardPointer, 'version'>): void {
  fs.writeFileSync(pointerPath(root), `${JSON.stringify({ version: 1, ...pointer }, null, 2)}\n`)
}
