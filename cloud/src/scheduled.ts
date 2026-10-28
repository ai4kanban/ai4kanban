import { cancelStrandedPacks } from './billing.ts'
import type { PackCancel } from './billing.ts'
import { CHAT_KEEP_DAYS, DAILY_WRITE_BUDGET } from './config.ts'
import { sendPendingContactMail } from './contact.ts'
import type { ContactMailRun } from './contact.ts'
import { call } from './db.ts'
import type { DeliveryRun } from './deliver.ts'
import { clearDroppedBoards, clearDroppedFiles } from './dropped.ts'
import type { Env } from './env.ts'
import { sendPendingMail } from './invites.ts'
import type { MailRun } from './invites.ts'
import { redrawEverywhere } from './redraw.ts'
import { expire } from './retention.ts'
import type { Expiry } from './retention.ts'
import { sendPendingTrainingMail } from './training-mail.ts'
import { settleEndings } from './v1/endings.ts'
import { sortWaitingTriage } from './triage-sort.ts'
import type { TrainingMailRun } from './training-mail.ts'

/** What one pass of the 30-day sweep freed (#319): the events, and the card messages left
 *  with no event to belong to (#359). */
export interface Sweep {
  deleted: number
  cardMessages?: number
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
): Promise<{
  heartbeat: Heartbeat
  mail: MailRun
  training: TrainingMailRun
  contact: ContactMailRun
  messages: Record<string, DeliveryRun>
  sweep: Sweep
  v1: Record<string, number>
  expiry: Expiry
  chats: { messages: number; chats: number }
  dropped: { boards: number; files: number }
  packs: PackCancel
  endings: number
  triage: number
}> {
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

  // The training page's own outbox (#683), and the retry for the same reason as the mail
  // above: the booking is held by its row, so a message the provider refused costs an hour of
  // delay and never the appointment. Outside the daily write budget with the rest of this run.
  let training: TrainingMailRun = { queued: 0, sent: 0, failed: 0 }
  try {
    training = await sendPendingTrainingMail(env)
  } catch (error) {
    console.error('cloud: booking mail failed', error)
  }
  if (training.queued > 0) console.log('cloud: booking mail', training)

  // The contact form's outbox (#784), retried for the same reason.
  let contact: ContactMailRun = { queued: 0, sent: 0, failed: 0 }
  try {
    contact = await sendPendingContactMail(env)
  } catch (error) {
    console.error('cloud: contact mail failed', error)
  }
  if (contact.queued > 0) console.log('cloud: contact mail', contact)

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

  // The public API's (#2000): events past 30 days, replays past a day, read alerts.
  let v1: Record<string, number> = {}
  try {
    v1 = await call<Record<string, number>>(env, 'v1_sweep')
  } catch (error) {
    console.error('cloud: public API sweep failed', error)
  }
  if (Object.values(v1).some((n) => n > 0)) console.log('cloud: swept public API rows', v1)

  // What the plans no longer keep (#2017), and abandoned uploads.
  let expiry: Expiry = { tasks: 0, events: 0, jobs: 0, files: 0, uploads: 0, triage: 0 }
  try {
    expiry = await expire(env)
  } catch (error) {
    console.error('cloud: expiry failed', error)
  }
  if (Object.values(expiry).some((n) => n > 0)) console.log('cloud: expired', expiry)

  // Task chats past the days kept (#2065); the Runner that answered keeps its own copy as long.
  let chats = { messages: 0, chats: 0 }
  try {
    chats = await call<typeof chats>(env, 'sweep_task_chats', { p_days: CHAT_KEEP_DAYS })
  } catch (error) {
    console.error('cloud: chat sweep failed', error)
  }
  if (chats.messages > 0 || chats.chats > 0) console.log('cloud: swept task chats', chats)

  // What deleted projects, files and runs left behind, a deleted account's included (#2089).
  const dropped = { boards: 0, files: 0 }
  try {
    dropped.boards = await clearDroppedBoards(env)
  } catch (error) {
    console.error('cloud: dropped boards failed', error)
  }
  try {
    dropped.files = await clearDroppedFiles(env)
  } catch (error) {
    console.error('cloud: dropped files failed', error)
  }
  if (dropped.boards > 0 || dropped.files > 0) console.log('cloud: cleared dropped', dropped)

  // A storage pack whose Pro has ended (#2033).
  let packs: PackCancel = { canceled: 0, failed: 0 }
  try {
    packs = await cancelStrandedPacks(env)
  } catch (error) {
    console.error('cloud: storage pack check failed', error)
  }
  if (packs.canceled > 0 || packs.failed > 0) console.log('cloud: storage packs', packs)

  // Task endings a request's own `waitUntil` did not finish (#2064).
  const endings = await settleEndings(env)
  if (endings > 0) console.log('cloud: task endings', { endings })

  // Triage items a request's own `waitUntil` did not judge (#2124).
  const triage = await sortWaitingTriage(env)
  if (triage > 0) console.log('cloud: triage sorted', { triage })

  return { heartbeat, mail, training, contact, messages, sweep, v1, expiry, chats, dropped, packs, endings, triage }
}
