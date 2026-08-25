// What a delivery does after implementation (#302). A fresh review run judges the work,
// fixes plain mistakes in the same session, and records pass or ask. Historical correction
// runs remain readable and hand back to review, but no new one is started.
//
// This file decides; it never starts anything. `deliveries.ts` writes the decision onto
// the delivery, and the watcher of the run that just closed starts what it says.

import { cmdUpdateQuestions } from '../../commands/card'
import { quietly } from '../io'
import { withBoardLock } from '../lock'
import { boardCommand } from './command'
import type {
  DeliveryRecord,
  DeliveryReview,
  ReviewFinding,
  ReviewRound,
  ReviewStopReason,
  ReviewVerdict,
  RunRecord,
} from './types'

/** The verdicts a review may record, as the command spells them. */
export const VERDICTS: ReviewVerdict[] = ['pass', 'ask']

// How many findings the card's question names before it stops counting. The rest are on
// the delivery's permanent record; a question nobody can read to the end is a question
// nobody acts on.
const MAX_NAMED = 3

// ---- findings ---------------------------------------------------------------

// A finding is one bullet in the card's own style: `- **<title>**: <evidence>`. A findings
// file that is prose instead is read as one finding titled by its first line.
const BULLET = /^\s*[-*]\s+\*\*(.+?)\*\*\s*:\s*([\s\S]*)$/

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** The findings in a review's answer, in the order it wrote them. */
export function parseFindings(text: string): ReviewFinding[] {
  const out: ReviewFinding[] = []
  for (const line of text.split('\n')) {
    const bullet = line.match(BULLET)
    if (bullet) {
      out.push({ title: squash(bullet[1]!), detail: squash(bullet[2]!) })
      continue
    }
    // A wrapped bullet belongs to the finding above it, not to a new one.
    if (out.length && /^\s+\S/.test(line)) {
      const last = out[out.length - 1]!
      last.detail = squash(`${last.detail} ${line}`)
    }
  }
  if (out.length) return out
  const whole = squash(text)
  if (!whole) return []
  const title = whole.length > 80 ? `${whole.slice(0, 77)}…` : whole
  return [{ title, detail: whole }]
}

// ---- the record a delivery keeps --------------------------------------------

/** This delivery's review state, made if it has none yet. */
export function reviewOf(delivery: DeliveryRecord): DeliveryReview {
  if (!delivery.review) delivery.review = { rounds: [], corrections: 0 }
  return delivery.review
}

/** The last verdict recorded, or undefined before the first review has spoken. */
export const lastRound = (delivery: DeliveryRecord): ReviewRound | undefined =>
  delivery.review?.rounds[delivery.review.rounds.length - 1]

/** Findings from the last non-pass review, including historical correction verdicts. */
export function openFindings(delivery: DeliveryRecord): ReviewFinding[] {
  const last = lastRound(delivery)
  return last && last.verdict !== 'pass' ? last.findings : []
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
 *  Only runs inside a delivery reach here, and only the three actions a delivery is
 *  made of. Whatever this returns, it is the caller that writes it down.
 *
 */
export function nextAfterSession(delivery: DeliveryRecord, run: RunRecord): ReviewNext {
  if (delivery.status !== 'active') return HOLD
  // A run somebody ended is not a failure and not a verdict: they stopped it, so the
  // delivery waits for them rather than asking them a question about their own click.
  if (run.status === 'stopped') return HOLD
  if (run.action === 'implement') {
    // A build that was cut off is picked up by Resume — the delivery is unfinished, not
    // wrong, and there is nothing for a reviewer to judge yet.
    return run.status === 'done' ? { start: 'review' } : HOLD
  }
  if (run.action === 'review') return afterReview(delivery, run)
  // An old delivery may still have a correction run in flight during an upgrade. Finish
  // that run, then use the combined review flow.
  if (run.action === 'correct') return afterLegacyCorrection(run)
  return HOLD
}

function afterReview(delivery: DeliveryRecord, run: RunRecord): ReviewNext {
  const round = lastRound(delivery)
  // The verdict is recorded by the run itself, so a review whose run ended without
  // one told us nothing — and a delivery that treats silence as a pass is a delivery with
  // no review in it.
  if (!round || round.sessionId !== run.sessionId) {
    return {
      stop: 'session',
      why:
        run.status === 'done'
          ? 'the review run ended without recording a verdict'
          : `the review run ${run.status === 'error' ? 'failed' : 'was cut off'} before it recorded a verdict`,
    }
  }
  if (round.verdict === 'pass') return { finish: true }
  if (round.verdict === 'ask') return { stop: 'ask', why: 'review found something only you can settle' }
  // `correct` is kept only for a verdict recorded by an older command before upgrade.
  return { start: 'review' }
}

function afterLegacyCorrection(run: RunRecord): ReviewNext {
  if (run.status !== 'done') {
    return {
      stop: 'session',
      why: `the correction run ${run.status === 'error' ? 'failed' : 'was cut off'} before it finished`,
    }
  }
  return { start: 'review' }
}

// ---- the question a stop leaves ---------------------------------------------

// What the user is being asked to do about it — the same three ways out of every stop, so
// the question ends by saying what to do rather than only what went wrong. Changing the
// card is not among them on purpose: a delivery builds the card it captured, so new
// requirements are a new delivery, which is what cancelling leads to.

/** The one line a stopped review puts on the card: what stopped it, what review found, and
 *  the decision that is now the user's. */
export function stopQuestion(delivery: DeliveryRecord, why: string, program = boardCommand()): string {
  const findings = openFindings(delivery)
  const named = findings.slice(0, MAX_NAMED).map((f) => f.title)
  const rest = findings.length - named.length
  const found = named.length
    ? ` Review found: ${named.join('; ')}${rest ? `, and ${rest} more on the delivery record` : ''}.`
    : ''
  return (
    `[user] Review stopped on delivery ${delivery.deliveryId}: ${why}.${found}` +
    ` Decide: answer here, explicitly accept the condition under ## Worth noting after implementation, or cancel the delivery` +
    ` and start again from a changed card. Once you have, \`${program} review ${delivery.cardId}\` judges it again.`
  )
}

/** Put that question on the card. Best-effort and silent, exactly as every other board move
 *  a run makes at its close: a delivery that could not write its question is still
 *  stopped, and the reason is on its permanent record either way. */
export function askUser(cardId: number, question: string): void {
  try {
    withBoardLock(() => quietly(() => cmdUpdateQuestions([String(cardId), '--append', question])))
  } catch {
    // the card is gone, or the board refused — the stop stands regardless
  }
}
