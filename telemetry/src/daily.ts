/**
 * The one job the service runs on a clock, in the last hour of the UTC day so it spends what
 * the day's allowance has left rather than taking it from the senders first.
 *
 * Three steps today — write the expiring days out to the archive, delete what has expired,
 * then write the summaries — and each stands on its own: a step that fails leaves the rest of
 * the job standing. The one order that matters is the first two: the sweep may only take a
 * day the archive already holds. #400's daily pull of the public GitHub and npm counts is the
 * next step, and goes here rather than on a schedule of its own, because a static site cannot
 * run one.
 *
 * A run gets fifty queries on the free plan and every D1 query is one of them. So the run
 * keeps a budget, spends it oldest work first, and carries whatever does not fit to the next
 * run: 90 days is the least time an event is kept, not the exact moment it goes.
 */

import { LIMITS } from '../contract.ts'
import { ARCHIVE_PAGE, fileOf, frontier, keyOf } from './archive.ts'
import type { ArchiveRow } from './archive.ts'
import type { Env } from './env.ts'
import { shift } from './take.ts'
import { SPREAD, TOTALS, WRITE_SUMMARY, numbersOf } from './summary.ts'
import type { Totals, Triple } from './summary.ts'
import { spent, usageSince } from './usage.ts'
import type { DayUsage } from './usage.ts'

/** Of the free plan's 50 a run, leaving room for the one read the usage gauge costs. */
const QUERY_BUDGET = 44
/** Rows one archive read returns. */
const ARCHIVE_CHUNK = 5_000
/** The archive's share of the run's queries. Forty thousand rows a day is far more than the
 *  free plan can store at all, so no day can outgrow one run before the plan itself does. */
const ARCHIVE_CHUNKS = 8
/** Rows one delete takes. Small enough that a chunk that fails costs one statement. */
const SWEEP_CHUNK = 2_500
const SWEEP_CHUNKS = 10
/** Spreads, totals, and the write. */
const QUERIES_PER_DAY = 3

/** The expired days, oldest first — the sweep takes them one at a time. */
const EXPIRED = 'SELECT day FROM events WHERE day < ?1 GROUP BY day ORDER BY day LIMIT ?2'

export const SWEEP = `
DELETE FROM events WHERE (install_id, event_id) IN (
  SELECT install_id, event_id FROM events WHERE day = ?1 LIMIT ?2
)`

const SUMMARISED = 'SELECT day, settled FROM daily WHERE day >= ?1'

export interface DailyRun {
  day: string
  /** Days this run wrote out to the archive, oldest first. */
  archived: string[]
  /** Event rows those files carry. */
  archivedRows: number
  swept: number
  /** Expired days the sweep left where they are, waiting on their archive file. Anything but
   *  zero for long means the database is growing until the archive is fixed. */
  held: number
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
    archived: [],
    archivedRows: 0,
    swept: 0,
    held: 0,
    summarised: [],
    carried: 0,
    rowsWritten: 0,
    rowsRead: 0,
  }
  let left = QUERY_BUDGET

  // The archive, ahead of the sweep. A day it could not write stays in `events`, so a missing
  // bucket or a failing put holds every expired day and the database grows until it is fixed
  // — the accepted cost of never deleting an unwritten day.
  let edge: string | null = null
  try {
    const done = await archiveDays(env, today, Math.min(left, ARCHIVE_CHUNKS), run)
    left -= done.used
    edge = done.frontier
  } catch (error) {
    console.error('telemetry: archive failed', error)
  }

  // The retention sweep, one day at a time and oldest first. Raw events only: a table beside
  // the summaries that carries no install id is not this deletion's business.
  try {
    left -= 1
    const expired = await env.DB.prepare(EXPIRED)
      .bind(shift(today, -LIMITS.retentionDays), SWEEP_CHUNKS)
      .all<{ day: string }>()
    run.rowsRead += expired.meta.rows_read
    let chunks = 0
    for (const { day } of expired.results) {
      if (edge === null || day >= edge) {
        run.held += 1
        continue
      }
      while (chunks < SWEEP_CHUNKS && left > 0) {
        chunks += 1
        left -= 1
        const result = await env.DB.prepare(SWEEP).bind(day, SWEEP_CHUNK).run()
        run.swept += result.meta.changes
        run.rowsWritten += result.meta.rows_written
        run.rowsRead += result.meta.rows_read
        if (result.meta.changes < SWEEP_CHUNK) break
      }
      if (chunks >= SWEEP_CHUNKS || left <= 0) break
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

/**
 * Every day whose events the sweep is about to take, written out oldest first.
 *
 * A day is taken once, on the run that would otherwise sweep it, so nothing here rewrites a
 * day that can still take late events. A day the service saw nothing on is written as an
 * empty file rather than skipped: the frontier moves past it, and every day in the archive's
 * range then has an answer.
 */
async function archiveDays(
  env: Env,
  today: string,
  budget: number,
  run: DailyRun,
): Promise<{ used: number; frontier: string }> {
  const before = shift(today, -LIMITS.retentionDays)
  let day = await frontier(env.ARCHIVE)
  let used = 0
  while (day < before && used < budget) {
    try {
      const read = await readDay(env, day, budget - used, run)
      used += read.used
      // The day needs more of this run than it has left. It is never put in part: the next
      // run starts it again, with the whole share to spend.
      if (read.lines === null) break
      await env.ARCHIVE.put(keyOf(day), fileOf(read.lines), {
        httpMetadata: { contentType: 'application/x-ndjson' },
      })
      run.archived.push(day)
      run.archivedRows += read.lines.length
    } catch (error) {
      // This day and every expired day behind it stay in `events` until a later run writes
      // it. The share is called spent: what it cost before failing is not known.
      console.error('telemetry: archive failed', day, error)
      used = budget
      break
    }
    day = shift(day, 1)
  }
  return { used, frontier: day }
}

async function readDay(
  env: Env,
  day: string,
  allowed: number,
  run: DailyRun,
): Promise<{ used: number; lines: string[] | null }> {
  const lines: string[] = []
  let install = ''
  let event = ''
  let used = 0
  for (;;) {
    if (used >= allowed) return { used, lines: null }
    used += 1
    const page = await env.DB.prepare(ARCHIVE_PAGE)
      .bind(day, install, event, ARCHIVE_CHUNK)
      .all<ArchiveRow>()
    run.rowsRead += page.meta.rows_read
    for (const row of page.results) lines.push(row.line)
    const last = page.results.at(-1)
    if (last === undefined || page.results.length < ARCHIVE_CHUNK) return { used, lines }
    install = last.i
    event = last.e
  }
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
