// What is true about a project folder right now, so the projects list can say
// it: is the folder still there, does it hold a board, and is an agent run going
// in it.
//
// Read the same checkout-local registry as the CLI.

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

/** The board folder itself, for a folder that is either a project or a board.
 *
 *  A window may be showing a project's second board — `marketing/kanban`, which
 *  has its own `todo/` and `config.md` and its own session registry (#407). Its
 *  runs are as real as the first board's, so they have to be findable under the
 *  folder the window was actually handed. */
function sessionsBoardOf(dir: string): string | null {
  if (fs.existsSync(path.join(dir, "docs", "kanban", "todo"))) return path.join(dir, "docs", "kanban");
  if (fs.existsSync(path.join(dir, "todo")) && fs.existsSync(path.join(dir, "config.md"))) return dir;
  return null;
}

/** Whether this checkout's board lives in a Cloud workspace (#317). The pointer at the
 *  repository root is the whole answer — a workspace id means nothing without the sign-in
 *  this machine holds, which is what lets it be committed and shared. */
export function pointsAtWorkspace(dir: string): boolean {
  try {
    const held: unknown = JSON.parse(fs.readFileSync(path.join(dir, ".ai4kanban.json"), "utf8"));
    return typeof (held as { workspace?: unknown } | null)?.workspace === "string";
  } catch {
    return false;
  }
}

/** A path with every symlink resolved, as far as the folder exists — the rest is put back
 *  on, so the answer does not change the day the folder appears. */
function realPathOf(dir: string): string {
  const here = path.resolve(dir);
  const rest: string[] = [];
  let at = here;
  for (;;) {
    try {
      return path.join(fs.realpathSync(at), ...rest);
    } catch {
      const up = path.dirname(at);
      if (up === at) return here;
      rest.unshift(path.basename(at));
      at = up;
    }
  }
}

/** Match cli/src/lib/machine/project.ts without loading the CLI in Electron. */
function stateDirOf(board: string, project?: string): string {
  const real = realPathOf(board);
  let root = project ? realPathOf(project) : real;
  while (!project && !fs.existsSync(path.join(root, ".git"))) {
    const up = path.dirname(root);
    if (up === root) {
      const parent = path.dirname(real);
      root = path.basename(parent) === "docs" ? path.dirname(parent) : parent;
      break;
    }
    root = up;
  }
  return path.join(root, ".akb", "boards", path.relative(root, real) || "_root");
}

/** Whether an agent run is going in this board — a live session in its registry
 *  whose process is still there. Best-effort: a folder with no board, no
 *  registry file or an unreadable one simply has no run going. */
export function hasLiveRun(dir: string): boolean {
  const board = sessionsBoardOf(dir);
  if (!board) return false;
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(stateDirOf(board, board === path.join(dir, "docs", "kanban") ? dir : undefined), "sessions.json"), "utf8"));
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
    cloud: there ? pointsAtWorkspace(dir) : false,
    running: there ? hasLiveRun(dir) : false,
    open,
  };
}
