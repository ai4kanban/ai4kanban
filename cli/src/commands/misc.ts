// ---- migrate ---------------------------------------------------------------
//
// `migrate` converts old bold-header cards to the frontmatter meta format.

import fs from 'node:fs'
import path from 'node:path'

import { rel, TODO } from '../lib/paths'
import { say } from '../lib/io'
import { slugify, LEVELS } from '../lib/validate'
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter'
import { walkMd } from '../lib/cards'
import type { Meta, MoveResult } from '../lib/types'

// Pull meta out of the old bold-line header. Missing fields fall back to safe
// defaults (empty lists, med level) rather than guessing.
function extractOldMeta(text: string, file: string): Partial<Meta> {
  const grab = (re: RegExp): string | null => {
    const m = text.match(re)
    return m ? m[1]!.trim() : null
  }
  const title = grab(/^#\s+(.+)$/m) || slugify(path.basename(file, '.md').replace(/^\d+-/, '')).replace(/-/g, ' ')
  const norm = (raw: string | null): string => {
    const v = (raw || '').toLowerCase()
    return LEVELS.includes(v) ? v : 'med'
  }
  const ids = (raw: string | null): number[] => (raw && !/none/i.test(raw) ? (raw.match(/\d+/g) || []).map(Number) : [])
  return {
    title,
    priority: norm(grab(/\*\*Priority:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    roi: norm(grab(/\*\*ROI:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    status: 'todo',
    blocked_by: ids(grab(/\*\*Blocked by:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    related: ids(grab(/\*\*Related:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    questions: [],
  }
}

// Drop the leading H1 + bold meta lines; keep the body below them.
function stripOldHeader(text: string): string {
  const lines = text.split('\n')
  let lastMeta = -1
  for (let k = 0; k < lines.length && k < 8; k++) {
    if (/^#\s/.test(lines[k]!) || /^\*\*(Track|Priority|ROI|Blocked by|Related):\*\*/.test(lines[k]!)) lastMeta = k
  }
  const rest = lines.slice(lastMeta + 1)
  while (rest.length && rest[0]!.trim() === '') rest.shift()
  return rest.join('\n')
}

/** `akb raw migrate`, as its command declares it (lib/cli/board.ts). */
export interface MigrateOptions {
  dryRun?: boolean
}

export function cmdMigrate(opts: MigrateOptions): MoveResult {
  const dry = opts.dryRun === true
  const files = walkMd(TODO).filter((f) => path.basename(f) !== 'README.md')
  let changed = 0
  let skipped = 0
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    if (text.trimStart().startsWith('---')) {
      skipped++
      continue
    }
    const meta = extractOldMeta(text, file)
    const out = serializeFrontmatter(meta) + '\n\n' + stripOldHeader(text).replace(/^\n+/, '')
    if (dry) say(`would migrate ${rel(file)}  (priority=${meta.priority} roi=${meta.roi})`)
    else {
      fs.writeFileSync(file, out.endsWith('\n') ? out : out + '\n')
      say(`migrated ${rel(file)}`)
    }
    changed++
  }
  say(`\n${dry ? '(dry run) ' : ''}${changed} card(s) ${dry ? 'to migrate' : 'migrated'}, ${skipped} already frontmatter`)
  return { dry_run: dry, migrated: changed, skipped }
}
