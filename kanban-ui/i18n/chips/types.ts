import type { ScheduledAction } from "@/lib/schedule";

/** The chips and small selects a card wears, on the board and on its own page. */
export type ChipsCopy = {
  /** The high / med / low scale, shared by priority and ROI. */
  level: { high: string; med: string; low: string };
  /** The ROI tag, which names the measure before the level. */
  roi: (level: string) => string;
  status: {
    /** The terse label for the board's tight chip row, and the phrase the card
     *  page shows when the pill stands alone. */
    ready: string;
    readyLong: string;
    implementing: string;
    implementingLong: string;
  };
  /** The mark a card wears while something is queued to run on it. */
  pending: string;
  /** What that mark spells out (#140): the action queued on the card, and whether it is
   *  held by a blocker or simply waiting its turn. */
  schedule: {
    action: Record<ScheduledAction, string>;
    waiting: (action: string, ids: string) => string;
    queued: (action: string) => string;
  };
  /** A card whose own chat is writing a reply (#633) — the chip, and what its hover says. */
  discussing: string;
  discussingHint: string;
  /** A card whose last run stopped short and has not been dealt with (#809) — the chip, and
   *  what its hover says. */
  failed: string;
  failedHint: string;
  group: string;
  /** Something this card waits on is still open. */
  blockedOne: (ids: string) => string;
  blockedMany: (ids: string) => string;
  /** A card naming a version the release list no longer holds. */
  releaseStale: (version: string) => string;
  cadence: {
    every: string;
    at: string;
    count: string;
    time: string;
    minutes: string;
    hours: string;
    days: string;
    none: string;
  };
  /** Who owns an open question. */
  question: { needsYou: string; new: string };
};
