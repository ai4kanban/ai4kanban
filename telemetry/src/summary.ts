/**
 * A day's numbers, worked out in the database.
 *
 * Everything a day comes to arrives as (dimension, key, count) triples, in as few queries as
 * D1 will take them. The free plan gives a run ten milliseconds of processor time, so nothing
 * here reads rows to count them — `COUNT(DISTINCT ...)` spends waiting time, which is not
 * processor time, and returns a handful of rows the service only has to arrange.
 */

import { EVENTS } from '../contract.ts'
import type { DayUsage } from './usage.ts'

/** The board counters #296 sends, taken from the contract so a new one needs no SQL edit. */
export const BOARD_COUNTERS = Object.entries(EVENTS.board_numbers.fields)
  .filter(([, kind]) => kind === 'count')
  .map(([field]) => field)

export interface Triple {
  dim: string
  key: string | null
  n: number | null
}

export interface Totals {
  installs: number
  returning_installs: number
  boards: number
}

const firstRun = "name = 'app_open' AND json_extract(fields, '$.first_run') = 1"

/** Every branch names the three columns, because any of them may be the first of its query
 *  and a compound takes its column names from the one it starts with. */
function spread(dim: string, column: string, where: string, installs = false): string {
  const count = installs ? 'COUNT(DISTINCT install_id)' : 'COUNT(*)'
  return `SELECT '${dim}' AS dim, ${column} AS key, ${count} AS n FROM d WHERE ${where} GROUP BY 2`
}

function json(dim: string, field: string, where: string): string {
  return (
    `SELECT '${dim}' AS dim, json_extract(fields, '$.${field}') AS key, COUNT(*) AS n ` +
    `FROM d WHERE ${where} GROUP BY 2`
  )
}

/** Page and language as one key, `/download zh`. Kept together rather than as two spreads
 *  because #297's rate is read per page, per language, AND per language for one page — and
 *  two separate spreads can give the first two but never the third. A token has no space, so
 *  the key splits back apart unambiguously. */
function pageAndLanguage(dim: string, where: string): string {
  return (
    `SELECT '${dim}' AS dim, ` +
    `json_extract(fields, '$.page') || ' ' || json_extract(fields, '$.language') AS key, ` +
    `COUNT(*) AS n FROM d WHERE ${where} GROUP BY 2`
  )
}

/**
 * How many SELECTs D1 takes in one compound statement.
 *
 * Measured against the service's own database: five are answered, the sixth is
 * `too many terms in compound SELECT`. The SQLite the tests run on takes 500, which is how
 * the spreads shipped as one 25-branch query that was refused every night and green here
 * (#801). A CTE's own body is a compound of its own and is not counted against this.
 */
export const D1_COMPOUND_TERMS = 5

/** The day every branch reads. `?1` is the day. */
const DAY = 'WITH d AS (SELECT * FROM events WHERE day = ?1)'

/** One branch for every spread a summary carries. */
const BRANCHES = [
  "SELECT 'event' AS dim, name AS key, COUNT(*) AS n FROM d GROUP BY name",
  // The install spreads count installs rather than events: one machine that sent forty
  // events is one machine on this version and in this country.
  spread('install_surface', 'surface', "install_id <> ''", true),
  spread('install_version', 'version', "install_id <> '' AND version <> ''", true),
  spread('install_country', 'country', "install_id <> '' AND country <> ''", true),
  // #400 reads these: a first run is the only thing our own numbers can call a real install.
  spread('first_run_surface', 'surface', firstRun, true),
  spread('first_run_version', 'version', `${firstRun} AND version <> ''`, true),
  json('run_harness', 'harness', "name IN ('run_started', 'run_finished', 'run_failed')"),
  // #297's rate: views and presses over the same key, so the two divide cell by cell.
  pageAndLanguage('page_view_seen', "name = 'page_view'"),
  pageAndLanguage('download_press_seen', "name = 'download_press'"),
  // What a press carried, so it outlives the 90-day deletion of the events behind it.
  json('download_press_place', 'place', "name = 'download_press'"),
  json('download_press_os', 'os', "name = 'download_press'"),
  json('download_press_arch', 'arch', "name = 'download_press'"),
  // `version` is a column, not a field: `take.ts` lifts it out of every event that carries one.
  spread('download_press_version', 'version', "name = 'download_press' AND version <> ''"),
  ...BOARD_COUNTERS.map(
    (counter) =>
      `SELECT 'board' AS dim, '${counter}' AS key, ` +
      `SUM(json_extract(fields, '$.${counter}')) AS n FROM d WHERE name = 'board_numbers'`,
  ),
]

/** The branches as the queries D1 will take: each one reads the day once and carries no more
 *  branches than `D1_COMPOUND_TERMS`. A day costs one query per entry here, which is what
 *  the daily job budgets for. */
export const SPREADS = Array.from(
  { length: Math.ceil(BRANCHES.length / D1_COMPOUND_TERMS) },
  (_, n) =>
    [DAY, BRANCHES.slice(n * D1_COMPOUND_TERMS, (n + 1) * D1_COMPOUND_TERMS).join('\nUNION ALL\n')]
      .join('\n'),
)

/** How many installs the day had, and how many of them had been seen on an earlier day —
 *  which is the only form of "returning" a summary can still carry once its events are gone. */
export const TOTALS = `
WITH t AS (SELECT DISTINCT install_id FROM events WHERE day = ?1 AND install_id <> '')
SELECT (SELECT COUNT(*) FROM t) AS installs,
       (SELECT COUNT(*) FROM t WHERE EXISTS (
          SELECT 1 FROM events e WHERE e.install_id = t.install_id AND e.day < ?1)
       ) AS returning_installs,
       (SELECT COUNT(DISTINCT board_id) FROM events WHERE day = ?1 AND board_id <> '') AS boards
`

export const WRITE_SUMMARY = `
INSERT INTO daily (day, numbers, settled, written_at) VALUES (?1, ?2, ?3, ?4)
ON CONFLICT(day) DO UPDATE
  SET numbers = excluded.numbers, settled = excluded.settled, written_at = excluded.written_at
`

/** Every number the numbers command prints for a day, as one object. */
export function numbersOf(
  spreads: Triple[],
  totals: Totals,
  usage: DayUsage | null,
): Record<string, unknown> {
  const numbers: Record<string, unknown> = {
    installs: totals.installs,
    returning_installs: totals.returning_installs,
    boards: totals.boards,
    // Unknown rather than zero: a day we could not measure must not read as a quiet one.
    usage: usage ?? null,
  }
  for (const { dim, key, n } of spreads) {
    if (key === null || n === null) continue
    const group = (numbers[groupOf(dim)] ??= {}) as Record<string, number>
    group[key] = n
  }
  return numbers
}

const groupOf = (dim: string) => (dim === 'event' ? 'events' : dim === 'board' ? 'board' : dim)
