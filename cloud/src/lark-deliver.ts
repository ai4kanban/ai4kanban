/**
 * Lark's half of the delivery loop (#351).
 *
 * The loop, the attempt counting and the delivery record are ./deliver.ts's, shared with
 * Slack. What is Lark's is here: the token a message goes out on, which call posts a card,
 * which one edits it, and which of Lark's own codes mean the user has to do something.
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

export const LARK: Connector<LarkPosts> = {
  name: 'lark',
  batch: LARK_BATCH,
  maxAttempts: LARK_MAX_ATTEMPTS,
  write,
  needsTheUser: (error) => NEEDS_THE_USER.includes(error.split(':')[0] ?? ''),
  refused: (env, ownerId, error) => larkRefused(env, ownerId, error),
}

/** Write every Lark message that is owed. With an event named, only that one. */
export const deliverLark = (env: Env, eventId?: string): Promise<DeliveryRun> =>
  deliver(env, LARK, eventId)

/**
 * Post it, or edit the one that is already there.
 *
 * One event keeps one message: a card that exists is patched in place, which is also the
 * whole of keeping it in step with the newest revision, the decision and the outcome. A patch
 * that fails is retried rather than posted again — Lark has no one code for "that message is
 * gone", and re-posting on a code we guessed at would leave a chat with two cards for one
 * task.
 */
async function write(env: Env, job: LarkJob): Promise<string> {
  const token = await tenantToken(env, job.posts.cloud, job.posts.tenantKey)
  const content = JSON.stringify(cardFor(job.event))

  if (job.messageRef) {
    await larkAsTenant(
      job.posts.cloud,
      `/open-apis/im/v1/messages/${encodeURIComponent(job.messageRef)}`,
      token,
      'PATCH',
      { content },
    )
    return job.messageRef
  }

  const receiveIdType = job.posts.direct ? 'open_id' : 'chat_id'
  const answer = await larkAsTenant<{ data?: { message_id?: string } }>(
    job.posts.cloud,
    `/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    token,
    'POST',
    { receive_id: job.posts.destinationId, msg_type: 'interactive', content },
  )
  const messageId = answer.data?.message_id
  if (!messageId) throw new Error('lark answered without a message id')
  return messageId
}
