import { allCards } from "./board";
import { patchCard } from "./edit";
import { NO_RELEASE } from "./types";

// The fill behind the New release dialog's toggle (#106) — the same rule
// `release new <id> --fill` runs on the CLI, ported from skill/lib/releases.mjs
// so the count the dialog shows is the set of cards the make will move.
//
// The fill is a rule, not a judgment call: it looks only at the cards in no
// release, and a card goes in on three tests — its priority is high, nothing open
// is blocking it, and it is not a group root. Nothing else is looked at. It only
// ever adds: a card already in a release stays where it is. Subtasks answer for
// themselves, so a group's urgent piece goes in even though its root can't.

export interface FillCard {
  id: number;
  title: string;
}

/** A high-priority card the fill leaves out, with the test it failed. */
export interface FillSkip extends FillCard {
  reason: string;
}

export interface FillPlan {
  /** The cards a fill would move, in id order. */
  fill: FillCard[];
  /** The high-priority cards it would leave, each with why. */
  skipped: FillSkip[];
}

export function fillPlan(): FillPlan {
  const fill: FillCard[] = [];
  const skipped: FillSkip[] = [];
  for (const card of allCards()) {
    if (card.release !== NO_RELEASE || card.priority !== "high") continue;
    if (card.isGroup) {
      skipped.push({ id: card.id, title: card.title, reason: "a group root — each subtask goes in on its own" });
      continue;
    }
    // `openBlockers` already holds only the blockers that count: the ids still
    // naming an open card, minus recurring cards and the card itself.
    if (card.openBlockers.length) {
      skipped.push({
        id: card.id,
        title: card.title,
        reason: `blocked by ${card.openBlockers.map((b) => `#${b.id}`).join(", ")}, still open`,
      });
      continue;
    }
    fill.push({ id: card.id, title: card.title });
  }
  return { fill, skipped };
}

// Move every candidate into release `id`, through the same patch the card page's
// release picker uses. Recomputed here rather than trusting a count the dialog
// fetched earlier — the board may have changed while it was open.
export function fillRelease(id: string): FillPlan {
  const plan = fillPlan();
  for (const card of plan.fill) patchCard(card.id, { release: id });
  return plan;
}
