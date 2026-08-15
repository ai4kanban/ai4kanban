import { boardRules, NoRulesError } from "./cli";
import type { Board, Card, CardRef, MemoryFile, MetricsResult, SetupDraft, SetupState } from "./types";

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

/** The open cards carrying `query` in their title or body, for the rail's search box.
 *
 *  It searches `allCards()` — every open card, a group's subtasks included — and never the
 *  archive: the rail is about what you are working on now. Read on each search rather than
 *  held as an index, so a card a run has just written matches on the words it has now.
 *
 *  Title matches lead, then the ones matched on their body alone, each by id. The word you
 *  half-remember is often in a scope line, but a card whose title says it is the one you
 *  meant. A blank query matches nothing — the rail keeps its own list — and a board with no
 *  rules to read it with comes back empty rather than throwing: a search box is no place to
 *  learn the board is unreadable, and every other screen already says so. */
export async function searchCards(query: string): Promise<CardRef[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  let cards: Card[];
  try {
    cards = (await boardRules()).allCards();
  } catch {
    return [];
  }
  const titled: CardRef[] = [];
  const bodied: CardRef[] = [];
  for (const card of cards) {
    const hit = { id: card.id, title: card.title };
    if (card.title.toLowerCase().includes(q)) titled.push(hit);
    else if (card.body.toLowerCase().includes(q)) bodied.push(hit);
  }
  const byId = (a: CardRef, b: CardRef) => a.id - b.id;
  return [...titled.sort(byId), ...bodied.sort(byId)];
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

/** One of the four memory files, whole (#129) — the project's copy, or a module's when
 *  `module` names one. `null` for a name that isn't one of the four, and for a module the
 *  map doesn't name (#130).
 *
 *  Read on each open rather than held, so a file a run has just rewritten reads as it is
 *  now. A board with no rules to read it with, or rules older than the release that added
 *  this, throws: the memory page is the one screen this is the whole of, and a page that
 *  quietly showed nothing would read as an empty memory. */
export async function readMemory(name: string, module = ""): Promise<MemoryFile | null> {
  const rules = await boardRules();
  if (!rules.readMemoryFile) {
    throw new NoRulesError("The board's rules this board runs are too old to read its memory.");
  }
  return rules.readMemoryFile(name, module);
}

/** What the guided first run opens with — the project, its tracks, and the goal as they
 *  stand. */
export async function readSetupDraft(): Promise<SetupDraft> {
  return (await boardRules()).readSetupDraft();
}

/** How far setup got, or null when there is no checklist — this board is set up, or it
 *  predates the file. Read on its own by the action that starts a setup run (#173), which
 *  has to know what is really left before it spawns an agent: the button that asked is
 *  drawn from a board read that can be a poll behind. */
export async function readSetupState(): Promise<SetupState | null> {
  return (await boardRules()).readSetupState();
}
