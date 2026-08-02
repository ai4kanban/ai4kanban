import { patchCard } from "./edit";
import { appendSection, cardLine, endingCards, openCardLine, plural, today } from "./release-summary";
import { readReleases, removeReleaseLine } from "./releases";
import { NO_RELEASE } from "./types";

// Dropping a release the team gives up on (#131) — the same move `release drop`
// makes on the CLI, ported from skill/lib/releases.mjs so what the button writes
// is exactly what the command writes: one dated `## Dropped` section in the
// release's summary file (the cards archived under it, and the open ones sent
// back), every open card's release cleared, and its line off the list. Nothing
// it writes reads as a shipped version, and a later close of a remade id skips
// the cards the drop listed.
//
// What it shares with the close (#136) — reading the cards, the card lines, the
// appending — lives in release-summary.ts.

export interface DropCard {
  id: number;
  title: string;
}

export interface DropPlan {
  /** The open cards whose release the drop clears, in id order. */
  left: DropCard[];
}

// What the drop would move right now — the confirm dialog reads this as it
// opens, so the user sees which open cards lose their release before anything is
// written.
export function dropPlan(id: string): DropPlan {
  const { left } = endingCards(id);
  return { left: left.map((c) => ({ id: c.id, title: c.title })) };
}

// Drop the release: summary section first (it is the only record of what the
// version was meant to hold, and the next step erases that from the cards), then
// the open cards' release cleared, then the line off the list. Recomputed here
// rather than trusting the plan the dialog fetched — the board may have changed
// while it was open, and a second tab may already have taken the release off.
export function dropRelease(id: string): { ok: boolean; error?: string } {
  try {
    const known = readReleases();
    if (!known.includes(id)) {
      return {
        ok: false,
        error: `"${id}" is not on the release list — it may already have been closed or dropped.`,
      };
    }
    const { archived, left } = endingCards(id);
    const out: string[] = [];
    out.push(`## Dropped ${today()}`);
    out.push("");
    out.push("This version was given up — nothing here shipped.");
    out.push("");
    out.push(
      archived.length
        ? `Archived under \`${id}\` — ${plural(archived.length, "card")}, done before the drop:`
        : `Archived under \`${id}\` — nothing was archived under this release.`,
    );
    if (archived.length) {
      out.push("");
      for (const card of archived) out.push(cardLine(card));
    }
    out.push("");
    out.push(
      left.length
        ? `Sent back with no release — ${plural(left.length, "card")} still open when it was dropped:`
        : "Sent back with no release — nothing was still open.",
    );
    if (left.length) {
      out.push("");
      for (const card of left) out.push(openCardLine(card));
    }
    out.push("");
    appendSection(id, out);
    for (const card of left) patchCard(card.id, { release: NO_RELEASE });
    removeReleaseLine(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
