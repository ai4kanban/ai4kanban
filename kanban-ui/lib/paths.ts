import fs from "node:fs";
import path from "node:path";

// Find the repo whose board we drive.
//
// `KANBAN_BOARD_DIR` names it outright, and then it IS the answer — the folder
// someone named is the project, board or no board. Whoever set it knew which
// folder they meant: the app passes the one you picked (desktop/src/lib/
// server.ts), and the npx launcher passes `--board`, or your shell's directory
// after doing its own looking (bin/kanban-ui.mjs).
//
// Only the fallback searches, because only the fallback is a guess: with nothing
// set we walk up from `process.cwd()` to the first `docs/kanban/todo/`, so `pnpm
// dev` works from `kanban-ui/` as well as from the repo root.
//
// The searching used to happen here in both cases, and it was wrong in the named
// one: a folder with no board would climb out of itself and show whatever
// board it happened to sit under — a stray `~/docs/kanban/` made every project in
// the home directory show that one, under its own name in the header. Files stay
// the single source of truth: we never store the board's location anywhere else.
let cached: string | null = null;

// Where the search starts — the folder the user pointed us at, or the one we
// were run from. Named in the "no board here" message either way, so it says
// which folder was actually looked at.
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
  const start = boardSearchStart();
  // Named: that folder or nothing. Unset: walk up from where we were run.
  const found = process.env.KANBAN_BOARD_DIR ? boardAt(start) : boardAtOrAbove(start);
  if (found) cached = found;
  return found;
}

// A board is a folder here, or a checkout pointed at a Cloud workspace (#316). A fresh
// clone of a Cloud checkout carries no `docs/kanban/` at all — the copy is git-ignored and
// written on the first read — so `.ai4kanban.json` is what says there is a board to open.
// Whether that workspace can actually be reached is the board's answer, drawn in the error
// strip, and not this lookup's: "no board here" and "the board would not open" are two
// different pages.
const boardAt = (dir: string): string | null =>
  fs.existsSync(path.join(dir, "docs", "kanban", "todo")) ||
  fs.existsSync(path.join(dir, ".ai4kanban.json"))
    ? dir
    : null;

function boardAtOrAbove(from: string): string | null {
  let dir = from;
  for (let i = 0; i < 8; i++) {
    const hit = boardAt(dir);
    if (hit) return hit;
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
// Where a card's mockups live (#239) — one folder per card, named after its id. The
// `ui-design` agent makes it when it writes the first mockup; the board never does, and a
// tag pointing into a folder that isn't there reads as a missing file. Dotted and
// gitignored: a mockup is a working drawing, so a card pulled from git can point at one
// this machine has never drawn — which is a note on the card, not a broken page.
export function mockupsDir(): string {
  return path.join(kanbanDir(), ".mockups");
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
// The finished cards, moved here by `archive`. Read-only for the UI — dropping a
// release lists the cards archived under it in the summary it writes.
export function archiveDir(): string {
  return path.join(kanbanDir(), ".archive");
}
// What a closed or dropped release left behind, one file per version id.
export function releaseSummariesDir(): string {
  return path.join(kanbanDir(), ".release-summaries");
}
export function uiConfigPath(): string {
  return path.join(kanbanDir(), "ui.config.json");
}
// The board's one place for API keys (#94), beside ui.config.json. Kept out of
// git by the .gitignore below, which the board writes whenever it writes a key.
export function envFilePath(): string {
  return path.join(kanbanDir(), ".env");
}
export function kanbanGitignorePath(): string {
  return path.join(kanbanDir(), ".gitignore");
}
export function metricsPath(): string {
  return path.join(kanbanDir(), "metrics.csv");
}
export function setupChecklistPath(): string {
  return path.join(kanbanDir(), "setup-checklist.md");
}
// The board's own settings — what the project is, its tracks, what planning reads
// (#172 writes the first two from the guided first run). The skill's own file:
// the UI edits two of its bullets and leaves the rest exactly as it found them.
export function configPath(): string {
  return path.join(kanbanDir(), "config.md");
}
