// What a delivery does after implementation (#302). A fresh review run judges the work and
// fixes plain mistakes in the same session. A successful run passes unless it appended a
// user-owned question to the card.
//
// A delivery can decline that run (#416): with AI review off the implementation is the last
// agent to read the code, and the delivery goes on to land without one. Every other gate —
// the repository's own checks, the open-question hold, diff approval — is untouched.
//
// This file decides; it never starts anything. `deliveries.ts` writes the decision onto
// the delivery, and the watcher of the run that just closed starts what it says.

import { appendCardQuestion } from '../board'
import { findCard } from '../view/read'
import { boardCommand } from './command'
import { missingRequired } from './stage-end'
import { stageContract, type Stage } from './stages'
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

/** Whether a fresh session reviews what this delivery built (#416). Frozen when the
 *  delivery started; a delivery recorded before the setting existed carries none and reads
 *  as review on. */
export const aiReviewOn = (delivery: Pick<DeliveryRecord, 'aiReview'>): boolean => delivery.aiReview !== false

/** The last review conclusion, or undefined before the first review has finished. */
export const lastRound = (delivery: DeliveryRecord): ReviewRound | undefined =>
  delivery.review?.rounds[delivery.review.rounds.length - 1]

/** Whether the review this delivery owes is the focused post-rebase one (#415): a conflict
 *  with the target branch was resolved, and that resolution is code nothing has judged. A
 *  rebase git composed by itself owes no review at all (#665), and a round recorded since
 *  the rebase has already been that pass. */
export const owesFocusedReview = (delivery: DeliveryRecord | undefined): boolean => {
  const landing = delivery?.landing
  if (!landing?.rebasedAt || !landing.rebasedFrom) return false
  if (landing.rebaseKind !== 'conflict') return false
  return (lastRound(delivery!)?.at ?? 0) < landing.rebasedAt
}

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
    if (run.status !== 'done') return HOLD
    // The build stage ends here, so this is where its contract is read (#714).
    const short = stageShortfall('build', delivery)
    if (short) return short
    // With AI review off the build IS the delivery's own work, so it finishes here and the
    // caller queues it for landing exactly as a pass would (#416).
    return aiReviewOn(delivery) ? { start: 'review' } : { finish: true }
  }
  if (run.action === 'review') return afterReview(delivery, run, raisedQuestions)
  return HOLD
}

/** The stop a stage's own contract calls for, or null when it requires nothing this card is
 *  short of (#714).
 *
 *  Nothing the command ships requires a helper, so this is null on both solutions today.
 *  When a board does require one and it wrote nothing, the delivery stops UNFINISHED with
 *  the card still held: the way out is the user's, and it is spelled out here rather than
 *  left as a card with nowhere to go. */
function stageShortfall(stage: Stage, delivery: DeliveryRecord): { stop: 'capability'; why: string } | null {
  const cardId = delivery.cardId
  if (cardId === null) return null
  let missing: string[]
  try {
    const card = findCard(cardId)
    if (!card) return null
    missing = missingRequired(stageContract(stage), card)
  } catch {
    // an unreadable board — the delivery is no worse off than before this check existed
    return null
  }
  if (!missing.length) return null
  return {
    stop: 'capability',
    why:
      `the ${stage} stage requires ${missing.map((name) => `\`${name}\``).join(', ')}, ` +
      `which wrote nothing on this card. Run ${missing.length === 1 ? 'it' : 'them'} yourself, take the ` +
      `requirement off the stage, or drop the card with \`${boardCommand()} raw archive ${cardId}\`.`,
  }
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

  if (raisedQuestions > 0) {
    return {
      stop: 'ask',
      why: `review left ${raisedQuestions} open decision${raisedQuestions === 1 ? '' : 's'} for you`,
    }
  }
  // And the review stage ends here, so its contract is read before the pass stands (#714).
  return stageShortfall('review', delivery) ?? { finish: true }
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
