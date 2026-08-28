/**
 * The invitation loop's two moving parts on the Worker's side (#327): the routes a
 * not-yet-admitted sign-in may call, and the hourly run's outbox.
 *
 * Nothing about asking for an invite waits on mail: the route records the request, hands the
 * send to `waitUntil` and returns. The hourly run is the retry behind that — for a send the
 * provider refused, and for a code approved in the SQL editor, where no Worker is in flight
 * to send it. So a mail provider having a bad hour costs a retry, never a request.
 */

import { MAIL_BATCH, MAIL_MAX_ATTEMPTS, SUPPORT_EMAIL } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import {
  invitationRedeemed,
  invitationUnknown,
  invitationWithdrawn,
  noVerifiedAddress,
  notAdmitted,
  serviceUnavailable,
} from './errors.ts'
import { sendMail } from './mail.ts'

/** What `api.request_invite` and `api.redeem_invitation` answer with. A refusal is a reason,
 *  not a raised exception, so a code that does not match writes nothing at all. */
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

/** Spend a code on this account. One code, one account, admitted for good. */
export async function redeemInvitation(env: Env, subject: string, code: string): Promise<void> {
  const outcome = await mutate<Outcome>(env, 'redeem_invitation', {
    p_subject: subject,
    p_code: code,
  })
  if (!outcome.ok) throw refusalFor(outcome.reason)
}

function refusalFor(reason: string | undefined) {
  switch (reason) {
    case 'unknown':
      return invitationUnknown()
    case 'redeemed':
      return invitationRedeemed()
    case 'withdrawn':
      return invitationWithdrawn()
    case 'no_address':
      return noVerifiedAddress()
    // Signed in through something other than GitHub, so there is no attested handle. The
    // same refusal the session gives.
    default:
      return notAdmitted()
  }
}

// --- the outbox ---------------------------------------------------------------

interface Queued {
  kind: 'request' | 'invitation'
  /** What names this record when it is marked: the request's id, or the code. */
  ref: string
  email: string
  handle: string | null
  code: string | null
  queued_at: string
}

export interface MailRun {
  /** What this run picked up. A full batch means there is more waiting for the next one. */
  queued: number
  sent: number
  failed: number
}

/**
 * Send everything queued: the notices that somebody asked, and the codes that answer them.
 *
 * Called twice over: from the route that wrote the row, through `waitUntil`, and from the
 * hourly run, which retries whatever that first attempt did not get out.
 *
 * Each record is marked sent the moment the provider accepts it, and one already marked is
 * never picked up. A crash between the send and the mark can repeat one message, which
 * carries the same code and admits nothing extra — the tradeoff that keeps a code from
 * being lost instead.
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
  return record.kind === 'invitation' ? invitation(record) : requestNotice(record)
}

/** The code, and what to do with it. Replying reaches the mailbox a person reads. */
function invitation(record: Queued) {
  const code = record.code ?? record.ref
  return {
    to: record.email,
    subject: 'Your AI4Kanban Cloud invitation code',
    text: [
      'You have been invited to the AI4Kanban Cloud preview. Your code is:',
      '',
      `    ${code}`,
      '',
      'Open AI4Kanban, go to Configuration → Notifications, sign in with GitHub, and paste the code',
      'there. It admits one account — whichever signs in and redeems it first — and admits it',
      'for good.',
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
      'Approve it in the project’s SQL editor, which issues the code and queues it for the',
      'next hourly run:',
      '',
      `    select cloud.approve_invite_request('${handle}');`,
      '',
      'Replying to this message answers the requester directly.',
    ].join('\n'),
  }
}
