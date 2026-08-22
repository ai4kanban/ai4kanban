// ---- docs/kanban/record.csv ------------------------------------------------
//
// What board moves saw as they ran, kept so the board's planning can still be scored after
// the evidence has left the board: a cleared question is gone from its card, a rejected
// card is deleted outright, and the day's tally in metrics.csv only ever counted three
// numbers. Every line here is written by a move that was already doing the work.
//
// Append-only. A line is never rewritten and never taken out, so where a line falls is
// decided by its position in the file and never by its date — two releases closed on the
// same day are still told apart. The `date` column is there for a person reading it;
// nothing is worked out from it.
//
// Columns: date,event,card,detail
//   date    the day the line was written, YYYY-MM-DD
//   event   one of EVENTS below
//   card    the card the fact is about; empty on `release-closed`, which is about a version
//   detail  the one value that event carries (see EVENTS)
//
// This module owns the event names, their allowed values, the CSV writing, and the
// validation. There is no prose copy of the format in an agent guide: no flow types a
// record line, so a second contract would only drift.

import fs from 'node:fs'
import path from 'node:path'

import { formatDay } from './cadence'
import { die, KANBAN, TODO } from './paths'
import { RECURRING } from './recurring'
import { SETUP_QUESTIONS_SLUG } from './setup'

/** Where a card came from: a person asked for it, or the board went looking and proposed it. */
export const ORIGINS = ['asked', 'proposed'] as const
export type Origin = (typeof ORIGINS)[number]

/** Who closed an open question — the board settled it, the user answered it, or it turned
 *  out to be a hand-check and moved to the card's `verify:` list. */
export const ANSWERERS = ['board', 'user', 'verify'] as const
export type Answerer = (typeof ANSWERERS)[number]

export type RecordEvent =
  | 'card-created'
  | 'card-archived'
  | 'card-rejected'
  | 'question-closed'
  | 'decisions-stood'
  | 'decisions-overruled'
  | 'release-closed'

// What each event carries, and whether it is about a card. `values` fixes the detail to a
// short list; `count` takes a whole number; `text` takes any one-line value (the release id).
interface EventShape {
  card: boolean
  detail: { kind: 'values'; values: readonly string[] } | { kind: 'count' } | { kind: 'text' }
}

export const EVENTS: Record<RecordEvent, EventShape> = {
  'card-created': { card: true, detail: { kind: 'values', values: ORIGINS } },
  'card-archived': { card: true, detail: { kind: 'values', values: ORIGINS } },
  'card-rejected': { card: true, detail: { kind: 'values', values: ORIGINS } },
  'question-closed': { card: true, detail: { kind: 'values', values: ANSWERERS } },
  'decisions-stood': { card: true, detail: { kind: 'count' } },
  'decisions-overruled': { card: true, detail: { kind: 'count' } },
  'release-closed': { card: false, detail: { kind: 'text' } },
}

export const EVENT_NAMES = Object.keys(EVENTS) as RecordEvent[]

export const RECORD_HEADER = 'date,event,card,detail'

/** The file itself. A binding, not a constant, because `--dir` repoints the board per call. */
export const recordFile = (): string => path.join(KANBAN, 'record.csv')

const today = (): string => formatDay()

// A value never runs over onto a second line, so any whitespace inside it collapses to a
// single space before it is written. Comma or quote means the field is quoted, doubling
// the quotes inside it — the CSV rule every reader already knows.
function csvField(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat
}

/** Check one fact and hand back the line it writes. Throws (as a refused move) on any shape
 *  the format does not allow, so a bad call never reaches the file. Exported for the tests
 *  that are this format's contract. */
export function formatFact(event: string, card: number | null, detail: unknown): string {
  const shape = EVENTS[event as RecordEvent]
  if (!shape) die(`"${event}" is not a record event. allowed: ${EVENT_NAMES.join(', ')}`, 'bad-record-event')
  if (shape.card) {
    if (!Number.isInteger(card) || (card as number) < 1) {
      die(`${event} is about one card — it needs a positive integer card id (got ${JSON.stringify(card)})`, 'bad-record-card')
    }
  } else if (card !== null) {
    die(`${event} is not about a card — its card column stays empty (got ${JSON.stringify(card)})`, 'bad-record-card')
  }
  const raw = detail === undefined || detail === null ? '' : String(detail)
  const value = raw.replace(/\s+/g, ' ').trim()
  if (shape.detail.kind === 'values') {
    if (!shape.detail.values.includes(value)) {
      die(`${event} carries one of ${shape.detail.values.join(' | ')} (got "${raw}")`, 'bad-record-detail')
    }
  } else if (shape.detail.kind === 'count') {
    if (!/^\d+$/.test(value)) die(`${event} carries a whole number (got "${raw}")`, 'bad-record-detail')
  } else if (!value) {
    die(`${event} carries a value (got "${raw}")`, 'bad-record-detail')
  }
  return [today(), event, shape.card ? String(card) : '', csvField(value)].join(',')
}

/** Append one fact. Writes the header the first time, and nothing else ever rewrites the
 *  file. Every caller is a move that was already doing this work — nothing calls this on
 *  its own. */
export function recordFact(event: RecordEvent, card: number | null, detail: string | number): void {
  const line = formatFact(event, card, detail)
  const file = recordFile()
  if (!fs.existsSync(file)) fs.writeFileSync(file, RECORD_HEADER + '\n')
  fs.appendFileSync(file, line + '\n')
}

// ---- reading back ----------------------------------------------------------

/** One line of the file, split back into its columns. */
export interface Fact {
  date: string
  event: string
  card: number | null
  detail: string
}

// Split one CSV line into its four fields, honouring the quoting `csvField` writes.
function splitLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (quoted) {
      if (c !== '"') field += c
      else if (line[i + 1] === '"') (field += '"'), i++
      else quoted = false
    } else if (c === '"') quoted = true
    else if (c === ',') (out.push(field), (field = ''))
    else field += c
  }
  out.push(field)
  return out
}

/** Every fact on file, in the order it was written. Empty when the board has none yet. */
export function readFacts(): Fact[] {
  const file = recordFile()
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .slice(1) // drop the header
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [date = '', event = '', card = '', detail = ''] = splitLine(line)
      return { date, event, card: /^\d+$/.test(card) ? Number(card) : null, detail }
    })
}

/** Where a card came from, read back off the file when it leaves the board. Null for a card
 *  created before any of this existed — it is counted neither as a proposal that was built
 *  nor as one that was dropped, because assuming either would invent the figure. */
export function originOf(id: number): Origin | null {
  for (const fact of readFacts().reverse()) {
    if (fact.event !== 'card-created' || fact.card !== id) continue
    return (ORIGINS as readonly string[]).includes(fact.detail) ? (fact.detail as Origin) : null
  }
  return null
}

// ---- what is counted -------------------------------------------------------

/** False for the board's own furniture: the setup questions card, which is all the user's
 *  calls and would say the board settles nothing, and the recurring cards, which are jobs
 *  the board repeats rather than work anybody planned. The day's tally skips both too. */
export function countsForRecord(file: string): boolean {
  const relative = path.relative(TODO, file)
  if (relative.startsWith('..')) return false
  if (relative.split(path.sep)[0] === RECURRING) return false
  return !path.basename(file).endsWith(`-${SETUP_QUESTIONS_SLUG}.md`)
}

// ---- the calls the board made on its own -----------------------------------

const AGENT_SECTION = /^##\s+Decided by the agent\s*$/i
const NOTING_SECTION = /^##\s+Worth noting\s*$/i
const PUSHBACK_SECTION = /^##\s+Pushback\s*$/i
const NOTING_SUBSECTION = /^###\s+Worth noting\s*$/i
const OVERRULED_SECTION = /^###\s+Overruled by the user\s*$/i
const HEADING = /^#{1,6}\s/
const BULLET = /^[-*+][ \t]/

/**
 * Count a card's own calls out of its body: the bullets still standing, and the ones the
 * user overruled, which the revise flow moves under `### Overruled by the user` at the end
 * of `## Decided by the agent`.
 *
 * A call stands wherever the board wrote it. That is `## Decided by the agent` and the
 * human half's `## Worth noting` — the calls a reviewer is most likely to refuse, so
 * leaving them out would flatter the board exactly where it is least sure of itself. A card
 * no refine has reshaped yet still carries them under `### Worth noting` and `## Pushback`,
 * which count the same way; otherwise a card's figure would depend on whether a repair pass
 * reached it first.
 *
 * Only bullets at the left margin count, so a call's own continuation lines are not
 * mistaken for calls of their own.
 */
export function countDecisions(body: string): { stood: number; overruled: number } {
  // 'none' is a subsection that holds no calls of its own.
  let bucket: 'outside' | 'stood' | 'overruled' | 'none' = 'outside'
  let stood = 0
  let overruled = 0
  for (const line of body.split('\n')) {
    if (/^##(?!#)\s/.test(line)) {
      const counts = AGENT_SECTION.test(line) || NOTING_SECTION.test(line) || PUSHBACK_SECTION.test(line)
      bucket = counts ? 'stood' : 'outside'
      continue
    }
    if (bucket === 'outside') continue
    if (HEADING.test(line)) {
      bucket = OVERRULED_SECTION.test(line) ? 'overruled' : NOTING_SUBSECTION.test(line) ? 'stood' : 'none'
      continue
    }
    if (!BULLET.test(line)) continue
    if (bucket === 'stood') stood++
    else if (bucket === 'overruled') overruled++
  }
  return { stood, overruled }
}
