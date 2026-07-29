import type { Card } from "./types";

// How the board decides which card to start next. It lives here rather than in
// `board.ts` because both views need it and `board.ts` reads the filesystem —
// a client component importing it would pull `node:fs` into the browser bundle.

// Pick-order for a column: the best card to start next sorts first. Vetted
// `ready` cards lead, `implementing` (already in flight) follows, raw `todo`
// last; then priority, then roi. Unranked (empty/unknown) sorts after ranked.
const STATUS_RANK: Record<string, number> = { ready: 0, implementing: 1, todo: 2 };
const LEVEL_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

const rank = (table: Record<string, number>, value: string): number =>
  table[value] ?? Object.keys(table).length;

export function byPickOrder(a: Card, b: Card): number {
  return (
    rank(STATUS_RANK, a.status) - rank(STATUS_RANK, b.status) ||
    rank(LEVEL_RANK, a.priority) - rank(LEVEL_RANK, b.priority) ||
    rank(LEVEL_RANK, a.roi) - rank(LEVEL_RANK, b.roi) ||
    a.id - b.id
  );
}

// The queue view's order. Same pick order, with two rules ahead of priority —
// both only between cards at the same status, so the status ranking above still
// decides first:
//
//  1. A card waiting on an open card sinks below the ones you can start. The
//     half promises the top is startable work, and a blocked card is not. It
//     only moves — it is never hidden or gated (the line #63 drew).
//  2. Among the rest, a blockers-track card rises. The kanban view gives
//     blockers their own leading column; merging every track into one half would
//     otherwise bury them among the feature cards.
export function byQueueOrder(a: Card, b: Card): number {
  const blocked = (c: Card) => (c.openBlockers.length > 0 ? 1 : 0);
  const blockerTrack = (c: Card) => (c.track === "blockers" ? 0 : 1);
  return (
    rank(STATUS_RANK, a.status) - rank(STATUS_RANK, b.status) ||
    blocked(a) - blocked(b) ||
    blockerTrack(a) - blockerTrack(b) ||
    byPickOrder(a, b)
  );
}
