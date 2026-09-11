// Triage on disk (#453, #499, #559).
//
// One item is one Markdown file: what is known about it in the frontmatter, its own words
// below. Markdown rather than a database because the board already is markdown in git — an
// item diffs, reviews and reverts with everything else, and a local board takes on no new
// dependency for it.
//
// Where the file sits IS its state:
//
//   triage/<id>.md            waiting to be sorted
//   triage/archived/<id>.md   a card was made of it — `card_id`, `archived_at`
//   triage/dismissed/<id>.md  ignored — `dismissed_at`, `dismissed_by`, `dismissed_reason`
//   triage/files/             the bytes of anything dropped in, shared by all three
//
// Leaving the list is a move, never a delete: the file that says "this was ignored" is the
// item itself, so nothing has to be listed anywhere for a dismissal to stick. `dismissed/`
// is kept for good — the page draws a recent window of it, the fetch is held off by all of
// it. A move rewrites nothing but the fields this file adds, so a field written by something
// that came later survives the trip.
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
// The folder is made the first time something lands in it, never by `init`: a board with
// nothing in triage carries no folder.

import fs from 'node:fs'
import path from 'node:path'

import { formatStamp } from '../cadence'
import { DERIVED } from './identity'
import { matchSourceType, readSourceType } from './sources'
import { SIGNALS_ARCHIVED, SIGNALS_DISMISSED, TRIAGE, rel } from '../paths'
import { unquote, yamlScalar } from '../yaml'
import type { Signal, SignalMeta } from '../view/types'

/** An item as it arrives, before the board stamps its import. */
export type IncomingSignal = Omit<
  Signal,
  'importedAt' | 'relPath' | 'dismissedAt' | 'dismissedBy' | 'dismissedReason' | 'contentKept'
>

const boardRel = (file: string): string => rel(file).split(path.sep).join('/')

/** The triage folder, from the repo root — what the page's heading names, whether or not the
 *  folder is there yet. */
export const triagePath = (): string => boardRel(TRIAGE)

// ---- one file -------------------------------------------------------------

// What an item waiting to be sorted carries, whatever wrote it. Everything else is optional.
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
 *  folder is skipped rather than drawn with empty fields.
 *
 *  A record migrated out of the old handled list has a source id and a judged time and
 *  nothing else, so a dismissed file is read on that alone: a gap in the record is not a
 *  reason to lose what the record does hold. */
export function parse(file: string, lenient = false): Signal | null {
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
  const required = lenient ? (['source_id'] as const) : FIELDS
  if (required.some((field) => !held[field])) return null

  // A file written before #560 carried a free-text source — `source`, or `platform` before
  // #499 renamed it. It reads through the one match rule: a hit is the type, a miss keeps
  // the words as a `source` meta entry, ahead of whatever the file wrote under `meta:`.
  const legacy = held.source_type ? '' : held.source || held.platform || ''
  const missed = legacy && !matchSourceType(legacy) ? metaPair('source', legacy) : null
  return {
    sourceId: held.source_id!,
    title: held.title ?? '',
    summary: lines
      .slice(i + 1)
      .join('\n')
      .replace(/^\n+/, '')
      .replace(/\s+$/, ''),
    sourceType: held.source_type ? readSourceType(held.source_type) : matchSourceType(legacy),
    meta: missed ? [missed, ...written] : written,
    url: held.url || '',
    collectedAt: held.collected_at ?? '',
    importedAt: held.imported_at ?? '',
    dismissedAt: held.dismissed_at || '',
    dismissedBy: held.dismissed_by === 'user' || held.dismissed_by === 'agent' ? held.dismissed_by : '',
    dismissedReason: held.dismissed_reason || '',
    contentKept: held.content_kept !== 'false',
    relPath: boardRel(file),
  }
}

// A source id is anything its source says it is, so the name is derived rather than used
// as typed: the readable part for a person browsing the folder, the hash so two ids that
// scrub down to the same word still get two files. A derived id says nothing to a reader,
// so what is readable then is the title.
export function fileName(signal: { sourceId: string; title: string; collectedAt: string }): string {
  const day = (signal.collectedAt || formatStamp(new Date())).slice(0, 10)
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

/** A name nothing in `dir` has yet, from the one wanted. A collision is two different items,
 *  so the second one is renamed rather than written over the first. */
export function freeName(dir: string, wanted: string): string {
  const ext = path.extname(wanted)
  const stem = wanted.slice(0, wanted.length - ext.length)
  let name = wanted
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stem}-${n}${ext}`
  return name
}

// ---- reading ---------------------------------------------------------------

/** Every item file in one folder. Subfolders and anything that is not an item are skipped,
 *  which is what lets the waiting list live in `triage/` beside `archived/` and the rest. */
export function readFolder(dir: string, lenient = false): Signal[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => parse(path.join(dir, entry.name), lenient))
    .filter((signal): signal is Signal => signal !== null)
}

/** Everything waiting to be sorted, newest collected first. Empty on a board that has never
 *  put anything in it, which is the same answer as a list somebody has emptied. */
export function readInbox(): Signal[] {
  const signals = readFolder(TRIAGE)
  // Ties keep a stable order, so a redraw never shuffles two items collected in the same
  // minute past each other.
  signals.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt) || a.sourceId.localeCompare(b.sourceId))
  return signals
}

/** Every item a card was made of. Read for the duplicate check; nothing draws it yet. */
export const readArchived = (): Signal[] => readFolder(SIGNALS_ARCHIVED)

/** Every item ever ignored, however long ago. What holds the fetch off. */
export const readAllDismissed = (): Signal[] => readFolder(SIGNALS_DISMISSED, true)

/** The newest import stamp the list holds, or empty when it holds nothing. */
export const latestImport = (signals: Signal[]): string =>
  signals.reduce((newest, signal) => (signal.importedAt > newest ? signal.importedAt : newest), '')

/** How far back the ignored tab reaches. The files are kept for good; this is only what is
 *  drawn, and the page says the window out loud. */
export const DISMISSED_DAYS = 30

/** What has been ignored recently, newest judged first (#559, #560).
 *
 *  An item with no judged stamp sorts last rather than being dropped: a missing stamp is a
 *  gap in the record, not a reason to lose the item. */
export function readDismissed(now = new Date()): Signal[] {
  const since = formatStamp(new Date(now.getTime() - DISMISSED_DAYS * 24 * 60 * 60 * 1000))
  const signals = readAllDismissed().filter((signal) => !signal.dismissedAt || signal.dismissedAt >= since)
  signals.sort(
    (a, b) =>
      Number(Boolean(b.dismissedAt)) - Number(Boolean(a.dismissedAt)) ||
      b.dismissedAt.localeCompare(a.dismissedAt) ||
      a.sourceId.localeCompare(b.sourceId),
  )
  return signals
}

// ---- writing ---------------------------------------------------------------

/** Write one item into triage, stamped with the moment it was imported. */
export function writeSignal(incoming: IncomingSignal, importedAt: string): Signal {
  fs.mkdirSync(TRIAGE, { recursive: true })
  const signal: Signal = {
    ...incoming,
    importedAt,
    dismissedAt: '',
    dismissedBy: '',
    dismissedReason: '',
    contentKept: true,
    relPath: '',
  }
  const file = path.join(TRIAGE, freeName(TRIAGE, fileName(signal)))
  fs.writeFileSync(file, serialize({ ...signal, relPath: boardRel(file) }))
  return { ...signal, relPath: boardRel(file) }
}

/** Add or replace frontmatter fields on an item file, leaving everything else — including
 *  fields nothing here knows about — exactly as it was written. */
function stamp(file: string, fields: Record<string, string>): void {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const close = lines.indexOf('---', 1)
  if (close < 0) return
  const kept = lines.slice(1, close).filter((line) => {
    const key = line.match(/^([a-z_]+):/)
    return !key || fields[key[1]!] === undefined
  })
  const added = Object.entries(fields).map(([key, value]) => `${key}: ${yamlScalar(value)}`)
  fs.writeFileSync(file, ['---', ...kept, ...added, ...lines.slice(close)].join('\n'))
}

/** Move one item file into a folder beside it, stamping what the move means onto it. The
 *  path it lands at, or empty when the source file has gone. */
function moveSignal(from: string, into: string, fields: Record<string, string>): string {
  if (!fs.existsSync(from)) return ''
  fs.mkdirSync(into, { recursive: true })
  const at = path.join(into, freeName(into, path.basename(from)))
  fs.renameSync(from, at)
  stamp(at, fields)
  return boardRel(at)
}

/** What one move gives back: where the file went, or why it did not go. */
export type MoveOutcome = { ok: true; relPath: string } | { ok: false; error: string }

/** Ignore one item: its file moves into `dismissed/` and is kept there for good, so no later
 *  fetch brings it back. Ignoring the same source again keeps the one record, judged afresh. */
export function dismissInboxItem(sourceId: string, by: 'user' | 'agent', reason = ''): MoveOutcome {
  const found = readInbox().find((signal) => signal.sourceId === sourceId)
  if (!found) return { ok: false, error: `nothing waiting in triage is ${sourceId}` }
  const already = readAllDismissed().find((signal) => signal.sourceId === sourceId)
  if (already) fs.rmSync(path.join(SIGNALS_DISMISSED, path.basename(already.relPath)), { force: true })
  const at = moveSignal(path.join(TRIAGE, path.basename(found.relPath)), SIGNALS_DISMISSED, {
    dismissed_at: formatStamp(new Date()),
    dismissed_by: by,
    ...(reason.trim() ? { dismissed_reason: reason.trim() } : {}),
  })
  return at ? { ok: true, relPath: at } : { ok: false, error: `nothing waiting in triage is ${sourceId}` }
}

/** Where the record of a card landed: the item moved into `archived/`, or — when the user
 *  ignored it while the card was being written — the `dismissed/` record it stayed in. */
export type ArchiveOutcome = { ok: true; relPath: string; where: 'archived' | 'dismissed' } | { ok: false; error: string }

/** Record that a card was made of one item: its file moves into `archived/`, carrying the
 *  card it became.
 *
 *  One item is judged once, by whoever lands first (#561). An item ignored on the page
 *  between the card being written and this call is NOT pulled back out of `dismissed/`: the
 *  card exists either way, so the ignore keeps its record and takes the card id onto it. */
export function archiveInboxItem(sourceId: string, cardId: number): ArchiveOutcome {
  const found = readInbox().find((signal) => signal.sourceId === sourceId)
  if (!found) {
    const ignored = readAllDismissed().find((signal) => signal.sourceId === sourceId)
    if (!ignored) return { ok: false, error: `nothing waiting in triage is ${sourceId}` }
    stamp(path.join(SIGNALS_DISMISSED, path.basename(ignored.relPath)), { card_id: String(cardId) })
    return { ok: true, relPath: ignored.relPath, where: 'dismissed' }
  }
  const at = moveSignal(path.join(TRIAGE, path.basename(found.relPath)), SIGNALS_ARCHIVED, {
    card_id: String(cardId),
    archived_at: formatStamp(new Date()),
  })
  return at ? { ok: true, relPath: at, where: 'archived' } : { ok: false, error: `nothing waiting in triage is ${sourceId}` }
}
