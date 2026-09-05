/**
 * What the service spent on a day — the requests it took and the rows it wrote.
 *
 * Cloudflare reports per-day usage nowhere the numbers command can read, and a row in D1 for
 * every request would spend the whole day's allowance measuring itself. So each run writes
 * one Analytics Engine data point, which costs no D1 row and no money, and the daily job
 * reads the open days back in one query and lands them in their summaries.
 *
 * Both copies of the service write to one dataset on purpose: the allowance belongs to the
 * account rather than to a Worker, so the gauge is only honest if it counts both.
 */

import type { Env } from './env.ts'

/** Must match `analytics_engine_datasets` in wrangler.jsonc. */
export const DATASET = 'ai4kanban_telemetry_usage'

export interface DayUsage {
  requests: number
  rows_written: number
  rows_read: number
}

/** One run's cost, indexed by the day it was spent on. Rows read matter as much as rows
 *  written: as installs grow it is the nightly job's reads, not the incoming traffic, that
 *  reach the ceiling first. */
export function spent(env: Env, day: string, written: number, read: number): void {
  env.USAGE?.writeDataPoint({ blobs: [env.COPY], doubles: [written, read], indexes: [day] })
}

/**
 * Every day from `since` on, in one read query. Empty when it cannot be read — no token, or
 * a dataset nothing has been written to yet. A day missing from the answer is recorded as
 * unknown rather than as zero, so a day we could not measure never reads as a quiet one.
 */
export async function usageSince(env: Env, since: string): Promise<Map<string, DayUsage>> {
  const out = new Map<string, DayUsage>()
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return out
  const sql =
    "SELECT index1 AS day, SUM(_sample_interval) AS requests, " +
    "SUM(_sample_interval * double1) AS rows_written, " +
    "SUM(_sample_interval * double2) AS rows_read " +
    `FROM ${DATASET} WHERE index1 >= '${since}' GROUP BY day FORMAT JSON`
  try {
    const answer = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
      { method: 'POST', headers: { authorization: `Bearer ${env.CF_API_TOKEN}` }, body: sql },
    )
    if (!answer.ok) throw new Error(`analytics answered ${answer.status}`)
    const body = (await answer.json()) as { data?: Record<string, unknown>[] }
    for (const row of body.data ?? []) {
      out.set(String(row.day), {
        requests: Number(row.requests ?? 0),
        rows_written: Number(row.rows_written ?? 0),
        rows_read: Number(row.rows_read ?? 0),
      })
    }
  } catch (error) {
    console.error('telemetry: usage unreadable', error)
  }
  return out
}
