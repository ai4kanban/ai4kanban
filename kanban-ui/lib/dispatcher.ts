import { buildPrompt, type AgentRequest } from "./agent";
import { readBoard } from "./board";
import { readAutoRefine, readAutoRefineParallelism } from "./config";
import { canRefine } from "./refine";
import { listSessions, startSession } from "./registry";
import type { Card, SessionView } from "./types";

// --- the auto-refine dispatcher (#43) ---------------------------------------
// A background timer inside the local-UI server that refines cards on its own,
// so the board runs itself without being asked. It is not the only way a refine
// starts — the card page's Refine button (#99) runs the same thing on one card
// on demand — but it is the one that needs no user at all.
//
// One process = one UI server, so a single timer pinned to globalThis is enough
// (the same reason the session registry lives there). It wakes once a minute;
// while the auto-refine switch is off, or while every refine slot is taken, a
// tick does nothing. Otherwise it walks the cards that need refining, highest
// priority first, and launches a session on each until the slots are full (#88).
//
// How many slots there are is the user's `autoRefineParallelism` setting, 1 by
// default — so an untouched board still refines one card at a time. A tick fills
// every free slot at once rather than adding one card a minute: the setting says
// how many should be going, and waiting three minutes to get there would be a
// ramp nobody asked for. Two runs writing the same board file is left as
// last-write-wins; only create/propose/archive/reject serialize (see the index
// lock in registry.ts).

const TICK_MS = 60_000; // wake once a minute (#43: timed interval, 1 min per iteration)

const LEVEL: Record<string, number> = { high: 0, med: 1, low: 2 };
const level = (v: string): number => LEVEL[v] ?? 3; // unranked sorts after ranked

// Highest priority first, then roi, then id — the order the dispatcher refines
// cards in (all candidates are `todo`, so status doesn't enter the sort).
function byRefineOrder(a: Card, b: Card): number {
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

// One dispatcher pass. Never throws — a bad tick (unreadable board, spawn
// failure) must not kill the timer, so the next minute still tries.
function tick(): void {
  try {
    if (!readAutoRefine()) return; // switch off — nothing auto-runs

    const sessions = listSessions();
    // Only refine runs use up a slot — a card the user is implementing by hand is
    // other work and doesn't shrink the pool. A refine the user started from a
    // card page (#99) DOES count: it never waited for a slot to be free, but
    // while it runs it is one more agent refining, so the dispatcher starts one
    // fewer. The setting bounds how many refines are going at once, whoever asked
    // for them.
    const live = sessions.filter((s) => s.status === "running" && s.action === "auto-refine").length;
    const free = readAutoRefineParallelism() - live;
    if (free <= 0) return; // every slot taken — wait for one to end

    // A card already in any live session is skipped (startSession's per-card lock
    // would refuse it anyway) so we move on to the next candidate.
    const busy = new Set(
      sessions.filter((s) => s.status === "running" && s.cardId !== null).map((s) => s.cardId),
    );
    const stopped = stoppedByHand(sessions);

    const queue = readBoard()
      .columns.flatMap((c) => c.cards)
      .filter((card) => needsRefine(card) && !busy.has(card.id) && !stopped.has(card.id))
      .sort(byRefineOrder)
      .slice(0, free);

    for (const card of queue) {
      const req: AgentRequest = { action: "auto-refine", id: card.id, title: card.title };
      // Each start is independently refused-or-not by the registry's locks; a
      // refusal on one card is not a reason to skip the rest of the queue.
      startSession(req, buildPrompt(req));
    }
  } catch {
    // swallow — keep the timer alive for the next tick
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
