/**
 * The installs badge's number (#728) — every install that has ever reported a first run.
 *
 * The one number that leaves this service without the Cloudflare account behind it, so the
 * shape is deliberately narrow: the daily job works the running total out and writes it down,
 * and the route reads the newest row and answers it. Nothing here reads an event, and the
 * route takes no parameter, so there is no second number to ask for.
 */

/**
 * The running total, rewritten from the summaries every run.
 *
 * Each day is the day before it plus its own first runs, which is the whole chain in one
 * statement — and the chain is worked out again rather than added to, because the daily job
 * rewrites a day for as long as it takes late events and a correction has to reach the days
 * after it too. It is also what fills the history in: the first run after this ships walks
 * every summary the database holds.
 *
 * `first_run_surface` is a count of installs per surface, so its values add up to the day's
 * first runs — one machine reports its first run once.
 */
export const WRITE_INSTALLS = `
INSERT INTO installs (day, first_runs, total, written_at)
SELECT day, first_runs, SUM(first_runs) OVER (ORDER BY day), ?1
FROM (
  SELECT day, COALESCE((
    SELECT SUM(one.value) FROM json_each(numbers, '$.first_run_surface') AS one
  ), 0) AS first_runs
  FROM daily
)
WHERE true
ON CONFLICT(day) DO UPDATE SET
  first_runs = excluded.first_runs, total = excluded.total, written_at = excluded.written_at
`

/** The one row the route reads: the newest day we hold, and the total through it. */
export const READ_INSTALLS = 'SELECT day, total FROM installs ORDER BY day DESC LIMIT 1'

export interface InstallsTotal {
  day: string
  total: number
}

/** How long the badge may hold an answer, in seconds. */
export const BADGE_CACHE = 3600

/**
 * What the route answers: a shields.io endpoint badge, exactly. Shields refuses a body that
 * carries a key its schema does not name, so the day this counts through goes in a header
 * (`INSTALLS_HEADER`) rather than in the JSON beside the number.
 *
 * A total we could not read is `unknown`, never `0` — a badge reading zero would say nobody
 * has ever installed it.
 */
export function badgeOf(held: InstallsTotal | null): Record<string, unknown> {
  return {
    schemaVersion: 1,
    label: 'installs',
    message: held ? held.total.toLocaleString('en-US') : 'unknown',
    color: held ? '2f6b46' : 'lightgrey',
    cacheSeconds: BADGE_CACHE,
  }
}
