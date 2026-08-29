/**
 * Writing and rewriting the message an event is (#320).
 *
 * Every message is sent from the Worker, never from the machine holding the board: no Slack
 * credential reaches a checkout, and a message keeps moving while that machine is off.
 *
 * One event keeps ONE message however many attempts it takes. The delivery record holds the
 * `ts` Slack answered with, so a message that exists is edited in place — which is also the
 * whole of keeping it in step with the card's newest revision, the decision and the
 * delivery's outcome. What is due is decided in `api.slack_jobs`, by comparing when the
 * event's content last moved against the version its message is showing.
 *
 * Called twice over, like the invitation mail: from the route that wrote the event, through
 * `waitUntil`, so a channel hears about a card in seconds; and from the hourly run, which
 * retries whatever that first attempt did not get out.
 */

import { SLACK_BATCH, SLACK_MAX_ATTEMPTS } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import type { EventRow } from './events.ts'
import { messageFor } from './slack-message.ts'
import { slackApi, slackRefused } from './slack.ts'

/** What one pass wrote. */
export interface SlackRun {
  due: number
  sent: number
  failed: number
}

interface SlackJob {
  ownerId: string
  eventId: string
  /** When any field of the event last moved, as it was when this job was read — `content_at`,
   *  not `changed_at`: a message follows a quiet refresh too, because an edit in a channel
   *  pings nobody and a message naming the wrong release is one somebody would review from.
   *  Recorded with a message that gets through, so an event that moved while Slack was
   *  answering is still due.
   *
   *  `changedAt` is what a schema older than 0008 calls it. Read both ways round, because a
   *  deploy and a migration do not land together and a version token this echoed back as
   *  NULL would leave every message due forever. */
  contentAt?: string
  changedAt?: string
  botToken: string
  channelId: string
  /** The `ts` of the message this event already has, or null when it has none yet. */
  messageRef: string | null
  attempts: number
  event: EventRow
}

/**
 * The Slack errors that mean the user has to do something.
 *
 * A connection in this state is marked revoked and shown where it was made, because a
 * message failing into silence reads as no work waiting. The two halves — the app was
 * removed, and the destination is gone — ask for the same move, so they are one state with
 * Slack's own word kept beside it.
 */
const NEEDS_THE_USER = [
  'invalid_auth',
  'not_authed',
  'account_inactive',
  'token_revoked',
  'token_expired',
  'missing_scope',
  'not_in_channel',
  'channel_not_found',
  'is_archived',
  'restricted_action',
  'org_login_required',
]

/** Write every message that is owed. With an event named, only that one — which is what a
 *  route calls the moment it has written the event. */
export async function deliverSlack(env: Env, eventId?: string): Promise<SlackRun> {
  const jobs = await call<SlackJob[]>(env, 'slack_jobs', {
    p_event: eventId ?? null,
    p_limit: SLACK_BATCH,
    p_max_attempts: SLACK_MAX_ATTEMPTS,
  })
  if (!jobs || jobs.length === 0) return { due: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const job of jobs) {
    try {
      const ts = await write(job)
      await record(env, job, { state: 'sent', ref: ts })
      sent += 1
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error('cloud: slack delivery failed', { event: job.eventId, error })
      await record(env, job, { state: 'failed', error })
      if (NEEDS_THE_USER.includes(error)) await slackRefused(env, job.ownerId, error)
      failed += 1
    }
  }
  return { due: jobs.length, sent, failed }
}

/**
 * Post it, or edit the one that is already there.
 *
 * A message somebody deleted in Slack is posted again rather than reported as a failure:
 * the delivery record is what says a message exists, and the channel is what says whether
 * it still does.
 */
async function write(job: SlackJob): Promise<string> {
  const message = messageFor(job.event)
  if (!job.messageRef) return post(job, message)
  try {
    await slackApi(job.botToken, 'chat.update', {
      channel: job.channelId,
      ts: job.messageRef,
      ...message,
    })
    return job.messageRef
  } catch (e) {
    if ((e instanceof Error ? e.message : '') !== 'message_not_found') throw e
    return post(job, message)
  }
}

async function post(job: SlackJob, message: { text: string; blocks: unknown[] }): Promise<string> {
  const answer = await slackApi<{ ts?: string }>(job.botToken, 'chat.postMessage', {
    channel: job.channelId,
    ...message,
  })
  if (!answer.ts) throw new Error('slack answered without a message id')
  return answer.ts
}

/** Where this event's message stands, against that event's own delivery record. A message
 *  that got through resets the attempt count, so an event edited all week never runs out of
 *  attempts while one Slack keeps refusing stops after a handful. */
const record = (
  env: Env,
  job: SlackJob,
  outcome: { state: 'sent' | 'failed'; ref?: string; error?: string },
): Promise<unknown> =>
  mutate(env, 'record_event_delivery', {
    p_subject: job.ownerId,
    p_event: job.eventId,
    p_connector: 'slack',
    p_state: outcome.state,
    p_external_ref: outcome.ref ?? null,
    p_last_error: outcome.error ?? '',
    // What the message now shows, not when it was written. The event may have moved while
    // Slack was answering, and that one is still owed a rewrite.
    p_rendered_at: job.contentAt ?? job.changedAt,
  })
