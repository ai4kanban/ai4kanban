import { parseQuestion } from "./questions";
import type { Card } from "./types";

// Would a refine on this card actually move it? The one rule behind both ways a
// refine starts — the background dispatcher picking cards on its own, and the
// Refine button on the card page (#99) — so the button can never offer a run
// that arrives, finds nothing to do, and leaves the card exactly as it was.
//
// The four cases where a refine has nothing to work with:
//   • the card is recurring (#64) — it carries a `## Process`, not a build plan
//     with todo boxes, and it never reaches `ready` because it is never finished
//     at all. A refine would push it toward a state it has no way to reach. Its
//     process is sharpened by RUNNING it instead: each run rewrites a step to
//     need less of a human (references/recurring-task.md);
//   • the card isn't `todo` — it's `ready` (the plan is already concrete) or
//     being implemented, and neither is a plan waiting to be sharpened;
//   • every todo is checked — that card is finished, not rough;
//   • every open question is `[user]` — those are the judgment calls only the
//     human can make, so the card waits on them. **Resolve** is the button that
//     fits there.
// A card with no questions at all is refinable (a plain refine), and so is one
// with a freshly raised, untagged question — that one still needs triage.
//
// Being blocked is deliberately NOT part of this. The dispatcher skips a blocked
// card (#89) because spending a background run on a plan whose foundation could
// still change shape is wasted work — but that's the dispatcher's own judgment
// about where to spend its turn, not a fact about the card. A user who clicks
// Refine on a blocked card has asked for it, so it runs and the dialog just says
// what's still open.
export function canRefine(card: Card): boolean {
  if (card.recurring) return false;
  if (card.status !== "todo") return false;
  const { total, done } = card.todos;
  if (total > 0 && done === total) return false;
  if (card.questions.length > 0 && card.questions.every((q) => parseQuestion(q.text).tag === "user")) {
    return false;
  }
  return true;
}
