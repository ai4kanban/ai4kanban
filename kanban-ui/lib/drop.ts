import { patchCard } from "./edit";
import { endingCards } from "./release-summary";
import { readReleases, removeReleaseLine } from "./releases";
import { NO_RELEASE } from "./types";

// Dropping a release the team gives up on (#131) — the same move `release drop`
// makes on the CLI, ported from skill/lib/releases.mjs: report the cards archived
// under it and the open ones sent back, clear every open card's release, and take
// its line off the list. It writes no summary file or section (#166), including
// when a close of the same id left a summary behind earlier.
//
// What it shares with the close (#136) — reading the cards — lives in
// release-summary.ts.

export interface DropCard {
  id: number;
  title: string;
}

export interface DropPlan {
  /** The archived cards that stay archived under this release, in id order. */
  archived: DropCard[];
  /** The open cards whose release the drop clears, in id order. */
  left: DropCard[];
}

// What the drop would move right now — the confirm dialog reads this as it
// opens, so the user sees what stays archived and which open cards lose their
// release before anything is changed.
export function dropPlan(id: string): DropPlan {
  const { archived, left } = endingCards(id);
  const planCard = (card: DropCard) => ({ id: card.id, title: card.title });
  return { archived: archived.map(planCard), left: left.map(planCard) };
}

// Drop the release: clear the open cards' release, then take the line off the
// list. Recomputed here rather than trusting the plan the dialog fetched — the
// board may have changed while it was open, and a second tab may already have
// taken the release off. Deliberately never reads or writes the summary path.
export function dropRelease(id: string): { ok: boolean; error?: string } {
  try {
    const known = readReleases();
    if (!known.includes(id)) {
      return {
        ok: false,
        error: `"${id}" is not on the release list — it may already have been closed or dropped.`,
      };
    }
    const { left } = endingCards(id);
    for (const card of left) patchCard(card.id, { release: NO_RELEASE });
    removeReleaseLine(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
