import fs from "node:fs";
import { kanbanDir, releasesPath } from "./paths";
import { DEFAULT_RELEASE } from "./types";

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
// Ported from skill/lib/releases.mjs — same two line shapes and the same rules
// for a new id, so the UI and the script always agree on what is on the list.

// The release one line names, or null when the line isn't a release at all. Both
// shapes are read: `- **v1** — a note` (what the script writes) and a bare `- v1`
// (what a hand edit leaves).
function lineId(line: string): string | null {
  const m = line.match(/^\s*[-*]\s+(.*)$/);
  if (!m) return null;
  const head = m[1].split("—")[0].trim();
  const bold = head.match(/^\*\*(.+?)\*\*$/);
  return (bold ? bold[1] : head).trim() || null;
}

export function readReleases(): string[] {
  let text: string;
  try {
    text = fs.readFileSync(releasesPath(), "utf8");
  } catch {
    return []; // no list yet — this board plans no versions
  }
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const id = lineId(line);
    // A duplicate can only come from a hand edit; the first line wins so the
    // order holds.
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

// ---- starting a release ----------------------------------------------------

// The line a fresh list carries instead of releases. Appending removes it.
const EMPTY_MARK = "_(no releases yet — `release new v1` makes the first one.)_";

const TEMPLATE = `# Releases

The versions this board is planning, in the order they ship — one line per release.
\`release new <id>\` adds one to the end. Closing a release takes its line away, so this
file only ever shows what is still ahead.

A card says which release it ships in. A card that says nothing sits at \`next\` — wanted,
but not promised to a version. \`next\` is always last and is never written here.

The order is whatever the lines say, so a hand edit is how you reorder. A note after the
version id is yours to write; nothing reads it.

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
  if (id.toLowerCase() === DEFAULT_RELEASE) {
    return `"${DEFAULT_RELEASE}" is where a card with no release sits — it is always there and can't be made. Pick a version id, like v1.`;
  }
  if (id === "." || id === "..") return `"${id}" names a folder, not a version — pick a version id, like v1.`;
  if (!ID_RE.test(id)) {
    return `a version id can only hold letters, numbers, dot, dash and underscore (you typed "${id}") — closing a release writes a file named after it.`;
  }
  if (known.includes(id)) return `"${id}" is already a release on this board.`;
  return null;
}

// Add one release to the end of the list — the header's New release entry (#115).
// Everything that can go wrong comes back as { ok:false, error } so the dialog can
// say why and stay open on the name the user typed, rather than throwing a server
// error at a board that is otherwise fine.
//
// The name is checked here, against the file, at the moment of writing: a second
// tab may have added the same release since this one drew its dropdown.
export function addRelease(raw: string): { ok: boolean; error?: string } {
  const id = String(raw ?? "").trim();
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
    lines.push(`- **${id}**`);
    fs.writeFileSync(file, lines.join("\n") + "\n");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
