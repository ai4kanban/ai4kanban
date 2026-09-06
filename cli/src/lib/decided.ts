// ---- what the decider answered for you (#447) -------------------------------
//
// The choices the decider made on this card, one per question it answered:
//
//   decided:
//     - question: Where does a draft live?
//       chose: In a file beside the card
//       from: docs/kanban/memory/local-ui/decisions.md
//     - question: How long before a draft is cleared?
//       chose: 30 days
//
// A RECORD, not a question. The question itself is dropped as it is answered, and this is
// what the card keeps of the choice: what it was asked, what it picked, and what it went
// on. Nothing here waits on an answer or holds the card back — the shape `verify:` already
// proved (./verify.ts).
//
// `from` is a board-relative file — a module's `decisions.md`, `memory/goal.md`. It is left
// off when nothing settled the question and the decider took the recommendation, so the
// card page can draw that case as what it is.
//
// The field is written only when a card carries an entry, so a board the decider has never
// run on reads exactly as it did.

import { die } from './paths'
import { yamlScalar, unquote } from './yaml'
import type { CardDecision } from './view/types'

const text = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim())

/** One entry from whatever shape it arrived in, or null when it names no question or no
 *  choice — half an entry says nothing anyone can read. */
export function normalizeDecision(raw: unknown): CardDecision | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const fields = raw as Record<string, unknown>
  const question = text(fields.question)
  const chose = text(fields.chose)
  if (!question || !chose) return null
  return { question, chose, from: text(fields.from) }
}

/** Read the field in any shape a card can carry it in. A damaged entry drops out rather
 *  than showing as a choice nobody can read. */
export function normalizeDecided(raw: unknown): CardDecision[] {
  const items = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' ? [] : [raw]
  const out: CardDecision[] = []
  for (const item of items) {
    const entry = normalizeDecision(item)
    if (entry) out.push(entry)
  }
  return out
}

/** Read the indented block under a `decided:` line — one `- question:` item at a time, with
 *  its own fields under it, the way `channels:` is read. */
export function parseDecidedBlock(lines: string[]): CardDecision[] {
  const out: unknown[] = []
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i]!.match(/^\s*-\s+(.*)$/)
    if (!item) continue
    const opened = item[1]!.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (!opened) continue
    const fields: Record<string, string> = { [opened[1]!]: unquote(opened[2]!) }
    while (i + 1 < lines.length && !/^\s*-\s/.test(lines[i + 1]!)) {
      const field = lines[i + 1]!.match(/^\s*([A-Za-z_]+):\s*(.*)$/)
      i++
      if (field) fields[field[1]!] = unquote(field[2]!)
    }
    out.push(fields)
  }
  return normalizeDecided(out)
}

/** The frontmatter lines for a card's decisions — none at all on a card the decider never
 *  answered, which is every card while the switch is off. */
export function serializeDecided(decided: CardDecision[] | undefined): string[] {
  const list = normalizeDecided(decided)
  if (!list.length) return []
  const out = ['decided:']
  for (const d of list) {
    out.push(`  - question: ${yamlScalar(d.question)}`)
    out.push(`    chose: ${yamlScalar(d.chose)}`)
    // Left off when it took the recommendation blind: a `from: ""` would read as a file the
    // board wrote down, and there was none.
    if (d.from) out.push(`    from: ${yamlScalar(d.from)}`)
  }
  return out
}

/** One op of `update-decided`. */
export type DecidedOp =
  | { kind: 'append'; entry: CardDecision }
  | { kind: 'drop'; ns: number[] }
  | { kind: 'clear' }

/** What `update-decided` was asked for. One op per call: an entry is three fields that only
 *  mean anything together, so there is no list of them to apply in the order typed. */
export interface DecidedInput {
  question?: string
  chose?: string
  from?: string
  drop?: string
  clear?: boolean
}

/** The one op of `update-decided`, checked against what the card has. */
export function readDecidedOp(opts: DecidedInput, count: number): DecidedOp {
  if (opts.clear === true) return { kind: 'clear' }
  if (opts.drop !== undefined) return { kind: 'drop', ns: parseDecidedPositions(opts.drop, count) }
  const question = text(opts.question)
  const chose = text(opts.chose)
  if (!question || !chose) {
    die('update-decided needs --question ".." --chose ".." [--from ".."], or --drop n[,n...] | --clear')
  }
  return { kind: 'append', entry: { question, chose, from: text(opts.from) } }
}

/** One or more 1-based positions (`1` or `1,3`), validated against what the card has. */
export function parseDecidedPositions(raw: unknown, count: number): number[] {
  const ns = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1)) {
    die('--drop needs one or more 1-based positions (e.g. 1 or 1,3)')
  }
  const over = ns.find((n) => n > count)
  if (over !== undefined) die(`the card has ${count} decision(s) — there's no entry ${over}`)
  return ns
}
