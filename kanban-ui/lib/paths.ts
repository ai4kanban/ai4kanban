import fs from "node:fs";
import path from "node:path";

// Find the repo whose board we drive. Normally we walk up from the current
// directory to the first `docs/kanban/todo/`, so the app works whether it's
// started from `kanban-ui/` or the repo root. When run as an npx package the
// server lives in the npm cache, far from the board, so `KANBAN_BOARD_DIR`
// overrides the starting point — set it to the repo root (the folder that holds
// `docs/kanban/`). Files stay the single source of truth: we never store the
// board's location anywhere else.
let cached: string | null = null;

// Where the walk up starts — the folder the user pointed us at, or the one we
// were run from.
export function boardSearchStart(): string {
  return process.env.KANBAN_BOARD_DIR
    ? path.resolve(process.env.KANBAN_BOARD_DIR)
    : process.cwd();
}

// Answers "is there a board" and nothing else: the repo root, or null when the
// walk up finds no `docs/kanban/todo/`. No board and a board that won't read are
// two different failures — the first shows the "no board here" page, the second
// keeps the error strip over a board that exists. Deciding between them on a
// lookup that returns null, instead of on the text of a thrown error, is what
// keeps them apart. Only a hit is cached: a board installed while the server is
// up must still be found on the next look.
export function findRepoRoot(): string | null {
  if (cached) return cached;
  let dir = boardSearchStart();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "docs", "kanban", "todo"))) {
      cached = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function repoRoot(): string {
  const found = findRepoRoot();
  if (found) return found;
  throw new Error(
    "could not find docs/kanban/todo/ above " +
      boardSearchStart() +
      " — run the UI from inside the repo (kanban-ui/ or the repo root), " +
      "or set KANBAN_BOARD_DIR to the folder that holds docs/kanban/.",
  );
}

export function kanbanDir(): string {
  return path.join(repoRoot(), "docs", "kanban");
}
export function todoDir(): string {
  return path.join(kanbanDir(), "todo");
}
export function readmePath(): string {
  return path.join(todoDir(), "README.md");
}
export function archivePath(): string {
  return path.join(kanbanDir(), "archive.md");
}
export function modulesPath(): string {
  return path.join(kanbanDir(), "modules.md");
}
export function releasesPath(): string {
  return path.join(kanbanDir(), "releases.md");
}
export function uiConfigPath(): string {
  return path.join(kanbanDir(), "ui.config.json");
}
export function metricsPath(): string {
  return path.join(kanbanDir(), "metrics.csv");
}
export function setupChecklistPath(): string {
  return path.join(kanbanDir(), "setup-checklist.md");
}
