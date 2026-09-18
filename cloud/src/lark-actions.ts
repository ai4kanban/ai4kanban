/**
 * A press in Lark, turned into the one durable action an event carries (#351).
 *
 * Nobody here is holding a Supabase token: Lark signs the request, and the cloud, the tenant
 * and the Lark user together say whose account the press is. Both halves have to hold, so:
 *
 *   • every callback is decrypted and checked against Lark's signature, and refused when it
 *     is unencrypted, wrongly signed, or old enough to be a replay — bar the address
 *     confirmation, which Lark sends unsigned and which knowing the Encrypt Key proves;
 *   • an actor we have no account for is refused with its own words rather than acted on.
 *
 * The route says which cloud it belongs to before the body is read, because an encrypted
 * callback carries nothing readable until the right Encrypt Key has been chosen.
 *
 * The press is recorded through #319's connector-neutral action path — the same database
 * function a click on the desktop calls — as `waiting_for_server`, which is what leaves the
 * claimable request #318's board server picks up. The connector never touches a card, and
 * never changes task state of its own.
 *
 * Every refusal is a toast: only the person who pressed sees it, and the card in the chat
 * does not move. Lark wants its answer inside three seconds, so the redraw is off the
 * response.
 */

import { LARK_CALLBACK_MAX_AGE_SECONDS, type LarkCloud } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { larkApp } from './env.ts'
import { Refusal, unauthenticated } from './errors.ts'
import type { EventRow } from './events.ts'
import { json } from './http.ts'
import {
  ACT_ANSWERS,
  ACT_IMPLEMENT,
  ACT_OPTION,
  answerField,
  wordsField,
} from './lark-message.ts'
import { larkActor, larkAppTicketPushed, type LarkActor } from './lark.ts'
import { readQuestions, type Answer, type Question } from './message.ts'
import { redrawEverywhere } from './redraw.ts'
import { hex, sameString } from './verify.ts'

/**
 * Lark's callback, for one cloud.
 *
 * It answers 200 for everything Lark itself did right, because a non-200 is Lark telling the
 * user the app is broken — and a refused press is not a broken app. What the person pressed
 * against is said to them in a toast instead.
 */
export async function larkCallback(
  env: Env,
  cloud: LarkCloud,
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  const app = larkApp(env, cloud)
  // No Encrypt Key means nothing can be checked, so nothing is trusted. A build that cannot
  // verify must refuse rather than accept unchecked.
  if (!app) throw unauthenticated(`This service cannot verify ${cloud} callbacks.`)

  const raw = await request.text()
  const signed = request.headers.has('x-lark-signature')
  if (signed) await verifySignature(request, raw, app.encryptKey)
  const payload = await decrypt(raw, app.encryptKey)

  // The one exchange that happens before anything else: Lark confirms the address once
  // before it sends a callback to it, and expects its own challenge back. It is the one
  // callback Lark sends UNSIGNED, so decrypting it is what proves the sender — it echoes a
  // value the caller supplied and touches nothing. Everything else is signed or refused.
  if (typeof payload.challenge === 'string') return json({ challenge: payload.challenge })
  if (!signed) throw unauthenticated('That callback is not signed.')

  const header = (payload.header ?? {}) as Record<string, unknown>
  const event = (payload.event ?? {}) as Record<string, unknown>

  // The `app_ticket` push. It is the app's rather than any account's, and it is what every
  // tenant token for this cloud is minted from — so it is held here whatever else arrives.
  const ticket = String(event.app_ticket ?? '')
  if (ticket) {
    await larkAppTicketPushed(env, cloud, ticket)
    return json({ ok: true })
  }

  const kind = String(header.event_type ?? payload.type ?? '')
  if (kind !== 'card.action.trigger') return json({ ok: true })
  return press(env, cloud, header, event, ctx)
}

// --- the signature and the envelope -------------------------------------------

/**
 * Lark's own signature over the raw body, and how old the request is.
 *
 * The age check is what makes a captured request useless minutes later; without it a signed
 * body replayed tomorrow would still verify. Both are refusals rather than answers: an
 * unsigned callback is not a person to talk to.
 *
 * Lark sends these three headers only where the app has an Encrypt Key, which is why our own
 * app has one on both listings — a shared token compared for equality says nothing about
 * WHEN a request was made, and that is the whole of refusing a replay.
 */
export async function verifySignature(
  request: Request,
  body: string,
  encryptKey: string,
): Promise<void> {
  const signature = request.headers.get('x-lark-signature') ?? ''
  const timestamp = request.headers.get('x-lark-request-timestamp') ?? ''
  const nonce = request.headers.get('x-lark-request-nonce') ?? ''
  const seconds = Number(timestamp)
  if (!signature || !timestamp || !Number.isFinite(seconds)) {
    throw unauthenticated('That callback is not signed.')
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > LARK_CALLBACK_MAX_AGE_SECONDS) {
    throw unauthenticated('That callback is too old to act on.')
  }
  const wanted = hex(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${timestamp}${nonce}${encryptKey}${body}`),
    ),
  )
  if (!sameString(wanted, signature)) throw unauthenticated('That callback is signed wrongly.')
}

/**
 * The body, decrypted.
 *
 * Lark encrypts the whole callback with AES-256-CBC under SHA-256 of the Encrypt Key, and
 * puts the IV at the front of the payload. A callback that carries no `encrypt` is refused
 * rather than read: this app is configured with an Encrypt Key on both listings, so an
 * unencrypted body is not one Lark sent.
 */
async function decrypt(raw: string, encryptKey: string): Promise<Record<string, unknown>> {
  let envelope: { encrypt?: unknown }
  try {
    envelope = JSON.parse(raw) as { encrypt?: unknown }
  } catch {
    throw unauthenticated('That callback carries no readable payload.')
  }
  if (typeof envelope.encrypt !== 'string' || !envelope.encrypt) {
    throw unauthenticated('That callback is not encrypted.')
  }

  const bytes = Uint8Array.from(atob(envelope.encrypt), (c) => c.charCodeAt(0))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encryptKey))
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-CBC' }, false, ['decrypt'])
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: bytes.slice(0, 16) },
      key,
      bytes.slice(16),
    )
  } catch {
    throw unauthenticated('That callback could not be decrypted.')
  }
  try {
    return JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>
  } catch {
    throw unauthenticated('That callback carries no readable payload.')
  }
}

// --- a press on the card ------------------------------------------------------

async function press(
  env: Env,
  cloud: LarkCloud,
  header: Record<string, unknown>,
  event: Record<string, unknown>,
  ctx: ExecutionContext,
): Promise<Response> {
  const action = (event.action ?? {}) as Record<string, unknown>
  const value = (action.value ?? {}) as Record<string, unknown>
  const what = String(value.a ?? '')
  // A url button carries no action back at all, so anything without one of our own names on
  // it is a shape we do not act on. Acknowledged, not refused.
  if (!what) return json({ ok: true })

  const found = await resolve(env, cloud, event, value)
  if (!found.ok) return toast(found.words)
  const { row, actorRow } = found

  // Lark retries a callback it did not get an answer to, and reuses the callback's own id
  // when it does — so a retry lands as this action's retry rather than as a second one.
  const opId = `lark:${row.id}:${String(header.event_id ?? '')}`

  if (what === ACT_IMPLEMENT) {
    const done = await record(env, actorRow, row, 'implement', [], opId)
    if (!done.ok) return toast(done.words)
    redraw(env, ctx, row.id)
    return toast('Recorded. This card now waits for your board’s machine.', 'success')
  }

  const questions = readQuestions(row)

  if (what === ACT_OPTION) {
    const at = Number(value.q)
    const option = Number(value.o)
    const question = questions[at]
    if (!question || !Number.isInteger(option) || option < 1 || option > question.options.length) {
      return toast('That question has changed. Open the card and look again.')
    }
    const answers = questions.map((_, index) =>
      index === at ? { picked: [option], text: '' } : { picked: [], text: '' },
    )
    const done = await record(env, actorRow, row, 'answer', answers, opId)
    if (!done.ok) return toast(done.words)
    redraw(env, ctx, row.id)
    return toast('Answered. This card now waits for your board’s machine.', 'success')
  }

  if (what !== ACT_ANSWERS) return json({ ok: true })

  // Every answer, in one action: Cloud records one action per event, so a form that submitted
  // one question at a time would spend the event's single action on the first and forfeit the
  // rest.
  const form = (action.form_value ?? {}) as Record<string, unknown>
  const answers = questions.map((question, at) => readAnswer(form, at, question))
  // A pick and words together is the one shape the form can produce that the wire cannot
  // carry. Saying so beats recording the pick and dropping the words just typed.
  if (answers.some((answer, at) => answer.picked.length > 0 && wordsAt(form, at))) {
    return toast('Either pick an option or write your own words — not both. Clear one of them.')
  }
  const done = await record(env, actorRow, row, 'answer', answers, opId)
  if (!done.ok) return toast(done.words)
  redraw(env, ctx, row.id)
  return toast('Answered. This card now waits for your board’s machine.', 'success')
}

/**
 * One question's answer, as the form hands it back.
 *
 * A pick wins over words, which is the board's own rule and the only one the wire carries.
 * "Something else" is not a pick — its value is one past the card's options, so it falls
 * through the filter and leaves the box below it as the answer. A blank is an answer left
 * open on purpose.
 */
function readAnswer(form: Record<string, unknown>, at: number, question: Question): Answer {
  const held = form[answerField(at)]
  const chosen = (Array.isArray(held) ? held : held === undefined || held === null ? [] : [held])
    .map((option) => Number(option))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= question.options.length)
  if (chosen.length > 0) return { picked: chosen, text: '' }
  // A question with no options is answered in its own field; one with options has a second.
  const words = question.options.length > 0 ? form[wordsField(at)] : held
  return { picked: [], text: typeof words === 'string' ? words.trim() : '' }
}

/** What an options question's own-words box holds. */
const wordsAt = (form: Record<string, unknown>, at: number): string => {
  const words = form[wordsField(at)]
  return typeof words === 'string' ? words.trim() : ''
}

// --- who pressed, and what they pressed ---------------------------------------

type Resolved =
  | { ok: true; row: EventRow; actorRow: LarkActor }
  | { ok: false; words: string }

/**
 * The account this press is, and the event it is about.
 *
 * Four ways it ends short, each with its own sentence, because they ask the reader for four
 * different things: connect your account, connect again, look at your own board, or this card
 * is out of date.
 */
async function resolve(
  env: Env,
  cloud: LarkCloud,
  event: Record<string, unknown>,
  value: Record<string, unknown>,
): Promise<Resolved> {
  const operator = (event.operator ?? {}) as Record<string, unknown>
  const tenantKey = String(operator.tenant_key ?? '')
  const openId = String(operator.open_id ?? '')
  if (!tenantKey || !openId) return { ok: false, words: 'Lark did not say who pressed that.' }

  const eventId = String(value.eventId ?? '')
  if (!eventId) return { ok: false, words: 'That button carries no task. Open the card instead.' }

  const actorRow = await larkActor(env, cloud, tenantKey, openId)
  if (!actorRow) {
    return {
      ok: false,
      words:
        'AI4Kanban does not know who you are here. Connect Lark in Configuration → Notifications to press this as your account.',
    }
  }
  if (actorRow.revoked) {
    return {
      ok: false,
      words: 'Lark refused this connection. Connect again in Configuration → Notifications.',
    }
  }

  const row = await call<EventRow | null>(env, 'read_event', {
    p_subject: actorRow.ownerId,
    p_event: eventId,
  })
  if (!row) return { ok: false, words: 'That task is not on your AI4Kanban account. Nothing changed.' }
  // An event already answered is deliberately not refused here: that is what this press's own
  // retry finds, and only the recorded op id tells it from a second press. `record` settles
  // both.
  if (row.revision !== String(value.revision ?? '')) {
    return {
      ok: false,
      words: `#${row.taskId} has been rewritten since this card. Read it again and decide on the new one.`,
    }
  }
  return { ok: true, row, actorRow }
}

/**
 * Record it, through the same function a click on the desktop calls.
 *
 * `waiting_for_server` rather than `accepted`: the person pressing is not at the board's
 * machine, so this leaves the claimable request that machine runs when it is next reachable.
 * The database's own refusals — a second action, a revision that has moved — are carried
 * through as the sentences they were written to be.
 *
 * The op id is what tells this press's own retry from a second press: an attempt already on
 * record answers with the event as it stands, so Lark retrying a callback it got no answer to
 * settles as the same action rather than as one refused. Only a DIFFERENT press on an event
 * that has been answered is refused.
 */
async function record(
  env: Env,
  actorRow: LarkActor,
  row: EventRow,
  decision: 'implement' | 'answer',
  answers: Answer[],
  opId: string,
): Promise<{ ok: true } | { ok: false; words: string }> {
  try {
    await mutate(env, 'record_event_action', {
      p_subject: actorRow.ownerId,
      p_op_id: opId,
      p_event: row.id,
      p_decision: decision,
      p_revision: row.revision,
      p_answers: answers,
      p_state: 'waiting_for_server',
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, words: error.message }
    console.error('cloud: lark action failed', error)
    return { ok: false, words: 'Cloud could not record that. Try again shortly.' }
  }
}

/** Every connector's message for this event, brought up to date — the Slack one included, so
 *  a channel does not wait for the hourly run to learn that a Lark press already settled it.
 *  Off the response, because Lark wants its 200 inside three seconds. */
function redraw(env: Env, ctx: ExecutionContext, eventId: string): void {
  ctx.waitUntil(
    redrawEverywhere(env, eventId).catch((e) => console.error('cloud: lark redraw failed', e)),
  )
}

/** A line only the person who pressed sees. The card in the chat does not move. */
const toast = (words: string, type: 'error' | 'success' = 'error'): Response =>
  json({ toast: { type, content: words.slice(0, 500) } })
