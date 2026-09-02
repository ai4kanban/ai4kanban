// ---- a whole board, in and out ----------------------------------------------
//
// One shape a board travels in, and the two halves that read and write it: `packBoard`
// reads `docs/kanban/` into it, `unpackBoard` writes it back out as a markdown board `akb`
// opens as a Local one. Cloud's import and export are those two with a network in between
// (#315).
//
// What travels is what the board COMMITS, and nothing else. The run state a board keeps out
// of git — `.env`, the run record and its logs, the chats, the mockups, the locks, and
// `ui.config.json`, which is this machine's own answer to which coding agent runs the board —
// stays on the machine that made it. `docs/kanban/.gitignore` is the list, and `KEPT_LOCAL`
// below is that list read as code.
//
// Two rules the shapes here exist to keep:
//
//   • A card travels as its portable fields AND its body, never as a blob. A client draws a
//     board without parsing markdown, and writing one back out goes through the board's own
//     `serializeFrontmatter`, so an export is a card file the board itself would have written.
//   • A path is the key for everything that is not a card. Import reads the file at that
//     path and export writes it back to it, so nothing has to invent a name on either side.
//     A path `kindOf` does not recognise is left behind rather than guessed at: `.DS_Store`
//     is not board content, and a new board file travels once it is named there.
//
// Import is not synchronization, and neither is export: neither keeps two writable boards in
// step, and nothing here deletes anything from the board it read.

import fs from 'node:fs'
import path from 'node:path'

import type { DeliveryRecord } from '../agent/types'
import { parseFrontmatter, serializeFrontmatter } from '../frontmatter'
import { DELIVERIES, KANBAN, readNextId } from '../paths'
import { EVENTS, recordFile } from '../record'
import type { Meta } from '../types'
import { revisionOf } from './revision'

// ---- what a board looks like on the way through -----------------------------

/** Which half of the board a document belongs to. The first three are the board being
 *  worked on now; the last two are its finished work and its daily tally. Cloud stores the
 *  same five and carries only the first three in a snapshot. */
export type DocumentKind = 'config' | 'memory' | 'rule' | 'summary' | 'history'

/** One card, under the number the board already calls it by. `path` is where it is
 *  written — a track folder, a group's folder, or the archive. */
export interface CardPayload {
  id: number
  archived: boolean
  path: string
  meta: Meta
  body: string
}

/** One board file that is not a card, under the path it is written back to. */
export interface DocumentPayload {
  path: string
  kind: DocumentKind
  body: string
}

/** One line of the board's own history, as `record.csv` wrote it. `key` is the line's
 *  position in that file, which is what makes a retried import find its own work: the file
 *  is append-only, so a line's position never moves. */
export interface EventPayload {
  key: string
  at: string
  action: string
  cardId: number | null
  detail: Record<string, string>
}

/** One delivery, without its repository half. Cloud strips that itself; this leaves it out
 *  so nothing sends what would only be thrown away. */
export interface DeliveryPayload {
  deliveryId: string
  cardId: number
  record: Record<string, unknown>
  approved: string
  /** The card's body as the delivery left it. Empty on a board moving in: a Local delivery
   *  never froze one, and only a delivery run against a workspace has one to send. */
  finalBody: string
}

/** A board, whole. */
export interface BoardPayload {
  fingerprint: string
  nextCardId: number
  cards: CardPayload[]
  documents: DocumentPayload[]
  events: EventPayload[]
  deliveries: DeliveryPayload[]
  /** The committed files `kindOf` does not recognise, so a board file nobody has named
   *  travels as a line the person running the import reads rather than as nothing at all. */
  leftBehind: string[]
}

/**
 * What a board keeps out of git, and therefore out of a workspace: the API keys, the record
 * of what is running and its logs, the conversations, the working drawings, the locks, and
 * this machine's own answer to which coding agent runs the board.
 *
 * Names relative to `docs/kanban/`, matched at the top level. It is `docs/kanban/.gitignore`
 * read as code, which is deliberate — the two say the same thing, and a board that uploaded
 * either of the first two would be a board that uploaded a key.
 */
const KEPT_LOCAL = new Set([
  '.env',
  '.sessions.json',
  '.sessions',
  '.sessions.lock',
  '.lock',
  '.index.lock',
  '.chats',
  '.mockups',
  'ui.config.json',
])

/** Where each committed file goes, by the folder it is in. `record.csv` travels as a
 *  document as well as becoming the trail: the file is what the board reads, and the trail
 *  is what a person reads — two things, not one copy of one. */
function kindOf(rel: string): DocumentKind | null {
  if (rel.startsWith('memory/')) return 'memory'
  if (rel.startsWith('rules/')) return 'rule'
  if (rel.startsWith('.release-summaries/') || rel === 'archive.md') return 'summary'
  if (rel === 'metrics.csv' || rel === 'record.csv') return 'history'
  if (rel === 'config.md' || rel === 'modules.md' || rel === 'releases.md') return 'config'
  if (rel === 'setup-checklist.md' || rel === 'todo/README.md') return 'config'
  // The board's own ignore list is board configuration too: a restore without it is a board
  // that would commit the keys and run state the list is there to keep out of git.
  if (rel === '.gitignore') return 'config'
  return null
}

/** Whether a file neither half recognised is worth telling the person about. `next-id`
 *  travels as the payload's own number and a dotfile is somebody's editor, so the ones left
 *  are the board files nobody has named yet — a recurring job's working folder today. */
function worthSaying(rel: string): boolean {
  if (rel === 'next-id') return false
  return !rel.split('/').some((part) => part.startsWith('.'))
}

/**
 * What this source board is recognised by, so a retried import finds its own work rather
 * than doubling it.
 *
 * The checkout, not its contents: an import that was interrupted halfway is carried on by
 * running it again, and a board whose cards moved between the two attempts is still the same
 * board. Nothing is read into it anywhere — Cloud stores it and compares it, and that is all.
 */
export const boardFingerprint = (root = KANBAN): string => `board-${revisionOf(canonical(root))}`

const canonical = (dir: string): string => {
  try {
    return fs.realpathSync(dir)
  } catch {
    return path.resolve(dir)
  }
}

// ---- reading the board ------------------------------------------------------

/**
 * Read `docs/kanban/` into one payload. Nothing is written and nothing is deleted: a board
 * that has been imported is the board it was, and its files are still the record.
 */
export function packBoard(): BoardPayload {
  const cards: CardPayload[] = []
  const documents: DocumentPayload[] = []
  const leftBehind: string[] = []

  for (const rel of walk(KANBAN)) {
    const top = rel.split('/')[0]
    if (KEPT_LOCAL.has(top)) continue
    if (top === 'deliveries') continue

    const card = cardAt(rel)
    if (card) {
      cards.push(card)
      continue
    }
    const kind = kindOf(rel)
    if (kind) documents.push({ path: rel, kind, body: read(path.join(KANBAN, rel)) })
    else if (worthSaying(rel)) leftBehind.push(rel)
  }

  return {
    fingerprint: boardFingerprint(),
    nextCardId: nextId(),
    cards: cards.sort((a, b) => a.id - b.id),
    documents: documents.sort((a, b) => a.path.localeCompare(b.path)),
    events: packEvents(),
    deliveries: packDeliveries(),
    leftBehind: leftBehind.sort((a, b) => a.localeCompare(b)),
  }
}

/** One card, or null when this path is not one. A group's `root.md` takes its number from
 *  the folder it is in, which is how the board itself finds it. */
function cardAt(rel: string): CardPayload | null {
  const archived = rel.startsWith('.archive/')
  if (!archived && !rel.startsWith('todo/')) return null
  if (!rel.endsWith('.md') || rel === 'todo/README.md') return null

  const parts = rel.split('/')
  const name = parts[parts.length - 1]
  const from = name === 'root.md' ? parts[parts.length - 2] : name
  const id = Number(/^(\d+)-/.exec(from ?? '')?.[1] ?? /^(\d+)\.md$/.exec(from ?? '')?.[1])
  if (!Number.isInteger(id) || id < 1) return null

  const { meta, body } = parseFrontmatter(read(path.join(KANBAN, rel)))
  if (!meta) return null
  return { id, archived, path: rel, meta, body }
}

/**
 * `record.csv` as the board's own history — one event per line, keeping the day it was
 * written and carrying no author, because nobody in Cloud did it: it happened on a machine,
 * before the board was there.
 *
 * A line's position in the file is its key. The file is append-only and a line is never
 * rewritten or taken out, so that position is stable for as long as the board is.
 */
function packEvents(): EventPayload[] {
  const text = read(recordFile())
  if (!text.trim()) return []
  const out: EventPayload[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('date,')) continue
    const [at = '', action = '', card = '', ...rest] = line.split(',')
    if (!EVENTS[action as keyof typeof EVENTS]) continue
    const id = Number(card)
    out.push({
      key: String(i + 1),
      at,
      action,
      cardId: Number.isInteger(id) && id > 0 ? id : null,
      detail: { value: rest.join(',') },
    })
  }
  return out
}

/** The committed delivery records, without the fields that mean something only where the
 *  repository is. Cloud strips them too — this is what stops them being sent at all. */
function packDeliveries(): DeliveryPayload[] {
  if (!fs.existsSync(DELIVERIES)) return []
  const out: DeliveryPayload[] = []
  for (const file of fs.readdirSync(DELIVERIES).sort()) {
    if (!file.endsWith('.json')) continue
    let record: DeliveryRecord
    try {
      record = JSON.parse(read(path.join(DELIVERIES, file))) as DeliveryRecord
    } catch {
      continue
    }
    if (!record?.deliveryId) continue
    out.push({
      deliveryId: record.deliveryId,
      cardId: record.cardId,
      record: portableDelivery(record),
      approved: record.approved ?? '',
      finalBody: '',
    })
  }
  return out
}

/**
 * A delivery record with its repository half taken off: the commit it forked from, the
 * branch it built on, the branch it lands on, its worktree, the commit it landed as and the
 * tip it landed onto, and the path a review's diff was written to.
 *
 * Cloud does this again on the way in, and that is the check that matters — this is what
 * keeps them off the wire in the first place.
 */
export function portableDelivery(record: DeliveryRecord): Record<string, unknown> {
  const { base, branch, targetBranch, worktree, landing, reviewed, ...rest } = record
  const out: Record<string, unknown> = { ...rest }
  if (landing) {
    const { commit, onto, ...keptLanding } = landing
    out.landing = keptLanding
  }
  if (reviewed) {
    const { diff, ...keptReview } = reviewed
    out.reviewed = keptReview
  }
  return out
}

// ---- writing it back out ----------------------------------------------------

/**
 * Write a payload out as a standalone markdown board under `root` — `<root>/docs/kanban/`,
 * which `akb --dir <root>` opens as a Local board.
 *
 * A card is written through the board's own `serializeFrontmatter`, so what lands is a card
 * file the board itself would have written. Everything else is written to the path it
 * travelled under.
 *
 * The trail is deliberately not written back: `record.csv` travels as a document and comes
 * back exactly as it was, while the workspace's own trail is a record of what happened in
 * Cloud and belongs where it happened.
 *
 * Every name this writes under came off a wire — a card carries the path it is written back
 * to, and a delivery's own id is its file name — so the folder is the boundary and it is
 * checked here, where the file is made, rather than trusted to whatever sent it.
 */
export function unpackBoard(payload: BoardPayload, root: string): { cards: number; documents: number; deliveries: number } {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  const written = { cards: 0, documents: 0, deliveries: 0 }

  for (const card of payload.cards) {
    const file = inside(kanban, card.path)
    if (!file) continue
    write(file, `${serializeFrontmatter(card.meta)}\n${card.body}`)
    written.cards++
  }
  for (const doc of payload.documents) {
    const file = inside(kanban, doc.path)
    if (!file) continue
    write(file, doc.body)
    written.documents++
  }
  for (const delivery of payload.deliveries) {
    const file = inside(kanban, `deliveries/${delivery.deliveryId}.json`)
    if (!file) continue
    // The frozen approved body is stored beside the record as well as inside it, so the
    // column wins only when it has something to say — an empty one must not write over the
    // copy the record itself carries.
    const record = { ...delivery.record }
    if (delivery.approved) record.approved = delivery.approved
    write(file, `${JSON.stringify(record, null, 2)}\n`)
    written.deliveries++
  }
  write(path.join(kanban, 'next-id'), `${payload.nextCardId}\n`)

  return written
}

/** Where one board-relative path lands under `kanban`, or null for a name that would leave
 *  it. A Windows path is refused rather than translated — a board path is one spelling. */
function inside(kanban: string, rel: string): string | null {
  if (!rel || rel.includes('\\') || path.isAbsolute(rel)) return null
  const file = path.resolve(kanban, rel)
  return file.startsWith(path.resolve(kanban) + path.sep) ? file : null
}

// ---- the small pieces --------------------------------------------------------

/** Every file under `dir`, as paths relative to it, with forward slashes whatever the
 *  platform — a board path is one spelling everywhere, because it is stored and compared. */
function walk(dir: string, prefix = ''): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: string[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel))
    else if (entry.isFile()) out.push(rel)
  }
  return out
}

const read = (file: string): string => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function write(file: string, body: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

/** The board's own next number, so the first card written after an import carries on where
 *  the source board left off rather than reusing a number a rejected card once had. */
function nextId(): number {
  try {
    return readNextId()
  } catch {
    return 1
  }
}
