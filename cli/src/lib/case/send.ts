// Posting one partner case (#628).
//
// Not the feedback sender and deliberately not built on it. That one carries a sentence and
// four small attachments and rides on this machine's usage install id; this one carries a
// refine's raw traces and the project files behind them, and carries NO install id at all —
// the submission id is the key, so a machine with usage reporting off is still a machine we
// can delete a pack for. Nothing retries on its own: somebody is watching the discussion,
// and the screen offers the retry.

import { CASE_ENDPOINT, LIMITS } from '../../../../telemetry/contract'
import type { SentCase } from '../../../../telemetry/contract'
import type { CaseFailure } from './state'

/** How long a submission may take before it is abandoned. Longer than a piece of feedback's
 *  fifteen seconds: this one is megabytes on whatever connection the user has. */
const SEND_TIMEOUT_MS = 120_000

/** Where a case goes. `AI4KANBAN_CASE_URL` points a checkout at the development copy or at a
 *  test's own server, the way `AI4KANBAN_FEEDBACK_URL` points the feedback route. */
const endpoint = (): string => process.env.AI4KANBAN_CASE_URL || CASE_ENDPOINT.production

export interface CaseSent {
  ok: boolean
  reason?: CaseFailure
  /** The status or the network error behind it, for a log. Never the whole of what a screen
   *  shows. */
  detail?: string
}

/**
 * Send one pack, and say what came of it.
 *
 * Never throws. A pack over the endpoint's ceiling is refused HERE rather than sent into a
 * 413 — the answer is the same either way, and the screen's **Send the question description
 * only** is what it leads to.
 */
export async function sendCase(pack: SentCase): Promise<CaseSent> {
  const payload = JSON.stringify(pack)
  if (Buffer.byteLength(payload) > LIMITS.caseBytes) return { ok: false, reason: 'too-large' }
  try {
    const answer = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (answer.ok) return { ok: true }
    if (answer.status === 413) return { ok: false, reason: 'too-large', detail: '413' }
    return { ok: false, reason: 'refused', detail: String(answer.status) }
  } catch (error) {
    return { ok: false, reason: 'unreachable', detail: error instanceof Error ? error.message : '' }
  }
}
