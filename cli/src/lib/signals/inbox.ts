// The inbox on disk (#453, #499).
//
// One item is one Markdown file under `docs/kanban/triage/inbox/`: what is known about it
// in the frontmatter, its own words below. Markdown rather than a database because the
// board already is markdown in git — an item diffs, reviews and reverts with everything
// else, and a local board takes on no new dependency for it.
//
// Title and body are the whole requirement. `source_type`, `url`, `collected_at` and `meta`
// are written only when something supplies them, so a dropped PDF and a pulled Reddit post
// are the same kind of file with different amounts filled in.
//
// `source_type` is a key off ./sources.ts and nothing else (#560); everything a source says
// beyond that is free key-value pairs under `meta:`, which the board neither validates nor
// translates. A file written before that carried a free-text `source` (or, older still, a
// `platform`): it is read through the same match rule as everything else — a hit is the type,
// a miss is a `source` meta entry — and the file on disk is not rewritten.
//
// `triage/handled.md` is the other half: one line per source id that has LEFT the inbox,
// with when it went. It is what makes a dismissal stick — the item's file is gone, so the
// file itself cannot be what says "don't import this again" (#454 writes here too, for the
// items it has turned into cards).
//
// The folder is made the first time something lands in it, never by `init`: a board with an
// empty inbox carries no folder.

import fs from 'node:fs'
import path from 'node:path'

import { formatStamp } from '../cadence'
import { DERIVED } from './identity'
import { matchSourceType, readSourceType } from './sources'
import { SIGNAL_INBOX, SIGNALS_DISMISSED, SIGNALS_HANDLED, TRIAGE, rel } from '../paths'
import { unquote, yamlScalar } from '../yaml'
import type { Signal, SignalMeta } from '../view/types'

/** An item as it arrives, before the board stamps its import. */
export type IncomingSignal = Omit<Signal, 'importedAt' | 'relPath' | 'dismissedAt' | 'dismissedWhy'>

const boardRel = (file: string): string => rel(file).split(path.sep).join('/')

/** The inbox folder, from the repo root — what the page's heading names, whether or not the
 *  folder is there yet. */
export const inboxPath = (): string => boardRel(SIGNAL_INBOX)

// ---- one file -------------------------------------------------------------

// What every file carries, whatever wrote it. Everything else is optional.
const FIELDS = ['source_id', 'title', 'collected_at', 'imported_at'] as const

// One `meta:` line: a key, quoted or not, and the rest of the line as its value.
const META_LINE = /^\s+("(?:[^"\\]|\\.)*"|[^:]+):\s*(.*)$/

/** One meta pair as the board will keep it, or null when it is not one a single line holds —
 *  a key with nothing under it, or a value that arrived as an object or a list. */
export function metaPair(key: unknown, value: unknown): SignalMeta | null {
  const name = typeof key === 'string' ? key.trim() : ''
  if (!name) return null
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null
  const said = String(value).trim()
  if (!said || said.includes('\n')) return null
  return { key: name, value: said }
}

function serialize(signal: Signal): string {
  const lines = [
    '---',
    `source_id: ${yamlScalar(signal.sourceId)}`,
    `title: ${yamlScalar(signal.title)}`,
    ...(signal.sourceType ? [`source_type: ${yamlScalar(signal.sourceType)}`] : []),
    ...(signal.url ? [`url: ${yamlScalar(signal.url)}`] : []),
    `collected_at: ${yamlScalar(signal.collectedAt)}`,
    `imported_at: ${yamlScalar(signal.importedAt)}`,
    ...(signal.meta.length > 0
      ? ['meta:', ...signal.meta.map((pair) => `  ${yamlScalar(pair.key)}: ${yamlScalar(pair.value)}`)]
      : []),
    '---',
  ]
  return `${lines.join('\n')}\n\n${signal.summary.trim()}\n`
}

/** One item read back off disk, or null when the file is not one — a stray file in the
 *  folder is skipped rather than drawn with empty fields. */
function parse(file: string): Signal | null {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
  const lines = text.split('\n')
  if (lines[0]!.trim() !== '---') return null
  const held: Record<string, string> = {}
  const written: SignalMeta[] = []
  let inMeta = false
  let i = 1
  for (; i < lines.length && lines[i]!.trim() !== '---'; i++) {
    const line = lines[i]!
    if (inMeta) {
      const entry = line.match(META_LINE)
      if (entry) {
        const pair = metaPair(unquote(entry[1]!), unquote(entry[2]!))
        if (pair) written.push(pair)
        continue
      }
      inMeta = false
    }
    if (/^meta:\s*$/.test(line)) {
      inMeta = true
      continue
    }
    const m = line.match(/^([a-z_]+):\s*(.*)$/)
    if (m) held[m[1]!] = unquote(m[2]!)
  }
  if (i >= lines.length) return null
  if (FIELDS.some((field) => !held[field])) return null

  // A file written before #560 carried a free-text source — `source`, or `platform` before
  // #499 renamed it. It reads through the one match rule: a hit is the type, a miss keeps
  // the words as a `source` meta entry, ahead of whatever the file wrote under `meta:`.
  const legacy = held.source_type ? '' : held.source || held.platform || ''
  const missed = legacy && !matchSourceType(legacy) ? metaPair('source', legacy) : null
  return {
    sourceId: held.source_id!,
    title: held.title!,
    summary: lines
      .slice(i + 1)
      .join('\n')
      .replace(/^\n+/, '')
      .replace(/\s+$/, ''),
    sourceType: held.source_type ? readSourceType(held.source_type) : matchSourceType(legacy),
    meta: missed ? [missed, ...written] : written,
    url: held.url || '',
    collectedAt: held.collected_at!,
    importedAt: held.imported_at!,
    dismissedAt: held.dismissed_at || '',
    dismissedWhy: held.dismissed_why || '',
    relPath: boardRel(file),
  }
}

// A source id is anything its source says it is, so the name is derived rather than used
// as typed: the readable part for a person browsing the folder, the hash so two ids that
// scrub down to the same word still get two files. A derived id says nothing to a reader,
// so what is readable then is the title.
function fileName(signal: Signal): string {
  const day = signal.collectedAt.slice(0, 10)
  const said = signal.sourceId.startsWith(DERIVED) ? signal.title : signal.sourceId
  const word = said
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  let hash = 0x811c9dc5
  for (const ch of signal.sourceId) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0
  return `${day}-${word || 'item'}-${hash.toString(16).padStart(8, '0')}.md`
}

// ---- reading ---------------------------------------------------------------

/** Everything in the inbox, newest collected first. Empty on a board that has never put
 *  anything in it, which is the same answer as an inbox somebody has emptied. */
export function readInbox(): Signal[] {
  let names: string[]
  try {
    names = fs.readdirSync(SIGNAL_INBOX)
  } catch {
    return []
  }
  const signals = names
    .filter((name) => name.endsWith('.md'))
    .map((name) => parse(path.join(SIGNAL_INBOX, name)))
    .filter((signal): signal is Signal => signal !== null)
  // Ties keep a stable order, so a redraw never shuffles two items collected in the same
  // minute past each other.
  signals.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt) || a.sourceId.localeCompare(b.sourceId))
  return signals
}

/** The newest import stamp the inbox holds, or empty when it holds nothing. */
export const latestImport = (signals: Signal[]): string =>
  signals.reduce((newest, signal) => (signal.importedAt > newest ? signal.importedAt : newest), '')

/** How far back the ignored tab reaches. The files are kept for good; this is only what is
 *  drawn, and the page says the window out loud. */
export const DISMISSED_DAYS = 30

/** What has been ignored recently, newest judged first (#560).
 *
 *  The same kind of file, read the same way, out of `triage/dismissed/` — the folder #559
 *  moves an ignored item into. Empty until that lands, and empty is the whole of what the
 *  tab then shows. An item with no judged stamp sorts last rather than being dropped: a
 *  missing stamp is a gap in the record, not a reason to lose the item. */
export function readDismissed(now = new Date()): Signal[] {
  let names: string[]
  try {
    names = fs.readdirSync(SIGNALS_DISMISSED)
  } catch {
    return []
  }
  const since = formatStamp(new Date(now.getTime() - DISMISSED_DAYS * 24 * 60 * 60 * 1000))
  const signals = names
    .filter((name) => name.endsWith('.md'))
    .map((name) => parse(path.join(SIGNALS_DISMISSED, name)))
    .filter((signal): signal is Signal => signal !== null)
    .filter((signal) => !signal.dismissedAt || signal.dismissedAt >= since)
  signals.sort(
    (a, b) =>
      Number(Boolean(b.dismissedAt)) - Number(Boolean(a.dismissedAt)) ||
      b.dismissedAt.localeCompare(a.dismissedAt) ||
      a.sourceId.localeCompare(b.sourceId),
  )
  return signals
}

// ---- what has left the inbox -----------------------------------------------

const HANDLED_HEAD = [
  '# Handled',
  '',
  'The source ids that have left the inbox, and when. Anything listed here is never',
  'pulled again, however many times the endpoint sends it.',
  '',
]

const HANDLED_LINE = /^-\s+(.+?)\s+—\s+(.+)$/

/** The source ids the board has already dealt with. */
export function readHandled(): Set<string> {
  let text: string
  try {
    text = fs.readFileSync(SIGNALS_HANDLED, 'utf8')
  } catch {
    return new Set()
  }
  const ids = new Set<string>()
  for (const line of text.split('\n')) {
    const m = line.match(HANDLED_LINE)
    if (m) ids.add(m[1]!.trim())
  }
  return ids
}

/** Write one source id down as handled. Silent about an id already there — the record only
 *  has to hold it once. */
export function markHandled(sourceId: string, when = formatStamp(new Date())): void {
  if (readHandled().has(sourceId)) return
  fs.mkdirSync(TRIAGE, { recursive: true })
  let text: string
  try {
    text = fs.readFileSync(SIGNALS_HANDLED, 'utf8')
  } catch {
    text = `${HANDLED_HEAD.join('\n')}\n`
  }
  const separator = text.endsWith('\n') ? '' : '\n'
  fs.writeFileSync(SIGNALS_HANDLED, `${text}${separator}- ${sourceId} — ${when}\n`)
}

// ---- writing ---------------------------------------------------------------

/** Write one item into the inbox, stamped with the moment it was imported. */
export function writeSignal(incoming: IncomingSignal, importedAt: string): Signal {
  fs.mkdirSync(SIGNAL_INBOX, { recursive: true })
  const signal: Signal = { ...incoming, importedAt, dismissedAt: '', dismissedWhy: '', relPath: '' }
  const file = path.join(SIGNAL_INBOX, fileName(signal))
  fs.writeFileSync(file, serialize({ ...signal, relPath: boardRel(file) }))
  return { ...signal, relPath: boardRel(file) }
}

/** Take one item out of the inbox for good: its file goes, its source id is written down,
 *  and the next fetch leaves it alone. False when the inbox holds no such item. */
export function dropSignal(sourceId: string): boolean {
  const found = readInbox().find((signal) => signal.sourceId === sourceId)
  if (!found) return false
  markHandled(sourceId)
  fs.rmSync(path.join(SIGNAL_INBOX, path.basename(found.relPath)), { force: true })
  return true
}
