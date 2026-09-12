import { boardRules } from "./cli";
import { readArchive } from "./board";
import type {
  ArchivedCard,
  CaseRecord,
  FeedbackDiagnostics,
  FeedbackSent,
  FeedbackToSend,
} from "./types";

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

// --- partner feedback (#628) -------------------------------------------------
//
// The other half of this file, and deliberately not built on the half above. That one is a
// press with four attachments the user reads first; this one is the material behind one
// refine, collected by the `feedback` agent after the user says in a discussion that the
// spec missed what they meant.
//
// Every call here answers "no" rather than throwing on rules that predate it, the way the
// feedback half does: the switch is not drawn, the link area is not offered, and Discuss is
// an ordinary discussion.

/** The cards this discussion can be linked to — open ones and archived ones. */
export async function searchLinkable(query: string): Promise<ArchivedCard[]> {
  const rules = await boardRules();
  return rules.searchLinkable?.(query) ?? [];
}

/** The submission this discussion is holding, or null when it is holding none. */
export async function readCase(discussion: string): Promise<CaseRecord | null> {
  const rules = await boardRules();
  return rules.readCase?.(discussion) ?? null;
}

/** Send the same pack again, under the same id. Never throws: a retry that could not even
 *  start reads as the failure it already was. */
export async function retryCase(discussion: string): Promise<CaseRecord | null> {
  const rules = await boardRules();
  if (!rules.retryCase) return null;
  try {
    return await rules.retryCase(discussion);
  } catch {
    return await readCase(discussion);
  }
}

/** Send the question description on its own. */
export async function sendTextOnlyCase(discussion: string): Promise<CaseRecord | null> {
  const rules = await boardRules();
  if (!rules.sendTextOnlyCase) return null;
  try {
    return await rules.sendTextOnlyCase(discussion);
  } catch {
    return await readCase(discussion);
  }
}

/** Take the submission off this discussion — what cancelling the link does. */
export async function dropCase(discussion: string): Promise<void> {
  const rules = await boardRules();
  rules.dropCase?.(discussion);
}
