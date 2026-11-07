// ---- how long a card has sat -----------------------------------------------
//
// A card carries no date of its own, so its age is the date of the last commit that
// touched its file. Git already knows it; keeping it in frontmatter would only be one
// more line to forget. A move into a group folder counts as a touch, because git records
// the rename as a change to the new path.
//
// The whole board is dated in ONE git pass — `raw list --stale` asks for it, and nothing
// that lists the board routinely pays for it.

import fs from 'node:fs'
import path from 'node:path'

import { git } from './agent/worktree'
import { CONFIG, TODO } from './paths'

/** Days a card may sit before the listing calls it stale, when `config.md` says nothing. */
export const STALE_AFTER_DEFAULT = 30

// `- **Stale after** — 30 days`, the way every other setting in config.md is written.
const LINE = /^- \*\*Stale after\*\*\s*[—-]\s*(\d+)/m

/** The threshold one `config.md` sets. Missing, damaged or not a number reads as the default. */
export function staleAfterIn(config: string): number {
  const days = Number(LINE.exec(config)?.[1])
  return Number.isInteger(days) && days > 0 ? days : STALE_AFTER_DEFAULT
}

/** This board's threshold, read from its `config.md`. */
export function staleAfter(): number {
  if (!fs.existsSync(CONFIG)) return STALE_AFTER_DEFAULT
  return staleAfterIn(fs.readFileSync(CONFIG, 'utf8'))
}

/** When a card was last touched, and how long ago that was. */
export interface Age {
  /** The commit date, as `YYYY-MM-DD`. */
  lastTouched: string
  /** Whole days from that date to now. */
  days: number
}

// The repository's top folder, which git names every path it prints from — not the
// project root, which sits under it whenever a board belongs to one package of a larger
// repository. Null outside a repository.
const gitTop = (): string | null => git(['rev-parse', '--show-toplevel'])?.trim() || null

// A path as git would reach it. Git resolves symlinks on the way to the top folder, so
// both ends of a comparison have to.
const real = (p: string): string => {
  try {
    return fs.realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

// `todo/` as git names it, from the top folder. Null when the board sits outside the
// repository, which reads the same as having no repository at all: nothing here can be
// dated.
function todoPathspec(top: string): string | null {
  const from = path.relative(real(top), real(TODO))
  if (!from || from.startsWith('..') || path.isAbsolute(from)) return null
  return from.split(path.sep).join('/')
}

// Git quotes a path holding anything unusual; the quoted form is a C string, which JSON
// reads closely enough for the names a board writes.
const unquotePath = (line: string): string => {
  if (!line.startsWith('"')) return line
  try {
    return String(JSON.parse(line))
  } catch {
    return line.slice(1, -1)
  }
}

// One path git printed, spelled the way the board spells it — under TODO, whatever route
// git took to the folder. Null for anything outside `todo/`.
function cardFile(spec: string, printed: string): string | null {
  const p = unquotePath(printed)
  if (!p.startsWith(`${spec}/`)) return null
  return path.join(TODO, ...p.slice(spec.length + 1).split('/'))
}

// Files under `todo/` that differ from HEAD, tracked or not. Their card's age would be the
// age of a file that is no longer what is on disk, so they are left undated.
function dirtyCards(top: string, spec: string): Set<string> {
  const out = git(['status', '--porcelain', '--untracked-files=all', '--', spec], top)
  if (out === null) return new Set()
  const dirty = new Set<string>()
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const file = cardFile(spec, line.slice(3).split(' -> ').pop()!.trim())
    if (file) dirty.add(file)
  }
  return dirty
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Every card file under `todo/` that git can date, keyed by absolute path.
 *
 * One `git log` over the folder: it walks newest first, so the first commit naming a file
 * is its last touch. A card missing from the map cannot be dated — never committed, or
 * edited in the working tree — and is never stale.
 *
 * Null outside a git repository, where there is nothing to read ages from.
 */
export function cardAges(now = Date.now()): Map<string, Age> | null {
  const top = gitTop()
  const spec = top && todoPathspec(top)
  if (!top || !spec) return null
  const out = git(['log', '--format=%x01%cI', '--name-only', '--', spec], top)
  if (out === null) return null

  const dirty = dirtyCards(top, spec)
  const ages = new Map<string, Age>()
  let when = ''
  for (const line of out.split('\n')) {
    if (line.startsWith('\x01')) {
      when = line.slice(1).trim()
      continue
    }
    if (!line.trim() || !when) continue
    const file = cardFile(spec, line.trim())
    if (!file || ages.has(file) || dirty.has(file)) continue
    const at = Date.parse(when)
    if (Number.isNaN(at)) continue
    ages.set(file, { lastTouched: when.slice(0, 10), days: Math.max(0, Math.floor((now - at) / DAY)) })
  }
  return ages
}
