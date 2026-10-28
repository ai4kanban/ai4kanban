// ---- validation (guards against hallucinated meta) -------------------------
//
// Reading the command line is Commander's (lib/cli/), and so is refusing an unknown option
// or a value outside a fixed set. What is left here is the checking a command line cannot
// do on its own: whether a module is on the map, whether an id names an open card. A
// hallucinated one is a hard error rather than a silently written field.

import fs from 'node:fs'
import path from 'node:path'

import { die, warn, rel, MODULES_MD } from './paths'
import { moduleNamesFrom } from './board/assemble'
import { idPrefix, locate, walkMd } from './cards'
import { STATUSES, parseFrontmatter } from './frontmatter'

export { slugify } from './slug'

export const LEVELS = ['high', 'med', 'low']

// The stages a card can rest in, in order: `todo` (raw), `ready` (plan concrete,
// no open questions, someone could start now), `implementing`. `reject`/`archive`
// take the card off the board, so they are not statuses — a live run's action is
// tracked in the UI registry, not here. A missing status reads as `todo`, so cards
// written before this field still parse.
export { STATUSES }

// The module map (docs/kanban/modules.md) lists the project's parts, one per line,
// each led by its **bolded name**. Parse just that bolded name at the front of a line —
// nothing else on the line. Returns null when there's no map yet (a pre-map install), so
// callers can skip the field instead of failing.
export function moduleNames(): string[] | null {
  if (!fs.existsSync(MODULES_MD)) return null
  return moduleNamesFrom(fs.readFileSync(MODULES_MD, 'utf8'))
}

// Validate tags against the module map.
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

// Card links name open cards.
export function parseIdList(raw: string[], name: string): number[] {
  const parts = raw.map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
  return parts.map((p) => {
    if (!/^\d+$/.test(p)) die(`--${name} takes task ids (numbers), got "${p}"`)
    const n = Number(p)
    if (!locate(n)) die(`--${name} points at #${n}, which is not an open card.`)
    return n
  })
}

// The path `id → dep → … → id` that making `id` wait on `dep` would close, or null.
// Follows open cards only: a closed card no longer blocks anything. A group also waits on
// every card inside it, since it closes only once they do.
export function dependencyCycle(id: number, dep: number): number[] | null {
  const seen = new Set<number>()
  const walk = (at: number): number[] | null => {
    if (at === id) return [id]
    if (seen.has(at)) return null
    seen.add(at)
    const found = locate(at)
    if (!found) return null
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    const nexts = parseFrontmatter(fs.readFileSync(file, 'utf8')).meta?.blocked_by ?? []
    if (found.kind === 'group') nexts.push(...groupMembers(found.target))
    for (const next of nexts) {
      const rest = walk(next)
      if (rest) return [at, ...rest]
    }
    return null
  }
  const rest = walk(dep)
  return rest && [id, ...rest]
}

function groupMembers(dir: string): number[] {
  return walkMd(dir)
    .filter((f) => f !== path.join(dir, 'root.md'))
    .map((f) => idPrefix(path.basename(path.basename(f) === 'root.md' ? path.dirname(f) : f)))
    .filter((n): n is number => n !== null)
}
