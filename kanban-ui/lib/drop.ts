import fs from "node:fs";
import path from "node:path";
import { allCards } from "./board";
import { patchCard } from "./edit";
import { parseFrontmatter } from "./frontmatter";
import { archiveDir, releaseSummariesDir } from "./paths";
import { readReleases, removeReleaseLine } from "./releases";
import { NO_RELEASE } from "./types";

// Dropping a release the team gives up on (#131) — the same move `release drop`
// makes on the CLI, ported from skill/lib/releases.mjs so what the button writes
// is exactly what the command writes: one dated `## Dropped` section in the
// release's summary file (the cards archived under it, and the open ones sent
// back), every open card's release cleared, and its line off the list. Nothing
// it writes reads as a shipped version, and a later close of a remade id skips
// the cards the drop listed.

export interface DropCard {
  id: number;
  title: string;
}

export interface DropPlan {
  /** The open cards whose release the drop clears, in id order. */
  left: DropCard[];
}

// What the drop would move right now — the confirm dialog reads this as it
// opens, so the user sees which open cards lose their release before anything is
// written. Subtasks answer for themselves, like everywhere else releases are
// counted.
export function dropPlan(id: string): DropPlan {
  const left = allCards()
    .filter((c) => c.release === id)
    .map((c) => ({ id: c.id, title: c.title }))
    .sort((a, b) => a.id - b.id);
  return { left };
}

const summaryPath = (id: string) => path.join(releaseSummariesDir(), `${id}.md`);

interface SummaryCard extends DropCard {
  track: string;
  /** Every todo ticked but never archived — named on an open card's line. */
  done: boolean;
}

interface ArchivedCard extends SummaryCard {
  release: string;
}

// The archived cards, read from docs/kanban/.archive/ — flat card files plus
// group folders holding a root.md. Archiving keeps a card's `release` field, so
// this is what says which cards were done under the version being dropped.
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const cardLine = (card: SummaryCard) =>
  `- #${card.id} ${card.title}${card.track ? ` (${card.track})` : ""}`;

const openCardLine = (card: SummaryCard) =>
  cardLine(card) + (card.done ? " — every todo ticked, never archived" : "");

const HEADING = (id: string) => `# ${id}

What each close or drop of this release left behind. This is a list of cards, not a
changelog — not every change goes through the board, so only a person can say what the
version changed.
`;

const today = () => new Date().toISOString().slice(0, 10);

// One dated section per drop, appended like a close's — the summary file is the
// only record of what the version was meant to hold, whichever way it ended.
function writeDropSection(id: string, archived: SummaryCard[], left: SummaryCard[]): void {
  fs.mkdirSync(releaseSummariesDir(), { recursive: true });
  const file = summaryPath(id);
  const out: string[] = [];
  out.push(`## Dropped ${today()}`);
  out.push("");
  out.push("This version was given up — nothing here shipped.");
  out.push("");
  out.push(
    archived.length
      ? `Archived under \`${id}\` — ${plural(archived.length, "card")}, done before the drop:`
      : `Archived under \`${id}\` — nothing was archived under this release.`,
  );
  if (archived.length) {
    out.push("");
    for (const card of archived) out.push(cardLine(card));
  }
  out.push("");
  out.push(
    left.length
      ? `Sent back with no release — ${plural(left.length, "card")} still open when it was dropped:`
      : "Sent back with no release — nothing was still open.",
  );
  if (left.length) {
    out.push("");
    for (const card of left) out.push(openCardLine(card));
  }
  out.push("");
  const section = out.join("\n");
  if (fs.existsSync(file)) fs.appendFileSync(file, `\n${section}`);
  else fs.writeFileSync(file, `${HEADING(id)}\n${section}`);
}

// Drop the release: summary section first (it is the only record of what the
// version was meant to hold, and the next step erases that from the cards), then
// the open cards' release cleared, then the line off the list. Recomputed here
// rather than trusting the plan the dialog fetched — the board may have changed
// while it was open, and a second tab may already have taken the release off.
export function dropRelease(id: string): { ok: boolean; error?: string } {
  try {
    const known = readReleases();
    if (!known.includes(id)) {
      return {
        ok: false,
        error: `"${id}" is not on the release list — it may already have been closed or dropped.`,
      };
    }
    const counted = alreadyCounted(summaryPath(id));
    const archived = archivedCards().filter((c) => c.release === id && !counted.has(c.id));
    const left: SummaryCard[] = allCards()
      .filter((c) => c.release === id)
      .map((c) => ({
        id: c.id,
        title: c.title,
        track: c.track,
        done: c.todos.total > 0 && c.todos.done === c.todos.total,
      }))
      .sort((a, b) => a.id - b.id);
    writeDropSection(id, archived, left);
    for (const card of left) patchCard(card.id, { release: NO_RELEASE });
    removeReleaseLine(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
