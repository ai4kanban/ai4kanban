import { boardRules } from "./cli";
import type { Board, Card, MetricsResult, SetupDraft } from "./types";

// --- reading the board, through the CLI (#169) -------------------------------
// The columns, one card in full, the module map, the daily numbers, the answers a guided
// first run opens with — all of it is the CLI's own read of `docs/kanban/`, which is the
// read `akb` does. The UI walks no files of its own: a card said one thing on a page and
// another on the command line for exactly as long as there were two readers.
//
// Everything is async because the rules are loaded from the built file this project has
// (lib/cli.ts). Nothing else about them changed.
//
// A board with no copy of those rules to load can't be read at all, so `readBoard` lets the
// refusal through — its message is the one line naming the fix, and the page shows it. The
// smaller reads fall back instead: an empty module list means a picker doesn't show, and
// that is better than a dialog that won't open.

/** The whole board: the columns, the archive notes, the releases and what each is for, how
 *  far setup got, whether the goal needs writing. */
export async function readBoard(): Promise<Board> {
  return (await boardRules()).readBoard();
}

/** Any open card by id, including a group subtask the columns don't show. */
export async function findCard(id: number): Promise<Card | null> {
  return (await boardRules()).findCard(id);
}

/** The module names from `docs/kanban/modules.md`, for the create dialog's picker. A board
 *  with no map — or no rules to read one with — has nothing to pick from. */
export async function readModules(): Promise<string[]> {
  try {
    return (await boardRules()).readModules();
  } catch {
    return [];
  }
}

/** The open releases, in ship order. */
export async function readReleases(): Promise<string[]> {
  try {
    return (await boardRules()).readReleases();
  } catch {
    return [];
  }
}

/** The last 30 days of `docs/kanban/metrics.csv`. A failure comes back as `{ ok:false }`
 *  rather than as an empty chart: telling someone with a damaged file that they have no
 *  activity would read as their history being gone. */
export async function readMetrics(): Promise<MetricsResult> {
  try {
    return (await boardRules()).readMetricsView();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The goal in the user's own words, for the editor — an empty box on a board that has
 *  none, and on one with no rules to read it with: the save is what says why. */
export async function readGoalText(): Promise<string> {
  try {
    return (await boardRules()).readGoalText();
  } catch {
    return "";
  }
}

/** What the guided first run opens with — the project, its tracks, and the goal as they
 *  stand. */
export async function readSetupDraft(): Promise<SetupDraft> {
  return (await boardRules()).readSetupDraft();
}
