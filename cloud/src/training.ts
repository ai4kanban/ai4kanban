/**
 * Booking an hour of training from the public site (#683).
 *
 * Every other route on this service is behind an admitted Cloud account. These four are not:
 * the person booking has no account, no sign-in and no reason to want one. So the proof each
 * one carries is what it can afford to carry —
 *
 *   availability   nothing. It answers with instants and no more, so there is nothing in the
 *                  answer to protect.
 *   book           nothing to read, everything to write. It is bounded instead: a fingerprint
 *                  rate limit, a re-check of the hour against the deployed schedule, a price
 *                  the server settles, and an atomic hold in the database.
 *   read / cancel  the unguessable token that went out in the confirmation email. Holding it
 *                  is the whole of the authorization, and it reaches exactly one booking.
 *
 * And one that is: the operator's list, behind an admitted account whose handle is named in
 * `TRAINING_OPERATORS`. Being in the Cloud preview is not being the coach.
 *
 * Nothing here logs a name, an address or a project note.
 */

import {
  TRAINING_ALLOWED_ORIGINS,
  TRAINING_ATTEMPT_LIMIT,
  TRAINING_ATTEMPT_SALT,
  TRAINING_ATTEMPT_WINDOW_SECONDS,
  TRAINING_MAX_PROJECT,
  TRAINING_MAX_WINDOW_DAYS,
  TRAINING_OPERATORS,
  TRAINING_PAGE_URL,
} from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, notFound, notYours, trainingSlotTaken } from './errors.ts'
import { bodyOf, json, requireMethod } from './http.ts'
import { MAX_NAME, shortName } from './input.ts'
import { requireOwner } from './owner.ts'
import { sendPendingTrainingMail } from './training-mail.ts'
import { SERVICES, availability, isScheduled, isServiceId, SESSION_MINUTES } from './training-schedule.ts'
import type { ServiceId } from './training-schedule.ts'

/** What a booking looks like to whoever is allowed to see it. */
export interface Booking {
  reference: string
  slot_at: string
  service: ServiceId
  price_cents: number
  name: string
  email: string
  timezone: string
  project: string
  state: 'booked' | 'cancelled'
  created_at: string
  cancelled_at: string | null
}

// --- CORS ---------------------------------------------------------------------

/**
 * The one place on this service that answers a browser from another origin. The header is
 * echoed only for an origin we publish the page on: a request from anywhere else is still
 * served, and the browser that made it is still not allowed to read the answer.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  if (!origin || !TRAINING_ALLOWED_ORIGINS.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

/** Whether this path is one of the booking routes — what tells `index.ts` to put the CORS
 *  headers on the answer, refusals included. */
export const isTrainingPath = (pathname: string) => pathname.startsWith('/v1/training')

// --- the routes ---------------------------------------------------------------

export async function routeTraining(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  rest: string,
): Promise<Response> {
  const url = new URL(request.url)

  if (rest === 'availability') {
    requireMethod(request, 'GET')
    return json(await readAvailability(env, url))
  }

  if (rest === 'bookings') {
    requireMethod(request, 'POST')
    const booked = await book(env, request, await bodyOf(request))
    // The row is written and the hour is held; the message is a second round trip. The manage
    // link travels with the send because it is the one thing the hourly retry cannot rebuild —
    // its token is minted here and stored nowhere.
    mail(env, ctx, { reference: booked.manage.reference, url: booked.manage.url })
    return json(booked)
  }

  // The operator's own read. Named before the reference matcher below so `records` can never
  // be mistaken for somebody's booking reference.
  if (rest === 'records') {
    requireMethod(request, 'GET')
    return json(await listRecords(env, request, url))
  }

  const booking = /^bookings\/([A-Za-z0-9-]{1,32})(?:\/(cancel))?$/.exec(rest)
  if (booking) {
    const [, reference = '', move] = booking
    if (move === 'cancel') {
      requireMethod(request, 'POST')
      const cancelled = await cancel(env, reference, await bodyOf(request))
      mail(env, ctx)
      return json(cancelled)
    }
    requireMethod(request, 'GET')
    return json(await readOne(env, reference, url.searchParams.get('token')))
  }

  throw notFound()
}

/**
 * The hours in a window, each open or already taken.
 *
 * The window is the visitor's own current week, sent as two instants — the page works out
 * where its week starts, because only the browser knows the zone it is being read in. The
 * server bounds how wide that window may be and answers with absolute instants, so the
 * projection back to a local weekday and hour happens in one place, on the page.
 */
async function readAvailability(env: Env, url: URL): Promise<{ slots: ReturnType<typeof availability>; sessionMinutes: number }> {
  const from = instant(url.searchParams.get('from'), 'from')
  const to = instant(url.searchParams.get('to'), 'to')
  if (to <= from) throw badRequest('That request asks for an empty week.')
  if (to.getTime() - from.getTime() > TRAINING_MAX_WINDOW_DAYS * 86400_000) {
    throw badRequest('That request asks for more than a couple of weeks at once.')
  }

  const booked = await call<string[]>(env, 'training_booked_slots', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })

  return { slots: availability(from, to, booked, new Date()), sessionMinutes: SESSION_MINUTES }
}

/** What a submit is answered with: the booking, and the one copy of the manage token that
 *  will ever exist outside the visitor's own mailbox. */
export interface Booked {
  booking: Booking
  manage: { reference: string; token: string; url: string }
}

async function book(env: Env, request: Request, body: unknown): Promise<Booked> {
  const held = (body ?? {}) as Record<string, unknown>

  const opId = shortName(held.opId)
  if (!opId) throw badRequest('That submission carries no id, so a retry could not be told apart.')

  const service = held.service
  if (!isServiceId(service)) throw badRequest('Choose which session you are booking.')

  const slotAt = instant(held.slotAt, 'hour')
  // The schedule is deployed configuration, and a form left open across a deploy may name an
  // hour it no longer offers. Re-checked here rather than trusted from the page.
  if (!isScheduled(slotAt)) throw trainingSlotTaken()
  if (slotAt.getTime() <= Date.now()) throw trainingSlotTaken()

  const name = shortName(held.name)
  if (!name) throw badRequest('Add a name so the coach knows who is coming.')

  const email = emailOf(held.email)
  const timezone = timezoneOf(held.timezone)
  const project = typeof held.project === 'string' ? held.project.trim().slice(0, TRAINING_MAX_PROJECT) : ''

  // Minted here and never stored: the database keeps its SHA-256, so a copy of the table is
  // not a set of working links.
  const token = manageToken()

  const booking = await mutate<Booking>(env, 'book_training', {
    p_op_id: opId,
    p_slot_at: slotAt.toISOString(),
    p_service: service,
    // The server's own price list. A form that sends one is ignored.
    p_price_cents: SERVICES[service].priceCents,
    p_name: name,
    p_email: email,
    p_timezone: timezone,
    p_project: project,
    p_manage_token_hash: await sha256Hex(token),
    p_fingerprint: await fingerprint(request),
    p_attempt_window_seconds: TRAINING_ATTEMPT_WINDOW_SECONDS,
    p_attempt_limit: TRAINING_ATTEMPT_LIMIT,
  })

  return { booking, manage: { reference: booking.reference, token, url: manageUrl(booking.reference, token) } }
}

/** One booking, to whoever holds its token. A wrong reference and a wrong token are the same
 *  404, so the pair cannot be used to find out which references exist. */
async function readOne(env: Env, reference: string, token: string | null): Promise<{ booking: Booking }> {
  const booking = await call<Booking | null>(env, 'read_training_booking', {
    p_reference: reference,
    p_manage_token_hash: await sha256Hex(shortName(token)),
  })
  if (!booking) throw notFound('No booking answers that link.')
  return { booking }
}

async function cancel(env: Env, reference: string, body: unknown): Promise<{ booking: Booking }> {
  const held = (body ?? {}) as Record<string, unknown>
  const booking = await mutate<Booking | null>(env, 'cancel_training_booking', {
    p_reference: reference,
    p_manage_token_hash: await sha256Hex(shortName(held.token)),
  })
  if (!booking) throw notFound('No booking answers that link.')
  return { booking }
}

/** Every booking in a window, in full, to the coach. */
async function listRecords(env: Env, request: Request, url: URL): Promise<{ bookings: Booking[] }> {
  const owner = await requireOwner(request, env)
  if (!TRAINING_OPERATORS.includes(owner.handle)) throw notYours()

  const from = instant(url.searchParams.get('from') ?? new Date().toISOString(), 'from')
  const to = instant(
    url.searchParams.get('to') ?? new Date(Date.now() + 90 * 86400_000).toISOString(),
    'to',
  )
  return { bookings: await call<Booking[]>(env, 'list_training_bookings', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  }) }
}

/** Send what this booking now owes, off the response. The hourly run is the retry behind it. */
function mail(env: Env, ctx: ExecutionContext, manage?: { reference: string; url: string }): void {
  ctx.waitUntil(
    sendPendingTrainingMail(env, manage).catch((e) => console.error('cloud: booking mail failed', e)),
  )
}

// --- taking a request apart ---------------------------------------------------

function instant(value: unknown, what: string): Date {
  const held = typeof value === 'string' ? value.trim() : ''
  const at = held ? new Date(held) : new Date(Number.NaN)
  if (Number.isNaN(at.getTime())) throw badRequest(`That request names no ${what}.`)
  return at
}

/** An address is checked for shape and nothing more. Whether it receives mail is answered by
 *  sending to it, which is what the confirmation does. */
function emailOf(value: unknown): string {
  const held = typeof value === 'string' ? value.trim().slice(0, MAX_NAME) : ''
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(held)) {
    throw badRequest('That email address does not look like one. The confirmation goes there.')
  }
  return held
}

/** The IANA zone the page was read in. Checked against the runtime's own zone table rather
 *  than a pattern, so what is stored is a zone a later message can format in. */
function timezoneOf(value: unknown): string {
  const held = typeof value === 'string' ? value.trim().slice(0, MAX_NAME) : ''
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: held })
    return held
  } catch {
    throw badRequest('That request names no timezone, so the confirmation could not say when.')
  }
}

/** 32 bytes of randomness, hex. What the manage link carries and the only thing that opens a
 *  booking. */
function manageToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The link a confirmation carries. The page reads both off its own query string — a static
 *  export has no route parameters to put them in. */
export function manageUrl(reference: string, token: string): string {
  return `${TRAINING_PAGE_URL}?booking=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Who is submitting, as far as the rate limit needs to know. The address is salted and hashed
 * before it leaves this function, so the attempts table cannot be read back as a list of who
 * visited the page — it is a counter with a key, not a log.
 */
async function fingerprint(request: Request): Promise<string> {
  const address = request.headers.get('cf-connecting-ip') ?? ''
  if (!address) return ''
  return (await sha256Hex(`${TRAINING_ATTEMPT_SALT}:${address}`)).slice(0, 32)
}
