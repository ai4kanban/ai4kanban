import fs from "node:fs";
import path from "node:path";
import { allCards } from "./board";
import { parseFrontmatter } from "./frontmatter";
import { archiveDir, releaseSummariesDir } from "./paths";
import { NO_RELEASE } from "./types";

// What both ways a release ends — the close (#136) and the drop (#131) — share.
// Ported from skill/lib/releases.mjs, where the two live in one file for the same
// reason: they read the same cards, write the same lines, and their sections go
// to the same summary file. Keeping the wording in one place is what makes the
// button's file and the command's file the same file.

export interface SummaryCard {
  id: number;
  title: string;
  track: string;
  /** Every todo ticked but never archived — named on an open card's line. */
  done: boolean;
}

interface ArchivedCard extends SummaryCard {
  release: string;
}

export const summaryPath = (id: string) => path.join(releaseSummariesDir(), `${id}.md`);

// The archived cards, read from docs/kanban/.archive/ — flat card files plus
// group folders holding a root.md. Archiving keeps a card's `release` field, so
// this is what says which cards were done under a version.
function archivedCards(): ArchivedCard[] {
  const dir = archiveDir();
  if (!fs.existsSync(dir)) return [];
  const rows: ArchivedCard[] = [];
  const recurse = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        recurse(full);
        continue;
      }
      if (!entry.name.endsWith(".md") || entry.name === "README.md") continue;
      const base = entry.name === "root.md" ? path.basename(path.dirname(full)) : entry.name;
      const m = base.match(/^(\d+)-/);
      if (!m) continue;
      const { meta } = parseFrontmatter(fs.readFileSync(full, "utf8"));
      rows.push({
        id: Number(m[1]),
        title: meta?.title || base.replace(/^\d+-/, "").replace(/\.md$/, ""),
        track: meta?.track || "",
        done: false, // archived — the never-archived marker can't apply
        release: meta ? meta.release : NO_RELEASE,
      });
    }
  };
  recurse(dir);
  return rows.sort((a, b) => a.id - b.id);
}

// The ids an earlier close or drop of this id already accounted for — a close's
// `Shipped` list and a drop's `Archived under` list. Same parse as the script's
// alreadyCounted, so a remade version id never re-claims old cards.
function alreadyCounted(file: string): Set<number> {
  if (!fs.existsSync(file)) return new Set();
  const ids = new Set<number>();
  let counting = false;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith("Shipped —") || line.startsWith("Archived under")) counting = true;
    else if (line.startsWith("Sent back") || line.startsWith("## ")) counting = false;
    const m = counting && line.match(/^-\s+#(\d+)\b/);
    if (m) ids.add(Number(m[1]));
  }
  return ids;
}

// The cards this ending records: the ones archived under the release (minus what
// an earlier close or drop of the same id already listed), and the ones still
// open. Subtasks answer for themselves, like everywhere else releases are counted.
export function endingCards(id: string): { archived: SummaryCard[]; left: SummaryCard[] } {
  const counted = alreadyCounted(summaryPath(id));
  const archived = archivedCards().filter((c) => c.release === id && !counted.has(c.id));
  const left = allCards()
    .filter((c) => c.release === id)
    .map((c) => ({
      id: c.id,
      title: c.title,
      track: c.track,
      done: c.todos.total > 0 && c.todos.done === c.todos.total,
    }))
    .sort((a, b) => a.id - b.id);
  return { archived, left };
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const cardLine = (card: SummaryCard) =>
  `- #${card.id} ${card.title}${card.track ? ` (${card.track})` : ""}`;

// The line for a card that was still open — the ticked-but-never-archived marker
// only makes sense there, so an archived card's line never carries it.
export const openCardLine = (card: SummaryCard) =>
  cardLine(card) + (card.done ? " — every todo ticked, never archived" : "");

const HEADING = (id: string) => `# ${id}

What each close or drop of this release left behind. This is a list of cards, not a
changelog — not every change goes through the board, so only a person can say what the
version changed.
`;

export const today = () => new Date().toISOString().slice(0, 10);

// One dated section per ending, appended to the release's summary file. A version
// id can be made again after it ended, so a second ending appends instead of
// writing over: the first version's record is the only one there is.
export function appendSection(id: string, lines: string[]): string {
  fs.mkdirSync(releaseSummariesDir(), { recursive: true });
  const file = summaryPath(id);
  const section = lines.join("\n");
  if (fs.existsSync(file)) fs.appendFileSync(file, `\n${section}`);
  else fs.writeFileSync(file, `${HEADING(id)}\n${section}`);
  return file;
}
