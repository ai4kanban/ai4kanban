// Sending one piece of feedback (#603).
//
// Not the usage queue, and deliberately nothing like it. A batch of numbers is queued, sent
// once a day at a minute the install picked, and dropped without a word when it fails —
// because nobody is waiting on it. Feedback is somebody typing a sentence and pressing a
// button: it goes now, it is awaited, and what came of it is handed straight back to the
// screen that asked, which says so. Nothing retries.
//
// Two rules hold the identifier:
//
//   - **The id is read, never made.** `ensureUsageInstallId` makes one on first use; this
//     reads what is already there. A machine with usage reporting off has none, and its
//     feedback goes without one rather than bringing an identifier back to life.
//   - **Reporting being off does not stop feedback.** The switch is about the anonymous
//     numbers. Feedback is a thing the user did on purpose, and the button stays live.

import { randomUUID } from 'node:crypto'

import { FEEDBACK_ENDPOINT, LIMITS, VERSION } from '../../../../telemetry/contract'
import type { FeedbackSource, SentFeedback, SentFeedbackPart } from '../../../../telemetry/contract'
import { SKILL_VERSION } from '../../version'
import { readUsageReporting } from './telemetry'
import { usageDay, usageSurface } from './usage'

/** How long a submission may take before it is abandoned. Longer than a batch's three
 *  seconds: this one carries attachments, and somebody is watching the button. */
const SEND_TIMEOUT_MS = 15_000

/** Where feedback goes. `AI4KANBAN_FEEDBACK_URL` points a checkout at the development copy
 *  or at a test's own server, the way `AI4KANBAN_USAGE_URL` points the batches. */
const endpoint = (): string => process.env.AI4KANBAN_FEEDBACK_URL || FEEDBACK_ENDPOINT.production

/** What a screen hands in. Everything optional is a separate authorisation the user gave. */
export interface FeedbackToSend {
  /** What they wrote. The whole of the submission on its own. */
  text: string
  /** Where it was written — the New task block, or the board's Feedback button. */
  source: FeedbackSource
  /** The archived card it is about, when one was linked. */
  cardId?: number
  /** The diagnostic attachments, already trimmed to what the preview showed. Absent or
   *  empty when that second authorisation was not given. */
  parts?: SentFeedbackPart[]
}

/** Why a submission did not go, as something a screen can say in its own language rather
 *  than a sentence this file wrote in English. */
export type FeedbackFailure = 'empty' | 'too-large' | 'refused' | 'unreachable'

export interface FeedbackSent {
  ok: boolean
  reason?: FeedbackFailure
  /** The status or the network error behind it, for a log or a detail line. Never the whole
   *  of what a screen shows. */
  detail?: string
}

/**
 * Send it, and say what came of it.
 *
 * Never throws: a screen gets `{ ok: false }` with a reason and says "this one did not go".
 * The task it was written beside is already created by then — a failure here reaches nothing
 * but this sentence.
 */
export async function sendFeedback(feedback: FeedbackToSend): Promise<FeedbackSent> {
  const text = feedback.text.trim()
  if (!text) return { ok: false, reason: 'empty' }

  const body: SentFeedback = {
    v: VERSION,
    id: randomUUID(),
    day: usageDay(),
    source: feedback.source,
    surface: usageSurface(),
    version: SKILL_VERSION,
    text: text.slice(0, LIMITS.feedbackTextChars),
  }
  // Read, never made: a machine that has said no to the anonymous numbers sends this
  // without an id at all.
  const install = readUsageReporting().installId
  if (install) body.install = install
  if (typeof feedback.cardId === 'number') body.card = feedback.cardId
  if (feedback.parts?.length) body.parts = feedback.parts

  const payload = JSON.stringify(body)
  if (Buffer.byteLength(payload) > LIMITS.feedbackBytes) return { ok: false, reason: 'too-large' }

  try {
    const answer = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (answer.ok) return { ok: true }
    // 413 is the one refusal with an answer: drop an attachment and it fits.
    if (answer.status === 413) return { ok: false, reason: 'too-large', detail: '413' }
    return { ok: false, reason: 'refused', detail: String(answer.status) }
  } catch (error) {
    return { ok: false, reason: 'unreachable', detail: error instanceof Error ? error.message : '' }
  }
}
