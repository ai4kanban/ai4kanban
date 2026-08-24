// The review loop: what a delivery does after it has built something (#302).
//
// Implementation ends, and a FRESH session judges the result against the card as it was
// approved. Three answers are possible — it passes, it plainly does not and a correction
// session fixes it, or only the user can settle it. A correction is followed by another
// fresh review of the whole candidate, never of the corrected lines alone.
//
// The loop is deliberately short. Two corrections, and it stops on a finding that came
// back, on a correction that changed nothing, and on a session that failed — because a
// loop that keeps going on any of those is a loop spending money to make the same mistake
// again. Every stop becomes one open question on the card, with the findings, the attempts
// and the decision the user has to make, and the delivery waits there.
//
// This file decides; it never starts anything. `deliveries.ts` writes the decision onto
// the delivery, and the watcher of the session that just closed starts what it says.

import { cmdUpdateQuestions } from '../../commands/card'
import { quietly } from '../io'
import { withBoardLock } from '../lock'
import { boardCommand } from './command'
import { candidateMark } from './candidate'
import type {
  DeliveryRecord,
  DeliveryReview,
  ReviewFinding,
  ReviewRound,
  ReviewStopReason,
  ReviewVerdict,
  RunRecord,
} from './types'

/** Correction sessions one delivery may spend before review stops and asks. */
export const MAX_CORRECTIONS = 2

/** The verdicts a review may record, as the command spells them. */
export const VERDICTS: ReviewVerdict[] = ['pass', 'correct', 'ask']

// How many findings the card's question names before it stops counting. The rest are on
// the delivery's permanent record; a question nobody can read to the end is a question
// nobody acts on.
const MAX_NAMED = 3

// ---- findings ---------------------------------------------------------------

// A finding is one bullet in the card's own style: `- **<title>**: <evidence>`. The title
// is its identity — the loop tells a correction that landed from one that did not by
// whether the same title comes back — so a findings file that is prose instead of bullets
// is read as one finding titled by its first line rather than refused.
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

/** The same finding, whichever round it was written in: a title compared without case or
 *  punctuation, so "Missing the empty case" and "missing the empty case." are one issue. */
const key = (finding: ReviewFinding): string =>
  finding.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ---- the record a delivery keeps --------------------------------------------

/** This delivery's review state, made if it has none yet. */
export function reviewOf(delivery: DeliveryRecord): DeliveryReview {
  if (!delivery.review) delivery.review = { rounds: [], corrections: 0 }
  return delivery.review
}

/** The last verdict recorded, or undefined before the first review has spoken. */
export const lastRound = (delivery: DeliveryRecord): ReviewRound | undefined =>
  delivery.review?.rounds[delivery.review.rounds.length - 1]

/** The findings the correction session in flight was started to fix. */
export function openFindings(delivery: DeliveryRecord): ReviewFinding[] {
  const last = lastRound(delivery)
  return last && last.verdict !== 'pass' ? last.findings : []
}

// ---- what happens next ------------------------------------------------------

/** What the delivery does now that one of its sessions has closed. */
export type ReviewNext =
  /** Start another session in this delivery. */
  | { start: 'review' | 'correct' }
  /** The candidate passed — the delivery is finished. */
  | { finish: true }
  /** Stop and ask the user; the card takes one open question. */
  | { stop: ReviewStopReason; why: string }
  /** Nothing to decide here — the delivery stays exactly as it is. */
  | { hold: true }

const HOLD: ReviewNext = { hold: true }

/** What follows the session that just closed.
 *
 *  Only sessions inside a delivery reach here, and only the three actions a delivery is
 *  made of. Whatever this returns, it is the caller that writes it down. */
export function nextAfterSession(delivery: DeliveryRecord, run: RunRecord): ReviewNext {
  if (delivery.status !== 'active') return HOLD
  // A session somebody ended is not a failure and not a verdict: they stopped it, so the
  // delivery waits for them rather than asking them a question about their own click.
  if (run.status === 'stopped') return HOLD
  if (run.action === 'implement') {
    // A build that was cut off is picked up by Resume — the delivery is unfinished, not
    // wrong, and there is nothing for a reviewer to judge yet.
    return run.status === 'done' ? { start: 'review' } : HOLD
  }
  if (run.action === 'review') return afterReview(delivery, run)
  if (run.action === 'correct') return afterCorrection(delivery, run)
  return HOLD
}

function afterReview(delivery: DeliveryRecord, run: RunRecord): ReviewNext {
  const round = lastRound(delivery)
  // The verdict is recorded by the session itself, so a review whose session ended without
  // one told us nothing — and a delivery that treats silence as a pass is a delivery with
  // no review in it.
  if (!round || round.sessionId !== run.sessionId) {
    return {
      stop: 'session',
      why:
        run.status === 'done'
          ? 'the review session ended without recording a verdict'
          : `the review session ${run.status === 'error' ? 'failed' : 'was cut off'} before it recorded a verdict`,
    }
  }
  if (round.verdict === 'pass') return { finish: true }
  if (round.verdict === 'ask') return { stop: 'ask', why: 'review found something only you can settle' }

  const review = reviewOf(delivery)
  const before = new Set(
    review.rounds
      .slice(0, -1)
      .filter((r) => r.verdict === 'correct')
      .flatMap((r) => r.findings.map(key)),
  )
  const again = round.findings.find((f) => before.has(key(f)))
  if (again) return { stop: 'repeat', why: `"${again.title}" came back after a correction meant to fix it` }
  if (review.corrections >= MAX_CORRECTIONS) {
    return { stop: 'limit', why: `${MAX_CORRECTIONS} corrections were spent and review still finds mistakes` }
  }
  return { start: 'correct' }
}

function afterCorrection(delivery: DeliveryRecord, run: RunRecord): ReviewNext {
  if (run.status !== 'done') {
    return {
      stop: 'session',
      why: `the correction session ${run.status === 'error' ? 'failed' : 'was cut off'} before it finished`,
    }
  }
  const mark = delivery.review?.mark
  // A correction that left the tree byte for byte as it found it has not addressed
  // anything, and the review after it would find exactly what the last one did.
  if (mark && candidateMark(delivery.base) === mark) {
    return { stop: 'no-progress', why: 'the correction session changed nothing in the candidate' }
  }
  return { start: 'review' }
}

// ---- the question a stop leaves ---------------------------------------------

// What the user is being asked to do about it — the same three ways out of every stop, so
// the question ends by saying what to do rather than only what went wrong. Changing the
// card is not among them on purpose: a delivery builds the card it captured, so new
// requirements are a new delivery, which is what cancelling leads to.

/** The one line a stopped review puts on the card: what stopped it, what review found, how
 *  many corrections were spent, and the decision that is now the user's. */
export function stopQuestion(delivery: DeliveryRecord, why: string, program = boardCommand()): string {
  const findings = openFindings(delivery)
  const named = findings.slice(0, MAX_NAMED).map((f) => f.title)
  const rest = findings.length - named.length
  const found = named.length
    ? ` Review found: ${named.join('; ')}${rest ? `, and ${rest} more on the delivery record` : ''}.`
    : ''
  const spent = delivery.review?.corrections ?? 0
  const tried = ` ${spent} correction${spent === 1 ? '' : 's'} tried.`
  return (
    `[user] Review stopped on delivery ${delivery.deliveryId}: ${why}.${found}${tried}` +
    ` Decide: answer here, approve an exception for this exact candidate, or cancel the delivery` +
    ` and start again from a changed card. Once you have, \`${program} review ${delivery.cardId}\` judges it again.`
  )
}

/** Put that question on the card. Best-effort and silent, exactly as every other board move
 *  a session makes at its close: a delivery that could not write its question is still
 *  stopped, and the reason is on its permanent record either way. */
export function askUser(cardId: number, question: string): void {
  try {
    withBoardLock(() => quietly(() => cmdUpdateQuestions([String(cardId), '--append', question])))
  } catch {
    // the card is gone, or the board refused — the stop stands regardless
  }
}

/** The candidate's fingerprint, taken as a correction is about to start, so the correction
 *  after it can be told whether anything moved. */
export const markCandidate = (delivery: DeliveryRecord): string | undefined =>
  candidateMark(delivery.base) ?? undefined
