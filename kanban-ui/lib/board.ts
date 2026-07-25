import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { archivePath, readmePath, todoDir } from "./paths";
import type { ArchiveGroup, Board, Card, Column, Subtask } from "./types";

const idPrefix = (name: string): number | null => {
  const m = name.match(/^(\d+)-/);
  return m ? Number(m[1]) : null;
};

function countTodos(body: string): { total: number; done: number } {
  const matches = body.match(/^[ \t]*[-*]\s+\[( |x|X)\]/gm) || [];
  const done = matches.filter((l) => /\[[xX]\]/.test(l)).length;
  return { total: matches.length, done };
}

// A group root's subtask lines: the todo lines that carry a `#<subid>` ref. That
// ref is how `kanban.mjs` finds the line, so it is what makes a line a subtask —
// the root's own stray todos (a leftover doc-update line) carry none and are left
// out, since the gate is "all subtasks resolved", not "all todos done".
//
// Resolved means the subtask is finished either way: `archive` ticks the box to
// `[x]`, `reject` strikes the text with `~~…~~` and leaves the box `[ ]`. A
// rejected subtask never becomes `[x]`, so a struck line has to count or one
// rejection would block the root's Archive forever. This is why it can't reuse
// `countTodos` — that one's plain done/total drives every card's progress bar and
// must keep reading a struck-but-unticked line as unfinished.
function countSubtaskLines(body: string): { total: number; resolved: number } {
  let total = 0;
  let resolved = 0;
  for (const line of body.split("\n")) {
    const m = line.match(/^[ \t]*[-*]\s+\[( |x|X)\]\s*(.*)$/);
    if (!m || !/#\d+/.test(m[2])) continue;
    total++;
    if (/[xX]/.test(m[1]) || /~~[\s\S]*~~/.test(m[2])) resolved++;
  }
  return { total, resolved };
}

// Read one card file into a Card. Returns null if it has no id or no frontmatter.
function readCard(file: string, relFromTodo: string): Card | null {
  const id = idPrefix(path.basename(relFromTodo));
  if (id === null) {
    // group root: id lives on the folder, file is root.md
    const parts = relFromTodo.split(path.sep);
    const folderId = idPrefix(parts[parts.length - 2] || "");
    if (folderId === null) return null;
    return buildCard(folderId, file, relFromTodo);
  }
  return buildCard(id, file, relFromTodo);
}

function buildCard(id: number, file: string, relFromTodo: string): Card | null {
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  if (!meta) return null;
  // The frontmatter `track` is authoritative — it decides which column the card
  // shows under. A group root lives in `<id>-<slug>/root.md` (a folder that is
  // NOT a track), so its column can only come from the frontmatter, not the path.
  const track = meta.track || path.basename(path.dirname(relFromTodo));
  return {
    id,
    relPath: relFromTodo.split(path.sep).join("/"),
    title: meta.title,
    track,
    priority: meta.priority,
    roi: meta.roi,
    status: meta.status,
    blocked_by: meta.blocked_by,
    related: meta.related,
    questions: meta.questions,
    modules: meta.modules,
    body: body.replace(/^\n+/, "").replace(/\s+$/, ""),
    todos: countTodos(body),
    isGroup: false, // readGroup flips this on the one card that is a root
  };
}

// A group folder is `todo/<id>-<slug>/` holding a `root.md` (the tracking card)
// plus its subtasks under `<track>/<subid>-<slug>.md`. It is detected by the
// presence of root.md — the folder itself is never a track/column.
function isGroupDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, "root.md"));
}

// Read a group folder: its root card (carrying a light list of its subtasks for
// the root page) and the full subtask cards (each linked back to the root so a
// subtask page can point up). Subtasks never surface as their own board cards.
function readGroup(folderName: string): { root: Card; subCards: Card[] } | null {
  const groupDir = path.join(todoDir(), folderName);
  const root = readCard(path.join(groupDir, "root.md"), path.join(folderName, "root.md"));
  if (!root) return null;
  // Group-ness comes from the folder shape (it has a root.md), not from the
  // subtask count below: a finished subtask's file is removed, so a group whose
  // subtasks are all done reads as zero subtasks and would stop looking like a
  // group right when it becomes archiveable.
  root.isGroup = true;
  root.subtaskLines = countSubtaskLines(root.body);

  const subCards: Card[] = [];
  const recurse = (dir: string, rel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        recurse(path.join(dir, entry.name), childRel);
      } else if (entry.name.endsWith(".md") && entry.name !== "README.md" && entry.name !== "root.md") {
        const c = readCard(path.join(dir, entry.name), childRel);
        if (c) {
          c.parent = { id: root.id, title: root.title };
          subCards.push(c);
        }
      }
    }
  };
  recurse(groupDir, folderName);
  subCards.sort((a, b) => a.id - b.id);

  root.subtasks = subCards.map<Subtask>((c) => ({
    id: c.id,
    title: c.title,
    track: c.track,
    todos: c.todos,
  }));
  return { root, subCards };
}

// Standalone `NN-slug.md` cards directly under a track folder. Group folders are
// read separately (they live at the top of todo/, not inside a track).
function standaloneCards(track: string): Card[] {
  const dir = path.join(todoDir(), track);
  if (!fs.existsSync(dir)) return [];
  const cards: Card[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      const c = readCard(path.join(dir, entry.name), path.join(track, entry.name));
      if (c) cards.push(c);
    }
  }
  return cards.sort((a, b) => a.id - b.id);
}

// Read every card once. `board` is what the columns show: standalone cards and
// group roots (never a subtask). `every` also includes each group's subtasks, so
// a `#<id>` reference linkifies and its `/<id>` route resolves for any open card.
function collectCards(): { board: Card[]; every: Card[] } {
  const board: Card[] = [];
  const every: Card[] = [];
  for (const entry of fs.readdirSync(todoDir(), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(todoDir(), entry.name);
    if (isGroupDir(dir)) {
      const g = readGroup(entry.name);
      if (g) {
        board.push(g.root);
        every.push(g.root, ...g.subCards);
      }
    } else {
      const cards = standaloneCards(entry.name);
      board.push(...cards);
      every.push(...cards);
    }
  }
  return { board, every };
}

// Find any open card by id, including a group subtask the columns don't show.
export function findCard(id: number): Card | null {
  return collectCards().every.find((c) => c.id === id) ?? null;
}

// Every open card, subtasks included. Used to reconcile a stale `status` on
// server start-up (a card left `implementing` by a session that no longer exists).
export function allCards(): Card[] {
  return collectCards().every;
}

// Track folders present on disk — every directory under todo/ except the index
// and the group folders (a group is one card in its own track, not a column).
function trackFolders(): string[] {
  return fs
    .readdirSync(todoDir(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !isGroupDir(path.join(todoDir(), e.name)))
    .map((e) => e.name);
}

// Column order follows the README's `## ` headings so the board matches the
// board file, with any track folder missing from the README appended after.
function orderedTracks(): { track: string; title: string }[] {
  const folders = new Set(trackFolders());
  const ordered: { track: string; title: string }[] = [];
  const seen = new Set<string>();

  if (fs.existsSync(readmePath())) {
    for (const line of fs.readFileSync(readmePath(), "utf8").split("\n")) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (!m) continue;
      const heading = m[1];
      const track = heading.toLowerCase() === "blockers" ? "blockers" : heading;
      if (folders.has(track) && !seen.has(track)) {
        ordered.push({ track, title: track === "blockers" ? "Blockers" : heading });
        seen.add(track);
      }
    }
  }
  // blockers always first, even if the README didn't list it
  if (folders.has("blockers") && !seen.has("blockers")) {
    ordered.unshift({ track: "blockers", title: "Blockers" });
    seen.add("blockers");
  }
  for (const t of trackFolders()) {
    if (!seen.has(t)) ordered.push({ track: t, title: t });
  }
  return ordered;
}

// Parse archive.md into groups keyed by topic heading. Read-only, no ids.
function readArchive(): ArchiveGroup[] {
  if (!fs.existsSync(archivePath())) return [];
  const lines = fs.readFileSync(archivePath(), "utf8").split("\n");
  const groups: ArchiveGroup[] = [];
  let current: ArchiveGroup | null = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      current = { category: h2[1], markdown: "" };
      groups.push(current);
      continue;
    }
    if (/^#\s/.test(line)) continue; // skip the top "# Archive" title
    if (current) current.markdown += line + "\n";
  }
  return groups
    .map((g) => ({ ...g, markdown: g.markdown.trim() }))
    .filter((g) => g.markdown.length > 0);
}

// Pick-order for a column: the best card to start next sorts first. Vetted
// `ready` cards lead, `implementing` (already in flight) follows, raw `todo`
// last; then priority, then roi. Unranked (empty/unknown) sorts after ranked.
const STATUS_RANK: Record<string, number> = { ready: 0, implementing: 1, todo: 2 };
const LEVEL_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

const rank = (table: Record<string, number>, value: string): number =>
  table[value] ?? Object.keys(table).length;

function byPickOrder(a: Card, b: Card): number {
  return (
    rank(STATUS_RANK, a.status) - rank(STATUS_RANK, b.status) ||
    rank(LEVEL_RANK, a.priority) - rank(LEVEL_RANK, b.priority) ||
    rank(LEVEL_RANK, a.roi) - rank(LEVEL_RANK, b.roi) ||
    a.id - b.id
  );
}

export function readBoard(): Board {
  const { board, every } = collectCards();
  // Bucket the board cards by their frontmatter track, then lay the columns out
  // in README order. A group root lands in its declared track next to the plain
  // cards, not in a column named after its folder.
  const byTrack = new Map<string, Card[]>();
  for (const card of board) {
    const list = byTrack.get(card.track);
    if (list) list.push(card);
    else byTrack.set(card.track, [card]);
  }
  const columns: Column[] = orderedTracks().map(({ track, title }) => ({
    track,
    title,
    cards: (byTrack.get(track) ?? []).sort(byPickOrder),
  }));
  // Linkify every open id, subtasks included — not just the cards the columns show.
  const openIds = Array.from(new Set(every.map((card) => card.id)));
  return { columns, archive: readArchive(), openIds };
}
