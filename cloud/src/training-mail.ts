/**
 * What a booking sends, and the retry behind it (#683).
 *
 * Same shape as the invitation outbox (`invites.ts`): the route that wrote the booking hands
 * its own send to `waitUntil`, and the hourly run picks up whatever the provider refused. A
 * mail provider having a bad hour costs a retry and never a booking — the hour is held by the
 * row, not by the message about it.
 *
 * A manage link cannot be rebuilt from the database: the token exists only in the message it
 * went out in. So the visitor's confirmation is queued with its link in hand, from the request
 * that minted it, and a retry of that one message reads the link off the same record. What the
 * hourly run can always rebuild is the coach's notice and the cancellation, neither of which
 * carries a token.
 */

import {
  TRAINING_COACH_EMAIL,
  TRAINING_MAIL_BATCH,
  TRAINING_MAIL_FROM,
  TRAINING_MAIL_MAX_ATTEMPTS,
  TRAINING_PAGE_URL,
} from './config.ts'
import { call } from './db.ts'
import type { Env } from './env.ts'
import { sendMail } from './mail.ts'
import { SESSION_MINUTES } from './training-schedule.ts'
import type { ServiceId } from './training-schedule.ts'

/** One message a booking still owes. Everything it needs travels with it. */
interface Queued {
  kind: 'visitor' | 'coach' | 'cancelled' | 'cancelled_coach'
  booking_id: string
  reference: string
  slot_at: string
  service: ServiceId
  price_cents: number
  name: string
  email: string
  timezone: string
  project: string
  state: 'booked' | 'cancelled'
  queued_at: string
}

export interface TrainingMailRun {
  queued: number
  sent: number
  failed: number
}

/**
 * Send everything a booking owes. Called from the booking route through `waitUntil`, and from
 * the hourly run, which is the retry behind it.
 *
 * `manage` is the one thing the run cannot rebuild — the link that went out with a token
 * nothing keeps. The request that minted it passes it here; the hourly run does not have it,
 * so a visitor confirmation it retries points at the page and tells the reader to use the
 * link in their own copy rather than inventing a second one.
 */
export async function sendPendingTrainingMail(
  env: Env,
  manage?: { reference: string; url: string },
): Promise<TrainingMailRun> {
  const queued = await call<Queued[]>(env, 'pending_training_mail', {
    p_limit: TRAINING_MAIL_BATCH,
    p_max_attempts: TRAINING_MAIL_MAX_ATTEMPTS,
  })
  if (queued.length === 0) return { queued: 0, sent: 0, failed: 0 }

  if (!env.RESEND_API_KEY) {
    console.error('cloud: RESEND_API_KEY is not set — no booking mail sent', { queued: queued.length })
    return { queued: queued.length, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  for (const record of queued) {
    const link = manage && manage.reference === record.reference ? manage.url : undefined
    try {
      await sendMail(env, message(record, link))
      await call(env, 'mark_training_mail_sent', { p_booking: record.booking_id, p_kind: record.kind })
      sent += 1
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      // The reference and the kind, and nothing a person wrote.
      console.error('cloud: booking mail failed', { kind: record.kind, reference: record.reference, error })
      await call(env, 'mark_training_mail_failed', {
        p_booking: record.booking_id,
        p_kind: record.kind,
        p_error: error,
      })
      failed += 1
    }
  }
  return { queued: queued.length, sent, failed }
}

// --- the four messages --------------------------------------------------------

function message(record: Queued, manageLink?: string) {
  if (record.kind === 'coach') return coachNotice(record)
  if (record.kind === 'cancelled') return cancelled(record)
  if (record.kind === 'cancelled_coach') return cancelledCoachNotice(record)
  return confirmation(record, manageLink)
}

/** Both messages are written in the visitor's own zone. The coach's UTC+8 clock appears in
 *  neither: it is how the schedule is kept, not how an appointment is read. */
function whenLine(record: Queued): string {
  const at = new Date(record.slot_at)
  const ends = new Date(at.getTime() + SESSION_MINUTES * 60_000)
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: record.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(at)
  const clock = (value: Date) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: record.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(value)
  return `${day}, ${clock(at)}–${clock(ends)} (${record.timezone})`
}

const SERVICE_NAMES: Record<ServiceId, string> = {
  single: 'One 60-minute session',
  monthly: 'Monthly guidance — one session a week, four in the month',
}

const money = (cents: number) => `$${(cents / 100).toFixed(0)}`

/** The visitor's copy: what was booked, when, in their own words, and the link that is the
 *  only way to cancel it. It never says the coach has read it — only that the booking is held. */
function confirmation(record: Queued, manageLink?: string) {
  const manage = manageLink
    ? ['Need to cancel or move it? Use this link — it is the only one that opens your booking:', '', `    ${manageLink}`]
    : [
        'Need to cancel or move it? Use the manage link in the first copy of this message.',
        `If you no longer have it, reply here and we will sort it out. — ${TRAINING_COACH_EMAIL}`,
      ]

  return {
    from: TRAINING_MAIL_FROM,
    to: record.email,
    replyTo: TRAINING_COACH_EMAIL,
    subject: `Your AI4Kanban training session — ${whenLine(record)}`,
    text: [
      `Your session is booked. Reference ${record.reference}.`,
      '',
      `    Session    ${SERVICE_NAMES[record.service]}`,
      `    Price      ${money(record.price_cents)}`,
      `    When       ${whenLine(record)}`,
      '',
      'Tao will email you before it starts with the meeting link. There is nothing to install',
      'and nothing to pay online — payment is arranged in that email.',
      '',
      ...manage,
      '',
      `The page you booked from: ${TRAINING_PAGE_URL}`,
    ].join('\n'),
  }
}

/** The coach's copy. This is the one message that carries the project note, and it goes to one
 *  address we control. */
function coachNotice(record: Queued) {
  return {
    from: TRAINING_MAIL_FROM,
    to: TRAINING_COACH_EMAIL,
    replyTo: record.email,
    subject: `Training booked: ${record.reference} — ${whenLine(record)}`,
    text: [
      `${record.name} booked a session.`,
      '',
      `    Reference  ${record.reference}`,
      `    Session    ${SERVICE_NAMES[record.service]}`,
      `    Price      ${money(record.price_cents)}`,
      `    When       ${whenLine(record)}`,
      `    Their zone ${record.timezone}`,
      `    Email      ${record.email}`,
      '',
      'What they are working on:',
      '',
      record.project || '(they left it blank)',
      '',
      'Replying to this message answers them directly.',
    ].join('\n'),
  }
}

/** The coach's copy of a cancellation — an hour they had put aside is theirs again, and they
 *  find out from us rather than from an empty call. */
function cancelledCoachNotice(record: Queued) {
  return {
    from: TRAINING_MAIL_FROM,
    to: TRAINING_COACH_EMAIL,
    replyTo: record.email,
    subject: `Cancelled: training ${record.reference} — ${whenLine(record)}`,
    text: [
      `${record.name} cancelled ${record.reference}.`,
      '',
      `    When       ${whenLine(record)}`,
      `    Email      ${record.email}`,
      '',
      'That hour is open on the page again.',
    ].join('\n'),
  }
}

/** Confirming a cancellation to the person who made it. No link: there is nothing left to
 *  manage, and the hour is open again. */
function cancelled(record: Queued) {
  return {
    from: TRAINING_MAIL_FROM,
    to: record.email,
    replyTo: TRAINING_COACH_EMAIL,
    subject: `Cancelled: AI4Kanban training ${record.reference}`,
    text: [
      `Your session on ${whenLine(record)} is cancelled, and that hour is open again.`,
      '',
      `Book another one whenever you are ready: ${TRAINING_PAGE_URL}`,
    ].join('\n'),
  }
}
