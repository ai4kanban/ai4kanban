// ---- validation (guards against hallucinated meta) -------------------------
//
// Reading the command line is Commander's (lib/cli/), and so is refusing an unknown option
// or a value outside a fixed set. What is left here is the checking a command line cannot
// do on its own: whether a track exists, whether a module is on the map, whether an id names
// an open card. A hallucinated one is a hard error rather than a silently written field.

import fs from 'node:fs'

import { die, warn, rel, TODO, MODULES_MD } from './paths'
import { locate, trackNames } from './cards'

export function slugify(s: unknown): string {
  const out = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return out || 'task'
}

export const LEVELS = ['high', 'med', 'low']

export function validLevel(v: unknown, name: string): void {
  if (!LEVELS.includes(String(v))) die(`--${name} must be one of ${LEVELS.join(' | ')} (got "${v}")`)
}

// The stages a card can rest in, in order: `todo` (raw), `ready` (plan concrete,
// no open questions, someone could start now), `implementing`. `reject`/`archive`
// take the card off the board, so they are not statuses — a live run's action is
// tracked in the UI registry, not here. A missing status reads as `todo`, so cards
// written before this field still parse.
export const STATUSES = ['todo', 'ready', 'implementing']

export function validStatus(v: unknown): void {
  if (!STATUSES.includes(String(v))) die(`--status must be one of ${STATUSES.join(' | ')} (got "${v}")`)
}

// The release a card ships in. A card that names none is simply in no release — wanted,
// but not promised to a version. The empty string is that state. Declared with the reader's
// shapes so a front end and a command mean the same thing by "no release".
export { NO_RELEASE } from './view/types'
import { NO_RELEASE } from './view/types'

// A version id is free text (`v1`, `0.5.0`, `august`) — the board never parses it. It's
// kept exactly as typed minus the spaces at each end, and its case stands, the way a
// track or a module name does: `V1` and `v1` are two different names. An empty, blank or
// damaged value reads as no release, so an old or hand-edited card still opens.
export function normalizeRelease(raw: unknown): string {
  if (raw === undefined || raw === null || typeof raw === 'object') return NO_RELEASE
  if (typeof raw === 'boolean') return NO_RELEASE
  return String(raw).trim()
}

export function validTrack(track: string): void {
  const known = trackNames()
  if (!known.includes(track)) {
    die(
      `unknown track "${track}". existing tracks: ${known.join(', ') || '(none)'}. ` +
        `--track takes a top-level track name, never a group folder path.`,
      { kind: 'unknown-track', track, known },
    )
  }
}

// The module map (docs/kanban/modules.md) lists the project's parts, one per line,
// each led by its **bolded name**. Parse just that bolded name at the front of a line —
// nothing else on the line. Returns null when there's no map yet (a pre-map install), so
// callers can skip the field instead of failing.
export function moduleNames(): string[] | null {
  if (!fs.existsSync(MODULES_MD)) return null
  const names: string[] = []
  for (const line of fs.readFileSync(MODULES_MD, 'utf8').split('\n')) {
    const m = line.match(/^\s*[-*]\s+\*\*([^*]+)\*\*/)
    if (m) names.push(m[1]!.trim())
  }
  return names
}

// Validate tags against the module map, the same way --track checks the track folders.
// No map yet → the field is skipped (returns []), not an error, so a pre-map install still
// works. An unknown name is a hard error whose message lists the known names and says how
// to add one — that message is the whole refresh path, so a new module gets on the map the
// moment someone tags a card with it.
export function validModules(mods: string[]): string[] {
  const known = moduleNames()
  if (known === null) {
    if (mods.length) warn(`no ${rel(MODULES_MD)} yet — skipping --modules ${mods.join(', ')}.`)
    return []
  }
  const unknown = mods.filter((mod) => !known.includes(mod))
  if (unknown.length) {
    die(
      `unknown module(s): ${unknown.join(', ')}. known modules: ${known.join(', ') || '(none)'}. ` +
        `if this really is a new part of the project, add a line to ${rel(MODULES_MD)} first ` +
        `(\`- **<name>** — <what it is>.\`), then tag the card — that line is how the map grows.`,
      { kind: 'unknown-module', modules: unknown, known },
    )
  }
  return mods
}

// Card links name open cards. The ceiling catches invented future ids cheaply; locate
// catches ids that were reserved by an older CLI, rejected, archived, or never existed.
export function parseIdList(raw: string[], name: string, ceiling: number): number[] {
  const parts = raw.map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
  return parts.map((p) => {
    if (!/^\d+$/.test(p)) die(`--${name} takes task ids (numbers), got "${p}"`)
    const n = Number(p)
    if (n < 1 || n >= ceiling) {
      die(`--${name} points at #${n}, not a real task id (ids so far go up to ${ceiling - 1}). don't invent ids.`)
    }
    if (!locate(n)) die(`--${name} points at #${n}, which is not an open card.`)
    return n
  })
}

// A module name doubles as a folder name under memory/, so it's held to the same shape as
// a track's.
export const MODULE_NAME_RE = /^[a-z0-9][a-z0-9-]*$/i
