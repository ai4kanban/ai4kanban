import { buildPrompt, type AgentRequest } from "./agent";
import { readBoard } from "./board";
import { nextDue } from "./cadence";
import { readAutoRefine, readAutoRefineParallelism } from "./config";
import { autoWorkAllowed } from "./desktop";
import { canRefine } from "./refine";
import { listSessions, startSession } from "./registry";
import type { Card, SessionView } from "./types";

// --- the dispatcher (#43, #139) ---------------------------------------------
// A background timer inside the local-UI server that works the board on its own,
// so it runs without being asked. Two jobs on the one timer: it refines cards
// that a refine would move (#43), and it runs the recurring cards whose cadence
// has elapsed (#139). Neither is the only way that work starts — the card page's
// Refine and Run buttons do the same thing on one card on demand — but these are
// the ones that need no user at all.
//
// One process = one UI server, so a single timer pinned to globalThis is enough
// (the same reason the session registry lives there). It wakes once a minute and
// makes both passes. The refine pass: while the auto-refine switch is off, or
// while every refine slot is taken, it does nothing; otherwise it walks the cards
// that need refining, highest priority first, and launches a session on each
// until the slots are full (#88). The recurring pass is below, and the switch
// does not gate it — the cadence on the card is that pass's only switch.
//
// How many slots there are is the user's `autoRefineParallelism` setting, 1 by
// default — so an untouched board still refines one card at a time. A tick fills
// every free slot at once rather than adding one card a minute: the setting says
// how many should be going, and waiting three minutes to get there would be a
// ramp nobody asked for. Two runs writing the same board file is left as
// last-write-wins; only create/propose/archive/reject serialize (see the index
// lock in registry.ts).
//
// Both passes are held while this board is one the desktop app has been
// switched away from (see autoWorkAllowed in lib/desktop.ts). A project's
// server keeps running so a run someone started can finish, and starting fresh
// work in a board nobody is looking at is the one thing that must not follow
// from that.

// Wake once a minute (#43: timed interval, 1 min per iteration). It is also the
// floor under a cadence: a card set to repeat faster than the tick still runs
// once a tick, since the tick is the only moment anything is started.
const TICK_MS = 60_000;

const LEVEL: Record<string, number> = { high: 0, med: 1, low: 2 };
const level = (v: string): number => LEVEL[v] ?? 3; // unranked sorts after ranked

// Highest priority first, then roi, then id — the order the dispatcher takes
// cards in, refine candidates and due recurring jobs alike (all candidates are
// `todo`, so status doesn't enter the sort).
function byDispatchOrder(a: Card, b: Card): number {
  return level(a.priority) - level(b.priority) || level(a.roi) - level(b.roi) || a.id - b.id;
}

// A card the dispatcher should auto-refine: one a refine would actually move
// (`canRefine`, the same rule the card page's Refine button shows itself by), and
// not waiting on another card.
//
// Blocked is skipped (#89) because refining a card whose blocker isn't built yet
// is wasted work: its plan depends on work that could still change shape. It's the
// board's own Blocked mark, `openBlockers` — a blocker that left the board
// (archived or rejected) no longer counts, and neither does a recurring one or a
// card naming itself (see attachBlockers in board.ts). So the cards the dispatcher
// passes over are exactly the ones the board marks Blocked, and the last blocker
// leaving the board is enough to make the card a candidate again on the next tick.
// A user can still refine a blocked card by hand from its page — this is where
// the dispatcher spends its own turns, not a rule about the card.
function needsRefine(card: Card): boolean {
  if (card.openBlockers.length > 0) return false; // waiting on another card — refine it later
  return canRefine(card);
}

// Cards whose newest run was stopped by the user (#49). Stopping a background
// refine has to mean something, and the dispatcher would otherwise pick the very
// same card again on the next tick — a minute later, doing exactly what was just
// ended. So the newest run on a card is read as its last word: stopped, and the
// dispatcher leaves it alone. Any later run on the card — a refine the user
// started, an implement, an edit — becomes the newest and lifts the skip. So does
// the stopped run finally ageing out of the kept-30 window, which is a long time
// on a board nobody is touching.
function stoppedByHand(sessions: SessionView[]): Set<number> {
  const newest = new Map<number, SessionView>();
  for (const r of sessions) {
    if (r.cardId === null) continue;
    const best = newest.get(r.cardId);
    if (!best || r.startedAt > best.startedAt) newest.set(r.cardId, r);
  }
  const skip = new Set<number>();
  for (const [cardId, r] of newest) if (r.status === "stopped") skip.add(cardId);
  return skip;
}

// --- recurring runs (#139) --------------------------------------------------
// The same minute timer also runs the recurring cards whose cadence has elapsed,
// so a job that repeats actually repeats without anyone clicking Run.
//
// It has its own single slot, separate from the refine slots above: a refine
// that is going must not hold back a job that is due, and a job that is still
// running must not start a second copy of itself. One at a time, because a
// recurring run does real work in the repo and two of them at once is a merge
// nobody asked for.
//
// The auto-refine switch does not gate this. That switch is about refining; the
// cadence written on the card is the only switch background runs have — no
// cadence, no background run.

// The newest `run` session on each card. Only run sessions count: this is asking
// "has a pass already been started for the window the card is due in", and an
// edit or a refine on the same card says nothing about that.
function newestRuns(sessions: SessionView[]): Map<number, SessionView> {
  const newest = new Map<number, SessionView>();
  for (const r of sessions) {
    if (r.cardId === null || r.action !== "run") continue;
    const best = newest.get(r.cardId);
    if (!best || r.startedAt > best.startedAt) newest.set(r.cardId, r);
  }
  return newest;
}

// The recurring cards that should run right now, highest priority first.
//
// Due is the cadence's own rule (lib/cadence.ts): a card that never ran is due
// at once, otherwise the interval since `last_run` has to have passed.
//
// A card is passed over when a run for this very window has already been
// started — the newest run on it began at or after the time it is due. That run
// stopped, failed, or was cut off, because only a run that PASSES is recorded
// (see recordRun) and recording moves `last_run` forward and with it the due
// time. Without this rule a broken agent connector — every run failing in
// seconds — would leave the card due on every tick and the board would spawn a
// run a minute, forever. Starting it again is then a person's call: a manual Run
// that passes puts the card back on its cadence.
function dueRecurring(cards: Card[], sessions: SessionView[], busy: Set<number | null>): Card[] {
  const newest = newestRuns(sessions);
  const now = Date.now();
  return cards
    .filter((card) => {
      if (!card.recurring || busy.has(card.id)) return false;
      const due = nextDue(card.last_run, card.cadence);
      if (!due || due.getTime() > now) return false;
      const last = newest.get(card.id);
      return !last || last.startedAt < due.getTime();
    })
    .sort(byDispatchOrder);
}

// Start the one due recurring card, if the recurring slot is free.
function runDue(sessions: SessionView[], cards: Card[], busy: Set<number | null>): void {
  const live = sessions.some((s) => s.status === "running" && s.action === "run");
  if (live) return; // one recurring run at a time
  const card = dueRecurring(cards, sessions, busy)[0];
  if (!card) return;
  const req: AgentRequest = { action: "run", id: card.id, title: card.title };
  // The refine pass reads the same set right after, so a card this run just took
  // is a card it leaves alone.
  if (startSession(req, buildPrompt(req)).ok) busy.add(card.id);
}

// One dispatcher pass. Never throws — a bad tick (unreadable board, spawn
// failure) must not kill the timer, so the next minute still tries.
function tick(): void {
  try {
    // Both passes start work nobody asked for, so both stop while this board is
    // one the user has switched away from in the app (#178). A run already
    // going is untouched — it finishes and writes to this board, as it should.
    if (!autoWorkAllowed()) return;
    const sessions = listSessions();
    const cards = readBoard().columns.flatMap((c) => c.cards);
    // A card already in any live session is skipped (startSession's per-card
    // lock would refuse it anyway) so we move on to the next candidate. Shared
    // by both passes — a card being run is not a card to refine, and the other
    // way round.
    const busy = new Set(
      sessions.filter((s) => s.status === "running" && s.cardId !== null).map((s) => s.cardId),
    );
    // Due jobs first: they were promised a time, and a refine is never in a
    // hurry. Neither pass waits on the other — they have their own slots.
    runDue(sessions, cards, busy);
    if (readAutoRefine()) refineNext(sessions, cards, busy);
  } catch {
    // swallow — keep the timer alive for the next tick
  }
}

// The auto-refine pass: fill every free refine slot with the cards a refine
// would really move.
function refineNext(sessions: SessionView[], cards: Card[], busy: Set<number | null>): void {
  // Only refine runs use up a slot — a card the user is implementing by hand is
  // other work and doesn't shrink the pool. A refine the user started from a
  // card page (#99) DOES count: it never waited for a slot to be free, but
  // while it runs it is one more agent refining, so the dispatcher starts one
  // fewer. The setting bounds how many refines are going at once, whoever asked
  // for them.
  const live = sessions.filter((s) => s.status === "running" && s.action === "auto-refine").length;
  const free = readAutoRefineParallelism() - live;
  if (free <= 0) return; // every slot taken — wait for one to end

  const stopped = stoppedByHand(sessions);

  const queue = cards
    .filter((card) => needsRefine(card) && !busy.has(card.id) && !stopped.has(card.id))
    .sort(byDispatchOrder)
    .slice(0, free);

  for (const card of queue) {
    const req: AgentRequest = { action: "auto-refine", id: card.id, title: card.title };
    // Each start is independently refused-or-not by the registry's locks; a
    // refusal on one card is not a reason to skip the rest of the queue.
    startSession(req, buildPrompt(req));
  }
}

// Start the timer once. Idempotent and pinned to globalThis so Next re-evaluating
// this module (across its server bundles) can't leave two timers running. Called
// from the polled server actions, so the dispatcher is live for as long as the UI
// server is. `unref()` keeps the timer from holding the process open on its own.
export function ensureDispatcher(): void {
  const g = globalThis as unknown as { __kanbanDispatcher?: ReturnType<typeof setInterval> };
  if (g.__kanbanDispatcher) return;
  const timer = setInterval(tick, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  g.__kanbanDispatcher = timer;
}
