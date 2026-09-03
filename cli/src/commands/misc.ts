// ---- migrate + run ---------------------------------------------------------
//
// `migrate` converts old bold-header cards to the frontmatter meta format.
// `run` records one run of a recurring task (+1 completed) and keeps the card.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO } from '../lib/paths'
import { say } from '../lib/io'
import { bumpMetric } from '../lib/metrics'
import { slugify, LEVELS } from '../lib/validate'
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter'
import { formatStamp, nextDue } from '../lib/cadence'
import { walkMd, locate, isRecurringCard } from '../lib/cards'
import { reconcileBoard } from '../lib/reconcile'
import type { Meta, MoveResult } from '../lib/types'

// Pull meta out of the old bold-line header. Missing fields fall back to safe
// defaults (empty lists, med level) rather than guessing.
function extractOldMeta(text: string, file: string): Partial<Meta> {
  const grab = (re: RegExp): string | null => {
    const m = text.match(re)
    return m ? m[1]!.trim() : null
  }
  const folderTrack = path.relative(TODO, file).split(path.sep)[0]!
  const title = grab(/^#\s+(.+)$/m) || slugify(path.basename(file, '.md').replace(/^\d+-/, '')).replace(/-/g, ' ')
  const track = (grab(/\*\*Track:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/) || folderTrack).toLowerCase()
  const norm = (raw: string | null): string => {
    const v = (raw || '').toLowerCase()
    return LEVELS.includes(v) ? v : 'med'
  }
  const ids = (raw: string | null): number[] => (raw && !/none/i.test(raw) ? (raw.match(/\d+/g) || []).map(Number) : [])
  return {
    title,
    track,
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
    if (dry) say(`would migrate ${rel(file)}  (track=${meta.track} priority=${meta.priority} roi=${meta.roi})`)
    else {
      fs.writeFileSync(file, out.endsWith('\n') ? out : out + '\n')
      say(`migrated ${rel(file)}`)
    }
    changed++
  }
  say(`\n${dry ? '(dry run) ' : ''}${changed} card(s) ${dry ? 'to migrate' : 'migrated'}, ${skipped} already frontmatter`)
  return { dry_run: dry, migrated: changed, skipped }
}

export function cmdRun(id: number): MoveResult {
  if (!Number.isInteger(id)) die('need a numeric task id')
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  if (!isRecurringCard(found)) {
    die(`#${id} is not recurring (${found.rel} is not under recurring/). Use \`archive\` for one-shot tasks.`)
  }
  // Records one pass of a recurring card. The local UI calls this itself at the end
  // of a run, so a card run from the board never needs anyone to remember
  // it — this is for a pass done by hand, outside the board.
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)
  // To the minute, not the day — a recurring card can run several times a day, and
  // a cadence set to the minute needs a stamp that can say so.
  const stamp = formatStamp(new Date())
  meta.last_run = stamp
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  bumpMetric('completed')
  say(`ran #${id} at ${stamp}: +1 completed (card kept — recurring)`)
  // The stamp is what the schedule counts from, so say when the card comes round
  // again — or that nothing will start it but a person.
  const due = nextDue(meta.last_run, meta.cadence)
  say(due ? `  next due ${formatStamp(due)} (cadence ${meta.cadence})` : '  no cadence — this card runs only when you run it')
  reconcileBoard()
  return { id, last_run: stamp, cadence: meta.cadence || '', next_due: due ? formatStamp(due) : null, file: rel(file) }
}
