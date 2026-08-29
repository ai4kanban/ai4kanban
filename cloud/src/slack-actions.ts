/**
 * A press in Slack, turned into the one durable action an event carries (#320).
 *
 * This is the second authenticated action path Cloud signs, beside the sign-in one. Nobody
 * here is holding a Supabase token: Slack signs the request, and the workspace and the
 * Slack user together say whose account the press is. Both halves have to hold, so:
 *
 *   • every callback is checked against Slack's signature and refused when it is unsigned,
 *     wrongly signed, or old enough to be a replay;
 *   • an actor we have no account for is refused with its own words rather than acted on.
 *
 * The press is recorded through #319's connector-neutral action path — the same database
 * function a click on the desktop calls — as `waiting_for_server`, which is what leaves the
 * claimable request #318's board server picks up. The connector never touches a card, and
 * never changes task state of its own.
 *
 * Every refusal is ephemeral: only the person who pressed sees it, and the message in the
 * channel does not move.
 */

import { SLACK_CALLBACK_MAX_AGE_SECONDS } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { Refusal, badRequest, unauthenticated } from './errors.ts'
import type { EventRow } from './events.ts'
import { json } from './http.ts'
import type { Answer } from './message.ts'
import { redrawEverywhere } from './redraw.ts'
import {
  ACTION_ANSWER_OPTION,
  ACTION_IMPLEMENT,
  ACTION_OPEN_ANSWERS,
  ANSWER_ACTION,
  ANSWER_VIEW,
  answerBlockId,
  answerView,
  readQuestions,
} from './slack-message.ts'
import { slackActor, slackApi, type SlackActor } from './slack.ts'
import { hex, sameString } from './verify.ts'

/**
 * Slack's interactivity callback.
 *
 * It answers 200 for everything Slack itself did right, because a non-200 is Slack telling
 * the user the app is broken — and a refused press is not a broken app. What the person
 * pressed against is said to them ephemerally instead.
 */
export async function slackCallback(
  env: Env,
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  const body = await request.text()
  await verifySignature(env, request, body)

  const payload = readPayload(body)
  const type = String(payload.type ?? '')
  if (type === 'block_actions') return blockAction(env, payload, ctx)
  if (type === 'view_submission') return viewSubmission(env, payload, ctx)
  // A callback shape we do not act on — Slack sends several. Acknowledged, not refused.
  return json({ ok: true })
}

// --- the signature ------------------------------------------------------------

/**
 * Slack's own signature over the raw body, and how old the request is.
 *
 * The age check is what makes a captured request useless minutes later; without it a signed
 * body replayed tomorrow would still verify. Both are refusals rather than answers: an
 * unsigned callback is not a person to talk to.
 */
export async function verifySignature(env: Env, request: Request, body: string): Promise<void> {
  const secret = env.SLACK_SIGNING_SECRET
  // No secret means nothing can be checked, so nothing is trusted. A build that cannot
  // verify must refuse rather than accept unchecked.
  if (!secret) throw unauthenticated('This service cannot verify Slack callbacks.')

  const signature = request.headers.get('x-slack-signature') ?? ''
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? ''
  const seconds = Number(timestamp)
  if (!signature || !Number.isFinite(seconds)) {
    throw unauthenticated('That callback is not signed.')
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > SLACK_CALLBACK_MAX_AGE_SECONDS) {
    throw unauthenticated('That callback is too old to act on.')
  }

  const bytes = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    bytes.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, bytes.encode(`v0:${timestamp}:${body}`))
  const expected = `v0=${hex(signed)}`
  if (!sameString(expected, signature)) throw unauthenticated('That callback is signed wrongly.')
}

/** Slack posts one form field holding the whole payload. */
function readPayload(body: string): Record<string, unknown> {
  const raw = new URLSearchParams(body).get('payload')
  if (!raw) throw badRequest('That callback carries no payload.')
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw badRequest('That callback carries no readable payload.')
  }
}

// --- a button in the message --------------------------------------------------

async function blockAction(
  env: Env,
  payload: Record<string, unknown>,
  ctx: ExecutionContext,
): Promise<Response> {
  const action = (asArray(payload.actions)[0] ?? {}) as Record<string, unknown>
  const actionId = String(action.action_id ?? '')
  // The card link is a URL button: Slack still tells us it was pressed, and there is
  // nothing to do about it. Reading the card is not an action on the event.
  if (!actionId || actionId === 'open_card') return json({ ok: true })

  const who = actor(payload)
  const responseUrl = String(payload.response_url ?? '')
  const found = await resolve(env, action, who)
  if (!found.ok) return refuse(ctx, responseUrl, found.words)
  const { event, actorRow } = found

  if (actionId === ACTION_OPEN_ANSWERS) {
    // The modal is not the action — it is where the whole set is written before one is
    // taken. Opened against the event as it stands right now.
    const trigger = String(payload.trigger_id ?? '')
    try {
      await slackApi(actorRow.botToken, 'views.open', {
        trigger_id: trigger,
        view: answerView(event),
      })
    } catch (e) {
      return refuse(ctx, responseUrl, `Slack would not open that: ${message(e)}.`)
    }
    return json({ ok: true })
  }

  const opId = `slack:${event.id}:${String(action.action_ts ?? payload.trigger_id ?? '')}`
  if (actionId === ACTION_IMPLEMENT) {
    const done = await record(env, actorRow, event, 'implement', [], opId)
    if (!done.ok) return refuse(ctx, responseUrl, done.words)
    redraw(env, ctx, event.id)
    return json({ ok: true })
  }

  const picked = readOptionAction(actionId)
  if (!picked) return json({ ok: true })
  const questions = readQuestions(event)
  const question = questions[picked.question]
  if (!question || picked.option > question.options.length) {
    return refuse(ctx, responseUrl, 'That question has changed. Open the card and look again.')
  }
  const answers = questions.map((_, at) =>
    at === picked.question ? { picked: [picked.option], text: '' } : { picked: [], text: '' },
  )
  const done = await record(env, actorRow, event, 'answer', answers, opId)
  if (!done.ok) return refuse(ctx, responseUrl, done.words)
  redraw(env, ctx, event.id)
  return json({ ok: true })
}

/** `answer_option:<question>:<option>` — both 0-based and 1-based exactly as the message
 *  wrote them: the question is a position in the event's list, the option a position in
 *  that question's own. */
function readOptionAction(actionId: string): { question: number; option: number } | null {
  const parts = actionId.split(':')
  if (parts[0] !== ACTION_ANSWER_OPTION || parts.length !== 3) return null
  const question = Number(parts[1])
  const option = Number(parts[2])
  if (!Number.isInteger(question) || !Number.isInteger(option) || option < 1) return null
  return { question, option }
}

// --- the modal ----------------------------------------------------------------

/**
 * Every answer, in one action.
 *
 * Cloud records one action per event, so a modal that submitted one question at a time
 * would spend the event's single action on the first and forfeit the rest. A refusal comes
 * back inside the view, where the person is still looking.
 */
async function viewSubmission(
  env: Env,
  payload: Record<string, unknown>,
  ctx: ExecutionContext,
): Promise<Response> {
  const view = (payload.view ?? {}) as Record<string, unknown>
  if (String(view.callback_id ?? '') !== ANSWER_VIEW) return json({ ok: true })

  const who = actor(payload)
  const found = await resolve(env, { value: String(view.private_metadata ?? '') }, who)
  if (!found.ok) return json(viewError(0, found.words))
  const { event, actorRow } = found

  const questions = readQuestions(event)
  const state = ((view.state ?? {}) as { values?: Record<string, unknown> }).values ?? {}
  const answers = questions.map((question, at) => readAnswer(state, at, question.options.length))

  const opId = `slack:${event.id}:${String(view.id ?? payload.trigger_id ?? '')}`
  const done = await record(env, actorRow, event, 'answer', answers, opId)
  if (!done.ok) return json(viewError(0, done.words))
  redraw(env, ctx, event.id)
  return json({ response_action: 'clear' })
}

/** One question's answer, as Slack hands the view's state back. A tick and words together
 *  is not a shape the view can produce, and a blank is an answer left open on purpose. */
function readAnswer(
  state: Record<string, unknown>,
  at: number,
  optionCount: number,
): Answer {
  const block = (state[answerBlockId(at)] ?? {}) as Record<string, unknown>
  const held = (block[ANSWER_ACTION] ?? {}) as {
    value?: unknown
    selected_option?: { value?: unknown } | null
    selected_options?: { value?: unknown }[]
  }
  const chosen = [
    ...(held.selected_option ? [held.selected_option] : []),
    ...(Array.isArray(held.selected_options) ? held.selected_options : []),
  ]
    .map((option) => Number(option?.value))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= optionCount)
  if (chosen.length > 0) return { picked: chosen, text: '' }
  return { picked: [], text: typeof held.value === 'string' ? held.value.trim() : '' }
}

/** A refusal a modal shows without closing. Keyed on the first question's block, because
 *  that is where the reader's eye already is. */
const viewError = (at: number, words: string) => ({
  response_action: 'errors',
  errors: { [answerBlockId(at)]: words.slice(0, 500) },
})

// --- who pressed, and what they pressed ---------------------------------------

/** The workspace and the user together. A Slack id is unique only inside its workspace, so
 *  neither half identifies anybody on its own. */
function actor(payload: Record<string, unknown>): { teamId: string; userId: string } {
  const user = (payload.user ?? {}) as { id?: unknown; team_id?: unknown }
  const team = (payload.team ?? {}) as { id?: unknown }
  return {
    teamId: String(team.id ?? user.team_id ?? ''),
    userId: String(user.id ?? ''),
  }
}

type Resolved =
  | { ok: true; event: EventRow; actorRow: SlackActor }
  | { ok: false; words: string }

/**
 * The account this press is, and the event it is about.
 *
 * Four ways it ends short, each with its own sentence, because they ask the reader for four
 * different things: link your account, look at your own board, this message is out of date,
 * or connect again.
 */
async function resolve(
  env: Env,
  action: { value?: unknown },
  who: { teamId: string; userId: string },
): Promise<Resolved> {
  if (!who.teamId || !who.userId) return { ok: false, words: 'Slack did not say who pressed that.' }
  const carried = readValue(action.value)
  if (!carried) return { ok: false, words: 'That button carries no task. Open the card instead.' }

  const actorRow = await slackActor(env, who.teamId, who.userId)
  if (!actorRow) {
    return {
      ok: false,
      words:
        'AI4Kanban does not know who you are here. Connect Slack in Configuration → Notifications to press this as your account.',
    }
  }
  if (actorRow.revoked) {
    return {
      ok: false,
      words: 'Slack refused this connection. Connect again in Configuration → Notifications.',
    }
  }

  const event = await call<EventRow | null>(env, 'read_event', {
    p_subject: actorRow.ownerId,
    p_event: carried.eventId,
  })
  if (!event) return { ok: false, words: 'That task is not on your AI4Kanban account. Nothing changed.' }
  if (event.acted) return { ok: false, words: 'That was already answered. Nothing changed.' }
  if (event.revision !== carried.revision) {
    return {
      ok: false,
      words: `#${event.taskId} has been rewritten since this message. Read it again and decide on the new one.`,
    }
  }
  return { ok: true, event, actorRow }
}

/** What a button carried back: the event, and the revision the message was drawn against. */
function readValue(value: unknown): { eventId: string; revision: string } | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const held = JSON.parse(value) as { eventId?: unknown; revision?: unknown }
    if (typeof held.eventId !== 'string' || !held.eventId) return null
    return { eventId: held.eventId, revision: String(held.revision ?? '') }
  } catch {
    return null
  }
}

/**
 * Record it, through the same function a click on the desktop calls.
 *
 * `waiting_for_server` rather than `accepted`: the person pressing is not at the board's
 * machine, so this leaves the claimable request that machine runs when it is next
 * reachable. The database's own refusals — a second action, a revision that has moved — are
 * carried through as the sentences they were written to be.
 */
async function record(
  env: Env,
  actorRow: SlackActor,
  event: EventRow,
  decision: 'implement' | 'answer',
  answers: Answer[],
  opId: string,
): Promise<{ ok: true } | { ok: false; words: string }> {
  try {
    await mutate(env, 'record_event_action', {
      p_subject: actorRow.ownerId,
      p_op_id: opId,
      p_event: event.id,
      p_decision: decision,
      p_revision: event.revision,
      p_answers: answers,
      p_state: 'waiting_for_server',
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, words: error.message }
    console.error('cloud: slack action failed', error)
    return { ok: false, words: 'Cloud could not record that. Try again shortly.' }
  }
}

/** Every connector's message for this event, brought up to date — the Lark one included, so
 *  a chat does not wait for the hourly run to learn that a Slack press already settled it.
 *  Off the response, because Slack wants its 200 inside three seconds. */
function redraw(env: Env, ctx: ExecutionContext, eventId: string): void {
  ctx.waitUntil(
    redrawEverywhere(env, eventId).catch((e) => console.error('cloud: slack redraw failed', e)),
  )
}

/** A refusal only the person who pressed sees. The message in the channel does not move. */
function refuse(ctx: ExecutionContext, responseUrl: string, words: string): Response {
  if (responseUrl) {
    ctx.waitUntil(
      fetch(responseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response_type: 'ephemeral', replace_original: false, text: words }),
      }).catch(() => undefined),
    )
  }
  return json({ ok: true })
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
