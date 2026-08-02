import { patchCard } from "./edit";
import { appendSection, cardLine, endingCards, openCardLine, plural, today } from "./release-summary";
import { readReleases, removeReleaseLine } from "./releases";
import { NO_RELEASE } from "./types";

// Closing a release that shipped (#136) — the same move `release close` makes on
// the CLI, ported from skill/lib/releases.mjs so what the button writes is
// exactly what the command writes: one dated `## Closed` section in the release's
// summary file (what shipped under it, and what was still open), every open
// card's release cleared, and its line off the list. The UI adds nothing of its
// own; what it shares with the drop lives in release-summary.ts.
//
// Closing is always allowed — a version ships when the user says it ships — and
// it runs once: after it the id is unknown and no card names it.

export interface CloseCard {
  id: number;
  title: string;
  /** Every todo ticked but never archived. Such a card counts as not shipped,
   *  and a closed release can't be reopened to fix that — so the confirm names
   *  it while archiving it first is still possible. */
  done: boolean;
}

export interface ClosePlan {
  /** The open cards whose release the close clears, in id order. */
  left: CloseCard[];
  /** How many archived cards the close would write down as shipped. */
  shipped: number;
}

// What the close would record and move right now — the confirm dialog reads this
// as it opens, so the user sees it before anything is written.
export function closePlan(id: string): ClosePlan {
  const { archived, left } = endingCards(id);
  return {
    left: left.map((c) => ({ id: c.id, title: c.title, done: c.done })),
    shipped: archived.length,
  };
}

// Close the release: summary first (it is the only record of what the version
// held, and the next step erases that from the cards), then the open cards' release
// cleared, then the line off the list. Recomputed here rather than trusting the
// plan the dialog fetched — the board may have changed while it was open, and a
// second tab may already have taken the release off.
export function closeRelease(id: string): { ok: boolean; error?: string } {
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
    out.push(`## Closed ${today()}`);
    out.push("");
    out.push(
      archived.length
        ? `Shipped — ${plural(archived.length, "card")}, archived while naming \`${id}\`:`
        : "Shipped — nothing was archived under this release.",
    );
    if (archived.length) {
      out.push("");
      for (const card of archived) out.push(cardLine(card));
    }
    out.push("");
    out.push(
      left.length
        ? `Sent back with no release — ${plural(left.length, "card")} still open when it closed:`
        : "Sent back with no release — nothing was still open.",
    );
    if (left.length) {
      out.push("");
      for (const card of left) out.push(openCardLine(card));
    }
    if (left.some((c) => c.done)) {
      out.push("");
      out.push(
        "A card marked *every todo ticked, never archived* may really have shipped. Archive it, " +
          "then move its line up by hand — closing again cannot fix it.",
      );
    }
    out.push("");
    appendSection(id, out);
    // The field is cleared: the work is not promised to a version nobody has
    // picked yet.
    for (const card of left) patchCard(card.id, { release: NO_RELEASE });
    removeReleaseLine(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
