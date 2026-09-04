// ---- the life of a workspace, as its owner runs it (#317) -------------------
//
// Creating one, renaming it, deleting it, and the machines registered to it. The service
// has answered all of these since #314; this is the half a screen calls, with the revision
// bookkeeping a rename needs kept here rather than in the pane.
//
// Reading and writing the board inside a workspace is ./workspace-board.ts (#315) and
// ../board/cloud.ts (#316). Nothing here touches a card.

import { newOpId } from '../board/ops'
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaceNodes,
  listWorkspaces,
  readWorkspace,
  removeWorkspaceNode,
  renameWorkspace,
  renameWorkspaceNode,
  type CloudWorkspace,
  type WireNode,
} from './client'

export type { CloudWorkspace, WireNode as CloudNode }

/** What every move here answers with: the thing, or the service's own sentence.
 *
 *  `stranded` is Cloud saying this workspace is not this account's — deleted, or never
 *  theirs, which it answers with one code on purpose. A caller acts on it rather than
 *  retrying: it is the difference between a workspace that cannot be reached right now and
 *  one there is no longer any point pointing at. */
export type WorkspaceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; stranded: boolean }

const refused = (call: { error: string; code?: string }): { ok: false; error: string; stranded: boolean } => ({
  ok: false,
  error: call.error,
  stranded: call.code === 'not_yours' || call.code === 'not_found',
})

/** Every workspace this account has — what "Open Cloud board" picks from. */
export async function readCloudWorkspaces(): Promise<WorkspaceResult<CloudWorkspace[]>> {
  const call = await listWorkspaces()
  return call.ok ? { ok: true, value: call.value.workspaces } : refused(call)
}

/** One, by id. */
export async function readCloudWorkspace(id: string): Promise<WorkspaceResult<CloudWorkspace>> {
  const call = await readWorkspace(id)
  return call.ok ? { ok: true, value: call.value.workspace } : refused(call)
}

/** Make one. The name is the user's; nothing about the folder is sent. */
export async function createCloudWorkspace(name: string): Promise<WorkspaceResult<CloudWorkspace>> {
  const call = await createWorkspace(newOpId(), name)
  return call.ok ? { ok: true, value: call.value.workspace } : refused(call)
}

/** Rename it. The revision it is at is read here rather than asked of the caller: a pane
 *  holding a stale one would fail a rename over a card another machine wrote. */
export async function renameCloudWorkspace(
  id: string,
  name: string,
): Promise<WorkspaceResult<CloudWorkspace>> {
  const at = await readWorkspace(id)
  if (!at.ok) return refused(at)
  const call = await renameWorkspace(id, newOpId(), name, at.value.workspace.revision)
  return call.ok ? { ok: true, value: call.value.workspace } : refused(call)
}

/** Delete it and everything in it. The confirmation that names what goes is the screen's;
 *  taking the pointer off the checkout is `unpointCheckout` in ./checkout.ts. */
export async function deleteCloudWorkspace(id: string): Promise<WorkspaceResult<{ name: string }>> {
  const call = await deleteWorkspace(id)
  return call.ok ? { ok: true, value: { name: call.value.name } } : refused(call)
}

// ---- the machines allowed to run this board's work --------------------------

export async function readWorkspaceNodes(id: string): Promise<WorkspaceResult<WireNode[]>> {
  const call = await listWorkspaceNodes(id)
  return call.ok ? { ok: true, value: call.value.nodes } : refused(call)
}

export async function renameCloudNode(
  id: string,
  nodeId: string,
  name: string,
): Promise<WorkspaceResult<WireNode>> {
  const call = await renameWorkspaceNode(id, nodeId, newOpId(), name)
  return call.ok ? { ok: true, value: call.value.node } : refused(call)
}

export async function removeCloudNode(id: string, nodeId: string): Promise<WorkspaceResult<true>> {
  const call = await removeWorkspaceNode(id, nodeId, newOpId())
  return call.ok ? { ok: true, value: true } : refused(call)
}
