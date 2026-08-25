import { DAILY_WRITE_BUDGET } from './config.ts'
import { call } from './db.ts'
import type { Env } from './env.ts'

export interface Heartbeat {
  last_run_at: string
  runs: number
  writes_today: number
}

/**
 * The service's one scheduled run. It touches the database every time, which is what keeps
 * the free Supabase project from pausing after a quiet week. Later cards add their steps
 * here rather than a schedule of their own (#314, #320).
 *
 * The heartbeat writes, and is deliberately outside the daily write budget: it is 24 rows a
 * day, and a busy day must not switch off the thing keeping the project awake.
 */
export async function runScheduled(env: Env): Promise<Heartbeat> {
  const heartbeat = await call<Heartbeat>(env, 'service_heartbeat')
  console.log('cloud: heartbeat', { ...heartbeat, daily_write_budget: DAILY_WRITE_BUDGET })
  return heartbeat
}
