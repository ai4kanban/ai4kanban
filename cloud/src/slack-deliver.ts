/**
 * Slack's half of the delivery loop (#320).
 *
 * The loop, the attempt counting and the delivery record are ./deliver.ts's, shared with
 * every other connector. What is Slack's is here: which call posts a message, which one
 * edits it, and which of Slack's own errors mean the user has to do something.
 */

import { SLACK_BATCH, SLACK_MAX_ATTEMPTS } from './config.ts'
import { deliver } from './deliver.ts'
import type { Connector, ConnectorJob, DeliveryRun } from './deliver.ts'
import type { Env } from './env.ts'
import { messageFor } from './slack-message.ts'
import { slackApi, slackRefused } from './slack.ts'

export type { DeliveryRun as SlackRun }

/** How this account's Slack connection posts. The bot token never leaves the Worker. */
interface SlackPosts {
  botToken: string
  channelId: string
}

type SlackJob = ConnectorJob<SlackPosts>

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

export const SLACK: Connector<SlackPosts> = {
  name: 'slack',
  batch: SLACK_BATCH,
  maxAttempts: SLACK_MAX_ATTEMPTS,
  write: (_env, job) => write(job),
  needsTheUser: (error) => NEEDS_THE_USER.includes(error),
  refused: (env, ownerId, error) => slackRefused(env, ownerId, error),
}

/** Write every Slack message that is owed. With an event named, only that one. */
export const deliverSlack = (env: Env, eventId?: string): Promise<DeliveryRun> =>
  deliver(env, SLACK, eventId)

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
    await slackApi(job.posts.botToken, 'chat.update', {
      channel: job.posts.channelId,
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
  const answer = await slackApi<{ ts?: string }>(job.posts.botToken, 'chat.postMessage', {
    channel: job.posts.channelId,
    ...message,
  })
  if (!answer.ts) throw new Error('slack answered without a message id')
  return answer.ts
}
