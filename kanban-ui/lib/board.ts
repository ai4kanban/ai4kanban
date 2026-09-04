import { machineCopy } from "./language";
import { boardRules, NoRulesError, type BoardEntry, type BoardState } from "./cli";
import { kanbanDir, repoRoot } from "./paths";
import { LOCAL_STANDING } from "./types";
import type {
  ArchiveList,
  ArchivedCardFile,
  Board,
  BoardScreen,
  BoardStanding,
  Card,
  CardRef,
  CardScreen,
  DeliveryDiff,
  DeliveryPlan,
  MemoryFile,
  MetricsResult,
  ScoreResult,
  ScreenBoard,
  SetupDraft,
  SetupState,
} from "./types";

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

/** How the board stands (#316): a folder here, or a copy of a Cloud workspace — and if so,
 *  whether Cloud is out of reach and when the copy was last read.
 *
 *  A board with no rules to ask, and one running rules older than Cloud boards, is Local:
 *  the strip that draws from this has nothing to say about either. */
export async function readBoardState(): Promise<BoardStanding> {
  try {
    const rules = await boardRules();
    const state: BoardState = rules.boardState?.() ?? LOCAL_STANDING;
    return { ...state, readWhen: state.readAt ? (rules.boardCopyReadWhen?.(state.readAt) ?? state.readAt) : "" };
  } catch {
    return LOCAL_STANDING;
  }
}

// --- the one read each screen makes (#374) -----------------------------------
// `BoardScreen` and `CardScreen` (lib/format/board/screen.ts) name what the board screen and
// a card page draw. These two are this machine's way of filling them; a board somewhere else
// fills the same shapes from its own read, and neither screen assembles one of its own.
//
// Nothing machine-only is in them. The coding agent, the repository root, the setup
// instruction, the skill state and a mockup on disk are read beside these, by the app shell
// that draws the controls needing them.

/** Which board this is, and how it stands — the head of both reads. */
async function screenBoard(): Promise<ScreenBoard> {
  return { id: repoRoot(), standing: await readBoardState() };
}

/** Everything the board screen draws. A board whose rules are missing or too old comes back
 *  with its reason attached rather than thrown: the screen says so with the columns it had
 *  still under the message. */
export async function boardScreen(): Promise<BoardScreen> {
  let board: Board | null = null;
  let error: string | null = null;
  try {
    board = await readBoard();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  // The standing is read AFTER the board: a read taken while offline is also the attempt
  // that brings the board back live, so asking first would say the board is out of reach
  // when that very read fetched it.
  return { ...(await screenBoard()), board, error };
}

/** Which board this window is showing, and every board its project holds (#407) — what the
 *  folder chip's badge is drawn from. One board answers with one entry, which is a label
 *  with nothing to press; a copy of the rules too old to know about boards answers with the
 *  open one alone, for the same reason. */
export async function boardsHere(): Promise<{ board: string; boards: BoardEntry[] }> {
  const open = kanbanDir();
  try {
    const rules = await boardRules();
    const boards = rules.listBoards?.(repoRoot()) ?? [];
    return { board: open, boards: boards.length ? boards : [] };
  } catch {
    return { board: open, boards: [] };
  }
}

/** Everything a card page draws, or null when the board holds no card with that id. */
export async function cardScreen(id: number): Promise<CardScreen | null> {
  const card = await findCard(id);
  if (!card) return null;
  const board = await readBoard();
  const [plan, diff, head] = await Promise.all([
    deliveryPlan(),
    deliveryDiff(card.delivery?.id ?? card.finished?.id),
    screenBoard(),
  ]);
  return {
    ...head,
    card,
    openIds: board.openIds,
    releases: board.releases,
    goalWritten: board.goalWritten,
    memoryModules: board.memoryModules,
    plan,
    diff,
  };
}

/** Read the whole workspace again — the user asking, never a timer. A Local board answers
 *  `ok` and does nothing, so no caller has to know which kind it is on. */
export async function refreshBoard(): Promise<{ ok: boolean; error?: string }> {
  try {
    return (await (await boardRules()).refreshBoard?.()) ?? { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// A card file is rewritten in place — by the agent editing it mid-run, and by the
// `git merge --ff-only` that lands a delivery into this checkout — so a read can land in the
// moment the file is empty and come back with nothing where the card is. That miss is what
// takes the card page off to the board, and it used to do so mid-write, with the user's
// half-typed answers in a dialog on it. So a miss is read again: a card that has really gone
// is still gone a beat later, and one that was only being written is back. Only a miss
// waits, and only a card page ever asks.
const MISS_TRIES = 4;
const MISS_WAIT_MS = 200;

async function confirmMiss<T>(read: () => Promise<T> | T, missed: (v: T) => boolean): Promise<T> {
  let value = await read();
  for (let tries = 1; missed(value) && tries < MISS_TRIES; tries++) {
    await new Promise((r) => setTimeout(r, MISS_WAIT_MS));
    value = await read();
  }
  return value;
}

/** Any open card by id, including a group subtask the columns don't show. */
export async function findCard(id: number): Promise<Card | null> {
  const rules = await boardRules();
  return confirmMiss(
    () => rules.findCard(id),
    (card) => card === null,
  );
}

/** Whether the card is still on the board — the one question the card page asks before it
 *  gives up on the page it is showing. Same confirmed read as `findCard`. */
export async function cardStillThere(id: number): Promise<boolean> {
  const rules = await boardRules();
  return confirmMiss(
    () => Boolean(rules.titleOf(id)),
    (there) => !there,
  );
}

/** What an Implement click would do on this board right now (#307) — the branch the change
 *  would land on, and whether it lands at all. Read on the server, where git is.
 *
 *  A board whose rules predate the one-click flow answers `auto` with no branch: the dialog
 *  then says what the click does without naming a branch it cannot know. */
export async function deliveryPlan(): Promise<DeliveryPlan> {
  try {
    return (await (await boardRules()).deliveryPlan?.()) ?? { commitMode: "auto" };
  } catch {
    return { commitMode: "auto" };
  }
}

/** What one delivery changed (#305) — the card page's **Diff** tab. Read on the server,
 *  where git is, and capped there: a diff can be megabytes.
 *
 *  Null with no delivery to read, and on a board whose rules predate the tab — either way
 *  the tab does not appear, which is what a tab with nothing in it should do. */
export async function deliveryDiff(id: string | undefined): Promise<DeliveryDiff | null> {
  if (!id) return null;
  try {
    return (await (await boardRules()).deliveryDiff?.(id)) ?? null;
  } catch {
    return null;
  }
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
    cards = await (await boardRules()).allCards();
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
    return await (await boardRules()).readModules();
  } catch {
    return [];
  }
}

/** The open releases, in ship order. */
export async function readReleases(): Promise<string[]> {
  try {
    return await (await boardRules()).readReleases();
  } catch {
    return [];
  }
}

/** The last 30 days of `docs/kanban/metrics.csv`. A failure comes back as `{ ok:false }`
 *  rather than as an empty chart: telling someone with a damaged file that they have no
 *  activity would read as their history being gone. */
export async function readMetrics(): Promise<MetricsResult> {
  try {
    return await (await boardRules()).readMetricsView();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The planning scores, release by release (#224). A failure comes back as `{ ok:false }`
 *  for the same reason the daily numbers do — an empty chart on a damaged record would read
 *  as a board that has planned nothing. Rules older than the score say so in the one line
 *  that names the update, so the Daily progress chart above it still draws. */
export async function readScore(): Promise<ScoreResult> {
  try {
    const rules = await boardRules();
    if (!rules.readScoreView) {
      const c = (await machineCopy()).messages.rules;
      return { ok: false, error: `${c.tooOldForScores} ${c.updateIt}` };
    }
    return await rules.readScoreView();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The goal in the user's own words, for the editor — an empty box on a board that has
 *  none, and on one with no rules to read it with: the save is what says why. */
export async function readGoalText(): Promise<string> {
  try {
    return await (await boardRules()).readGoalText();
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
    const c = (await machineCopy()).messages.rules;
    throw new NoRulesError(c.tooOldForMemory, c.installIt);
  }
  return rules.readMemoryFile(name, module);
}

/** What `docs/kanban/.archive` holds — every finished card, newest first (#380).
 *
 *  Read on each open rather than held, so a card archived a moment ago is in the list. A
 *  board with no rules to read it with, and one whose rules predate this read, both throw:
 *  the archive is the whole of its page, and quietly showing nothing would read as a board
 *  that has finished no work. */
export async function readArchive(): Promise<ArchiveList> {
  const rules = await boardRules();
  if (!rules.readArchive) {
    const c = (await machineCopy()).messages.rules;
    throw new NoRulesError(c.tooOldForArchive, c.updateIt);
  }
  return rules.readArchive();
}

/** One archived card, whole. `null` when the archive holds none with that id, which is what
 *  the page turns into "no such card". Throws for the same two reasons the list does. */
export async function readArchivedCard(id: number): Promise<ArchivedCardFile | null> {
  const rules = await boardRules();
  if (!rules.readArchivedCard) {
    const c = (await machineCopy()).messages.rules;
    throw new NoRulesError(c.tooOldForArchive, c.updateIt);
  }
  return rules.readArchivedCard(id);
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
