/**
 * Slack's half of the delivery loop (#320).
 *
 * The loop, the attempt counting and the delivery record are ./deliver.ts's, shared with
 * every other connector. What is Slack's is here: which call posts a message, which one
 * edits it, and which of Slack's own errors mean the user has to do something.
 *
 * A CARD is one message, and its thread is the log (#359). The top message belongs to the
 * card rather than to any one event: it is drawn from the card's newest event, rewritten
 * whenever that moves, and it is where every control is offered. Underneath it goes one reply
 * per event, written once and never edited — the chat's own timestamp is when it happened.
 *
 * Where that message is, is stored: `api.connector_jobs` hands it over as `cardRef`, and it
 * is recorded the moment Slack answers rather than with the event's delivery.
 */

import { SLACK_BATCH, SLACK_MAX_ATTEMPTS } from './config.ts'
import { deliver, recordCardMessage } from './deliver.ts'
import type { Connector, ConnectorJob, DeliveryRun } from './deliver.ts'
import type { Env } from './env.ts'
import { logFor, messageFor, type Block } from './slack-message.ts'
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

/** A message as Slack takes it: the notification line and the blocks. */
type Message = { text: string; blocks: Block[] }

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
 * The Slack errors that mean the message we were given is not one to reply under.
 *
 * A card's message somebody deleted and one left behind in a destination the account has
 * moved away from both land here, and both take the same path: post the card afresh and log
 * this event under that one. Whatever that old message was, it is not the card's any more.
 */
const THREAD_REFUSED = [
  'thread_not_found',
  'message_not_found',
  'invalid_thread_ts',
  'cannot_reply_to_message',
]

/**
 * What one pass has written per card.
 *
 * Two of a card's events in the same pass read the same `cardRef` — the one the database had
 * before either was written — so without somewhere to keep it the second would open a second
 * message. `drawn` is what keeps the second from redrawing what the first just drew.
 */
interface Pass {
  ref: Map<string, string>
  drawn: Set<string>
}

/** Slack, holding the card messages this one pass took. */
const slack = (pass: Pass): Connector<SlackPosts> => ({
  name: 'slack',
  batch: SLACK_BATCH,
  maxAttempts: SLACK_MAX_ATTEMPTS,
  write: (env, job) => write(env, job, pass),
  needsTheUser: (error) => NEEDS_THE_USER.includes(error),
  refused: (env, ownerId, error) => slackRefused(env, ownerId, error),
})

/** Write every Slack message that is owed. With an event named, only that one. */
export const deliverSlack = (env: Env, eventId?: string): Promise<DeliveryRun> =>
  deliver(env, slack({ ref: new Map(), drawn: new Set() }), eventId)

/**
 * The card's message, brought up to date, and this event's line in its thread.
 *
 * The delivery record this answers is the EVENT's, so what is returned is the reply — which
 * is written once and never rewritten. An event that already has one costs one edit of the
 * card's message and nothing else: that edit is the whole of keeping the top of the thread in
 * step with the newest revision, the decision and the delivery's outcome.
 */
async function write(env: Env, job: SlackJob, pass: Pass): Promise<string> {
  const root = await cardMessage(env, job, pass)
  if (job.messageRef) return job.messageRef

  const line = logFor(job.event, { actorId: job.posts.actorId })
  try {
    return await post(job, line, root)
  } catch (e) {
    if (!THREAD_REFUSED.includes(e instanceof Error ? e.message : '')) throw e
  }
  const fresh = await postCard(env, job, pass)
  return post(job, line, fresh)
}

/**
 * The card's message: posted where it has none, edited where it has one, once per pass.
 *
 * A message somebody deleted in Slack is posted again rather than reported as a failure: the
 * record is what says a message exists, and the channel is what says whether it still does.
 */
async function cardMessage(env: Env, job: SlackJob, pass: Pass): Promise<string> {
  const card = cardKey(job)
  const known = pass.ref.get(card) ?? job.cardRef ?? null
  if (known && pass.drawn.has(card)) return known

  if (known) {
    try {
      await slackApi(job.posts.botToken, 'chat.update', {
        channel: job.posts.channelId,
        ts: known,
        ...shown(job),
      })
      pass.ref.set(card, known)
      pass.drawn.add(card)
      return known
    } catch (e) {
      if ((e instanceof Error ? e.message : '') !== 'message_not_found') throw e
    }
  }
  return postCard(env, job, pass)
}

/** A card's message where it has none Slack will take. Recorded the moment Slack answers, so
 *  nothing later in this pass — a failed reply, a second event — opens a second one. */
async function postCard(env: Env, job: SlackJob, pass: Pass): Promise<string> {
  const ts = await post(job, shown(job), null)
  await recordCardMessage(env, 'slack', job, ts)
  pass.ref.set(cardKey(job), ts)
  pass.drawn.add(cardKey(job))
  return ts
}

/** The card as it stands now — its newest event, not whichever event's delivery is due. A
 *  schema older than 0013 sends no newest event, and the one being delivered is all there is. */
const shown = (job: SlackJob): Message => messageFor(job.card ?? job.event)

const cardKey = (job: SlackJob): string => `${job.event.boardId}:${job.event.taskId}`

/** Nothing is ever broadcast to the channel: a broadcast reply would put the card's bulk back
 *  in the timeline, and the controls are at the top of the thread rather than in a reply. */
async function post(job: SlackJob, message: Message, thread: string | null): Promise<string> {
  const answer = await slackApi<{ ts?: string }>(job.posts.botToken, 'chat.postMessage', {
    channel: job.posts.channelId,
    ...message,
    ...(thread ? { thread_ts: thread } : {}),
  })
  if (!answer.ts) throw new Error('slack answered without a message id')
  return answer.ts
}
