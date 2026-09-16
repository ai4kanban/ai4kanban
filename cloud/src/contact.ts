/**
 * The site's contact form (#784): a visitor with no account sends a message, and it is mailed
 * to support with the sender as its reply-to. The row is written first; the send goes out
 * through `waitUntil`, and the hourly run retries whatever the provider refused.
 *
 * No captcha. The submit is bounded by two rate-limit keys counted apart — the visitor's
 * address and the sender email, both salted and hashed — and either one past the limit
 * refuses it.
 *
 * Nothing here logs an address or what somebody wrote.
 */

import {
  CONTACT_ATTEMPT_LIMIT,
  CONTACT_ATTEMPT_SALT,
  CONTACT_ATTEMPT_WINDOW_SECONDS,
  CONTACT_MAIL_BATCH,
  CONTACT_MAIL_FROM,
  CONTACT_MAIL_MAX_ATTEMPTS,
  CONTACT_MAX_MESSAGE,
  CONTACT_MAX_WORKFLOW,
  SUPPORT_EMAIL,
} from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { Refusal, badRequest, contactTooManyAttempts } from './errors.ts'
import { bodyOf, json, requireMethod } from './http.ts'
import { MAX_NAME, shortName } from './input.ts'
import { sendMail } from './mail.ts'
import { sha256Hex } from './training.ts'

export type ContactReason = 'support' | 'customize'

export const isContactPath = (pathname: string) => /^\/v1\/contact\/?$/.test(pathname)

/** What the page shows once a message is in. */
export const CONTACT_RECEIVED = 'Thanks — your message is in. We will reply to your email.'

export async function routeContact(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  requireMethod(request, 'POST')
  await submit(env, request, await bodyOf(request))
  ctx.waitUntil(sendPendingContactMail(env).catch((e) => console.error('cloud: contact mail failed', e)))
  return json({ received: true, message: CONTACT_RECEIVED })
}

async function submit(env: Env, request: Request, body: unknown): Promise<void> {
  const held = (body ?? {}) as Record<string, unknown>

  const opId = shortName(held.opId)
  if (!opId) throw badRequest('That submission carries no id, so a retry could not be told apart.')

  const reason = held.reason
  if (reason !== 'support' && reason !== 'customize') throw badRequest('Choose what you are writing about.')

  const email = emailOf(held.email)
  const message = textOf(held.message, CONTACT_MAX_MESSAGE, 'Write a message.')
  const workflow =
    reason === 'customize' ? textOf(held.workflow, CONTACT_MAX_WORKFLOW, 'Describe the workflow you want.') : ''

  const address = request.headers.get('cf-connecting-ip') ?? ''
  try {
    await mutate(env, 'submit_contact', {
      p_op_id: opId,
      p_reason: reason,
      p_email: email,
      p_message: message,
      p_workflow: workflow,
      // No address, no key: the database skips an empty one, so the email alone counts.
      p_ip_key: address ? await attemptKey('ip', address) : '',
      p_email_key: await attemptKey('email', email.toLowerCase()),
      p_attempt_window_seconds: CONTACT_ATTEMPT_WINDOW_SECONDS,
      p_attempt_limit: CONTACT_ATTEMPT_LIMIT,
    })
  } catch (e) {
    // The counter is the booking page's; its refusal is not this page's words.
    if (e instanceof Refusal && e.code === 'training_too_many_attempts') throw contactTooManyAttempts()
    throw e
  }
}

function emailOf(value: unknown): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (held.length > MAX_NAME || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(held)) {
    throw badRequest('That email address does not look like one. Our reply goes there.')
  }
  return held
}

/** Required prose, refused rather than cut when too long — a cut message loses its end. */
function textOf(value: unknown, max: number, missing: string): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (!held) throw badRequest(missing)
  if (held.length > max) throw badRequest(`That is longer than ${max} characters. Shorten it, or email us at ${SUPPORT_EMAIL}.`)
  return held
}

async function attemptKey(kind: 'ip' | 'email', value: string): Promise<string> {
  return `contact:${(await sha256Hex(`${CONTACT_ATTEMPT_SALT}:${kind}:${value}`)).slice(0, 32)}`
}

// --- the outbox ---------------------------------------------------------------

interface Queued {
  id: string
  reason: ContactReason
  email: string
  message: string
  workflow: string
  created_at: string
}

export interface ContactMailRun {
  queued: number
  sent: number
  failed: number
}

export async function sendPendingContactMail(env: Env): Promise<ContactMailRun> {
  const queued = await call<Queued[]>(env, 'pending_contact_mail', {
    p_limit: CONTACT_MAIL_BATCH,
    p_max_attempts: CONTACT_MAIL_MAX_ATTEMPTS,
  })
  if (queued.length === 0) return { queued: 0, sent: 0, failed: 0 }

  if (!env.RESEND_API_KEY) {
    console.error('cloud: RESEND_API_KEY is not set — no contact mail sent', { queued: queued.length })
    return { queued: queued.length, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  for (const record of queued) {
    try {
      await sendMail(env, notice(record))
      await call(env, 'mark_contact_mail_sent', { p_id: record.id })
      sent += 1
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error('cloud: contact mail failed', { id: record.id, error })
      await call(env, 'mark_contact_mail_failed', { p_id: record.id, p_error: error })
      failed += 1
    }
  }
  return { queued: queued.length, sent, failed }
}

const REASONS: Record<ContactReason, string> = {
  support: 'Support',
  customize: 'Customize agents',
}

function notice(record: Queued) {
  const firstLine = record.message.split('\n')[0]?.trim() ?? ''
  const subject = firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine
  return {
    from: CONTACT_MAIL_FROM,
    to: SUPPORT_EMAIL,
    replyTo: record.email,
    subject: `[${REASONS[record.reason]}] ${subject}`,
    text: [
      `${REASONS[record.reason]} request from ${record.email}`,
      '',
      record.message,
      ...(record.workflow ? ['', 'Their workflow:', '', record.workflow] : []),
      '',
      'Replying to this message answers them directly.',
    ].join('\n'),
  }
}
