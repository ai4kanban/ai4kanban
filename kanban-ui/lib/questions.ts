// Open-question tags, shared by the board reader, the dispatcher, and the UI.

export type QuestionTag = "user";

export interface ParsedQuestion {
  tag: QuestionTag | null;
  text: string;
}

// A question string may lead with a `[user] ...` tag token — a judgment call the
// human must make. No token means untagged: freshly raised, not yet triaged.
// There is no tag for an answered question — answering removes it from the list.
// Kept in step with parseQuestion in skill/kanban.mjs.
export function parseQuestion(raw: string): ParsedQuestion {
  const m = raw.match(/^\[(user)\]\s+([\s\S]*)$/);
  return m ? { tag: m[1] as QuestionTag, text: m[2] } : { tag: null, text: raw };
}
