/**
 * The one job the service runs on a clock, in the last hour of the UTC day so it spends what
 * the day's allowance has left rather than taking it from the senders first.
 *
 * Two steps today — delete what has expired, then write the summaries — and each stands on
 * its own: a step that fails leaves the rest of the job standing. #400's daily pull of the
 * public GitHub and npm counts is the third, and goes here rather than on a schedule of its
 * own, because a static site cannot run one.
 *
 * A run gets fifty queries on the free plan and every D1 query is one of them. So the run
 * keeps a budget, spends it oldest work first, and carries whatever does not fit to the next
 * run: 90 days is the least time an event is kept, not the exact moment it goes.
 */

import { LIMITS } from '../contract.ts'
import type { Env } from './env.ts'
import { shift } from './take.ts'
import { SPREAD, TOTALS, WRITE_SUMMARY, numbersOf } from './summary.ts'
import type { Totals, Triple } from './summary.ts'
import { spent, usageSince } from './usage.ts'
import type { DayUsage } from './usage.ts'

/** Of the free plan's 50 a run, leaving room for the one read the usage gauge costs. */
const QUERY_BUDGET = 44
/** Rows one delete takes. Small enough that a chunk that fails costs one statement. */
const SWEEP_CHUNK = 2_500
const SWEEP_CHUNKS = 10
/** Spreads, totals, and the write. */
const QUERIES_PER_DAY = 3

export const SWEEP = `
DELETE FROM events WHERE (install_id, event_id) IN (
  SELECT install_id, event_id FROM events WHERE day < ?1 LIMIT ?2
)`

const SUMMARISED = 'SELECT day, settled FROM daily WHERE day >= ?1'

export interface DailyRun {
  day: string
  swept: number
  /** Days whose summary this run wrote. */
  summarised: string[]
  /** Days this run had no budget for. The next run takes them. */
  carried: number
  rowsWritten: number
  rowsRead: number
}

export async function runDaily(env: Env, now: Date): Promise<DailyRun> {
  const today = now.toISOString().slice(0, 10)
  const run: DailyRun = {
    day: today,
    swept: 0,
    summarised: [],
    carried: 0,
    rowsWritten: 0,
    rowsRead: 0,
  }
  let left = QUERY_BUDGET

  // The retention sweep. Raw events only: a table beside the summaries that carries no
  // install id is not this deletion's business.
  try {
    const before = shift(today, -LIMITS.retentionDays)
    for (let chunk = 0; chunk < SWEEP_CHUNKS && left > 0; chunk += 1) {
      left -= 1
      const result = await env.DB.prepare(SWEEP).bind(before, SWEEP_CHUNK).run()
      run.swept += result.meta.changes
      run.rowsWritten += result.meta.rows_written
      run.rowsRead += result.meta.rows_read
      if (result.meta.changes < SWEEP_CHUNK) break
    }
  } catch (error) {
    console.error('telemetry: sweep failed', error)
  }

  try {
    left = await summarise(env, today, left, run)
  } catch (error) {
    console.error('telemetry: summaries failed', error)
  }

  spent(env, today, run.rowsWritten, run.rowsRead)
  console.log('telemetry: daily', { ...run, budgetLeft: left })
  return run
}

async function summarise(env: Env, today: string, budget: number, run: DailyRun): Promise<number> {
  let left = budget
  if (left < 1 + QUERIES_PER_DAY) return left

  left -= 1
  const kept = shift(today, -LIMITS.retentionDays)
  const written = await env.DB.prepare(SUMMARISED)
    .bind(kept)
    .all<{ day: string; settled: number }>()
  run.rowsRead += written.meta.rows_read
  const held = new Set(written.results.map((row) => row.day))
  const settled = new Set(
    written.results.filter((row) => row.settled === 1).map((row) => row.day),
  )

  // Back as far as a day this run may write, not just the open ones: a day summarised late
  // has to carry what it cost too, and the answer is one grouped row per day either way.
  const usage = await usageSince(env, shift(today, -LIMITS.retentionDays))

  for (const day of wanted(today, held, settled)) {
    if (left < QUERIES_PER_DAY) {
      run.carried += 1
      continue
    }
    left -= QUERIES_PER_DAY
    await writeDay(env, day.day, day.settled, usage.get(day.day) ?? null, run)
  }
  return left
}

/**
 * The days this run should write, oldest first.
 *
 * A day takes late events until it is more than `backfillDays` old, so every day back to
 * then is rewritten — an install that was offline is counted on the day it was used. The day
 * after that is written once, settled, and never touched again.
 *
 * Behind those come every day this service saw that is not settled yet: one a run missed
 * altogether, and one whose last summary was written while it could still take events,
 * because the run that would have closed it never happened. Both are written for as long as
 * their events are kept — the summary is the only copy of a day's numbers once they are gone,
 * so the oldest goes first: it is the one whose events the sweep takes next. A day older than
 * the oldest summary we hold was never missed, because the service was not running then,
 * which is what stops a first run writing ninety empty days.
 */
export function wanted(
  today: string,
  held: Set<string>,
  settled: Set<string>,
): { day: string; settled: boolean }[] {
  const open: { day: string; settled: boolean }[] = []
  const missed: { day: string; settled: boolean }[] = []
  const closes = LIMITS.backfillDays + 1
  const earliest = [...held].sort()[0]
  for (let back = 0; back <= LIMITS.retentionDays; back += 1) {
    const day = shift(today, -back)
    if (settled.has(day)) continue
    if (back <= closes) open.push({ day, settled: back === closes })
    else if (earliest !== undefined && day >= earliest) missed.push({ day, settled: true })
  }
  return [...open.reverse(), ...missed.reverse()]
}

async function writeDay(
  env: Env,
  day: string,
  settled: boolean,
  usage: DayUsage | null,
  run: DailyRun,
): Promise<void> {
  const spreads = await env.DB.prepare(SPREAD).bind(day).all<Triple>()
  run.rowsRead += spreads.meta.rows_read
  // `all` rather than `first`: this is the run's most expensive read, and the summary
  // promises to say what the day cost.
  const totals = await env.DB.prepare(TOTALS).bind(day).all<Totals>()
  run.rowsRead += totals.meta.rows_read
  const numbers = numbersOf(spreads.results, totals.results[0] ?? EMPTY, usage)
  const result = await env.DB.prepare(WRITE_SUMMARY)
    .bind(day, JSON.stringify(numbers), settled ? 1 : 0, new Date().toISOString())
    .run()
  run.rowsWritten += result.meta.rows_written
  run.rowsRead += result.meta.rows_read
  run.summarised.push(day)
}

const EMPTY: Totals = { installs: 0, returning_installs: 0, boards: 0 }
