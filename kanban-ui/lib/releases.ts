import fs from "node:fs";
import { releasesPath } from "./paths";

// Read docs/kanban/releases.md — the open releases, one line each, in the order
// they ship — and return just the version ids. This is the one place the UI reads
// the release list (#105); the card page's picker and the board's release
// dropdown (#104) both come from here, so the file stays the single source of
// truth. A missing file reads as no releases: a board that never planned a
// version keeps working and never meets the word.
//
// Ported from `readReleases` in skill/lib/releases.mjs — same two line shapes, so
// the UI and the script always agree on what is on the list.

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
