// ---- the board, read whole -------------------------------------------------
//
// One pass over `docs/kanban/todo/` that gives back every open card, the columns they fall
// into, and the handful of board-wide facts a screen draws around them — the releases and
// what each is for, the archive's topics, how far setup got, whether the goal needs
// writing.
//
// This is the reading half of what the writing commands own. It is the ONE reader: a board
// UI asks for this rather than walking the files itself, so a card can never say one thing
// on a page and another on the command line.

import fs from 'node:fs'
import path from 'node:path'

import { activeDelivery } from '../agent/deliveries'
import { readRuns } from '../agent/sessions'
import { ARCHIVE_MD, README, TODO } from '../paths'
import { formatStamp, nextDue } from '../cadence'
import { parseFrontmatter } from '../frontmatter'
import { readReleaseEntries } from '../releases'
import { readSetupChecklist } from '../setup'
import { goalNeedsWork, goalWritten } from './goal'
import { readMemoryModules } from './memory'
import { byPickOrder } from './rules'
import type { ArchiveGroup, Board, Card, CardStatus, Column, SetupState, Subtask } from './types'

const idPrefix = (name: string): number | null => {
  const m = name.match(/^(\d+)-/)
  return m ? Number(m[1]) : null
}

function countTodos(body: string): { total: number; done: number } {
  const matches = body.match(/^[ \t]*[-*]\s+\[( |x|X)\]/gm) || []
  const done = matches.filter((l) => /\[[xX]\]/.test(l)).length
  return { total: matches.length, done }
}

// A group root's subtask lines: the todo lines that carry a `#<subid>` ref. That ref is how
// `archive` and `reject` find the line, so it is what makes a line a subtask — the root's
// own stray todos (a leftover doc-update line) carry none and are left out, since the gate
// is "all subtasks resolved", not "all todos done".
//
// Resolved means the subtask is finished either way: `archive` ticks the box to `[x]`,
// `reject` strikes the text with `~~…~~` and leaves the box `[ ]`. A rejected subtask never
// becomes `[x]`, so a struck line has to count or one rejection would block the root's
// archive forever. This is why it can't reuse `countTodos` — that one's plain done/total
// drives every card's progress bar and must keep reading a struck-but-unticked line as
// unfinished.
function countSubtaskLines(body: string): { total: number; resolved: number } {
  let total = 0
  let resolved = 0
  for (const line of body.split('\n')) {
    const m = line.match(/^[ \t]*[-*]\s+\[( |x|X)\]\s*(.*)$/)
    if (!m || !/#\d+/.test(m[2]!)) continue
    total++
    if (/[xX]/.test(m[1]!) || /~~[\s\S]*~~/.test(m[2]!)) resolved++
  }
  return { total, resolved }
}

// When a recurring card comes round again, in words a page can print as it stands. Empty
// when the card has no cadence — nothing will start it but a person. "Due now" when the
// wait is already over, which covers a card that has never run: it is due the moment it
// gets a cadence, so a new job is seen working instead of waiting a day for its first pass.
//
// Worked out here, on the machine whose clock the schedule runs on. A browser on another
// machine would otherwise show its own idea of the time.
function dueLabel(lastRun: string, cadence: string): string {
  const due = nextDue(lastRun, cadence)
  if (!due) return ''
  return due.getTime() <= Date.now() ? 'Due now' : formatStamp(due)
}

// Read one card file into a Card. Null when it has no id or no frontmatter.
function readCard(file: string, relFromTodo: string): Card | null {
  const id = idPrefix(path.basename(relFromTodo))
  if (id === null) {
    // Group root: the id lives on the folder, the file is root.md.
    const parts = relFromTodo.split(path.sep)
    const folderId = idPrefix(parts[parts.length - 2] || '')
    if (folderId === null) return null
    return buildCard(folderId, file, relFromTodo)
  }
  return buildCard(id, file, relFromTodo)
}

function buildCard(id: number, file: string, relFromTodo: string): Card | null {
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) return null
  // The frontmatter `track` is authoritative — it decides which column the card shows
  // under. A group root lives in `<id>-<slug>/root.md` (a folder that is NOT a track), so
  // its column can only come from the frontmatter, not the path.
  const track = meta.track || path.basename(path.dirname(relFromTodo))
  const relPath = relFromTodo.split(path.sep).join('/')
  // `recurring/` is a reserved folder, not a track someone named: a card in it repeats on a
  // cadence instead of being built once. The path is what says so — the same test
  // `record-run` makes before it will record a run.
  const recurring = relPath.split('/')[0] === 'recurring'
  return {
    id,
    relPath,
    title: meta.title,
    track,
    priority: meta.priority,
    roi: meta.roi,
    status: meta.status as CardStatus,
    release: meta.release,
    blocked_by: meta.blocked_by,
    related: meta.related,
    questions: meta.questions,
    verify: meta.verify,
    modules: meta.modules,
    last_run: meta.last_run,
    cadence: meta.cadence,
    schedule: meta.schedule,
    nextRun: recurring ? dueLabel(meta.last_run, meta.cadence) : '',
    body: body.replace(/^\n+/, '').replace(/\s+$/, ''),
    todos: countTodos(body),
    isGroup: false, // readGroup flips this on the one card that is a root
    recurring,
    openBlockers: [], // filled by attachBlockers once every card has been read
  }
}

// Work out what is really blocking each card. A `blocked_by` id counts only when it names a
// card that is still open — an id no longer on the board was archived or rejected, so that
// work is done and the block is cleared. A recurring blocker and a card that names itself
// are skipped: neither can ever clear, since a recurring card is never archived.
//
// Runs over every card at once (subtasks included), so a blocker inside a group folder
// resolves like any other card.
function attachBlockers(cards: Card[]): void {
  const byId = new Map(cards.map((c) => [c.id, c]))
  for (const card of cards) {
    card.openBlockers = card.blocked_by
      .filter((n) => n !== card.id)
      .map((n) => byId.get(n))
      .filter((b): b is Card => !!b && !b.recurring)
      .map((b) => ({ id: b.id, title: b.title }))
  }
}

// A group folder is `todo/<id>-<slug>/` holding a `root.md` (the tracking card) plus its
// subtasks under `<track>/<subid>-<slug>.md`. It is detected by the presence of root.md —
// the folder itself is never a track or a column.
function isGroupDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'root.md'))
}

// Read a group folder: its root card (carrying a light list of its subtasks for the root
// page) and the full subtask cards (each linked back to the root so a subtask page can
// point up). Subtasks never surface as their own board cards.
function readGroup(folderName: string): { root: Card; subCards: Card[] } | null {
  const groupDir = path.join(TODO, folderName)
  const root = readCard(path.join(groupDir, 'root.md'), path.join(folderName, 'root.md'))
  if (!root) return null
  // Group-ness comes from the folder shape (it has a root.md), not from the subtask count
  // below: a finished subtask's file is removed, so a group whose subtasks are all done
  // reads as zero subtasks and would stop looking like a group right when it becomes
  // archiveable.
  root.isGroup = true
  root.subtaskLines = countSubtaskLines(root.body)

  const subCards: Card[] = []
  const recurse = (dir: string, relDir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = path.join(relDir, entry.name)
      if (entry.isDirectory()) {
        recurse(path.join(dir, entry.name), childRel)
      } else if (entry.name.endsWith('.md') && entry.name !== 'README.md' && entry.name !== 'root.md') {
        const c = readCard(path.join(dir, entry.name), childRel)
        if (c) {
          c.parent = { id: root.id, title: root.title }
          subCards.push(c)
        }
      }
    }
  }
  recurse(groupDir, folderName)
  subCards.sort((a, b) => a.id - b.id)

  root.subtasks = subCards.map<Subtask>((c) => ({
    id: c.id,
    title: c.title,
    track: c.track,
    release: c.release,
    todos: c.todos,
  }))
  return { root, subCards }
}

// Standalone `NN-slug.md` cards directly under a track folder. Group folders are read
// separately (they live at the top of todo/, not inside a track).
function standaloneCards(track: string): Card[] {
  const dir = path.join(TODO, track)
  if (!fs.existsSync(dir)) return []
  const cards: Card[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      const c = readCard(path.join(dir, entry.name), path.join(track, entry.name))
      if (c) cards.push(c)
    }
  }
  return cards.sort((a, b) => a.id - b.id)
}

// Read every card once. `board` is what the columns show: standalone cards and group roots
// (never a subtask). `every` also includes each group's subtasks, so a `#<id>` reference
// linkifies and its own page resolves for any open card.
function collectCards(): { board: Card[]; every: Card[] } {
  const board: Card[] = []
  const every: Card[] = []
  for (const entry of fs.readdirSync(TODO, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(TODO, entry.name)
    if (isGroupDir(dir)) {
      const g = readGroup(entry.name)
      if (g) {
        board.push(g.root)
        every.push(g.root, ...g.subCards)
      }
    } else {
      const cards = standaloneCards(entry.name)
      board.push(...cards)
      every.push(...cards)
    }
  }
  // The two arrays hold the same card objects, so annotating `every` covers the board cards
  // as well.
  attachBlockers(every)
  return { board, every }
}

/** Any open card by id, including a group subtask the columns don't show. */
export function findCard(id: number): Card | null {
  const card = collectCards().every.find((c) => c.id === id) ?? null
  if (card) attachDelivery(card)
  return card
}

// The delivery in flight on this card, read fresh. Only the single-card read attaches it:
// the board draws no delivery of its own, and the hold it feeds is the card page's.
//
// A plain read of the record, never `listRuns()`: that one reaps, which writes the record
// and calls board moves, and a card can be read with the board's own lock already held.
function attachDelivery(card: Card): void {
  const delivery = activeDelivery(card.id)
  if (!delivery) return
  const live = readRuns().find((r) => r.status === 'running' && r.deliveryId === delivery.deliveryId)
  card.delivery = {
    id: delivery.deliveryId,
    startedAt: delivery.startedAt,
    sessionId: live?.sessionId,
    waiting: delivery.review?.stopped?.why,
    next: delivery.next,
  }
}

/** Every open card, subtasks included. */
export function allCards(): Card[] {
  return collectCards().every
}

// Track folders present on disk — every directory under todo/ except the group folders (a
// group is one card in its own track, not a column).
function trackFolders(): string[] {
  return fs
    .readdirSync(TODO, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !isGroupDir(path.join(TODO, e.name)))
    .map((e) => e.name)
}

// Column order follows the README's `## ` headings so the board matches the board file,
// with any track folder missing from the README appended after.
function orderedTracks(): { track: string; title: string }[] {
  const folders = new Set(trackFolders())
  const ordered: { track: string; title: string }[] = []
  const seen = new Set<string>()

  if (fs.existsSync(README)) {
    for (const line of fs.readFileSync(README, 'utf8').split('\n')) {
      const m = line.match(/^##\s+(.+?)\s*$/)
      if (!m) continue
      const heading = m[1]!
      const track = heading.toLowerCase() === 'blockers' ? 'blockers' : heading
      if (folders.has(track) && !seen.has(track)) {
        ordered.push({ track, title: track === 'blockers' ? 'Blockers' : heading })
        seen.add(track)
      }
    }
  }
  // Blockers always first, even if the README didn't list it.
  if (folders.has('blockers') && !seen.has('blockers')) {
    ordered.unshift({ track: 'blockers', title: 'Blockers' })
    seen.add('blockers')
  }
  for (const t of trackFolders()) {
    if (!seen.has(t)) ordered.push({ track: t, title: t })
  }
  return ordered
}

// Parse archive.md into groups keyed by topic heading. Read-only, no ids.
function readArchiveNotes(): ArchiveGroup[] {
  if (!fs.existsSync(ARCHIVE_MD)) return []
  const groups: ArchiveGroup[] = []
  let current: ArchiveGroup | null = null
  for (const line of fs.readFileSync(ARCHIVE_MD, 'utf8').split('\n')) {
    const h2 = line.match(/^##\s+(.+?)\s*$/)
    if (h2) {
      current = { category: h2[1]!, markdown: '' }
      groups.push(current)
      continue
    }
    if (/^#\s/.test(line)) continue // skip the top "# Archive" title
    if (current) current.markdown += line + '\n'
  }
  return groups.map((g) => ({ ...g, markdown: g.markdown.trim() })).filter((g) => g.markdown.length > 0)
}

// How many open cards name each release. Counted over EVERY open card, subtasks included,
// so the number a release dropdown shows is the number `release list` prints — a group's
// subtasks answer for themselves there too. A blocker counts once, in the release it names.
function countByRelease(cards: Card[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const card of cards) counts[card.release] = (counts[card.release] ?? 0) + 1
  return counts
}

/** How far setup got: every box in order, the count, and the first unticked one. Null when
 *  there is no checklist (setup is finished) and also when there is one we can't read a
 *  single box out of — a file we don't understand is not something to nag about. */
export function readSetupState(): SetupState | null {
  const steps = readSetupChecklist()
  if (!steps || steps.length === 0) return null
  const done = steps.filter((s) => s.done).length
  return { steps, done, total: steps.length, next: steps.find((s) => !s.done) ?? null }
}

/** The whole board in one read. */
export function readBoard(): Board {
  const { board, every } = collectCards()
  // Bucket the board cards by their frontmatter track, then lay the columns out in README
  // order. A group root lands in its declared track next to the plain cards, not in a
  // column named after its folder.
  const byTrack = new Map<string, Card[]>()
  for (const card of board) {
    const list = byTrack.get(card.track)
    if (list) list.push(card)
    else byTrack.set(card.track, [card])
  }
  const columns: Column[] = orderedTracks().map(({ track, title }) => ({
    track,
    title,
    cards: (byTrack.get(track) ?? []).sort(byPickOrder),
  }))
  const entries = readReleaseEntries()
  const releaseGoals: Record<string, string> = {}
  for (const entry of entries) if (entry.goal) releaseGoals[entry.id] = entry.goal
  return {
    columns,
    archive: readArchiveNotes(),
    // Linkify every open id, subtasks included — not just the cards the columns show.
    openIds: Array.from(new Set(every.map((card) => card.id))),
    releases: entries.map((e) => e.id),
    releaseGoals,
    releaseCounts: countByRelease(every),
    goalNeedsWork: goalNeedsWork(),
    goalWritten: goalWritten(),
    memoryModules: readMemoryModules(),
    setup: readSetupState(),
  }
}
