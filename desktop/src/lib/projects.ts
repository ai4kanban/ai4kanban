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

/** The board in this project, or null when it has none.
 *
 *  The folder the user picked is the project — this looks in it and nowhere
 *  else, which is the same answer the board server gives the folder we hand it
 *  (kanban-ui/lib/paths.ts). The two have to agree: this side decides what the
 *  projects list says about a folder, that side decides what the window shows,
 *  and a list naming one project over a window showing the board from two
 *  folders up is worse than either being wrong alone. A folder with no board is
 *  not a dead end — the app offers to make one there. */
export function boardRootOf(dir: string): string | null {
  return fs.existsSync(path.join(dir, "docs", "kanban", "todo")) ? dir : null;
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
