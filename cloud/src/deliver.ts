/**
 * Writing and rewriting the message an event is, for whichever connector owes one.
 *
 * Every message is sent from the Worker, never from the machine holding the board: no chat
 * credential reaches a checkout, and a message keeps moving while that machine is off.
 *
 * One event keeps ONE message per connector however many attempts it takes. The delivery
 * record holds the id the chat answered with, so a message that exists is edited in place —
 * which is also the whole of keeping it in step with the card's newest revision, the decision
 * and the delivery's outcome. What is due is decided in `api.connector_jobs`, by comparing
 * when the event's content last moved against the version its message is showing.
 *
 * Called twice over, like the invitation mail: from the route that wrote the event, through
 * `waitUntil`, so a chat hears about a card in seconds; and from the hourly run, which
 * retries whatever that first attempt did not get out.
 *
 * A connector adds an implementation of the interface below and nothing else — the loop, the
 * attempt counting and the delivery record are one copy for all of them.
 */

import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import type { EventRow } from './events.ts'

/** What one pass wrote. */
export interface DeliveryRun {
  due: number
  sent: number
  failed: number
}

/** One message a connector owes, as `api.connector_jobs` answers it. */
export interface ConnectorJob<Posts> {
  ownerId: string
  eventId: string
  /** When any field of the event last moved, as it was when this job was read — `content_at`,
   *  not `changed_at`: a message follows a quiet refresh too, because an edit in a chat pings
   *  nobody and a message naming the wrong release is one somebody would review from.
   *  Recorded with a message that gets through, so an event that moved while the chat was
   *  answering is still due.
   *
   *  `changedAt` is what a schema older than 0008 calls it. Read both ways round, because a
   *  deploy and a migration do not land together and a version token this echoed back as
   *  NULL would leave every message due forever. */
  contentAt?: string
  changedAt?: string
  /** How this account's connection posts — the connector's own half, opaque to the loop. */
  posts: Posts
  /** The id of the message this event already has, or null when it has none yet. */
  messageRef: string | null
  /** The CARD's own message under this connector, scoped to the destination this connection
   *  posts to now, and null when the card has none yet. Stored per board, task and connector
   *  rather than read back out of a delivery row: a message that follows the card belongs to
   *  no one event (#359). Absent from a schema older than 0013. */
  cardRef?: string | null
  /** The card's NEWEST event, whichever event's delivery is due — what the card's own message
   *  is drawn from, so a redraw aimed at one event never shows a state the card has moved
   *  past. Absent from a schema older than 0013. */
  card?: EventRow
  /** The top of this CARD's thread: the earliest message still recorded for its
   *  `(board_id, task_id)` under this connector, whichever event that message belongs to.
   *  Equal to `messageRef` when this event is the top of the thread rather than in it, and
   *  null when the card has no message left to reply to. The loop does not read it — a
   *  connector that threads does (#352). Slack replies under `cardRef` from #359; Lark reads
   *  this until #360. */
  threadRef?: string | null
  attempts: number
  event: EventRow
}

/** One connector, as the loop needs it. */
export interface Connector<Posts> {
  /** The name deliveries are recorded under, and the name `api.connector_jobs` selects by. */
  name: string
  /** How many messages one pass writes. */
  batch: number
  /** Attempts against one event's delivery record before it is left alone. A message that
   *  gets through resets the count, so this bounds a failing message rather than a busy one. */
  maxAttempts: number
  /** Post it, or edit the one that is already there. Answers the id the message keeps. */
  write(env: Env, job: ConnectorJob<Posts>): Promise<string>
  /** Whether this refusal is one the user has to do something about. */
  needsTheUser(error: string): boolean
  /** Say so where the connection was made, because a message failing into silence reads to
   *  the user as no work waiting. */
  refused(env: Env, ownerId: string, error: string): Promise<unknown>
}

/** Write every message this connector is owed. With an event named, only that one — which is
 *  what a route calls the moment it has written the event. */
export async function deliver<Posts>(
  env: Env,
  connector: Connector<Posts>,
  eventId?: string,
): Promise<DeliveryRun> {
  const jobs = await call<ConnectorJob<Posts>[]>(env, 'connector_jobs', {
    p_connector: connector.name,
    p_event: eventId ?? null,
    p_limit: connector.batch,
    p_max_attempts: connector.maxAttempts,
  })
  if (!jobs || jobs.length === 0) return { due: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const job of jobs) {
    try {
      const ref = await connector.write(env, job)
      await record(env, connector, job, { state: 'sent', ref })
      sent += 1
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error(`cloud: ${connector.name} delivery failed`, { event: job.eventId, error })
      await record(env, connector, job, { state: 'failed', error })
      if (connector.needsTheUser(error)) await connector.refused(env, job.ownerId, error)
      failed += 1
    }
  }
  return { due: jobs.length, sent, failed }
}

/**
 * Where the card's own message is, per board, task and connector (#359).
 *
 * Recorded the moment the chat answers rather than with the event's delivery: a reply that
 * then fails, and a second event of the same card arriving in the same pass, must neither of
 * them cost the card a second message.
 */
export const recordCardMessage = <Posts>(
  env: Env,
  connector: string,
  job: ConnectorJob<Posts>,
  ref: string,
): Promise<unknown> =>
  mutate(env, 'record_card_message', {
    p_subject: job.ownerId,
    p_board: job.event.boardId,
    p_task_id: job.event.taskId,
    p_connector: connector,
    p_external_ref: ref,
  })

/** Where this event's message stands, against that event's own delivery record. */
const record = <Posts>(
  env: Env,
  connector: Connector<Posts>,
  job: ConnectorJob<Posts>,
  outcome: { state: 'sent' | 'failed'; ref?: string; error?: string },
): Promise<unknown> =>
  mutate(env, 'record_event_delivery', {
    p_subject: job.ownerId,
    p_event: job.eventId,
    p_connector: connector.name,
    p_state: outcome.state,
    p_external_ref: outcome.ref ?? null,
    p_last_error: outcome.error ?? '',
    // What the message now shows, not when it was written. The event may have moved while
    // the chat was answering, and that one is still owed a rewrite.
    p_rendered_at: job.contentAt ?? job.changedAt,
  })
