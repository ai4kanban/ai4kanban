/**
 * The one message a scope change sends (#451).
 *
 * Moving `Configuration → Cloud → Watching` brings cards into view that were ALREADY waiting.
 * They land in the bell read and raise nothing, and every connector is told to owe them no
 * new message — so what the switch is worth saying in a chat is said once: what is watched
 * now, and how many cards that turned out to be.
 *
 * It belongs to no card, so it is not an event and takes none of the delivery loop in
 * ./deliver.ts: there is no message to edit later, no thread to join and nothing to redraw.
 * It is addressed to the account that moved the switch and posted to that account's own
 * connections, exactly once.
 *
 * Best effort, deliberately. It acknowledges a click whose result the user can already see in
 * the bell, so a copy that never reaches a chat is worth less than the retry machinery it
 * would take to guarantee. `op_id` is the whole of what stops a machine that never heard the
 * answer posting a second one.
 */

import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest } from './errors.ts'
import { larkAsTenant, tenantToken, type LarkPosts } from './lark.ts'
import { watchSummaryFor as larkSummary } from './lark-message.ts'
import type { WatchSummary } from './message.ts'
import { slackApi } from './slack.ts'
import { watchSummaryFor as slackSummary } from './slack-message.ts'
import type { Owner } from './owner.ts'

/** What the route answers, and what a delivery is written from. `posted` is false on a retry
 *  of an attempt that already landed — nothing is sent for one. */
export interface RecordedSummary extends WatchSummary {
  summaryId: string
  posted: boolean
}

/** Where one account's summary goes. The same `posts` shapes `api.connector_jobs` hands a
 *  delivery, so the two ways a message reaches a chat read the same. */
type Target =
  | { connector: 'slack'; posts: { botToken: string; channelId: string } }
  | { connector: 'lark'; posts: LarkPosts }

/** Write the switch down, and say whether this attempt is the one that wrote it. */
export async function recordWatchSummary(
  env: Env,
  owner: Owner,
  body: unknown,
): Promise<RecordedSummary> {
  const input = (body ?? {}) as Record<string, unknown>
  const cards = Number(input.cards)
  if (!Number.isInteger(cards) || cards < 1) throw badRequest('That switch brought no card in.')
  const watching = typeof input.watching === 'string' ? input.watching.trim() : ''
  if (!watching) throw badRequest('That summary names no watched scope.')

  const recorded = await mutate<RecordedSummary | null>(env, 'record_watch_summary', {
    p_subject: owner.accountId,
    p_op_id: text(input.opId, 'attempt id'),
    p_board: uuid(input.boardId),
    p_watching: watching.slice(0, 100),
    p_cards: cards,
  })
  // A board Cloud has never heard of has no summary to send. The publisher registers the
  // board on the same pass, so this is a request that arrived out of order — refused, and
  // dropped rather than retried for ever.
  if (!recorded) throw badRequest('That summary names no board.')
  return recorded
}

/** Post it to every destination this account has connected, one message each. Each failure
 *  is logged and the next destination is still tried: a chat that refused us must not cost
 *  the other one its copy. */
export async function deliverWatchSummary(env: Env, owner: Owner, summary: RecordedSummary): Promise<void> {
  const targets = (await call<Target[]>(env, 'watch_summary_targets', { p_subject: owner.accountId })) ?? []
  for (const target of targets) {
    try {
      if (target.connector === 'slack') await postToSlack(target.posts, summary)
      else await postToLark(env, target.posts, summary)
    } catch (e) {
      console.error('cloud: watch summary failed', {
        connector: target.connector,
        summary: summary.summaryId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
}

const postToSlack = (
  posts: { botToken: string; channelId: string },
  summary: WatchSummary,
): Promise<unknown> =>
  slackApi(posts.botToken, 'chat.postMessage', {
    channel: posts.channelId,
    ...slackSummary(summary),
  })

async function postToLark(env: Env, posts: LarkPosts, summary: WatchSummary): Promise<void> {
  const token = await tenantToken(env, posts.cloud, posts.tenantKey)
  await larkAsTenant(
    posts.cloud,
    `/open-apis/im/v1/messages?receive_id_type=${posts.direct ? 'open_id' : 'chat_id'}`,
    token,
    'POST',
    {
      receive_id: posts.destinationId,
      msg_type: 'interactive',
      content: JSON.stringify(larkSummary(summary)),
    },
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuid(value: unknown): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (!UUID.test(held)) throw badRequest('That summary names no board.')
  return held
}

function text(value: unknown, what: string): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (!held) throw badRequest(`That request carries no ${what}.`)
  return held.slice(0, 200)
}
