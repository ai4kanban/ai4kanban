// Open questions, shared by the board reader, the dispatcher, and the UI.

export type QuestionTag = "user";

export interface ParsedQuestion {
  tag: QuestionTag | null;
  text: string;
}

/** How many options the user may tick: `one` (pick a single option) or `many`
 *  (pick as many as they want). */
export type QuestionPick = "one" | "many";

/** One open question on a card.
 *
 *  A PLAIN question is text only — the user answers it in a box, as they always
 *  have. An OPTIONS question carries choices to tick instead of choices buried
 *  in a sentence. Both shapes live side by side on a card, and the `[user]` tag
 *  reads the same on either: it sits at the front of `text`.
 *
 *  The frontmatter shape both this and `skill/kanban.mjs` read is documented in
 *  that script, under "questions". */
export interface CardQuestion {
  /** The question itself, `[user]` tag included. Split it with parseQuestion. */
  text: string;
  /** Absent on a plain question. */
  pick?: QuestionPick;
  /** Each option is one short line, with its reason inside that line. Absent or
   *  empty on a plain question. */
  options?: string[];
  /** 1-based positions into `options` — the ones the resolve dialog opens
   *  already ticked. Empty means the agent recommends nothing, so the list
   *  opens with nothing ticked. */
  recommend?: number[];
}

export function hasOptions(q: CardQuestion): boolean {
  return Array.isArray(q.options) && q.options.length > 0;
}

// A question string may lead with a `[user] ...` tag token — a judgment call the
// human must make. No token means untagged: freshly raised, not yet triaged.
// There is no tag for an answered question — answering removes it from the list.
// Kept in step with parseQuestion in skill/kanban.mjs.
export function parseQuestion(raw: string): ParsedQuestion {
  const m = raw.match(/^\[(user)\]\s+([\s\S]*)$/);
  return m ? { tag: m[1] as QuestionTag, text: m[2] } : { tag: null, text: raw };
}
