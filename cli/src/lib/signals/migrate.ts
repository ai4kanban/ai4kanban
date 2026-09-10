// A board written before #559, read for the first time by one written after it.
//
// What changes: items move up out of `triage/inbox/` into `triage/` itself, dropped files
// out of `inbox/files/` into `triage/files/`, and `handled.md` — the list that used to be
// what made a dismissal stick — becomes one file per ignored source id under `dismissed/`.
//
// Run on every read, and cheap on a board that has already done it: two `existsSync` calls
// and nothing else. It has to be, because there is no migration step to run — the first
// thing that touches triage is what migrates it.
//
// Re-entrant throughout: a run that stops halfway leaves a board that is part-way moved, and
// the next one carries on. Nothing is overwritten — a source id that already has a file is
// left alone, and a file name that is taken is given the next free one — so the worst a
// repeat can do is nothing.
//
// A handled line is a source id and a time and no more. That is all the record ever held, so
// that is all its `dismissed/` file says: no title, no words, and no reason invented on its
// behalf. `content_kept: false` is how the page knows to draw it as the stub it is.

import fs from 'node:fs'
import path from 'node:path'

import { SIGNALS_ARCHIVED, SIGNALS_DISMISSED, SIGNALS_FILES, SIGNALS_OLD_HANDLED, SIGNALS_OLD_INBOX, TRIAGE, rel } from '../paths'
import { yamlScalar } from '../yaml'
import { fileName, freeName, parse, readAllDismissed, readFolder } from './inbox'

const HANDLED_LINE = /^-\s+(.+?)\s+—\s+(.+)$/

// Read off the board rather than spelled out: an item body carries the path from the repo
// root, and a board named by `--board` is not under `docs/kanban` (#407).
const asWritten = (dir: string): string => `${rel(dir).split(path.sep).join('/')}/`

/** The source ids the old record held, each with when it left the inbox. */
function readHandled(): { sourceId: string; when: string }[] {
  let text: string
  try {
    text = fs.readFileSync(SIGNALS_OLD_HANDLED, 'utf8')
  } catch {
    return []
  }
  const held: { sourceId: string; when: string }[] = []
  const seen = new Set<string>()
  for (const line of text.split('\n')) {
    const m = line.match(HANDLED_LINE)
    if (!m) continue
    const sourceId = m[1]!.trim()
    if (!sourceId || seen.has(sourceId)) continue
    seen.add(sourceId)
    held.push({ sourceId, when: m[2]!.trim() })
  }
  return held
}

/** Move one file, unless something is already there under that name — then take the next
 *  free one, because two names that collide are two different things. */
function lift(from: string, into: string): void {
  fs.mkdirSync(into, { recursive: true })
  fs.renameSync(from, path.join(into, freeName(into, path.basename(from))))
}

/** Repoint every item body in one folder at where its dropped file now lives. The path was
 *  written once and is rewritten once; everything else in the file is left alone. */
function repoint(dir: string, from: string, into: string): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const file = path.join(dir, entry.name)
    const text = fs.readFileSync(file, 'utf8')
    if (text.includes(from)) fs.writeFileSync(file, text.split(from).join(into))
  }
}

/** Take a folder away once the move has emptied it. One that still holds something is left
 *  exactly as it is — this is tidying, not a delete. */
function dropIfEmpty(dir: string): void {
  try {
    fs.rmdirSync(dir)
  } catch {
    // still holds something somebody put there by hand
  }
}

/** Everything under `inbox/` up into `triage/`, and its dropped files beside them. */
function liftInbox(): void {
  if (!fs.existsSync(SIGNALS_OLD_INBOX)) return
  const oldFiles = path.join(SIGNALS_OLD_INBOX, 'files')
  if (fs.existsSync(oldFiles)) {
    for (const entry of fs.readdirSync(oldFiles, { withFileTypes: true })) {
      if (entry.isFile()) lift(path.join(oldFiles, entry.name), SIGNALS_FILES)
    }
    dropIfEmpty(oldFiles)
  }

  const held = new Set(readFolder(TRIAGE).map((signal) => signal.sourceId))
  for (const entry of fs.readdirSync(SIGNALS_OLD_INBOX, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const from = path.join(SIGNALS_OLD_INBOX, entry.name)
    const item = parse(from)
    // A source id `triage/` already holds is the same item moved by an earlier, interrupted
    // run — the file left behind is the copy, so it goes rather than landing twice.
    if (item && held.has(item.sourceId)) {
      fs.rmSync(from, { force: true })
      continue
    }
    if (item) held.add(item.sourceId)
    lift(from, TRIAGE)
  }
  // Before the old folder goes, not after: a run cut short between the two would leave a
  // board that never repoints, because the next one sees no `inbox/` to migrate.
  const wasAt = asWritten(path.join(SIGNALS_OLD_INBOX, 'files'))
  const nowAt = asWritten(SIGNALS_FILES)
  for (const dir of [TRIAGE, SIGNALS_ARCHIVED, SIGNALS_DISMISSED]) repoint(dir, wasAt, nowAt)
  dropIfEmpty(SIGNALS_OLD_INBOX)
}

/** Every id the old record held that has no item file anywhere, written down as the history
 *  it is: the id, when it was judged, and that its own words were never kept. */
function liftHandled(): void {
  if (!fs.existsSync(SIGNALS_OLD_HANDLED)) return
  const lines = readHandled()
  const held = new Set([
    ...readFolder(TRIAGE).map((signal) => signal.sourceId),
    ...readFolder(SIGNALS_ARCHIVED).map((signal) => signal.sourceId),
    ...readAllDismissed().map((signal) => signal.sourceId),
  ])
  for (const { sourceId, when } of lines) {
    if (held.has(sourceId)) continue
    held.add(sourceId)
    fs.mkdirSync(SIGNALS_DISMISSED, { recursive: true })
    const name = freeName(SIGNALS_DISMISSED, fileName({ sourceId, title: '', collectedAt: when }))
    const front = [
      '---',
      `source_id: ${yamlScalar(sourceId)}`,
      `dismissed_at: ${yamlScalar(when)}`,
      'content_kept: false',
      '---',
      '',
    ]
    fs.writeFileSync(path.join(SIGNALS_DISMISSED, name), `${front.join('\n')}\n`)
  }
  // Only once every line has a file: an interrupted run leaves the list to be finished.
  fs.rmSync(SIGNALS_OLD_HANDLED, { force: true })
}

/** Bring an older board's triage up to the layout #559 reads. Does nothing to one that is
 *  already there, and never throws — a migration that cannot finish leaves the board readable
 *  and is tried again on the next read. */
export function migrateTriage(): void {
  if (!fs.existsSync(SIGNALS_OLD_INBOX) && !fs.existsSync(SIGNALS_OLD_HANDLED)) return
  try {
    liftInbox()
    liftHandled()
  } catch {
    // Part-way is a state the next read carries on from, so a failure is not worth failing
    // the read it happened under.
  }
}
