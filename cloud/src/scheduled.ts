import { DAILY_WRITE_BUDGET } from './config.ts'
import { call } from './db.ts'
import type { DeliveryRun } from './deliver.ts'
import type { Env } from './env.ts'
import { sendPendingMail } from './invites.ts'
import type { MailRun } from './invites.ts'
import { redrawEverywhere } from './redraw.ts'

/** What one pass of the 30-day sweep freed (#319). */
export interface Sweep {
  deleted: number
}

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
 *
 * The mail step is the retry, not the first attempt: `/v1/invite-request` sends its own
 * notice through `waitUntil`. What is left for this run is a send the provider refused, and an
 * approval written in the SQL editor, where no Worker was in flight to send it.
 */
export async function runScheduled(
  env: Env,
): Promise<{ heartbeat: Heartbeat; mail: MailRun; messages: Record<string, DeliveryRun>; sweep: Sweep }> {
  const heartbeat = await call<Heartbeat>(env, 'service_heartbeat')
  console.log('cloud: heartbeat', { ...heartbeat, daily_write_budget: DAILY_WRITE_BUDGET })

  // Never let a mail failure take the heartbeat's run down with it: the project staying awake
  // matters more than this hour's retry, which the next hour makes again anyway.
  let mail: MailRun = { queued: 0, sent: 0, failed: 0 }
  try {
    mail = await sendPendingMail(env)
  } catch (error) {
    console.error('cloud: invitation mail failed', error)
  }
  if (mail.queued > 0) console.log('cloud: invitation mail', mail)

  // Every connector's retry (#320, #351). Like the mail above, this is not the first attempt:
  // every route that writes an event hands its own delivery to `waitUntil`. What is left for
  // this run is a message the chat refused, and one whose Worker went away mid-send. Outside
  // the daily write budget for the same reason as the rest of this run — a busy day must not
  // leave a chat with a message that stopped following its card.
  const messages = await redrawEverywhere(env)
  for (const [connector, run] of Object.entries(messages)) {
    if (run.due > 0) console.log(`cloud: ${connector} messages`, run)
  }

  // An event is kept while it is unresolved, and 30 days after it reaches a final outcome
  // (#319). Outside the daily write budget like the heartbeat: a busy day must not switch
  // off the sweep that frees space, and a failed sweep is one the next hour makes up for.
  let sweep: Sweep = { deleted: 0 }
  try {
    sweep = await call<Sweep>(env, 'sweep_events')
  } catch (error) {
    console.error('cloud: event sweep failed', error)
  }
  if (sweep.deleted > 0) console.log('cloud: swept finished events', sweep)

  return { heartbeat, mail, messages, sweep }
}
