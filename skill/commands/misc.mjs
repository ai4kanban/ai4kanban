// ---- migrate + run ---------------------------------------------------------
//
// `migrate` converts old bold-header cards to the frontmatter meta format.
// `run` records one run of a recurring task (+1 completed) and keeps the card.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO } from '../lib/paths.mjs'
import { bumpMetric } from '../lib/metrics.mjs'
import { parseFlags, slugify, LEVELS } from '../lib/validate.mjs'
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter.mjs'
import { walkMd, locate, isRecurringCard } from '../lib/cards.mjs'
import { reconcileBoard } from '../lib/reconcile.mjs'

// Pull meta out of the old bold-line header. Missing fields fall back to safe
// defaults (empty lists, med level) rather than guessing.
function extractOldMeta(text, file) {
  const grab = (re) => {
    const m = text.match(re)
    return m ? m[1].trim() : null
  }
  const folderTrack = path.relative(TODO, file).split(path.sep)[0]
  const title = grab(/^#\s+(.+)$/m) || slugify(path.basename(file, '.md').replace(/^\d+-/, '')).replace(/-/g, ' ')
  const track = (grab(/\*\*Track:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/) || folderTrack).toLowerCase()
  const norm = (v) => {
    v = (v || '').toLowerCase()
    return LEVELS.includes(v) ? v : 'med'
  }
  const ids = (raw) => (raw && !/none/i.test(raw) ? (raw.match(/\d+/g) || []).map(Number) : [])
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
function stripOldHeader(text) {
  const lines = text.split('\n')
  let lastMeta = -1
  for (let k = 0; k < lines.length && k < 8; k++) {
    if (/^#\s/.test(lines[k]) || /^\*\*(Track|Priority|ROI|Blocked by|Related):\*\*/.test(lines[k])) lastMeta = k
  }
  const rest = lines.slice(lastMeta + 1)
  while (rest.length && rest[0].trim() === '') rest.shift()
  return rest.join('\n')
}

export function cmdMigrate(args) {
  const { flags } = parseFlags(args, ['dry-run', 'dry'])
  const dry = !!(flags['dry-run'] || flags.dry)
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
    if (dry) console.log(`would migrate ${rel(file)}  (track=${meta.track} priority=${meta.priority} roi=${meta.roi})`)
    else {
      fs.writeFileSync(file, out.endsWith('\n') ? out : out + '\n')
      console.log(`migrated ${rel(file)}`)
    }
    changed++
  }
  console.log(`\n${dry ? '(dry run) ' : ''}${changed} card(s) ${dry ? 'to migrate' : 'migrated'}, ${skipped} already frontmatter`)
}

// The minute a run happened, as the card records it: `2026-08-02 14:31`, local time.
// To the minute, not the day — a recurring card can run several times a day, and a
// cadence set to the minute needs a stamp that can say so.
function runStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function cmdRun(id) {
  if (!Number.isInteger(id)) die('need a numeric task id')
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`)
  if (!isRecurringCard(found)) {
    die(`#${id} is not recurring (${found.rel} is not under recurring/). Use \`archive\` for one-shot tasks.`)
  }
  // Stamp when the card ran, so the board can say when it last did instead of
  // making someone read the run files for a date.
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)
  const stamp = runStamp()
  meta.last_run = stamp
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  bumpMetric('completed')
  console.log(`ran #${id} at ${stamp}: +1 completed (card kept — recurring)`)
  console.log('  next: fold this run into the card\'s ## Process; log unrepeatable asks in its open-questions file')
  reconcileBoard()
}
