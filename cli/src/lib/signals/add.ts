// Add to inbox: what a dropped file, a pasted link or pasted text becomes (#499).
//
// The endpoint pull is no longer the only way in, and everything that comes in this way
// lands as the same Markdown file the pull writes — one folder, one shape, one triage.
//
// What each kind of input gives up:
//
//   a link   ──► title from the address, url the link, the domain against the source list
//   text     ──► title from its first line, the whole of it as the body, and no source
//   .md/.txt ──► title from its first line, its text as the body, the name as `filename`
//   anything ──► the bytes are COPIED under `inbox/files/`, and the body names them
//
// A source is a key off ./sources.ts or nothing (#560). A domain the list has not got, and a
// dropped file's name, are kept as a `meta` entry — a fact about the item, not a claim about
// where it came from. Nothing here invents a source out of a domain or a file name.
//
// A dropped file is copied rather than referenced where it sat: a browser drop hands over
// bytes and no path at all, and a board is markdown in git — a path into somebody's
// Downloads folder would be dead the moment the file moved or the board was cloned.
//
// A caller may say the title and the source outright instead of leaving them to be read off
// the input (#534): `akb triage add` does, so a proposal carries the card that prompted it.

import fs from 'node:fs'
import path from 'node:path'

import { createHash } from 'node:crypto'
import { formatStamp } from '../cadence'
import { SIGNAL_INBOX, rel } from '../paths'
import { asLink, derivedSourceId, host } from './identity'
import { matchSourceType } from './sources'
import { metaPair, readInbox, writeSignal, type IncomingSignal } from './inbox'
import type { InboxAddResult, InboxDrop, SignalMeta } from '../view/types'

/** Where a dropped file's bytes are copied to. */
const FILES = (): string => path.join(SIGNAL_INBOX, 'files')

/** As much of a file as the board will take into git. Past this it belongs somewhere else,
 *  and the answer says so rather than committing it. */
const MAX_BYTES = 25 * 1024 * 1024

/** A title is one line: past this it is a body pretending to be one. */
const TITLE_MAX = 120

// A file whose text IS the item, rather than one the item points at. Decided by what the
// browser called it and by its name, and confirmed by the bytes decoding as UTF-8.
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.text', '.csv', '.json', '.yml', '.yaml', '.log'])

const boardRel = (file: string): string => rel(file).split(path.sep).join('/')

const oneLine = (text: string): string => {
  const first = text.split('\n').find((line) => line.trim()) ?? ''
  const clean = first.replace(/^#+\s*/, '').trim()
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…` : clean
}

/** What a link reads as in a list: the site and the path, without the scheme. */
function linkTitle(url: string): string {
  let at: URL
  try {
    at = new URL(url)
  } catch {
    return url.slice(0, TITLE_MAX)
  }
  const where = decodeURI(`${at.hostname.replace(/^www\./, '')}${at.pathname}`).replace(/\/$/, '')
  return oneLine(where) || url.slice(0, TITLE_MAX)
}

/** The file's own text, or null when it is not text — bytes that do not decode are a file
 *  to keep, not a body to read. */
function asText(file: NonNullable<InboxDrop['file']>): string | null {
  const ext = path.extname(file.name).toLowerCase()
  if (!file.type.startsWith('text/') && file.type !== 'application/json' && !TEXT_EXTENSIONS.has(ext)) return null
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(file.data)
    return text.trim() ? text : null
  } catch {
    return null
  }
}

// Kept to what a folder in git should hold, and stripped of any path the browser sent.
function fileName(name: string, data: Uint8Array): string {
  const base = path.basename(name)
  const ext = path.extname(base).toLowerCase().slice(0, 12)
  const word =
    path
      .basename(base, path.extname(base))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'file'
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 8)
  return `${word}-${hash}${ext}`
}

/** Where a dropped file's bytes WILL go. Worked out before anything is written, so a drop
 *  the inbox already holds leaves no copy behind. */
const keepAt = (file: NonNullable<InboxDrop['file']>): string => path.join(FILES(), fileName(file.name, file.data))

/** Take one thing into the inbox. Never throws: what it could not take is one sentence for
 *  the page to show, and the inbox is left as it was. */
export function addToInbox(drop: InboxDrop): InboxAddResult {
  const typed = (drop.text ?? '').trim()
  const file = drop.file
  if (!typed && !file) return { ok: false, error: 'nothing to add — paste a link or some text, or drop a file.' }
  if (file && file.data.length === 0) return { ok: false, error: `${path.basename(file.name)} is empty.` }
  if (file && file.data.length > MAX_BYTES) {
    return { ok: false, error: `${path.basename(file.name)} is over ${MAX_BYTES / 1024 / 1024} MB — too big for the board.` }
  }

  const read = describe(typed, file)
  const keep = read.keep
  // A caller that knows the two facts says them rather than leaving them to be read off the
  // words (#534): `akb triage add` is given a title and the card the item came from. What it
  // says about the source reads through the one match rule, and a miss — `#452`, a newsletter
  // name — is kept as it was written rather than becoming a source of its own.
  const said = drop.source?.trim() ?? ''
  const hit = said ? matchSourceType(said) : ''
  const kept = said && !hit ? metaPair('source', said) : null
  const incoming = {
    ...read.incoming,
    ...(drop.title?.trim() ? { title: oneLine(drop.title) } : {}),
    ...(hit ? { sourceType: hit } : {}),
    ...(kept ? { meta: [kept, ...read.incoming.meta] } : {}),
  }
  if (!incoming.title || !incoming.summary) return { ok: false, error: 'nothing to add — that had no words in it.' }

  const sourceId = derivedSourceId(incoming.url || `${incoming.title}\n${incoming.summary}`)
  if (readInbox().some((held) => held.sourceId === sourceId)) return { ok: false, error: 'that is already in the inbox.' }

  try {
    if (keep) {
      fs.mkdirSync(FILES(), { recursive: true })
      fs.writeFileSync(keep.at, keep.data)
    }
    return { ok: true, signal: writeSignal({ ...incoming, sourceId }, formatStamp(new Date())) }
  } catch (e) {
    return { ok: false, error: `that could not be saved: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** What the input is, read into everything but its id — and the bytes still to be written,
 *  when it is a file the board is keeping. Nothing here touches the disk. */
function describe(
  typed: string,
  file: InboxDrop['file'],
): { incoming: Omit<IncomingSignal, 'sourceId'>; keep?: { at: string; data: Uint8Array } } {
  const collectedAt = formatStamp(new Date())
  const pair = (key: string, value: string): SignalMeta[] => {
    const only = metaPair(key, value)
    return only ? [only] : []
  }
  if (file) {
    const name = path.basename(file.name)
    const text = asText(file)
    // A note typed alongside a drop goes under whatever the file gave, never over it.
    const note = typed ? `\n\n${typed}` : ''
    // A file says what it is called and nothing about where it came from.
    const named = { sourceType: '', meta: pair('filename', name), url: '', collectedAt }
    if (text !== null) {
      return { incoming: { title: oneLine(text) || name, summary: `${text.trim()}${note}`, ...named } }
    }
    const at = keepAt(file)
    return {
      incoming: {
        title: path.basename(name, path.extname(name)) || name,
        summary: `${name} — ${boardRel(at)}${note}`,
        ...named,
      },
      keep: { at, data: file.data },
    }
  }

  const link = asLink(typed)
  if (link) {
    const site = host(link)
    const known = matchSourceType(site)
    return {
      incoming: {
        title: linkTitle(link),
        summary: link,
        sourceType: known,
        meta: known ? [] : pair('domain', site),
        url: link,
        collectedAt,
      },
    }
  }
  return { incoming: { title: oneLine(typed), summary: typed, sourceType: '', meta: [], url: '', collectedAt } }
}
