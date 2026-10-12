import type { Card } from "./types";

const STALE_AFTER_DAYS = 5;
const DAY_MS = 86_400_000;

/** How many whole days a card has sat untouched, or 0 when it is not stale (#1640). A card
 *  being built, or one with no known write time, never is. A group root goes by its newest
 *  write across the group, and stays put while any subtask is being built (#1648). */
export const staleDays = (card: Card, now: number): number => {
  const subtasks = card.subtasks ?? [];
  if (card.status === "implementing" || card.delivery || subtasks.some((s) => s.status === "implementing")) return 0;
  const times = [card.updatedAt, ...subtasks.map((s) => s.updatedAt)].filter((t): t is string => !!t).map(Date.parse);
  if (!times.length) return 0;
  const idle = now - Math.max(...times);
  return idle > STALE_AFTER_DAYS * DAY_MS ? Math.floor(idle / DAY_MS) : 0;
};
