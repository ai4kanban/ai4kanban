import { machineCopy } from "./language";
import { boardRules, NoRulesError, type BoardEntry, type BoardState } from "./cli";
import { kanbanDir, repoRoot } from "./paths";
import { LOCAL_STANDING, SOLUTIONS } from "./types";
import type {
  ArchiveList,
  ArchivedCardFile,
  Board,
  BoardScreen,
  BoardStanding,
  Card,
  CardDrafts,
  CardHold,
  CardRef,
  CardScreen,
  ChannelStatus,
  DeliveryDiff,
  DeliveryPlan,
  DraftComment,
  InboxAddResult,
  InboxDrop,
  MemoryFile,
  MetricsResult,
  ScoreResult,
  ScreenBoard,
  SetupDraft,
  SetupState,
  SignalInbox,
  SignalsAccess,
  Solution,
  TopicResult,
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

/** Which board this is, how it stands, and what its work IS (#411).
 *
 *  The solution is read HERE, on the server, and not fetched after the paint: a card page
 *  that asked afterwards would draw the product face on every marketing card first. A board
 *  with no rules to ask, and one whose `config.md` cannot be read, is `product` — which is
 *  what every board drew before there was a second solution. */
async function screenBoard(): Promise<ScreenBoard> {
  const [standing, solution] = await Promise.all([readBoardState(), readSolution()]);
  return { id: repoRoot(), standing, solution };
}

/** What this board's work is. Anything unreadable — no rules, rules older than solutions, a
 *  board that names one nobody has — answers `product`. */
export async function readSolution(): Promise<Solution> {
  try {
    const named = (await boardRules()).solution?.() ?? "";
    return (SOLUTIONS as readonly string[]).includes(named) ? (named as Solution) : "product";
  } catch {
    return "product";
  }
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
  const [plan, diff, head, hold] = await Promise.all([
    deliveryPlan(),
    deliveryDiff(card.delivery?.id ?? card.finished?.id),
    screenBoard(),
    cardHold(id),
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
    hold,
  };
}

/** Who is holding this card right now (#375), or null when nobody is. Read here — when the
 *  page is drawn, and again when a refresh redraws it — and never polled: nothing pushes a
 *  hold, and the refusal a save meets is what actually protects the card.
 *
 *  A Local board, a board out of reach and a copy of the rules older than holds all answer
 *  with none, because a page missing the hint is better than one that will not open. */
async function cardHold(id: number): Promise<CardHold | null> {
  try {
    const holds = (await (await boardRules()).boardHolds?.()) ?? [];
    return holds.find((h) => h.cardId === id) ?? null;
  } catch {
    return null;
  }
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

// --- the inbox waiting to be looked at (#453, #499) --------------------------
// Nothing here is a card: the inbox never reaches the card list. Pulling is
// `akb triage fetch` alone; what the UI does is read the inbox, add to it by hand, and
// ignore what it does not want.
//
// A board whose rules predate them answers "closed" rather than throwing: the whole feature
// is one rail row, and a row that isn't there is the same answer a Marketing board gets.

/** Whether this board and this account may use the inbox at all. Reaches Cloud, so it is
 *  asked once when a window opens rather than on the board's poll. */
export async function signalsOpen(): Promise<SignalsAccess> {
  try {
    const rules = await boardRules();
    if (!rules.signalsAccess) return { open: false, why: (await machineCopy()).messages.rules.tooOldForSignals };
    return await rules.signalsAccess();
  } catch (e) {
    return { open: false, why: e instanceof Error ? e.message : String(e) };
  }
}

/** What the inbox holds, and what is still to be filled in before it can hold more. */
export async function readSignals(): Promise<SignalInbox> {
  const rules = await boardRules();
  if (!rules.readSignals) {
    const c = (await machineCopy()).messages.rules;
    throw new NoRulesError(c.tooOldForSignals, c.updateIt);
  }
  return rules.readSignals();
}

/** Add one thing to the inbox by hand (#499) — a dropped file, a pasted link, or pasted
 *  text. It lands as the same Markdown file a pull writes, so triage does not know which
 *  way it came in.
 *
 *  The rules say why in English when they refuse, and that IS the reader's to act on here —
 *  what was dropped is theirs — so it is passed through rather than replaced. */
export async function addToInbox(drop: InboxDrop): Promise<InboxAddResult> {
  const rules = await boardRules();
  if (!rules.addToInbox) return { ok: false, error: (await machineCopy()).messages.rules.tooOldForSignals };
  return rules.addToInbox(drop);
}

/** Ignore one signal for good — its file moves to `triage/dismissed/`, where it is kept, and
 *  no later pull brings it back.
 *
 *  A refusal is answered in the page's own copy, not the rules'. The rules say why in
 *  English — the id is not in the inbox, the file would not go — and none of that is a
 *  reader's to act on, so what the page shows is the one line it has in both languages. */
export async function dismissSignal(sourceId: string): Promise<{ ok: boolean; error?: string }> {
  const c = await machineCopy();
  const rules = await boardRules();
  if (!rules.dismissSignal) return { ok: false, error: c.messages.rules.tooOldForSignals };
  const done = rules.dismissSignal(sourceId);
  return done.ok ? done : { ok: false, error: c.rail.signals.dismissFailed };
}

// --- a marketing card's drafts and its channels (#411) -----------------------
// The card page's drafts block, on the server side of the boundary. Every one of these is
// the CLI's own — a draft is `content/<id>/<name>.md`, a repurpose is the `channel`
// command with all of its checks, and Publish is `raw channel-status`.
//
// A board whose rules predate them says so in the block rather than failing: `error` on the
// read, and the same line back from a write. That is the one thing a board too old to draw
// this can honestly show — reading as a topic nobody has written for would be a lie.

/** Which drafts this card has, each one whole. Read on each open and on tab focus, so a
 *  draft a repurpose has just written is in the pane with nothing to poll. */
export async function readDrafts(id: number): Promise<CardDrafts> {
  try {
    const rules = await boardRules();
    if (!rules.readDrafts) return { dir: "", drafts: [], error: await tooOldForDrafts() };
    return rules.readDrafts(id);
  } catch (e) {
    return { dir: "", drafts: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Write one draft and hand the set back as it now reads. Last write wins: the pane is
 *  explicit about saving, and a draft held open in an editor too loses whichever save
 *  landed second. */
export async function saveDraft(id: number, name: string, text: string): Promise<CardDrafts> {
  try {
    const rules = await boardRules();
    if (!rules.saveDraft) return { dir: "", drafts: [], error: await tooOldForDrafts() };
    return rules.saveDraft(id, name, text);
  } catch (e) {
    return { dir: "", drafts: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Start the repurpose run for one channel. `kind` is the refusal's own name, which is how
 *  the pane tells a draft that is already written — where the answer is to confirm and run
 *  again — from a refusal there is nothing to do about. */
export async function repurposeChannel(
  id: number,
  channel: string,
  again: boolean,
  ask: { note?: string; language?: string } = {},
): Promise<{ ok: boolean; sessionId?: string; error?: string; kind?: string }> {
  try {
    const rules = await boardRules();
    if (!rules.repurposeChannel) return { ok: false, error: await tooOldForDrafts() };
    return await rules.repurposeChannel(id, channel, again, ask);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Choose the channels this topic goes to (#434). The `+` on the card page
 *  appends one; the whole list is rewritten, and a channel that stays keeps its status and
 *  URL. Rules without it draw no `+`, so this is only ever called where it exists. */
export async function setChannels(id: number, names: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const rules = await boardRules();
    if (!rules.setChannels) return { ok: false, error: await tooOldForDrafts() };
    return await rules.setChannels(id, names);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Move one channel along and record where the piece went up. It posts nothing. */
export async function setChannelStatus(
  id: number,
  channel: string,
  status: ChannelStatus,
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const rules = await boardRules();
    if (!rules.setChannelStatus) return { ok: false, error: await tooOldForDrafts() };
    return await rules.setChannelStatus(id, channel, status, url);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the comments left on a draft, and the polish they go to (#458) ---------
// A board whose rules predate them draws no comment control at all — `canComment` on the
// read is absent, so the page offers nothing to comment with and none of these is reached.
// They still answer, with the same line the drafts block says, for a page that asked anyway.

export async function commentOnDraft(
  id: number,
  draft: string,
  passage: { quote: string; context: string; at: number; words: string },
): Promise<{ comments: DraftComment[]; error?: string }> {
  try {
    const rules = await boardRules();
    if (!rules.commentOnDraft) return { comments: [], error: await tooOldForDrafts() };
    return { comments: rules.commentOnDraft(id, draft, passage) };
  } catch (e) {
    return { comments: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function editDraftComment(
  id: number,
  draft: string,
  commentId: string,
  words: string,
): Promise<{ comments: DraftComment[]; error?: string }> {
  try {
    const rules = await boardRules();
    if (!rules.editDraftComment) return { comments: [], error: await tooOldForDrafts() };
    return { comments: rules.editDraftComment(id, draft, commentId, words) };
  } catch (e) {
    return { comments: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function dropDraftComment(
  id: number,
  draft: string,
  commentId: string,
): Promise<{ comments: DraftComment[]; error?: string }> {
  try {
    const rules = await boardRules();
    if (!rules.dropDraftComment) return { comments: [], error: await tooOldForDrafts() };
    return { comments: rules.dropDraftComment(id, draft, commentId) };
  } catch (e) {
    return { comments: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Submit the batch: one `polish` run over that draft. The board clears the comments when
 *  it ends `done`, so a run that failed leaves them to submit again. */
export async function polishDraft(
  id: number,
  draft: string,
  note?: string,
): Promise<{ ok: boolean; sessionId?: string; error?: string; kind?: string }> {
  try {
    const rules = await boardRules();
    if (!rules.polishDraft) return { ok: false, error: await tooOldForDrafts() };
    return await rules.polishDraft(id, draft, note);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the two ends of a topic (#507) ------------------------------------------
// New topic writes a blank card and its page opens on the editor; Discard takes one off the
// board again. Rules older than either say so in the same line the drafts block says, so a
// press on an old board reports why instead of appearing to do nothing.

/** Write one blank topic and answer with the id its page is at. */
export async function newTopic(): Promise<TopicResult> {
  try {
    const rules = await boardRules();
    if (!rules.newTopic) return { ok: false, error: await tooOldForDrafts() };
    return await rules.newTopic();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Take one topic off the board — the topic page's own Discard, and nothing automatic. */
export async function discardTopic(id: number): Promise<TopicResult> {
  try {
    const rules = await boardRules();
    if (!rules.discardTopic) return { ok: false, error: await tooOldForDrafts() };
    return await rules.discardTopic(id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function tooOldForDrafts(): Promise<string> {
  const c = (await machineCopy()).messages.rules;
  return `${c.tooOldForDrafts} ${c.updateIt}`;
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
