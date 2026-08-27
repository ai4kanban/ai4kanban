// Reading a card's open questions — the two shapes one can take, and the `[user]` tag that
// says a question is the human's own judgment call.
//
// The rules are NOT here. They are `cli/src/lib/view/rules.ts`, copied to
// ./format/view/rules.ts by scripts/sync-format.mjs, so a card the CLI writes and a dialog
// that reads it can never disagree about what a question says. This file is the name the
// UI imports them under — fix the rules in cli/src/lib/view/.

export { hasOptions, parseQuestion } from "./format/view/rules";
export type { Question, Question as CardQuestion, QuestionMode, QuestionTag } from "./format/view/types";

import type { Question } from "./format/view/types";

/** The last choice on every options question, added here rather than written onto the
 *  card: picking it opens a box to answer in the user's own words. So "none of these" is
 *  a tick like the others, and no card has to carry the same boilerplate line. */
export const FREE_TEXT_CHOICE = "Something else — I'll type it";

/** Its 1-based position, one past the choices the card carries. */
export const freeTextPick = (q: Question): number => (q.options?.length ?? 0) + 1;
