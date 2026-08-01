import fs from "node:fs";
import { setupChecklistPath } from "./paths";
import type { SetupState, SetupStep } from "./types";

// Setup's own checklist, `docs/kanban/setup-checklist.md` (#85). The file's
// presence is the flag: it is there while setup is unfinished, and setup's last
// step deletes it — so a board with no file is a board that is set up, and a
// board made before this file existed stays quiet. Empty columns are never the
// signal; only the file is.
//
// The script owns the file (skill/lib/setup.mjs writes it and ticks its boxes).
// This is the reader, plus the one tick the UI does itself — the goal step, which
// the goal editor finishes. Same contract as lib/frontmatter.ts and lib/goal.ts:
// the script stays the authority, this mirrors its format.

// One box: `- [ ] `config` (agent) — Fill in ...`. The step name and the owner are
// what the bar reads; the text is shown as written.
const LINE_RE = /^- \[([ xX])\][ \t]+`([a-z][a-z0-9-]*)`[ \t]+\((script|agent|you)\)[ \t]+—[ \t]+(.+?)[ \t]*$/;

function readSteps(): SetupStep[] | null {
  let text: string;
  try {
    text = fs.readFileSync(setupChecklistPath(), "utf8");
  } catch {
    return null; // no checklist — setup is done
  }
  const steps: SetupStep[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(LINE_RE);
    if (m) steps.push({ done: m[1] !== " ", name: m[2], owner: m[3] as SetupStep["owner"], text: m[4] });
  }
  return steps;
}

// What the setup bar shows: how far setup got, and the first unticked step. Null
// when there is no checklist (setup is finished) and also when there is one we
// can't read a single box out of — a file we don't understand is not something to
// nag about, and the script is the only thing that should ever have written it.
export function readSetup(): SetupState | null {
  const steps = readSteps();
  if (!steps || steps.length === 0) return null;
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, next: steps.find((s) => !s.done) ?? null };
}

// Tick one box — the UI's own half of the contract, used when the goal editor
// saves. Mirrors the script's rule exactly: the tick that closes the last box
// deletes the file. Silent about a board with no checklist, an unknown step, or
// one already ticked; all three mean there is nothing to do, and the bar is a
// nudge, never something that should fail a save.
export function tickSetupStep(name: string): void {
  const file = setupChecklistPath();
  let lines: string[];
  try {
    lines = fs.readFileSync(file, "utf8").split("\n");
  } catch {
    return;
  }
  let ticked = false;
  let unticked = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE);
    if (!m) continue;
    if (m[2] === name && m[1] === " ") {
      lines[i] = lines[i].replace(/^- \[ \]/, "- [x]");
      ticked = true;
      continue;
    }
    if (m[1] === " ") unticked++;
  }
  if (!ticked) return;
  try {
    if (unticked === 0) fs.rmSync(file);
    else fs.writeFileSync(file, lines.join("\n"));
  } catch {
    // A checklist we couldn't write is not worth failing the save the user asked
    // for — the goal is on disk either way, and the bar simply stays put.
  }
}
