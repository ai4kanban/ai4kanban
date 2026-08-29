/**
 * The invitation loop's two moving parts on the Worker's side (#327, #350): the one route a
 * not-yet-admitted sign-in may call, and the hourly run's outbox.
 *
 * Nothing about asking for an invite waits on mail: the route records the request, hands the
 * send to `waitUntil` and returns. The hourly run is the retry behind that — for a send the
 * provider refused, and for an approval written in the SQL editor, where no Worker is in
 * flight to send it. So a mail provider having a bad hour costs a retry, never a request,
 * and never an admission: approving admits the account there and then, and the message only
 * carries the news.
 */

import { MAIL_BATCH, MAIL_MAX_ATTEMPTS, SUPPORT_EMAIL } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { noVerifiedAddress, notAdmitted, serviceUnavailable } from './errors.ts'
import { sendMail } from './mail.ts'

/** What `api.request_invite` answers with. A refusal is a reason, not a raised exception. */
interface Outcome {
  ok: boolean
  reason?: string
  requested_at?: string
}

/**
 * Record that this account asked for an invite. Pressing again returns the request already
 * open — no second row, and a notice already sent is never picked up again.
 */
export async function requestInvite(env: Env, subject: string): Promise<string> {
  const outcome = await mutate<Outcome>(env, 'request_invite', { p_subject: subject })
  if (!outcome.ok) throw refusalFor(outcome.reason)
  if (!outcome.requested_at) throw serviceUnavailable()
  return outcome.requested_at
}

function refusalFor(reason: string | undefined) {
  // Signed in through something other than GitHub, so there is no attested handle. The same
  // refusal the session gives.
  return reason === 'no_address' ? noVerifiedAddress() : notAdmitted()
}

// --- the outbox ---------------------------------------------------------------

interface Queued {
  /** The notice that somebody asked, or the news that we let them in. One request row can be
   *  queued as both, and this is what tells the two apart through to the mark. */
  kind: 'request' | 'approval'
  /** The request's id, which names the record when it is marked. */
  ref: string
  email: string
  handle: string | null
  queued_at: string
}

export interface MailRun {
  /** What this run picked up. A full batch means there is more waiting for the next one. */
  queued: number
  sent: number
  failed: number
}

/**
 * Send everything queued: the notices that somebody asked, and the news that we approved
 * them.
 *
 * Called twice over: from the route that wrote the row, through `waitUntil`, and from the
 * hourly run, which retries whatever that first attempt did not get out.
 *
 * Each record is marked sent the moment the provider accepts it, and one already marked is
 * never picked up. A crash between the send and the mark can repeat one message, which tells
 * the reader what they were already told.
 */
export async function sendPendingMail(env: Env): Promise<MailRun> {
  const queued = await call<Queued[]>(env, 'pending_mail', {
    p_limit: MAIL_BATCH,
    p_max_attempts: MAIL_MAX_ATTEMPTS,
  })
  if (queued.length === 0) return { queued: 0, sent: 0, failed: 0 }

  if (!env.RESEND_API_KEY) {
    console.error('cloud: RESEND_API_KEY is not set — nothing sent', { queued: queued.length })
    return { queued: queued.length, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  for (const record of queued) {
    try {
      await sendMail(env, message(record))
      await call(env, 'mark_mail_sent', { p_kind: record.kind, p_ref: record.ref })
      sent += 1
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error('cloud: send failed', { kind: record.kind, ref: record.ref, error })
      await call(env, 'mark_mail_failed', {
        p_kind: record.kind,
        p_ref: record.ref,
        p_error: error,
      })
      failed += 1
    }
  }
  return { queued: queued.length, sent, failed }
}

function message(record: Queued) {
  return record.kind === 'approval' ? approval(record) : requestNotice(record)
}

/** They are in, and where to go. Replying reaches the mailbox a person reads. */
function approval(record: Queued) {
  return {
    to: record.email,
    subject: 'You are in the AI4Kanban Cloud preview',
    text: [
      'Your request to join the AI4Kanban Cloud preview has been approved. Your account is in —',
      'there is nothing to paste and nothing more to do.',
      '',
      'Open AI4Kanban and go to Configuration → Notifications. If you are already signed in,',
      'the pane says you are in the next time you open it.',
      '',
      'Cloud carries the moments your board needs you — a card ready for review, a question only',
      'you can answer — to your desktop and to Slack, and your own machine still does the work.',
      'What it is, and what it holds: https://ai4kanban.dev/cloud',
      '',
      `Reply to this message if anything is in the way. — ${SUPPORT_EMAIL}`,
    ].join('\n'),
  }
}

/** Somebody asked. The requester is the reply address, so answering by hand is a reply. */
function requestNotice(record: Queued) {
  const handle = record.handle ?? 'someone'
  return {
    to: SUPPORT_EMAIL,
    replyTo: record.email,
    subject: `AI4Kanban Cloud: invite request from @${handle}`,
    text: [
      `@${handle} asked for an AI4Kanban Cloud invite.`,
      '',
      `    handle   @${handle}`,
      `    email    ${record.email}`,
      `    asked    ${record.queued_at}`,
      '',
      'Approving admits the account there and then and queues the message telling them so,',
      `for the next hourly run. From a checkout: \`npm run invite approve ${handle}\` in cloud/.`,
      'By hand, in the project’s SQL editor:',
      '',
      `    select cloud.approve_invite_request('${handle}');`,
      '',
      'Replying to this message answers the requester directly.',
    ].join('\n'),
  }
}
