// Open-question tags, shared by the board reader, the dispatcher, and the UI.

export type QuestionTag = "user" | "agent";

export interface ParsedQuestion {
  tag: QuestionTag | null;
  text: string;
}

// A question string may lead with a tag token — `[user] ...` or `[agent] ...` —
// saying who owns it: the human (a judgment call it can't decide) or the agent
// (one auto-refine answers itself). No token means untagged: freshly raised, not
// yet triaged. Kept in step with parseQuestion in skill/kanban.mjs.
export function parseQuestion(raw: string): ParsedQuestion {
  const m = raw.match(/^\[(user|agent)\]\s+([\s\S]*)$/);
  return m ? { tag: m[1] as QuestionTag, text: m[2] } : { tag: null, text: raw };
}
