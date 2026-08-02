import fs from "node:fs";
import path from "node:path";
import { kanbanDir } from "./paths";

// The board root's goal.md — the direction in the user's own words. The file
// starts empty (the box is where the ask lives, not the file), and the UI reads
// its `reviewed:` frontmatter to decide whether to ask for a goal at all. The
// judged values are the agent's alone; the one value written here is `pending`,
// on save — see writeGoalText.

export function goalPath(): string {
  return path.join(kanbanDir(), "memory", "goal.md");
}

// The leading `--- ... ---` frontmatter block, if any. goal.md's frontmatter is
// free-form (not a card's fixed schema), so it is kept verbatim on save rather
// than parsed and re-serialized.
const FM_RE = /^---\n([\s\S]*?)\n---\n?/;

// How clear the goal is to plan from, ported from skill/commands/init.mjs (same
// contract as lib/frontmatter.ts: the script stays the authority, this is its
// mirror). `strong`, `good` and `weak` are the agent's judgment; `pending` is a
// goal written but not judged yet. A missing file or field reads `pending` too —
// whether to ask for a goal is decided by goalNeedsWork, which looks at the text
// itself. Never throws; a bad read must not break the board.
export function goalReviewed(): "strong" | "good" | "pending" | "weak" {
  try {
    const fm = fs.readFileSync(goalPath(), "utf8").match(FM_RE);
    const line = fm && fm[1].match(/^reviewed:[ \t]*(.+?)[ \t]*$/m);
    const v = line && line[1];
    return v === "strong" || v === "good" || v === "weak" ? v : "pending";
  } catch {
    return "pending";
  }
}

// Is there a goal to read? True once the file holds words — a missing or empty
// file has nothing to open, and the setup bar is what asks for it in that state.
// This is a mechanical test on the text, not the agent's `reviewed:` judgment
// (#128): a user who writes their goal can open it straight away, not after the
// next agent run.
export function goalWritten(): boolean {
  let body: string;
  try {
    body = fs.readFileSync(goalPath(), "utf8").replace(FM_RE, "");
  } catch {
    return false;
  }
  return body.trim().length > 0;
}

// Should the board ask for a goal? Only when there is nothing written, or when
// the agent judged what is written too vague to plan from (#108). The board
// never grades the goal itself — it can see an empty file, and that takes no
// judgment; everything past that is the agent's call.
export function goalNeedsWork(): boolean {
  return !goalWritten() || goalReviewed() === "weak";
}

// The goal text for the editor: everything below the frontmatter — the user's
// words, without the agent's field. A missing file opens an empty box.
export function readGoalText(): string {
  try {
    return fs.readFileSync(goalPath(), "utf8").replace(FM_RE, "").replace(/^\n+/, "");
  } catch {
    return "";
  }
}

// Save the user's words back, keeping whatever frontmatter the file already has
// and setting `reviewed: pending` — the goal is written, and nobody has judged
// this version of it yet. That is what stops the board asking for a goal the
// moment it is written: no agent runs on a save, so waiting for a judgment here
// would nag the user for work they just did. The next propose run judges it.
export function writeGoalText(text: string): { ok: boolean; error?: string } {
  try {
    const file = goalPath();
    let frontmatter = "---\nreviewed: pending\n---\n\n";
    if (fs.existsSync(file)) {
      const fm = fs.readFileSync(file, "utf8").match(FM_RE);
      if (fm) frontmatter = setReviewed(fm[0]).replace(/\n*$/, "\n\n");
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, frontmatter + text.replace(/^\n+/, "").replace(/\s+$/, "") + "\n");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// `reviewed: pending` into an existing frontmatter block, leaving every other
// line of it as it was — the block is free-form, and nothing else in it is ours.
function setReviewed(block: string): string {
  if (/^reviewed:.*$/m.test(block)) {
    return block.replace(/^reviewed:.*$/m, "reviewed: pending");
  }
  return block.replace(/^---\n/, "---\nreviewed: pending\n");
}
