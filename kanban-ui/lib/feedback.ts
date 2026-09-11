import { boardRules } from "./cli";
import { readArchive } from "./board";
import type { ArchivedCard, FeedbackDiagnostics, FeedbackSent, FeedbackToSend } from "./types";

// --- feedback on a landed task (#603) ----------------------------------------
// Nothing is collected and nothing is guessed. The screens ask for a card, for the four
// diagnostic parts and for the send separately, and each of these is the answer to exactly
// one of those asks.
//
// A board whose rules predate this answers `null`/`false` rather than throwing: the Feedback
// button and the block on New task simply are not offered, the way an old board offers no
// archive.

/** How many archived cards one search shows. A landed task is found by its number or by a
 *  word from its title; a longer list is a list nobody reads. */
const MATCHES = 8;

/** Whether this board can take feedback at all. */
export async function feedbackOffered(): Promise<boolean> {
  const rules = await boardRules();
  return typeof rules.sendFeedback === "function" && typeof rules.readArchive === "function";
}

/**
 * Archived cards matching what was typed — by number, or by a word in the title.
 *
 * Only `.archive/`: a card still in flight has no landed result to judge. The archive is
 * read on each search rather than held, so a task archived a moment ago is findable.
 */
export async function searchArchived(query: string): Promise<ArchivedCard[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const { cards } = await readArchive();
  const number = q.replace(/^#/, "");
  return cards
    .filter(
      (card) =>
        (/^\d+$/.test(number) && String(card.id).startsWith(number)) ||
        card.title.toLowerCase().includes(q),
    )
    .slice(0, MATCHES);
}

/** What one archived card has to attach — the four parts, their sizes, and exactly the text
 *  each would send. Null on rules that predate it, which is also "offer no attachments". */
export async function feedbackDiagnostics(cardId: number): Promise<FeedbackDiagnostics | null> {
  const rules = await boardRules();
  return rules.readFeedbackDiagnostics?.(cardId) ?? null;
}

/** Send it, and say what came of it. Never throws: the screen says "this one did not go"
 *  and the task it was written beside is already created. */
export async function sendFeedback(feedback: FeedbackToSend): Promise<FeedbackSent> {
  const rules = await boardRules();
  if (!rules.sendFeedback) return { ok: false, reason: "refused" };
  try {
    return await rules.sendFeedback(feedback);
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
