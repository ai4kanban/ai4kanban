import fs from "node:fs";
import { kanbanDir, releasesPath } from "./paths";

// Read docs/kanban/releases.md — the open releases, one line each, in the order
// they ship — and return just the version ids. This is the one place the UI reads
// the release list (#105); the card page's picker and the board's release
// dropdown (#104) both come from here, so the file stays the single source of
// truth. A missing file reads as no releases: a board that never planned a
// version keeps working and never meets the word.
//
// It is also where the UI starts a release (#115) — the header's New release
// entry appends a line here, the same line `release new` writes. Closing,
// renaming and reordering stay terminal jobs: a close writes a summary and moves
// cards, and the other two are a hand edit of a short file.
//
// A release also says what it is for (#164): the goal sits on the same line,
// after the em dash, and is what the board and the agent read to say what this
// version is trying to ship. It is never required — a release made before goals
// existed, or made with the box left empty, works everywhere one with a goal does.
//
// Ported from skill/lib/releases.mjs — same line shapes and the same rules for a
// new id and for folding a goal, so the UI and the script always agree on what is
// on the list.

/** One release as its line says it: the version id, and what the version is for
 *  (empty when the line says nothing). */
export interface ReleaseEntry {
  id: string;
  goal: string;
}

// The release one line names and its goal, or null when the line isn't a release
// at all. Every shape is read: `- **v1** — what it is for` (what the script
// writes), `- **v1**` (no goal) and a bare `- v1` (what a hand edit leaves). Only
// the FIRST em dash splits the line, so a goal holding one of its own reads back
// whole.
function lineEntry(line: string): ReleaseEntry | null {
  const m = line.match(/^\s*[-*]\s+(.*)$/);
  if (!m) return null;
  const cut = m[1].indexOf("—");
  const head = (cut === -1 ? m[1] : m[1].slice(0, cut)).trim();
  const goal = cut === -1 ? "" : m[1].slice(cut + 1).trim();
  const bold = head.match(/^\*\*(.+?)\*\*$/);
  const id = (bold ? bold[1] : head).trim();
  return id ? { id, goal } : null;
}

const lineId = (line: string): string | null => lineEntry(line)?.id ?? null;

// A goal as it goes on disk: one line, whatever was typed into the box. Line
// breaks and runs of spaces fold into single spaces, so the file's shape never
// depends on how the goal was typed.
export const foldGoal = (raw: string): string => String(raw ?? "").replace(/\s+/g, " ").trim();

// The line the file carries for one release. No goal, no em dash.
const releaseLine = (id: string, goal: string) => `- **${id}**${goal ? ` — ${goal}` : ""}`;

export function readReleaseEntries(): ReleaseEntry[] {
  let text: string;
  try {
    text = fs.readFileSync(releasesPath(), "utf8");
  } catch {
    return []; // no list yet — this board plans no versions
  }
  const out: ReleaseEntry[] = [];
  for (const line of text.split("\n")) {
    const entry = lineEntry(line);
    // A duplicate can only come from a hand edit; the first line wins so the
    // order holds.
    if (entry && !out.some((e) => e.id === entry.id)) out.push(entry);
  }
  return out;
}

export const readReleases = (): string[] => readReleaseEntries().map((e) => e.id);

/** What each release is for, keyed by version id. A release with no goal is
 *  absent, not an empty string. */
export function readReleaseGoals(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readReleaseEntries()) if (entry.goal) out[entry.id] = entry.goal;
  return out;
}

// Change what a release is for, after it was made (#164) — the ⋯ menu's goal
// dialog. An empty goal clears it: a release with no goal is a state the board
// works over, so unsaying it has to be possible too. Rewriting the line
// normalizes it, so a hand-written `- v1` comes back as `- **v1**`.
export function setReleaseGoal(id: string, raw: string): { ok: boolean; error?: string } {
  try {
    if (!readReleases().includes(id)) {
      return {
        ok: false,
        error: `"${id}" is not on the release list — it may already have been closed or dropped.`,
      };
    }
    const goal = foldGoal(raw);
    let done = false;
    const kept = fs
      .readFileSync(releasesPath(), "utf8")
      .split("\n")
      .map((line) => {
        if (done || lineId(line) !== id) return line;
        done = true;
        return releaseLine(id, goal);
      });
    fs.writeFileSync(releasesPath(), kept.join("\n"));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- starting a release ----------------------------------------------------

// The line a fresh list carries instead of releases. Appending removes it.
const EMPTY_MARK = "_(no releases yet — `release new v1` makes the first one.)_";

const TEMPLATE = `# Releases

The versions this board is planning, in the order they ship — one line per release.
\`release new <id>\` adds one to the end. Closing a release takes its line away, so this
file only ever shows what is still ahead.

A card says which release it ships in. A card that says nothing is in no release —
wanted, but not promised to a version.

The order is whatever the lines say, so a hand edit is how you reorder. What comes after
the em dash is the release's goal — what this version is for, in your own words.

${EMPTY_MARK}
`;

// A version id is free text — `v1`, `0.5.0`, `august` — but closing a release
// writes a summary file named after it, so it has to be usable as a filename:
// letters, numbers, dot, dash and underscore, and never `.` or `..`.
const ID_RE = /^[A-Za-z0-9._-]+$/;

// Why this name can't be a release, in the words of someone who is typing it into
// a box — not the terminal's wording, which ends by pointing at `release new v1`.
// The user reading this has no terminal open. Null means the name is fine.
function idProblem(id: string, known: string[]): string | null {
  if (!id) return "a release needs a version id, like v1 or 0.5.0";
  if (id === "." || id === "..") return `"${id}" names a folder, not a version — pick a version id, like v1.`;
  if (!ID_RE.test(id)) {
    return `a version id can only hold letters, numbers, dot, dash and underscore (you typed "${id}") — closing a release writes a file named after it.`;
  }
  if (known.includes(id)) return `"${id}" is already a release on this board.`;
  return null;
}

// Take one release's line off the list — the last step of a drop (#131), ported
// from skill/lib/releases.mjs. When the last release goes the file gets its empty
// line back, so it reads the way a fresh one does instead of ending in a stray
// blank.
export function removeReleaseLine(id: string): void {
  const kept: string[] = [];
  let dropped = false;
  for (const line of fs.readFileSync(releasesPath(), "utf8").split("\n")) {
    if (!dropped && lineId(line) === id) {
      dropped = true;
      continue;
    }
    kept.push(line);
  }
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  if (!kept.some((line) => lineId(line))) kept.push("", EMPTY_MARK);
  fs.writeFileSync(releasesPath(), kept.join("\n") + "\n");
}

// Add one release to the end of the list — the header's New release entry (#115),
// with what the version is for beside it (#164; empty is fine).
// Everything that can go wrong comes back as { ok:false, error } so the dialog can
// say why and stay open on the name the user typed, rather than throwing a server
// error at a board that is otherwise fine.
//
// The name is checked here, against the file, at the moment of writing: a second
// tab may have added the same release since this one drew its dropdown.
export function addRelease(raw: string, rawGoal = ""): { ok: boolean; error?: string } {
  const id = String(raw ?? "").trim();
  const goal = foldGoal(rawGoal);
  try {
    const file = releasesPath();
    if (!fs.existsSync(file)) {
      fs.mkdirSync(kanbanDir(), { recursive: true });
      fs.writeFileSync(file, TEMPLATE);
    }
    const problem = idProblem(id, readReleases());
    if (problem) return { ok: false, error: problem };
    const lines = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== EMPTY_MARK);
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    // The new line joins the list at the end: straight after the last release, or
    // after a blank line when this is the first one.
    if (!/^\s*[-*]\s+/.test(lines[lines.length - 1] || "")) lines.push("");
    lines.push(releaseLine(id, goal));
    fs.writeFileSync(file, lines.join("\n") + "\n");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
