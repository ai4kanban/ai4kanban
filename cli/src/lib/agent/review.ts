// What a delivery does after implementation. Nothing reviews the build any more (#1203): a
// finished build is the delivery's own work, and it goes on to land. Every other gate — the
// repository's own checks, the open-question hold, diff approval — is untouched.
//
// `delivery.review` is still where a delivery that stopped says why — work nobody could
// commit, files outside the board, a hook that failed — and where the rounds of the
// reviews it had before #1203 are kept.
//
// This file decides; it never starts anything. `deliveries.ts` writes the decision onto
// the delivery.

import { findCard } from '../view/read'
import { boardCommand } from './command'
import { hookStopWhy, owedHooks } from './hooks'
import { missingRequired } from './stage-end'
import { stageContract, type Stage } from './stages'
import type { DeliveryRecord, DeliveryReview, ReviewRound, ReviewStopReason, RunRecord, StopHook } from './types'

/** This delivery's stop slot, made if it has none yet. */
export function reviewOf(delivery: DeliveryRecord): DeliveryReview {
  if (!delivery.review) delivery.review = { rounds: [] }
  return delivery.review
}

/** The last review conclusion a delivery recorded before #1203, if any. */
export const lastRound = (delivery: DeliveryRecord): ReviewRound | undefined =>
  delivery.review?.rounds[delivery.review.rounds.length - 1]

/** What the delivery does now that one of its runs has closed. */
export type ReviewNext =
  /** The build and every hook after it are done — the delivery is finished. */
  | { finish: true }
  /** Stop and wait for the user. */
  | { stop: ReviewStopReason; why: string; hook?: StopHook }
  /** Nothing to decide here — the delivery stays exactly as it is. */
  | { hold: true }

const HOLD: ReviewNext = { hold: true }

/** What follows the run that just closed. Only runs inside a delivery reach here, and the
 *  caller writes whatever this returns down. */
export function nextAfterSession(delivery: DeliveryRecord, run: RunRecord): ReviewNext {
  if (delivery.status !== 'active') return HOLD
  // A hook after the build (#1328): the next one is owed, the last one finishes, and one
  // that failed or was stopped stops the delivery where it is.
  if (run.action === 'hook') {
    if (run.status === 'done') return owedHooks(delivery).length ? HOLD : { finish: true }
    const agent = run.specAgent ?? ''
    const stopped = run.status === 'stopped'
    return { stop: 'hook', why: hookStopWhy(agent, stopped), hook: { agent, how: stopped ? 'stopped' : 'failed' } }
  }
  // A build somebody stopped, or one that was cut off, is picked up by Resume.
  if (run.action !== 'implement' || run.status !== 'done') return HOLD
  // The build stage ends here, so this is where its contract is read (#714).
  return stageShortfall('build', delivery) ?? (owedHooks(delivery).length ? HOLD : { finish: true })
}

/** The stop a stage's own contract calls for, or null when it requires nothing this card is
 *  short of (#714). Nothing the command ships requires an agent, so this is null today. */
function stageShortfall(stage: Stage, delivery: DeliveryRecord): { stop: 'capability'; why: string } | null {
  const cardId = delivery.cardId
  if (cardId === null) return null
  let missing: string[]
  try {
    const card = findCard(cardId)
    if (!card) return null
    missing = missingRequired(stageContract(stage), card)
  } catch {
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
