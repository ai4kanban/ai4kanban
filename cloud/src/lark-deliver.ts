/**
 * Lark's half of the delivery loop (#351).
 *
 * The loop, the attempt counting and the delivery record are ./deliver.ts's, shared with
 * Slack. What is Lark's is here: the token a message goes out on, which call posts a card,
 * which one edits it, and which of Lark's own codes mean the user has to do something.
 *
 * A CARD keeps one 话题 in a group chat (#353). Its earliest recorded message opens the topic
 * and every later event replies inside it, so a group carries one entry per card rather than
 * one per event. The direct message is left alone — Lark opens a topic in group chats only.
 * Nothing per-card is stored for it: `api.connector_jobs` reads the root back out of the
 * delivery records already kept.
 */

import { LARK_BATCH, LARK_MAX_ATTEMPTS } from './config.ts'
import { deliver } from './deliver.ts'
import type { Connector, ConnectorJob, DeliveryRun } from './deliver.ts'
import type { Env } from './env.ts'
import { cardFor } from './lark-message.ts'
import { larkAsTenant, larkRefused, tenantToken, type LarkPosts } from './lark.ts'

export type { DeliveryRun as LarkRun }

type LarkJob = ConnectorJob<LarkPosts>

/**
 * The Lark codes that mean the user has to do something.
 *
 * A connection in this state is marked revoked and shown where it was made, because a message
 * failing into silence reads as no work waiting. The two halves — the tenant uninstalled the
 * app, and the destination is gone — ask for the same move, so they are one state with Lark's
 * own words kept beside it.
 *
 * Everything else is left to the next run: a rate limit, a bad minute at Lark, and a cloud
 * whose `app_ticket` has not been pushed yet all mend themselves.
 */
const NEEDS_THE_USER = [
  '99991663', // the tenant token is not valid
  '99991664', // the app token is not valid
  '232004', // no such app
  '232006', // that chat id is not one Lark knows
  '232009', // the chat has been dissolved
  '232011', // the bot is not in that chat
  '232024', // the app is not visible to that person
  '232025', // the bot capability is switched off
  '232034', // the tenant has not installed the app, or has switched it off
  '232060', // the chat is banned
  '230002', // the bot may not post there
]

/**
 * The Lark codes that mean the topic we were given is not one to post in.
 *
 * A chat that will not take a thread reply and a root somebody recalled both land here, and
 * both take the same path: post again at the top level. The card's records still point at
 * that root until the sweep takes it, so until then the card is back to a message per event —
 * which is what it had before topics, and not worth a write that only unsays a message id.
 *
 * None of these is a connection anybody has to mend, so none belongs in the list above.
 */
const THREAD_REFUSED = [
  '230071', // the chat does not support a thread reply
  '230072', // the message is an aggregated one
  '230011', // the root was recalled
  '231003', // the root is gone
]

/** Lark, holding the roots this one pass took. Two of a card's events posted in the same pass
 *  read the same `threadRef` — the one the database had before either was written — so
 *  without somewhere to keep it the second would open a topic of its own. */
const lark = (roots: Map<string, string>): Connector<LarkPosts> => ({
  name: 'lark',
  batch: LARK_BATCH,
  maxAttempts: LARK_MAX_ATTEMPTS,
  write: (env, job) => write(env, job, roots),
  needsTheUser: (error) => NEEDS_THE_USER.includes(code(error)),
  refused: (env, ownerId, error) => larkRefused(env, ownerId, error),
})

/** Write every Lark message that is owed. With an event named, only that one. */
export const deliverLark = (env: Env, eventId?: string): Promise<DeliveryRun> =>
  deliver(env, lark(new Map()), eventId)

/**
 * Where a message is, as the delivery record keeps it: `<destination>:<message_id>`.
 *
 * Lark's reply endpoint takes no destination — a reply lands in whichever chat the message it
 * answers is in — so the chat has to be known before the call rather than learned from a
 * refusal. It travels in the reference, which is the connector's own opaque token, so it
 * costs no column and no per-card state. A reference written before #353 is a bare message
 * id: still patched in place, never replied under.
 */
const refFor = (job: LarkJob, messageId: string): string =>
  `${job.posts.destinationId}:${messageId}`

const messageIdOf = (ref: string): string => ref.slice(ref.indexOf(':') + 1)

/** Whether a recorded message is one this connection can reply to: it has to be in the chat
 *  the connection posts to NOW. `api.connector_jobs` answers only such roots from 0012 on;
 *  this is what holds while a Worker runs against an older schema, where a root may be a bare
 *  message id naming no chat or one in a destination the account has since left. */
const inThisChat = (job: LarkJob, ref: string): boolean =>
  ref.startsWith(`${job.posts.destinationId}:`)

/** Lark refusals arrive as `"<code>: <message>"` from `larkAsTenant`. */
const code = (error: string): string => error.split(':')[0] ?? ''

/**
 * Post it, or edit the one that is already there.
 *
 * One event keeps one message: a card that exists is patched in place, which is also the
 * whole of keeping it in step with the newest revision, the decision and the outcome. A patch
 * that fails is retried rather than posted again — Lark has no one code for "that message is
 * gone", and re-posting on a code we guessed at would leave a chat with two cards for one
 * task.
 *
 * Where it sits is the card's, not the event's: in a group, everything but the card's
 * earliest message is a reply inside that one's topic. An edit is made wherever the message
 * already is — Lark needs no topic to patch one — and its shape follows the root the card has
 * NOW: a reply whose root the sweep has taken is edited back into a root's own shape, because
 * that is what it has become.
 */
async function write(env: Env, job: LarkJob, roots: Map<string, string>): Promise<string> {
  const token = await tenantToken(env, job.posts.cloud, job.posts.tenantKey)
  const card = `${job.event.boardId}:${job.event.taskId}`
  if (!roots.has(card) && job.threadRef) roots.set(card, job.threadRef)
  const root = roots.get(card)
  // Lark opens a topic in group chats only, and the root pointing at this event's own message
  // is the event being the top of the topic rather than in it.
  const thread =
    !job.posts.direct && root && root !== job.messageRef && inThisChat(job, root) ? root : null

  if (job.messageRef) {
    await larkAsTenant(
      job.posts.cloud,
      `/open-apis/im/v1/messages/${encodeURIComponent(messageIdOf(job.messageRef))}`,
      token,
      'PATCH',
      { content: content(job, thread !== null) },
    )
    return job.messageRef
  }

  if (thread) {
    try {
      return await post(job, token, messageIdOf(thread))
    } catch (e) {
      if (!THREAD_REFUSED.includes(code(e instanceof Error ? e.message : ''))) throw e
    }
  }
  // A topic of its own: the card has no message left to reply to in this chat, or the one it
  // named is not one Lark will post in. Either way this message is the top of what comes next.
  const ref = await post(job, token, null)
  roots.set(card, ref)
  return ref
}

/** The card as it sits: the whole of it at the top of a topic, and where the work stands in a
 *  reply inside one. */
const content = (job: LarkJob, reply: boolean): string =>
  JSON.stringify(reply ? cardFor(job.event, { openId: job.posts.openId }) : cardFor(job.event))

/**
 * A reply inside the root's topic, or a new message in the destination.
 *
 * `reply_in_thread` is what makes the reply a 话题 rather than a quote: a reply to a message
 * already in one joins that topic. Nothing is broadcast to the chat — the reply is heard
 * because it names the account the connection was made under, and a broadcast would put the
 * card's bulk back in the timeline.
 */
async function post(job: LarkJob, token: string, replyTo: string | null): Promise<string> {
  const path = replyTo
    ? `/open-apis/im/v1/messages/${encodeURIComponent(replyTo)}/reply`
    : `/open-apis/im/v1/messages?receive_id_type=${job.posts.direct ? 'open_id' : 'chat_id'}`
  const answer = await larkAsTenant<{ data?: { message_id?: string } }>(
    job.posts.cloud,
    path,
    token,
    'POST',
    replyTo
      ? { msg_type: 'interactive', content: content(job, true), reply_in_thread: true }
      : {
          receive_id: job.posts.destinationId,
          msg_type: 'interactive',
          content: content(job, false),
        },
  )
  const messageId = answer.data?.message_id
  if (!messageId) throw new Error('lark answered without a message id')
  return refFor(job, messageId)
}
