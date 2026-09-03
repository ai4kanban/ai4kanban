// What a delivery does after implementation (#302). A fresh review run judges the work and
// fixes plain mistakes in the same session. A successful run passes unless it appended a
// user-owned question to the card.
//
// This file decides; it never starts anything. `deliveries.ts` writes the decision onto
// the delivery, and the watcher of the run that just closed starts what it says.

import { appendCardQuestion } from '../board'
import type {
  DeliveryRecord,
  DeliveryReview,
  ReviewRound,
  ReviewStopReason,
  RunRecord,
} from './types'

// ---- the record a delivery keeps --------------------------------------------

/** This delivery's review state, made if it has none yet. */
export function reviewOf(delivery: DeliveryRecord): DeliveryReview {
  if (!delivery.review) delivery.review = { rounds: [] }
  return delivery.review
}

/** The last review conclusion, or undefined before the first review has finished. */
export const lastRound = (delivery: DeliveryRecord): ReviewRound | undefined =>
  delivery.review?.rounds[delivery.review.rounds.length - 1]

// ---- what happens next ------------------------------------------------------

/** What the delivery does now that one of its runs has closed. */
export type ReviewNext =
  /** Start another run in this delivery. */
  | { start: 'review' }
  /** The delivery's code changes passed — the delivery is finished. */
  | { finish: true }
  /** Stop and ask the user; the card takes one open question. */
  | { stop: ReviewStopReason; why: string }
  /** Nothing to decide here — the delivery stays exactly as it is. */
  | { hold: true }

const HOLD: ReviewNext = { hold: true }

/** What follows the run that just closed.
 *
 *  Only runs inside a delivery reach here. Whatever this returns, it is the caller that
 *  writes it down.
 *
 */
export function nextAfterSession(delivery: DeliveryRecord, run: RunRecord, raisedQuestions = 0): ReviewNext {
  if (delivery.status !== 'active') return HOLD
  // A run somebody ended is not a completed review: they stopped it, so the
  // delivery waits for them rather than asking them a question about their own click.
  if (run.status === 'stopped') return HOLD
  if (run.action === 'implement') {
    // A build that was cut off is picked up by Resume — the delivery is unfinished, not
    // wrong, and there is nothing for a reviewer to judge yet.
    return run.status === 'done' ? { start: 'review' } : HOLD
  }
  if (run.action === 'review') return afterReview(delivery, run, raisedQuestions)
  return HOLD
}

function afterReview(delivery: DeliveryRecord, run: RunRecord, raisedQuestions: number): ReviewNext {
  // A failed, interrupted or user-stopped run is unfinished. Resume carries it on; none of
  // those states is a decision to put on the card.
  if (run.status !== 'done') return HOLD

  const review = reviewOf(delivery)
  const round: ReviewRound = {
    sessionId: run.sessionId,
    verdict: raisedQuestions > 0 ? 'ask' : 'pass',
    findings: [],
    at: run.endedAt ?? Date.now(),
  }
  const mine = review.rounds[review.rounds.length - 1]
  if (mine?.sessionId === run.sessionId) review.rounds[review.rounds.length - 1] = round
  else review.rounds.push(round)

  return raisedQuestions > 0
    ? {
        stop: 'ask',
        why: `review left ${raisedQuestions} open decision${raisedQuestions === 1 ? '' : 's'} for you`,
      }
    : { finish: true }
}

/** One question a run leaves on a card: the line, and the choices under it. */
export interface Ask {
  text: string
  options: string[]
}

/** Put that question on the card. Best-effort and silent, exactly as every other board move
 *  a run makes at its close: a delivery that could not write its question is still
 *  stopped, and the reason is on its permanent record either way. */
export async function askUser(cardId: number, ask: Ask): Promise<void> {
  try {
    await appendCardQuestion(cardId, ask.text, ask.options)
  } catch {
    // the card is gone, or the board refused — the stop stands regardless
  }
}
