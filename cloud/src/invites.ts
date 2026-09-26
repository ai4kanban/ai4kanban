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

/** The app labels the approval names. A test holds them to `kanban-ui/i18n/configuration/en.ts`. */
export const APP_LABELS = {
  configuration: 'Configuration',
  cloud: 'Cloud',
  signIn: 'Sign in with GitHub',
}

const SET_UP_URL = 'https://ai4kanban.dev/cloud'
const ABOUT =
  'Cloud notifies you on your desktop and in Slack when your board needs a decision, so you can step away without leaving your agents waiting.'

/** They are in, and the one thing to do next. The button goes to the web: mail clients drop
 *  `ai4kanban://` links. */
function approval(record: Queued) {
  const { configuration, cloud, signIn } = APP_LABELS
  const path = `${configuration} → ${cloud}`
  const already = 'Already signed in? The pane shows you’re in next time you open it.'
  return {
    to: record.email,
    subject: 'You’re in the AI4Kanban Cloud preview',
    text: [
      `Open AI4Kanban, go to ${path}, and click ${signIn}.`,
      already,
      '',
      `Set up Cloud: ${SET_UP_URL}`,
      '',
      ABOUT,
    ].join('\n'),
    html: [
      '<!doctype html><html lang="en"><body style="margin:0;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#24231f">',
      '<div style="max-width:520px;margin:0 auto">',
      '<h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">You’re in the Cloud preview</h1>',
      `<p style="font-size:17px;line-height:1.55;margin:0 0 24px">Open AI4Kanban, go to <b>${path}</b>, and click <b>${signIn}</b>. ${already}</p>`,
      `<a href="${SET_UP_URL}" style="display:inline-block;background:#dd4f1e;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:6px">Set up Cloud</a>`,
      `<p style="font-size:14px;line-height:1.6;color:#635a4e;margin:28px 0 0">${ABOUT}</p>`,
      '</div></body></html>',
    ].join(''),
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
