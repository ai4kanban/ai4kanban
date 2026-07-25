import { buildPrompt, type AgentRequest } from "./agent";
import { readBoard } from "./board";
import { readAutoRefine } from "./config";
import { parseQuestion } from "./questions";
import { listSessions, startSession } from "./registry";
import type { Card } from "./types";

// --- the auto-refine dispatcher (#43) ---------------------------------------
// A background timer inside the local-UI server that refines cards on its own,
// so the board runs itself: no clicking Refine. It's the reason the manual
// Refine button is gone — refine is only ever automatic now.
//
// One process = one UI server, so a single timer pinned to globalThis is enough
// (the same reason the session registry lives there). It wakes once a minute;
// while the auto-refine switch is off, or while a refine is already running, a
// tick does nothing. Otherwise it picks the highest-priority card that still
// needs refining and launches ONE auto-refine session on it — one at a time.

const TICK_MS = 60_000; // wake once a minute (#43: timed interval, 1 min per iteration)

const LEVEL: Record<string, number> = { high: 0, med: 1, low: 2 };
const level = (v: string): number => LEVEL[v] ?? 3; // unranked sorts after ranked

// Highest priority first, then roi, then id — the order the dispatcher refines
// cards in (all candidates are `todo`, so status doesn't enter the sort).
function byRefineOrder(a: Card, b: Card): number {
  return level(a.priority) - level(b.priority) || level(a.roi) - level(b.roi) || a.id - b.id;
}

// A card the dispatcher should auto-refine: `todo`, with unfinished todos, and
// not already settled on the user. Auto-refine keeps working a card until every
// open question is `[user]` — a judgment call it can't decide alone — so it picks
// a card that has no questions (a plain refine) OR at least one question still
// untagged (freshly raised, needs triage) or `[agent]` (mid-answer). A card whose
// every question is `[user]` is left for the human — this is what stops the
// dispatcher re-picking a card it can't move, so there's no spin. A card with
// every todo checked is done, not refinable.
function needsRefine(card: Card): boolean {
  if (card.status !== "todo") return false;
  const { total, done } = card.todos;
  if (total > 0 && done === total) return false; // all todos checked — archive, don't refine
  if (
    card.questions.length > 0 &&
    card.questions.every((q) => parseQuestion(q).tag === "user")
  ) {
    return false; // nothing left but human-only questions — wait on the user
  }
  return true;
}

// One dispatcher pass. Never throws — a bad tick (unreadable board, spawn
// failure) must not kill the timer, so the next minute still tries.
function tick(): void {
  try {
    if (!readAutoRefine()) return; // switch off — nothing auto-runs

    const sessions = listSessions();
    // One auto-refine at a time: every auto-refine session is the dispatcher's
    // own, so one already running means this tick waits.
    if (sessions.some((s) => s.status === "running" && s.action === "auto-refine")) return;
    // A card already in any live session is skipped (startSession's per-card lock
    // would refuse it anyway) so we move on to the next candidate.
    const busy = new Set(
      sessions.filter((s) => s.status === "running" && s.cardId !== null).map((s) => s.cardId),
    );

    const next = readBoard()
      .columns.flatMap((c) => c.cards)
      .filter((card) => needsRefine(card) && !busy.has(card.id))
      .sort(byRefineOrder)[0];
    if (!next) return;

    const req: AgentRequest = { action: "auto-refine", id: next.id, title: next.title };
    startSession(req, buildPrompt(req));
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
