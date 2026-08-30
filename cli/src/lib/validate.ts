// ---- flags + validation (guards against hallucinated meta) -----------------

import fs from 'node:fs'

import { die, warn, rel, TODO, MODULES_MD } from './paths'
import { locate, trackNames } from './cards'
import type { FlagOrder, FlagValue, Flags, ParsedFlags } from './types'

// Minimal flag parser. `--key value` sets a string; a repeated `--key` builds an
// array; a `--key` with no following value (or followed by another `--`) is a
// boolean. An unknown flag is a hard error so a mistyped/hallucinated option can't
// be silently ignored.
export function parseFlags(args: string[], allowed?: string[]): ParsedFlags {
  const flags: Flags = {}
  const positional: string[] = []
  // Every flag in the order it was typed. Most commands read `flags`, where a
  // repeated flag collapses into a list; the question flags need the order too,
  // because --option/--mode/--recommended-option belong to the --question before them.
  const order: FlagOrder = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a.startsWith('--')) {
      const key = a.slice(2)
      if (allowed && !allowed.includes(key)) {
        die(`unknown option "--${key}". allowed: ${allowed.map((f) => '--' + f).join(', ')}`)
      }
      const next = args[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
        order.push([key, true])
      } else {
        const current = flags[key]
        if (current === undefined) flags[key] = next
        else if (Array.isArray(current)) current.push(next)
        else flags[key] = [current, next]
        order.push([key, next])
        i++
      }
    } else {
      positional.push(a)
    }
  }
  return { flags, positional, order }
}

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

// Split a --modules value (repeatable and/or comma-separated) into a clean name list.
export function parseModuleList(raw: FlagValue): string[] {
  return (Array.isArray(raw) ? raw : [raw])
    .flatMap((s) => String(s).split(','))
    .map((s) => s.trim())
    .filter(Boolean)
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
export function parseIdList(raw: FlagValue, name: string, ceiling: number): number[] {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((s) => String(s).split(','))
    .map((s) => s.trim().replace(/^#/, ''))
    .filter(Boolean)
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
