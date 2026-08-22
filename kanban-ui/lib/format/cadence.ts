// Copied from cli/src/lib/cadence.ts by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

// ---- the cadence a recurring card repeats on -------------------------------
//
// A recurring card can carry one line saying how often it repeats:
//
//   30m          every 30 minutes
//   6h           every 6 hours
//   7d           every 7 days
//   1d at 09:30  every day, at that time of day
//
// `at HH:MM` is allowed only when the interval is whole days — "every 90 minutes
// at 09:30" doesn't mean anything. A card with no cadence runs only when someone
// clicks Run: writing one is the opt-in to background runs.
//
// This module is the one parser. The local UI does not carry a second one — it
// is copied there, to `kanban-ui/lib/format/`, by `scripts/sync-format.mjs`, so
// the script and the server cannot read a card differently. Change it here.
// Times are the server's own local time — the board is a local tool, and there
// is no other clock to pick.

/** The accepted forms, in the words the error messages use. */
export const CADENCE_FORMS =
  '<N>m (minutes), <N>h (hours), <N>d (days), or <N>d at HH:MM (whole days, at that time of day) — e.g. 30m, 6h, 1d at 09:30'

/** The units a cadence counts in. */
export type CadenceUnit = 'm' | 'h' | 'd'

export interface Cadence {
  /** How many units between runs — a whole number, 1 or more. */
  n: number
  unit: CadenceUnit
  /** The time of day it runs at, `HH:MM`, or empty when it names none. Only a
   *  whole-day cadence can carry one. */
  at: string
}

const CADENCE_RE = /^(\d+)\s*([mhd])(?:\s+at\s+(\d{1,2}):(\d{2}))?$/i

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Read a cadence line. Returns `{ n, unit, at }` — `at` is `''` unless the card
 * named a time of day — or null when the text isn't one of the accepted forms.
 * Null is also what an empty field gives: no cadence, so no background runs.
 */
export function parseCadence(raw: unknown): Cadence | null {
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(CADENCE_RE)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isInteger(n) || n < 1) return null
  const unit = m[2]!.toLowerCase() as CadenceUnit
  if (m[3] === undefined) return { n, unit, at: '' }
  // A time of day only means something when the interval is whole days.
  if (unit !== 'd') return null
  const hour = Number(m[3])
  const minute = Number(m[4])
  if (hour > 23 || minute > 59) return null
  return { n, unit, at: `${pad(hour)}:${pad(minute)}` }
}

/** A parsed cadence back as the one line the card carries. */
export function formatCadence(c: Cadence): string {
  return c.at ? `${c.n}${c.unit} at ${c.at}` : `${c.n}${c.unit}`
}

/** A day — `2026-08-02`, local time. Every date the board writes down is this one: a
 *  `metrics.csv` row, a `record.csv` line, the day a release shipped.
 *
 *  Local rather than UTC, for the same reason the stamps above are. The board is one
 *  person's tool on one machine, and the day it means is the day they are having — east of
 *  UTC, a UTC date files an evening's work under yesterday, and a session either side of
 *  midnight lands on two rows that disagree with the clock on the wall. */
export function formatDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A minute stamp — `2026-08-02 14:31`, local time. What `last_run` holds. */
export function formatStamp(d: Date): string {
  return `${formatDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Read a `YYYY-MM-DD HH:MM` stamp as a local Date, or null if it isn't one. */
export function parseStamp(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * When this card is next due, from the run it last recorded.
 *
 * Null means never — the card has no cadence, so it only runs when a human says
 * so. A card that HAS a cadence and has never run is due right away (the epoch
 * stands in for "as far in the past as it gets"): waiting up to a day to see a
 * new job work once would be the wrong first impression.
 *
 * Otherwise it's `last_run` plus the interval. With `at HH:MM` the day the
 * interval lands on has to reach that time as well, so `1d at 09:30` is 09:30
 * the next day whatever hour the last run happened at. Days are counted on the
 * calendar rather than in milliseconds, so a clock change doesn't drag the hour
 * with it.
 */
export function nextDue(lastRun: string, cadence: string | Cadence | null): Date | null {
  const c = typeof cadence === 'string' ? parseCadence(cadence) : cadence
  if (!c) return null
  const last = parseStamp(lastRun)
  if (!last) return new Date(0)
  if (c.unit === 'm') return new Date(last.getTime() + c.n * 60_000)
  if (c.unit === 'h') return new Date(last.getTime() + c.n * 3_600_000)
  const [hour, minute] = c.at ? c.at.split(':').map(Number) : [last.getHours(), last.getMinutes()]
  return new Date(last.getFullYear(), last.getMonth(), last.getDate() + c.n, hour, minute, 0, 0)
}

/** True when this card's cadence has elapsed and it should run again. */
export function isDue(lastRun: string, cadence: string, now: Date = new Date()): boolean {
  const due = nextDue(lastRun, cadence)
  return due !== null && due.getTime() <= now.getTime()
}
