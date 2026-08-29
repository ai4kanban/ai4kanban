/**
 * Slack's half of the delivery loop (#320).
 *
 * The loop, the attempt counting and the delivery record are ./deliver.ts's, shared with
 * every other connector. What is Slack's is here: which call posts a message, which one
 * edits it, and which of Slack's own errors mean the user has to do something.
 *
 * A CARD keeps one thread (#352). Its earliest recorded message is the top of it and every
 * later event replies underneath, so a channel carries one entry per card rather than one
 * per event. Nothing per-card is stored for that: `api.connector_jobs` reads the root back
 * out of the delivery records already kept.
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
  /** The account the Slack connection was made under. A reply pings nobody, so one still
   *  asking for a decision names it. Absent from a schema older than 0011. */
  actorId?: string
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

/**
 * The Slack errors that mean the thread we were given is not one to post in.
 *
 * A root somebody deleted and one left behind in a destination the account has moved away
 * from both land here, and both take the same path: post again with no thread. The card's
 * records still point at that root until the sweep takes it, so until then the card is back
 * to a message per event — which is what it had before threads, and not worth a write that
 * only unsays a `ts`.
 */
const THREAD_REFUSED = [
  'thread_not_found',
  'message_not_found',
  'invalid_thread_ts',
  'cannot_reply_to_message',
]

/** Slack, holding the roots this one pass took. Two of a card's events posted in the same
 *  pass read the same `threadRef` — the one the database had before either was written — so
 *  without somewhere to keep it the second would open a thread of its own. */
const slack = (roots: Map<string, string>): Connector<SlackPosts> => ({
  name: 'slack',
  batch: SLACK_BATCH,
  maxAttempts: SLACK_MAX_ATTEMPTS,
  write: (_env, job) => write(job, roots),
  needsTheUser: (error) => NEEDS_THE_USER.includes(error),
  refused: (env, ownerId, error) => slackRefused(env, ownerId, error),
})

/** Write every Slack message that is owed. With an event named, only that one. */
export const deliverSlack = (env: Env, eventId?: string): Promise<DeliveryRun> =>
  deliver(env, slack(new Map()), eventId)

/**
 * Post it, or edit the one that is already there.
 *
 * A message somebody deleted in Slack is posted again rather than reported as a failure:
 * the delivery record is what says a message exists, and the channel is what says whether
 * it still does.
 *
 * Where it sits is the card's, not the event's: everything but the card's earliest message
 * is a reply under that one, so a channel carries one entry per card. An edit is made
 * wherever the message already is — Slack needs no thread to update one — and its shape
 * follows the root the card has NOW: a reply whose root the sweep has taken is edited back
 * into a root's own shape, because that is what it has become.
 */
async function write(job: SlackJob, roots: Map<string, string>): Promise<string> {
  const card = `${job.event.boardId}:${job.event.taskId}`
  if (!roots.has(card) && job.threadRef) roots.set(card, job.threadRef)
  const root = roots.get(card)
  // The root pointing at this event's own message is the event being the top of the thread.
  const thread = root && root !== job.messageRef ? root : null

  if (job.messageRef) {
    try {
      await slackApi(job.posts.botToken, 'chat.update', {
        channel: job.posts.channelId,
        ts: job.messageRef,
        ...render(job, thread !== null),
      })
      return job.messageRef
    } catch (e) {
      if ((e instanceof Error ? e.message : '') !== 'message_not_found') throw e
    }
  }

  if (thread) {
    try {
      return await post(job, thread)
    } catch (e) {
      if (!THREAD_REFUSED.includes(e instanceof Error ? e.message : '')) throw e
    }
  }
  // A thread of its own: the card has no message left to reply to, or the one it named is
  // not one Slack will take. Either way this message is the top of what comes next.
  const ts = await post(job, null)
  roots.set(card, ts)
  return ts
}

/** The message as it sits: the whole card at the top of a thread, and where the work stands
 *  in a reply under it. */
const render = (job: SlackJob, reply: boolean) =>
  reply ? messageFor(job.event, { actorId: job.posts.actorId }) : messageFor(job.event)

/** Nothing is ever broadcast to the channel: a broadcast reply is a reference carrying no
 *  buttons, so it would leave the card's bulk in the timeline and take the decision out of
 *  the thread. */
async function post(job: SlackJob, thread: string | null): Promise<string> {
  const answer = await slackApi<{ ts?: string }>(job.posts.botToken, 'chat.postMessage', {
    channel: job.posts.channelId,
    ...render(job, thread !== null),
    ...(thread ? { thread_ts: thread } : {}),
  })
  if (!answer.ts) throw new Error('slack answered without a message id')
  return answer.ts
}
