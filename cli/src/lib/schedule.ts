// ---- the action the board will start on this card by itself ----------------
//
// A card can hand one run to the board instead of starting it here and now. The board runs
// it on its next tick, or on the first tick after the last card in its way leaves. A rough
// card saves a refine when it first becomes blocked; anyone can write one directly. It lives
// in the card's own frontmatter:
//
//   schedule:
//     action: implement
//     notes: "..."
//
// Keeping it on the card is what makes it survive a server restart, a reboot and a clone on
// another machine; what makes it travel when the card moves track or joins a group; and what
// takes it away with the file when the card is archived or rejected. A separate list of
// schedules would have to be kept in step with a board people also edit by hand and in git.
//
// This module is the FIELD — how it reads and how it is written back. The rules about it
// (which cards may carry one, when it has gone stale) are the board's, in ./view/rules.ts,
// because the browser applies them too. Who fires it is ./view/dispatch.ts.

import { yamlScalar, unquote } from './yaml'
import type { CardSchedule, ScheduledAction } from './view/types'

/** The actions a card can be scheduled for, in the words the card and the messages use. */
export const SCHEDULED_ACTIONS: ScheduledAction[] = ['implement', 'refine']

/** One action name as the board writes it, or null when it isn't one the board can start.
 *  Null is what a damaged or hand-typed line gives, and it means the card is simply not
 *  scheduled — better than a mark on a card that nothing will ever fire. */
export function asScheduledAction(raw: unknown): ScheduledAction | null {
  const text = String(raw ?? '').trim().toLowerCase()
  return SCHEDULED_ACTIONS.find((a) => a === text) ?? null
}

/** A schedule from whatever shape it arrived in, or null when it names no action we run. */
export function normalizeSchedule(raw: unknown): CardSchedule | null {
  if (!raw || typeof raw !== 'object') return null
  const { action, notes } = raw as { action?: unknown; notes?: unknown }
  const valid = asScheduledAction(action)
  if (!valid) return null
  return { action: valid, notes: typeof notes === 'string' ? notes.trim() : '' }
}

/** Read the indented block under a `schedule:` line. Anything it doesn't understand reads as
 *  no schedule. */
export function parseScheduleBlock(lines: string[]): CardSchedule | null {
  const fields: Record<string, string> = {}
  for (const line of lines) {
    const m = line.match(/^\s+([A-Za-z_]+):\s*(.*)$/)
    if (m) fields[m[1]!] = unquote(m[2]!)
  }
  return normalizeSchedule(fields)
}

/** The frontmatter lines for a schedule — none at all on a card that carries none, so a card
 *  nobody scheduled says nothing about it. */
export function serializeSchedule(schedule: CardSchedule | null | undefined): string[] {
  const s = normalizeSchedule(schedule)
  if (!s) return []
  const out = ['schedule:', `  action: ${s.action}`]
  // The notes only when there are some: an empty line would read as a note nobody wrote.
  if (s.notes) out.push(`  notes: ${yamlScalar(s.notes)}`)
  return out
}
