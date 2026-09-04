// ---- taking a checkout to Cloud, and bringing it back (#317) ----------------
//
// The two moves onboarding and the workspace controls make, each one call:
//
//   • **going** — create or pick a workspace, carry this folder's cards into it if the user
//     asked, and point the checkout at it;
//   • **leaving** — write the workspace's board back into `docs/kanban/`, take the pointer
//     off and un-ignore the folder, so the cards the user gets back are cards git tracks.
//
// Both leave the repository dirty on purpose. The commit is one change the user reads first
// (./checkout.ts), and declining it leaves a checkout that still works.

import fs from 'node:fs'
import path from 'node:path'

import { clearBoardCopy, unpackBoard } from '../board/transfer'
import { readCloudChange, pointAtWorkspace, unpointCheckout, type CloudChange } from './checkout'
import { readPointer } from './pointer'
import { importBoard, readWorkspacePayload, type Progress } from './workspace-board'
import { createCloudWorkspace, type CloudWorkspace } from './workspace-life'

/** What a folder already holds, so onboarding can say it before anything is decided: all
 *  four moves pick a project folder, and what the folder turns out to be is what happens. */
export interface FolderState {
  path: string
  name: string
  /** A board is already installed here. */
  board: boolean
  /** How many cards are in `docs/kanban/todo/` — what an import would carry. */
  cards: number
  /** There is a git repository over it. Without one the Cloud path still runs; there is
   *  simply nothing to commit the pointer to yet. */
  git: boolean
  /** It already points at a workspace. */
  workspace: string
}

export function readFolder(dir: string): FolderState {
  const todo = path.join(dir, 'docs', 'kanban', 'todo')
  return {
    path: dir,
    name: path.basename(dir) || dir,
    board: fs.existsSync(todo),
    cards: countCards(todo),
    git: fs.existsSync(path.join(dir, '.git')),
    workspace: readPointer(dir)?.workspace ?? '',
  }
}

/** Every card file under `todo/`, groups included. `README.md` is the index, not a card. */
function countCards(todo: string): number {
  let held = 0
  const walk = (dir: string): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name))
      else if (entry.name.endsWith('.md') && entry.name !== 'README.md') held++
    }
  }
  walk(todo)
  return held
}

export interface GoCloudRequest {
  /** The project folder. A Cloud board is still a folder on this machine. */
  root: string
  /** The workspace to open, or empty to make a new one. */
  workspaceId?: string
  /** What to call a new one. */
  name?: string
  /** Carry the cards already in `docs/kanban/` into the workspace. */
  importCards?: boolean
}

export interface GoneCloud {
  workspace: { id: string; name: string }
  /** How many cards the import carried, or 0 when none was asked for. */
  imported: number
  /** What the offered commit would carry. */
  change: CloudChange
}

export type GoCloudResult = { ok: true; value: GoneCloud } | { ok: false; error: string }

/**
 * Point `root` at a workspace, making one and filling it from this folder when asked.
 *
 * The pointer is written LAST: a folder that ends up pointed at a workspace an import never
 * finished would open onto half a board, and everything before the pointer is either
 * repeatable or nothing at all.
 */
export async function goCloud(
  request: GoCloudRequest,
  say: Progress = () => {},
): Promise<GoCloudResult> {
  let workspace: { id: string; name: string }
  if (request.workspaceId) {
    workspace = { id: request.workspaceId, name: request.name ?? '' }
  } else {
    const made: { ok: true; value: CloudWorkspace } | { ok: false; error: string } =
      await createCloudWorkspace(request.name ?? '')
    if (!made.ok) return { ok: false, error: made.error }
    workspace = { id: made.value.id, name: made.value.name }
  }

  let imported = 0
  if (request.importCards) {
    const moved = await importBoard(workspace.id, say)
    if (!moved.ok) return { ok: false, error: moved.error }
    imported = moved.moved.cards
  }

  pointAtWorkspace(request.root, workspace.id, workspace.name)
  return { ok: true, value: { workspace, imported, change: readCloudChange(request.root, 'go') } }
}

export interface LeftCloud {
  cards: number
  change: CloudChange
}

export type LeaveCloudResult = { ok: true; value: LeftCloud } | { ok: false; error: string }

/**
 * Write the workspace back into `root` as a Local board, and stop pointing at it.
 *
 * The copy in `docs/kanban/` is cleared first and replaced whole: it is a copy of this same
 * workspace, so nothing of the user's is thrown away — but a board half from a read and half
 * from the workspace is not a board anybody can trust.
 */
export async function leaveCloud(
  root: string,
  workspaceId: string,
  say: Progress = () => {},
): Promise<LeaveCloudResult> {
  const read = await readWorkspacePayload(workspaceId)
  if (!read.ok) return { ok: false, error: read.error }

  clearBoardCopy()
  const written = unpackBoard(read.payload, root)
  say(`wrote ${written.cards} cards and ${written.documents} files back into docs/kanban/`)
  unpointCheckout(root)

  return { ok: true, value: { cards: written.cards, change: readCloudChange(root, 'leave') } }
}

/**
 * Leave a workspace this machine cannot read — deleted, or somebody else's (#317).
 *
 * There is nothing to write back, so this only stops the checkout pointing at it: whatever
 * markdown `docs/kanban/` holds becomes the board again, and the cards are in git history
 * either way. The same call takes the pointer off a checkout whose workspace the owner has
 * just deleted.
 */
export function abandonCloud(root: string): LeftCloud {
  unpointCheckout(root)
  return { cards: 0, change: readCloudChange(root, 'leave') }
}
