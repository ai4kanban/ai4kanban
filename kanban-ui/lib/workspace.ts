// The workspace a Cloud board lives in, as its owner runs it (#317).
//
// Configuration → Workspace is the whole of this: the board's name and its rename, the
// machines allowed to run its work, the export, leaving Cloud, and the deletion. Onboarding
// runs the same moves before a board is open, through the app rather than through here
// (desktop/src/lib/cloud.ts).
//
// Every one of them is the board's own rules. Nothing here decides what a workspace is,
// what leaving costs, or what the offered commit carries.

import { getCopy } from "@/i18n";
import { boardRules, type CloudChange, type WorkspaceNodeWire } from "./cli";
import { repoRoot } from "./paths";
import { DEFAULT_LANGUAGE } from "./types";

// Read at load, so English: rules that predate the workspace controls may predate the
// language setting too.
const TOO_OLD = getCopy(DEFAULT_LANGUAGE).messages.rules.tooOldForCloud;

export type WorkspaceMove = { ok: true } | { ok: false; error: string };

/** Everything the pane draws in one read. */
export interface WorkspaceView {
  /** The workspace this checkout points at. Empty on a Local board, where the pane is not
   *  offered at all. */
  workspaceId: string;
  name: string;
  nodes: WorkspaceNodeWire[];
  /** The going-Cloud commit this checkout still holds uncommitted, when it holds one. The
   *  offer comes back here until it is taken. */
  change: CloudChange | null;
  /** Cloud's own sentence, when a read of it was refused. The name and the pointer are
   *  still true, so the pane draws with what it has and says this above it. */
  error: string;
  /** Cloud says this workspace is not this account's — deleted, or never theirs. There is
   *  nothing to write back, so leaving it is only taking the pointer off. A workspace that
   *  merely could not be reached is NOT this: leaving that one still writes it back. */
  stranded: boolean;
}

const NOTHING: WorkspaceView = {
  workspaceId: "",
  name: "",
  nodes: [],
  change: null,
  error: "",
  stranded: false,
};

/** The workspace this checkout points at, or empty on a Local board. The pointer alone —
 *  no network, and no opinion about whether the workspace can be read. */
export async function workspaceId(): Promise<string> {
  const rules = await boardRules();
  return rules.readBoardPointer?.(repoRoot())?.workspace ?? "";
}

/** What Configuration → Workspace draws. */
export async function workspaceView(): Promise<WorkspaceView> {
  const rules = await boardRules();
  const root = repoRoot();
  const pointer = rules.readBoardPointer?.(root) ?? null;
  if (!pointer?.workspace) return NOTHING;

  const held: WorkspaceView = {
    ...NOTHING,
    workspaceId: pointer.workspace,
    name: pointer.name ?? "",
    change: pendingChange(rules.readCloudChange?.(root, "go")),
  };
  if (!rules.readCloudWorkspace || !rules.readWorkspaceNodes) return { ...held, error: TOO_OLD };

  const read = await rules.readCloudWorkspace(pointer.workspace);
  if (!read.ok) return { ...held, error: read.error, stranded: read.stranded === true };
  const nodes = await rules.readWorkspaceNodes(pointer.workspace);
  return {
    ...held,
    name: read.value.name,
    nodes: nodes.ok ? nodes.value : [],
    error: nodes.ok ? "" : nodes.error,
  };
}

/** The offer is only made while there is something to commit. */
const pendingChange = (change: CloudChange | undefined): CloudChange | null =>
  change && change.git && !change.clean ? change : null;

export async function renameWorkspace(name: string): Promise<WorkspaceMove> {
  const rules = await boardRules();
  const id = rules.readBoardPointer?.(repoRoot())?.workspace ?? "";
  if (!rules.renameCloudWorkspace || !id) return { ok: false, error: TOO_OLD };
  const done = await rules.renameCloudWorkspace(id, name);
  return done.ok ? { ok: true } : { ok: false, error: done.error };
}

export async function renameWorkspaceNode(nodeId: string, name: string): Promise<WorkspaceMove> {
  const rules = await boardRules();
  const id = rules.readBoardPointer?.(repoRoot())?.workspace ?? "";
  if (!rules.renameCloudNode || !id) return { ok: false, error: TOO_OLD };
  const done = await rules.renameCloudNode(id, nodeId, name);
  return done.ok ? { ok: true } : { ok: false, error: done.error };
}

export async function removeWorkspaceNode(nodeId: string): Promise<WorkspaceMove> {
  const rules = await boardRules();
  const id = rules.readBoardPointer?.(repoRoot())?.workspace ?? "";
  if (!rules.removeCloudNode || !id) return { ok: false, error: TOO_OLD };
  const done = await rules.removeCloudNode(id, nodeId);
  return done.ok ? { ok: true } : { ok: false, error: done.error };
}

/**
 * Write the whole board out as markdown into `dir`.
 *
 * The preview keeps no backups, so this is the only copy anybody restores from — it carries
 * the archive and the finished work as well as the live board, and it refuses a folder that
 * already holds one.
 */
export async function exportWorkspace(dir: string): Promise<WorkspaceMove> {
  const rules = await boardRules();
  const id = rules.readBoardPointer?.(repoRoot())?.workspace ?? "";
  if (!rules.exportCloudBoard || !id) return { ok: false, error: TOO_OLD };
  if (!dir) return { ok: false, error: "Name the folder to write the board into." };
  const done = await rules.exportCloudBoard(id, dir);
  return done.ok ? { ok: true } : { ok: false, error: done.error ?? "" };
}

/** What a leave or a delete left behind for the user to commit. `cards` is what a leave
 *  wrote back into `docs/kanban/` — zero for a delete, and for a stranded workspace there
 *  was nothing to write back. It is NOT `change.cards`: that one counts every board file
 *  entering git, which is the offer's number and not this sentence's. */
export type WorkspaceExit =
  | { ok: true; cards: number; change: CloudChange | null }
  | { ok: false; error: string };

/**
 * Leave Cloud: the board back in `docs/kanban/`, the pointer off, the folder un-ignored.
 *
 * The change is left uncommitted on purpose — it is one commit the user reads first, and
 * the board they get back is one git tracks only once they take it.
 */
export async function leaveWorkspace(force = false): Promise<WorkspaceExit> {
  const rules = await boardRules();
  const root = repoRoot();
  const id = rules.readBoardPointer?.(root)?.workspace ?? "";
  if (!rules.leaveCloud || !rules.abandonCloud || !id) return { ok: false, error: TOO_OLD };
  // A workspace this machine cannot read has nothing to write back, so leaving it is only
  // taking the pointer off — whatever markdown `docs/kanban/` holds becomes the board again.
  if (force) return { ok: true, cards: 0, change: leftChange(rules.abandonCloud(root).change) };
  const done = await rules.leaveCloud(root, id);
  return done.ok
    ? { ok: true, cards: done.value.cards, change: leftChange(done.value.change) }
    : { ok: false, error: done.error };
}

/**
 * Delete the workspace and everything in it, and stop this checkout pointing at it.
 *
 * The confirmation that names what goes is the pane's. There is no grace window and no
 * backup: the owner's export is the only copy anybody restores from.
 */
export async function deleteWorkspace(): Promise<WorkspaceExit> {
  const rules = await boardRules();
  const root = repoRoot();
  const id = rules.readBoardPointer?.(root)?.workspace ?? "";
  if (!rules.deleteCloudWorkspace || !rules.abandonCloud || !id) return { ok: false, error: TOO_OLD };
  const done = await rules.deleteCloudWorkspace(id);
  if (!done.ok) return { ok: false, error: done.error };
  // The workspace is gone, so the checkout must stop naming it — a checkout left pointed at
  // nothing opens onto a refusal every time.
  return { ok: true, cards: 0, change: leftChange(rules.abandonCloud(root).change) };
}

const leftChange = (change: CloudChange): CloudChange | null =>
  change.git && !change.clean ? change : null;

/** Take the offered commit, going either way. */
export async function commitCloudChange(kind: "go" | "leave"): Promise<WorkspaceMove> {
  const rules = await boardRules();
  if (!rules.commitCloudChange) return { ok: false, error: TOO_OLD };
  const done = rules.commitCloudChange(repoRoot(), kind);
  return done.ok ? { ok: true } : { ok: false, error: done.error ?? "" };
}
