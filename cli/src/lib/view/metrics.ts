// ---- the daily numbers, as a chart reads them ------------------------------
//
// `docs/kanban/metrics.csv` holds one row per day: completed, created, rejected. The
// writing side is ../metrics.ts; this is the window a progress view draws.
//
// Three things the reader has to get right. Dates are stamped in local time by the writer
// (`formatDay`), so the window is counted in local time too — the two have to agree, or the
// newest day slips in or out of it. The columns are read by header name, not by position:
// the file's order is
// `completed,created,rejected`, the reverse of how we say it, and a file written by another
// version shouldn't be silently mis-plotted. And a file we can't read or make sense of is
// reported as an error, never as an empty board — telling a user with a damaged file that
// they have no activity would read as their history being gone.

import fs from 'node:fs'

import { formatDay } from '../cadence'
import { METRICS } from '../paths'
import { METRICS_WINDOW_DAYS, type MetricsDay, type MetricsResult } from './types'

const DATE = 'date'
const COUNTS = ['completed', 'created', 'rejected'] as const
type Count = (typeof COUNTS)[number]

/** `YYYY-MM-DD` for a day offset from today, counted on the local calendar — the same one
 *  the writer stamps a row with. */
function localDay(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return formatDay(d)
}

/** A count the same way the writer writes it: anything missing or non-numeric reads as
 *  zero. One odd cell isn't a damaged file. */
function count(cell: string | undefined): number {
  const n = Number((cell ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

/** The window, every day at zero. */
function blankDays(): Map<string, MetricsDay> {
  const days = new Map<string, MetricsDay>()
  for (let i = METRICS_WINDOW_DAYS - 1; i >= 0; i--) {
    const date = localDay(-i)
    days.set(date, { date, completed: 0, created: 0, rejected: 0 })
  }
  return days
}

function view(days: Map<string, MetricsDay>, empty: boolean): MetricsResult {
  const list = [...days.values()]
  const totals = { completed: 0, created: 0, rejected: 0 }
  for (const day of list) for (const c of COUNTS) totals[c] += day[c]
  return { ok: true, view: { days: list, totals, empty } }
}

export function readMetricsView(): MetricsResult {
  let text: string
  try {
    text = fs.readFileSync(METRICS, 'utf8')
  } catch (e) {
    // No file at all is the one honest empty: a board that has never recorded anything. A
    // directory in its place, no permission to read it, bad bytes — those are failures, and
    // the user needs to know which file to look at.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return view(blankDays(), true)
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Could not read ${METRICS} — ${why}` }
  }

  const rows = text.trim().split('\n').filter(Boolean)
  if (rows.length === 0) return { ok: false, error: `${METRICS} is empty — it has no header row.` }

  // Read the columns by name. A header that doesn't name them is not something to guess at:
  // guessing by position is exactly the silent mis-plotting that reading by name prevents.
  const header = rows[0]!.split(',').map((h) => h.trim().toLowerCase())
  const at = {} as Record<Count, number>
  const missing: string[] = []
  for (const name of [DATE, ...COUNTS]) {
    const i = header.indexOf(name)
    if (i < 0) missing.push(name)
    else if (name !== DATE) at[name as Count] = i
  }
  if (missing.length > 0) {
    return {
      ok: false,
      error:
        `${METRICS} does not name its ${missing.join(', ')} column${missing.length > 1 ? 's' : ''} ` +
        'in the header row — the numbers can\'t be read without guessing which is which.',
    }
  }
  const dateAt = header.indexOf(DATE)

  const days = blankDays()
  const body = rows.slice(1)
  for (const line of body) {
    const cells = line.split(',')
    const day = days.get((cells[dateAt] ?? '').trim())
    if (!day) continue // outside the window, or not a date
    for (const c of COUNTS) day[c] += count(cells[at[c]])
  }

  // A header alone is a board that has recorded nothing yet — the header is written the
  // first time anything touches the file.
  return view(days, body.length === 0)
}
