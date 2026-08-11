// What is true about a project folder right now, so the projects list can say
// it: is the folder still there, does it hold a board, and is an agent run going
// in it.
//
// The run check reads the board's own session registry
// (`docs/kanban/.sessions.json`, written by kanban-ui/lib/registry.ts) rather
// than asking the server that owns the project. It has to: a project whose
// server this app never started — one left mid-run when the app was last
// quit — should still say so, and a file the board already keeps is a truer
// answer than anything the app could remember on its own.

import fs from "node:fs";
import path from "node:path";
import type { ProjectInfo } from "../shared/bridge";

// The same walk up the board UI does (kanban-ui/lib/paths.ts): a user may point
// the app at a folder inside the repo, and the board is wherever
// `docs/kanban/todo/` first turns up above it.
const MAX_WALK_UP = 8;

/** The repo root holding this folder's board, or null when there is no board at
 *  or above it. */
export function boardRootOf(dir: string): string | null {
  let at = dir;
  for (let i = 0; i < MAX_WALK_UP; i++) {
    if (fs.existsSync(path.join(at, "docs", "kanban", "todo"))) return at;
    const parent = path.dirname(at);
    if (parent === at) break;
    at = parent;
  }
  return null;
}

function isDir(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

// Signal 0 doesn't kill; it asks whether the pid is there. EPERM means alive but
// somebody else's — still alive. Same test the board's own registry uses.
function pidAlive(pid: unknown): boolean {
  if (typeof pid !== "number" || !pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

/** Whether an agent run is going in this project — a live session in its
 *  registry whose process is still there. Best-effort: a project with no board,
 *  no registry file or an unreadable one simply has no run going. */
export function hasLiveRun(dir: string): boolean {
  const root = boardRootOf(dir);
  if (!root) return false;
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(root, "docs", "kanban", ".sessions.json"), "utf8"),
    );
    const live = (raw as { live?: unknown } | null)?.live;
    if (!Array.isArray(live)) return false;
    return live.some((r) => pidAlive((r as { pid?: unknown } | null)?.pid));
  } catch {
    return false;
  }
}

/** One line of the projects list. `name` is the folder's own name, which is what
 *  a person calls the project; the whole path sits beside it, since two projects
 *  can share a name. */
export function describe(dir: string, { open = false }: { open?: boolean } = {}): ProjectInfo {
  const there = isDir(dir);
  return {
    path: dir,
    name: path.basename(dir) || dir,
    // The folder was moved or deleted since it was opened. The line says so and
    // offers to be removed, rather than opening a window onto nothing.
    missing: !there,
    hasBoard: there ? Boolean(boardRootOf(dir)) : false,
    running: there ? hasLiveRun(dir) : false,
    open,
  };
}
