// ---- a board, assembled from one read ---------------------------------------
//
// The board's own reading rules as plain functions: what a `## Todo` counts, what a group
// folder is, how the columns are laid out, which release list a picker draws. `view/read.ts`
// applies them to `docs/kanban/`; a hosted page applies them to what a Cloud read hands back
// (#322), and neither invents a second set.
//
// Nothing here touches a filesystem, git or the coding agent, and it imports only its
// siblings — which is what lets `scripts/sync-format.mjs` copy it into the board UI and run
// it on a Worker.
//
// What a read has to carry is `BoardRead` below: the workspace's name, its live cards as
// #315 stores them, and the board's configuration documents. What it CANNOT carry is
// everything the machine holding the board answers — the delivery in flight, the archive,
// the memory set, the setup checklist — so those come back empty rather than guessed at.

import { formatStamp, nextDue } from '../cadence'
import { byPickOrder } from '../view/rules'
import type {
  Board,
  Card,
  CardSchedule,
  CardStatus,
  Column,
  Question,
  Subtask,
} from '../view/types'
import type { BoardScreen, BoardStanding, CardScreen, ScreenBoard } from './screen'

// ---- what a read carries ----------------------------------------------------

/** One card as a workspace stores it (#315): the number the board calls it by, the version
 *  it was read at, and its portable fields plus its body under `data`. */
export interface ReadCard {
  id: number
  revision: string
  /** `{ path, meta, body }` — read defensively, since it arrives as JSON off a wire. */
  data: unknown
}

/** One board file that is not a card, under the path it is written to. */
export interface ReadDocument {
  path: string
  body: string
}

/** Everything the two screens are drawn from. */
export interface BoardRead {
  workspace: { id: string; name: string }
  cards: ReadCard[]
  documents: ReadDocument[]
}

// ---- the pieces `view/read.ts` shares with it -------------------------------

/** The number at the front of a card's filename, or of a group folder's name. */
export const idPrefix = (name: string): number | null => {
  const m = name.match(/^(\d+)-/)
  return m ? Number(m[1]) : null
}

/** A folder under `todo/` holding a group's `root.md` — recognised by its name alone, so a
 *  group whose subtasks are all finished is still a group. */
export const isGroupFolder = (name: string): boolean => idPrefix(name) !== null

/** How far a card's `## Todo` got. Every checkbox in the body counts, wherever it sits. */
export function countTodos(body: string): { total: number; done: number } {
  const matches = body.match(/^[ \t]*[-*]\s+\[( |x|X)\]/gm) || []
  const done = matches.filter((l) => /\[[xX]\]/.test(l)).length
  return { total: matches.length, done }
}

/**
 * A group root's subtask lines — the `## Todo` boxes carrying a `#<subid>` — and how many
 * are settled: ticked (built) or struck through (rejected). `ticked` is the closing rule's
 * alone; no screen draws it.
 *
 * The root keeps these true after the subtask files are gone, so this is what says a group
 * is finished rather than the subtask count.
 */
export function subtaskLines(body: string): { total: number; resolved: number; ticked: number } {
  let total = 0
  let resolved = 0
  let ticked = 0
  for (const line of body.split('\n')) {
    const m = line.match(/^[ \t]*[-*]\s+\[( |x|X)\]\s*(.*)$/)
    if (!m || !/#\d+/.test(m[2]!)) continue
    total++
    const done = /[xX]/.test(m[1]!)
    if (done) ticked++
    if (done || /~~[\s\S]*~~/.test(m[2]!)) resolved++
  }
  return { total, resolved, ticked }
}

/**
 * When a recurring card comes round again, in words a page prints as it stands. Empty when
 * the card has no cadence — then nothing but a person starts it. "Due now" when the wait is
 * already over, which covers a card that has never run.
 *
 * Worked out where the board is read, on the clock its schedule runs on.
 */
export function dueLabel(lastRun: string, cadence: string, now = Date.now()): string {
  const due = nextDue(lastRun, cadence)
  if (!due) return ''
  return due.getTime() <= now ? 'Due now' : formatStamp(due)
}

/**
 * Work out what is really blocking each card. A `blocked_by` id counts only when it names a
 * card that is still open — an id no longer on the board was archived or rejected, so that
 * work is done. A recurring blocker and a card naming itself are skipped: neither ever
 * clears.
 */
export function attachBlockers(cards: Card[]): void {
  const byId = new Map(cards.map((c) => [c.id, c]))
  for (const card of cards) {
    card.openBlockers = card.blocked_by
      .filter((n) => n !== card.id)
      .map((n) => byId.get(n))
      .filter((b): b is Card => !!b && !b.recurring)
      .map((b) => ({ id: b.id, title: b.title }))
  }
}

/** The catch-all band's heading — cards whose `modules:` is empty. */
const UNTAGGED = 'Untagged'

/**
 * Lay the bands out in module-map order, with a band at the end for cards naming none. A
 * card can name a module the map has since lost, so those are banded rather than dropped.
 */
function orderedModules(known: string[], present: Set<string>): { module: string; title: string }[] {
  const ordered: { module: string; title: string }[] = []
  const seen = new Set<string>()
  for (const name of known) {
    if (seen.has(name)) continue
    ordered.push({ module: name, title: name })
    seen.add(name)
  }
  for (const name of Array.from(present).sort()) {
    if (name && !seen.has(name)) ordered.push({ module: name, title: name })
  }
  ordered.push({ module: '', title: UNTAGGED })
  return ordered
}

/** The board's columns: cards bucketed by their first module, in map order, empties dropped. */
export function columnsFrom(cards: Card[], known: string[]): Column[] {
  const byModule = new Map<string, Card[]>()
  for (const card of cards) {
    const key = card.modules[0] ?? ''
    const list = byModule.get(key)
    if (list) list.push(card)
    else byModule.set(key, [card])
  }
  return orderedModules(known, new Set(byModule.keys()))
    .map(({ module, title }) => ({
      module,
      title,
      cards: (byModule.get(module) ?? []).sort(byPickOrder),
    }))
    .filter((col) => col.cards.length > 0)
}

/** How many open cards name each release, with the empty key for the cards in none. */
export function countByRelease(cards: Card[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const card of cards) counts[card.release] = (counts[card.release] ?? 0) + 1
  return counts
}

// ---- the two board files a read parses --------------------------------------

/** One release on the list, and what it is for. */
export interface ReleaseEntry {
  id: string
  goal: string
}

/**
 * One line of `releases.md`. It reads `- **v1** — what it is for` (what the script writes),
 * `- **v1**` (a release with no goal) and a bare `- v1` (what a hand edit leaves). Only the
 * FIRST em dash splits the line, so a goal holding one of its own reads back whole.
 */
export function releaseLineEntry(line: string): ReleaseEntry | null {
  const m = line.match(/^\s*[-*]\s+(.*)$/)
  if (!m) return null
  const cut = m[1]!.indexOf('—')
  const head = (cut === -1 ? m[1]! : m[1]!.slice(0, cut)).trim()
  const goal = cut === -1 ? '' : m[1]!.slice(cut + 1).trim()
  const bold = head.match(/^\*\*(.+?)\*\*$/)
  const id = (bold ? bold[1]! : head).trim()
  return id ? { id, goal } : null
}

/** Every release on the list with its goal, in file order. A duplicate can only come from a
 *  hand edit; the first line wins so the order holds. */
export function releaseEntriesFrom(text: string): ReleaseEntry[] {
  const out: ReleaseEntry[] = []
  for (const line of text.split('\n')) {
    const entry = releaseLineEntry(line)
    if (entry && !out.some((e) => e.id === entry.id)) out.push(entry)
  }
  return out
}

/** The module map's names — the **bolded name** at the front of each line, nothing else. */
export function moduleNamesFrom(text: string): string[] {
  const names: string[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-*]\s+\*\*([^*]+)\*\*/)
    if (m) names.push(m[1]!.trim())
  }
  return names
}

// ---- one card, off the wire -------------------------------------------------

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const ids = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n)) : []
const lines = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => text(v)).filter(Boolean) : []

/** A card's stored `data`, read as the fields a screen draws. Anything missing reads as
 *  empty: a screen drawing a card with no priority is better than one that will not draw. */
function fieldsOf(data: unknown): { path: string; body: string; meta: Record<string, unknown> } {
  const held = (data ?? {}) as Record<string, unknown>
  const meta = (held.meta ?? {}) as Record<string, unknown>
  return { path: text(held.path), body: text(held.body), meta }
}

/** Turn one stored card into the card a screen draws. `path` is what says whether it is a
 *  group root, a subtask or a recurring job — the same rule the folder shape is read by. */
function cardFrom(read: ReadCard, now: number): Card | null {
  const { path, body, meta } = fieldsOf(read.data)
  if (!path) return null
  // Stored under `docs/kanban/`; a card's `relPath` is relative to `todo/`.
  const relPath = path.replace(/^todo\//, '')
  const recurring = relPath.split('/')[0] === 'recurring'
  const cadence = text(meta.cadence)
  const lastRun = text(meta.last_run)
  return {
    id: read.id,
    revision: read.revision,
    relPath,
    title: text(meta.title),
    priority: text(meta.priority),
    roi: text(meta.roi),
    status: text(meta.status) as CardStatus,
    release: text(meta.release),
    blocked_by: ids(meta.blocked_by),
    related: ids(meta.related),
    questions: (Array.isArray(meta.questions) ? meta.questions : []) as Question[],
    verify: lines(meta.verify),
    modules: lines(meta.modules),
    last_run: lastRun,
    cadence,
    schedule: (meta.schedule ?? null) as CardSchedule | null,
    nextRun: recurring ? dueLabel(lastRun, cadence, now) : '',
    body: body.replace(/^\n+/, '').replace(/\s+$/, ''),
    todos: countTodos(body),
    isGroup: false,
    recurring,
    openBlockers: [],
  }
}

/** The group folder a card sits in, or empty when it is not in one. */
function groupFolder(relPath: string): string {
  const parts = relPath.split('/')
  return parts.length > 1 && isGroupFolder(parts[0]!) ? parts[0]! : ''
}

const isRoot = (relPath: string): boolean =>
  relPath.endsWith('/root.md') && !!groupFolder(relPath)

/**
 * Every card a read holds, with the group shape put back: a root carries its subtasks and a
 * subtask points back at its root, and no subtask is a board card of its own.
 */
function collectCards(read: BoardRead, now: number): { board: Card[]; every: Card[] } {
  const cards: Card[] = []
  for (const entry of read.cards) {
    const card = cardFrom(entry, now)
    if (card) cards.push(card)
  }
  cards.sort((a, b) => a.id - b.id)

  const roots = new Map<string, Card>()
  for (const card of cards) {
    if (!isRoot(card.relPath)) continue
    card.isGroup = true
    const { total, resolved } = subtaskLines(card.body)
    card.subtaskLines = { total, resolved }
    card.subtasks = []
    roots.set(groupFolder(card.relPath), card)
  }

  const board: Card[] = []
  for (const card of cards) {
    const folder = groupFolder(card.relPath)
    const root = folder ? roots.get(folder) : undefined
    if (!root || root === card) {
      board.push(card)
      continue
    }
    card.parent = { id: root.id, title: root.title }
    root.subtasks!.push(subtaskOf(card))
  }

  attachBlockers(cards)
  return { board, every: cards }
}

const subtaskOf = (card: Card): Subtask => ({
  id: card.id,
  title: card.title,
  release: card.release,
  todos: card.todos,
  blocked_by: card.blocked_by,
})

// ---- the two screens --------------------------------------------------------

/** How a hosted page stands: the workspace itself, read live, so there is no copy to date. */
const standingOf = (name: string): BoardStanding => ({
  kind: 'cloud',
  offline: false,
  workspaceName: name,
  readAt: '',
  readWhen: '',
})

const screenBoardOf = (read: BoardRead): ScreenBoard => ({
  id: read.workspace.id,
  standing: standingOf(read.workspace.name),
})

const documentBody = (read: BoardRead, path: string): string =>
  read.documents.find((d) => d.path === path)?.body ?? ''

/** The whole board, as the board screen draws it. */
function boardFrom(read: BoardRead, now = Date.now()): Board {
  const { board, every } = collectCards(read, now)
  const releases = releaseEntriesFrom(documentBody(read, 'releases.md'))
  const releaseGoals: Record<string, string> = {}
  for (const entry of releases) if (entry.goal) releaseGoals[entry.id] = entry.goal
  return {
    columns: columnsFrom(board, moduleNamesFrom(documentBody(read, 'modules.md'))),
    // Read on demand where the board is, and not served to a browser (#322).
    archive: [],
    openIds: Array.from(new Set(every.map((card) => card.id))),
    releases: releases.map((e) => e.id),
    releaseGoals,
    releaseCounts: countByRelease(every),
    // The goal and the memory set are the board's own and no screen here draws them; the
    // setup checklist is a run on the machine holding the board.
    goalNeedsWork: false,
    goalWritten: false,
    memoryModules: [],
    setup: null,
  }
}

/** Everything the board screen draws. */
export function boardScreenFrom(read: BoardRead, now = Date.now()): BoardScreen {
  return { ...screenBoardOf(read), board: boardFrom(read, now), error: null }
}

/** Everything a card page draws, or null when this read holds no card with that id. */
export function cardScreenFrom(read: BoardRead, id: number, now = Date.now()): CardScreen | null {
  const every = collectCards(read, now).every
  const card = every.find((c) => c.id === id)
  if (!card) return null
  const releases = releaseEntriesFrom(documentBody(read, 'releases.md'))
  return {
    ...screenBoardOf(read),
    card,
    openIds: Array.from(new Set(every.map((c) => c.id))),
    releases: releases.map((e) => e.id),
    goalWritten: false,
    memoryModules: [],
    // A plan is about a checkout and a diff is a commit — both the machine's, neither a
    // board's, and no control here would use either.
    plan: { commitMode: 'manual' },
    diff: null,
  }
}
