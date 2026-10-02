// ---- what a card that left the board still holds in .akb (#1177) -----------
//
// Archiving keeps a card's assets for the archive page, and nothing else ever removed them —
// nor the worktree of a delivery that ended. Once a card has been off the board for a week
// its assets, old mockups, chats and ended delivery worktrees go, except the asset files a
// memory note or an open card still points at. The archived card itself goes after 30 days
// (#1335), unless it names a release still on the list. A cleared chat kept for the memory
// review (#1345) goes after 30 days unread, whatever became of its card.

import fs from 'node:fs'
import path from 'node:path'

import { dropKeptChat, keptChats } from './agent/chat'
import { git, removeWorktree, dropEmptyWorktreeFolders, pruneWorktreeMetadata, worktreeDir } from './agent/worktree'
import { idPrefix, walkDirs, walkMd } from './cards'
import { parseFrontmatter } from './frontmatter'
import { AKB_DIR, ARCHIVE, ASSETS, CHATS_DIR, DELIVERIES, KANBAN, MEMORY, MOCKUPS, TODO, rel } from './paths'
import { readReleases } from './releases'
import { normalizeRelease } from './validate'

const KEEP_DAYS = 7
const KEEP_CARD_DAYS = 30
const KEEP_CHAT_DAYS = 30
const DAY = 24 * 60 * 60_000

export interface LeftoverPrune {
  removed: string[]
  /** Worktrees git refused to remove — uncommitted work, most likely. Tried again next time. */
  skipped: string[]
}

const listDir = (dir: string): string[] => {
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

const mtime = (file: string): number => {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return 0
  }
}

// Every id still on the board, subtasks and recurring cards included.
function openIds(): Set<number> {
  const ids = new Set<number>()
  if (!fs.existsSync(TODO)) return ids
  for (const f of [...walkMd(TODO), ...walkDirs(TODO)]) {
    const id = idPrefix(path.basename(f))
    if (id !== null) ids.add(id)
  }
  return ids
}

interface ArchivedFile {
  /** Its `archived:` day, or null when it has none that reads. */
  at: number | null
  release: string
}

function readArchived(file: string): ArchivedFile {
  const meta = parseFrontmatter(fs.readFileSync(file, 'utf8')).meta
  const day = String(meta?.archived ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return {
    at: day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime() : null,
    release: normalizeRelease(meta?.release),
  }
}

// When each archived card was archived, from its `archived:` day.
function archivedAt(): Map<number, number> {
  const at = new Map<number, number>()
  if (!fs.existsSync(ARCHIVE)) return at
  for (const file of walkMd(ARCHIVE)) {
    const id = idPrefix(path.basename(file)) ?? idPrefix(path.basename(path.dirname(file)))
    if (id === null) continue
    const day = readArchived(file).at
    if (day !== null) at.set(id, day)
  }
  return at
}

/** An archive entry past its keep: one card file, or a group folder whole. */
export interface DueArchived {
  path: string
  /** Every card in it. */
  ids: number[]
}

/** Each archived card file, and each group folder whole, whose newest card has been archived
 *  for KEEP_CARD_DAYS. A card naming a release still on the list keeps its entry: closing
 *  that release reads the archive for what shipped. `undated` is when a card with no
 *  `archived:` day was archived, by id; a card it does not name goes by its file's mtime. */
export function dueArchivedCards(now = Date.now(), undated?: ReadonlyMap<number, number>): DueArchived[] {
  const open = new Set(readReleases())
  const due: DueArchived[] = []
  for (const entry of fs.existsSync(ARCHIVE) ? fs.readdirSync(ARCHIVE, { withFileTypes: true }) : []) {
    if (idPrefix(entry.name) === null) continue
    const full = path.join(ARCHIVE, entry.name)
    const files = entry.isDirectory() ? walkMd(full) : entry.name.endsWith('.md') ? [full] : []
    if (!files.length) continue
    const cards = files.map((file) => ({
      ...readArchived(file),
      file,
      id: idPrefix(path.basename(file) === 'root.md' ? path.basename(path.dirname(file)) : path.basename(file)),
    }))
    if (cards.some((c) => open.has(c.release))) continue
    const newest = Math.max(...cards.map((c) => c.at ?? (c.id !== null ? undated?.get(c.id) : undefined) ?? mtime(c.file)))
    if (now - newest < KEEP_CARD_DAYS * DAY) continue
    due.push({ path: full, ids: cards.map((c) => c.id).filter((id): id is number => id !== null) })
  }
  return due
}

/** Delete those entries, and say what went. */
export function removeArchivedCards(due: DueArchived[]): string[] {
  for (const entry of due) fs.rmSync(entry.path, { recursive: true, force: true })
  return due.map((entry) => rel(entry.path))
}

interface EndedWorktree {
  cardId: number
  worktree: string
}

// This board's ended deliveries that still name a card worktree.
function endedWorktrees(): EndedWorktree[] {
  const out: EndedWorktree[] = []
  for (const name of listDir(DELIVERIES)) {
    if (!name.endsWith('.json')) continue
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DELIVERIES, name), 'utf8'))
      if (d.status === 'active' || typeof d.cardId !== 'number' || typeof d.worktree !== 'string') continue
      const inside = path.relative(path.join(AKB_DIR, 'worktrees', String(d.cardId)), worktreeDir(d.worktree))
      if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) continue
      out.push({ cardId: d.cardId, worktree: d.worktree })
    } catch {
      // an unreadable record claims nothing
    }
  }
  return out
}

// ---- references that keep an asset -----------------------------------------

// `assets/<id>/<path>` in any of its spellings: `.assets/`, `.akb/boards/…/assets/`, bare.
const ASSET_REF = /(?:^|[^\w-])\.?assets\/(\d+)(?:\/([^\s`'"()[\]]*))?/g

// A written path as a test on a file's path under `assets/<id>/`. `*`, `{a,b}` and `<a|b>`
// are wildcards; a path that names a folder keeps everything under it.
function refMatcher(pattern: string): RegExp {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*'
        i++
      } else re += '[^/]*'
    } else if (c === '{' || c === '<') {
      const close = pattern.indexOf(c === '{' ? '}' : '>', i)
      if (close < 0) {
        re += '\\' + c
        continue
      }
      const alts = pattern.slice(i + 1, close).split(c === '{' ? ',' : '|')
      re += `(?:${alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`
      i = close
    } else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}(?:/.*)?$`)
}

// Per id: the tests its referenced paths make, or `null` when the whole folder is referenced.
function assetRefs(): Map<number, RegExp[] | null> {
  const refs = new Map<number, RegExp[] | null>()
  const files = [MEMORY, TODO].flatMap((dir) => (fs.existsSync(dir) ? walkMd(dir) : []))
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(ASSET_REF)) {
      const id = Number(m[1])
      const sub = (m[2] ?? '').replace(/[.,:;!?]+$/, '').replace(/\/+$/, '')
      if (!sub) refs.set(id, null)
      else if (refs.get(id) !== null) refs.set(id, [...(refs.get(id) ?? []), refMatcher(sub)])
    }
  }
  return refs
}

// Remove every file under `dir` no test keeps, then the folders that leaves empty.
function pruneFiles(dir: string, keep: RegExp[], removed: string[], at = ''): void {
  for (const entry of fs.readdirSync(path.join(dir, at), { withFileTypes: true })) {
    const sub = at ? `${at}/${entry.name}` : entry.name
    const full = path.join(dir, sub)
    if (entry.isDirectory()) {
      pruneFiles(dir, keep, removed, sub)
      if (!fs.readdirSync(full).length) fs.rmdirSync(full)
    } else if (!keep.some((re) => re.test(sub))) {
      fs.rmSync(full, { force: true })
      removed.push(rel(full))
    }
  }
}

// ---- the prune ---------------------------------------------------------------

const registeredWorktrees = (): Set<string> =>
  new Set(
    (git(['worktree', 'list', '--porcelain']) ?? '')
      .split('\n')
      .filter((l) => l.startsWith('worktree '))
      .map((l) => realpath(l.slice('worktree '.length))),
  )

const realpath = (p: string): string => {
  try {
    return fs.realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

/** Remove what every card off the board for a week still holds, then the archived cards and
 *  the kept chats past their own keep, and say what went. `cards: false` leaves the archived
 *  cards to a caller with somewhere else to delete them from first. */
export function pruneLeftovers(now = Date.now(), cards = true): LeftoverPrune {
  const removed: string[] = []
  const skipped: string[] = []
  pruneHeld(now, removed, skipped)
  if (cards) removed.push(...removeArchivedCards(dueArchivedCards(now)))
  for (const kept of keptChats()) {
    if (now - kept.keptAt >= KEEP_CHAT_DAYS * DAY && dropKeptChat(kept.key)) removed.push(`${rel(CHATS_DIR)}/${kept.key}.kept`)
  }
  return { removed, skipped }
}

function pruneHeld(now: number, removed: string[], skipped: string[]): void {
  const open = openIds()
  const oldMockups = path.join(KANBAN, '.mockups')

  // Every leftover path, by the id it belongs to.
  const held = new Map<number, string[]>()
  const hold = (id: number | null, p: string) => {
    if (id === null || open.has(id)) return
    held.set(id, [...(held.get(id) ?? []), p])
  }
  for (const root of [ASSETS, MOCKUPS, oldMockups]) {
    for (const name of listDir(root)) if (/^\d+$/.test(name)) hold(Number(name), path.join(root, name))
  }
  for (const name of listDir(CHATS_DIR)) {
    const m = name.match(/^card-(\d+)\./)
    if (m) hold(Number(m[1]), path.join(CHATS_DIR, name))
  }
  const worktrees = endedWorktrees().filter((w) => fs.existsSync(worktreeDir(w.worktree)))
  for (const w of worktrees) hold(w.cardId, worktreeDir(w.worktree))

  const archived = archivedAt()
  const leaving = new Set<number>()
  for (const [id, paths] of held) {
    const left = archived.get(id) ?? Math.max(...paths.map(mtime))
    if (now - left >= KEEP_DAYS * DAY) leaving.add(id)
  }
  if (!leaving.size) return

  const refs = assetRefs()
  for (const id of leaving) {
    const assets = path.join(ASSETS, String(id))
    const keep = refs.get(id)
    if (fs.existsSync(assets) && keep !== null) {
      if (keep) {
        pruneFiles(assets, keep, removed)
        if (!fs.readdirSync(assets).length) fs.rmdirSync(assets)
      } else {
        fs.rmSync(assets, { recursive: true, force: true })
        removed.push(rel(assets))
      }
    }
    for (const dir of [path.join(MOCKUPS, String(id)), path.join(oldMockups, String(id))]) {
      if (!fs.existsSync(dir)) continue
      fs.rmSync(dir, { recursive: true, force: true })
      removed.push(rel(dir))
    }
    for (const name of listDir(CHATS_DIR)) {
      if (!name.startsWith(`card-${id}.`)) continue
      fs.rmSync(path.join(CHATS_DIR, name), { recursive: true, force: true })
      removed.push(rel(path.join(CHATS_DIR, name)))
    }
  }

  const gone = worktrees.filter((w) => leaving.has(w.cardId))
  if (gone.length) {
    const registered = registeredWorktrees()
    let unregistered = false
    for (const w of gone) {
      const dir = worktreeDir(w.worktree)
      if (registered.has(realpath(dir))) {
        const out = removeWorktree(w.worktree, undefined)
        if (!out.ok) {
          skipped.push(`${w.worktree}: ${out.error}`)
          continue
        }
      } else {
        fs.rmSync(dir, { recursive: true, force: true })
        unregistered = true
      }
      removed.push(w.worktree)
    }
    if (unregistered) pruneWorktreeMetadata()
    dropEmptyWorktreeFolders()
  }
}
