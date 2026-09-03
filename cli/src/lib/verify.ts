// ---- verify lines ----------------------------------------------------------
//
// What the user should check by hand before accepting a finished build:
//
//   verify:
//     - the import runs on a board with no releases — try it on a real repo
//     - the desktop app picks the new setting up after a restart
//
// One short line each, and each one is a NOTE, not a question. Nothing here waits on an
// answer, carries choices, or holds the card back — a card with verify lines still reaches
// `ready`, still resolves, still archives. A decision the user has to make is an open
// question instead (./questions.ts), and that is the only thing `[user]` marks.
//
// The field is written only when a card carries a line, so a board written before it reads
// exactly as it did.

import { die, warn } from './paths'
import type { Typed } from './cli/shared'

// A leading `[user]`-style token is what a question carries, and a verify line is not one.
// It gets taken off rather than stored, so a note misfiled as a question and moved here
// doesn't arrive still dressed as one.
const TAG = /^\[[^\]]+\]\s+/

function cleanLine(raw: unknown): string {
  const text = String(raw).trim()
  if (!TAG.test(text)) return text
  warn(`a verify line is a note, not a question — dropped the "${text.match(TAG)![0].trim()}" tag from it.`)
  return text.replace(TAG, '').trim()
}

/** Read the field in any shape a card can carry it in: the list the board writes, a single
 *  line somebody typed, or nothing at all. Empty lines drop out, so a bullet blanked by hand
 *  doesn't show up as one. */
export function normalizeVerify(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((line) => String(line).trim()).filter(Boolean)
  const text = typeof raw === 'string' ? raw.trim() : ''
  return text && text !== '[]' ? [text] : []
}

/** One op of `update-verify`. */
export interface VerifyOp {
  kind: 'append' | 'drop' | 'clear'
  ns?: string
  line?: string
}

/** What `update-verify` was asked for: its ops, in the order they were typed. */
export interface VerifyOpsInput {
  ops?: Typed[]
}

/** The ops of `update-verify` — the same three edits `questions:` gets, minus the rewrite: a
 *  hand-check that changed is dropped and appended again, and there are no options to lose
 *  by re-typing it. Ops apply in the order they were typed. */
export function readVerifyOps(typed: Typed[]): VerifyOp[] {
  const ops: VerifyOp[] = []
  for (const [key, value] of typed) {
    if (key === 'clear') {
      ops.push({ kind: 'clear' })
    } else if (key === 'drop') {
      ops.push({ kind: 'drop', ns: value })
    } else {
      const line = cleanLine(value)
      if (!line) die('--append must not be empty')
      ops.push({ kind: 'append', line })
    }
  }
  if (!ops.length) die('update-verify needs at least one op: --append ".." | --drop n[,n...] | --clear')
  return ops
}

/** One or more 1-based verify positions (`1` or `1,3`), validated against what the card has. */
export function parseVerifyPositions(raw: unknown, count: number): number[] {
  const ns = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1)) {
    die('--drop needs one or more 1-based verify line numbers (e.g. 1 or 1,3)')
  }
  const over = ns.find((n) => n > count)
  if (over !== undefined) die(`the card has ${count} verify line(s) — there's no line ${over}`)
  return ns
}
