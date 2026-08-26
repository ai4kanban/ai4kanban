import { DAILY_WRITE_BUDGET } from './config.ts'
import { call } from './db.ts'
import type { Env } from './env.ts'
import { sendPendingMail } from './invites.ts'
import type { MailRun } from './invites.ts'

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
 * day, and a busy day must not switch off the thing keeping the project awake. The mail the
 * run sends (#327) is outside it for the same reason — a handful of rows an hour, and a busy
 * day must not hold an invitation back.
 */
export async function runScheduled(env: Env): Promise<{ heartbeat: Heartbeat; mail: MailRun }> {
  const heartbeat = await call<Heartbeat>(env, 'service_heartbeat')
  console.log('cloud: heartbeat', { ...heartbeat, daily_write_budget: DAILY_WRITE_BUDGET })

  // Never let a mail failure take the heartbeat's run down with it: the project staying awake
  // matters more than this hour's send, which is retried on the next one anyway.
  let mail: MailRun = { queued: 0, sent: 0, failed: 0 }
  try {
    mail = await sendPendingMail(env)
  } catch (error) {
    console.error('cloud: invitation mail failed', error)
  }
  if (mail.queued > 0) console.log('cloud: invitation mail', mail)

  return { heartbeat, mail }
}
