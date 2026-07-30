import fs from "node:fs";
import path from "node:path";
import { kanbanDir } from "./paths";

// The board root's goal.md — the direction in the user's own words. The UI reads
// its `reviewed:` frontmatter (the agent's judgment, written by the agent as it
// re-judges the goal) to decide whether to show the goal bar, and lets the user
// edit the text below the frontmatter. The field itself is never written here:
// the agent judges and writes, the user owns the words.

export function goalPath(): string {
  return path.join(kanbanDir(), "memory", "goal.md");
}

// The seeded goal template's body, ported from skill/kanban.mjs (same contract
// as lib/frontmatter.ts: the script stays the authority, this is its mirror).
// Shown as the editor's starting text when goal.md doesn't exist yet.
const TEMPLATE_BODY = `# Goal

The direction, in the user's own words — where this is headed. One short statement. The
user owns this file; the agent seeds it but does not invent the goal.

_(not filled in yet — the user writes this.)_
`;

// The leading `--- ... ---` frontmatter block, if any. goal.md's frontmatter is
// free-form (not a card's fixed schema), so it is kept verbatim on save rather
// than parsed and re-serialized.
const FM_RE = /^---\n([\s\S]*?)\n---\n?/;

// The agent's judgment of the goal, read the way the skill reads it: `strong`
// and `good` both mean clear enough to plan from — a missing file, a missing
// field, or any other value reads as weak. Never throws; a weak read must not
// break the board.
export function goalReviewed(): "strong" | "good" | "weak" {
  try {
    const fm = fs.readFileSync(goalPath(), "utf8").match(FM_RE);
    const line = fm && fm[1].match(/^reviewed:[ \t]*(.+?)[ \t]*$/m);
    const v = line && line[1];
    return v === "strong" || v === "good" ? v : "weak";
  } catch {
    return "weak";
  }
}

// The goal text for the editor: everything below the frontmatter — the user's
// words, without the agent's field. A missing file yields the seeded template
// body so the editor has something to start from.
export function readGoalText(): string {
  try {
    return fs.readFileSync(goalPath(), "utf8").replace(FM_RE, "").replace(/^\n+/, "");
  } catch {
    return TEMPLATE_BODY;
  }
}

// Save the user's words back, keeping whatever frontmatter the file already has
// — `reviewed:` included, verbatim. A file that doesn't exist yet is created
// with the seeded `reviewed: weak` frontmatter: a just-written goal still waits
// for the agent's judgment.
export function writeGoalText(text: string): { ok: boolean; error?: string } {
  try {
    const file = goalPath();
    let frontmatter = "---\nreviewed: weak\n---\n\n";
    if (fs.existsSync(file)) {
      const fm = fs.readFileSync(file, "utf8").match(FM_RE);
      if (fm) frontmatter = fm[0].replace(/\n*$/, "\n\n");
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, frontmatter + text.replace(/^\n+/, "").replace(/\s+$/, "") + "\n");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
