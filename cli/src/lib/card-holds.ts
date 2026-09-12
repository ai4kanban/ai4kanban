// ---- what is keeping a card where it is ------------------------------------
//
// A stale card is stale for one of three reasons, and the listing already names it (#117):
// an unfinished card ahead of it, a question waiting on the user, or a build in flight.
//
// Written once, because two callers read the same answer for opposite purposes. `raw list
// --stale` prints every hold and filters nothing — a card waiting on the user is still on
// the list. `akb card unstick` (#118) skips the two that mean the card is not forgotten,
// and judges everything else, an unanswered question included.

import { parseQuestion } from './view/rules'
import type { Question } from './types'

/** The three things a card can be waiting on. */
export type HoldKind = 'blocked' | 'user' | 'building'

/** One reason a card is sitting where it is. */
export interface Hold {
  kind: HoldKind
  /** The clause the listing prints — `blocked by #4, #9`, `waiting on you`, `being built`. */
  text: string
}

/** What one card is held by, in the order the card reads them. `blockers` is the
 *  `blocked_by` ids that still point at an open card: an id no longer on the board holds
 *  nothing. */
export function heldBy(card: {
  blockers: readonly number[]
  questions: readonly Question[]
  status: string
}): Hold[] {
  const holds: Hold[] = []
  if (card.blockers.length) {
    holds.push({ kind: 'blocked', text: `blocked by ${card.blockers.map((n) => `#${n}`).join(', ')}` })
  }
  // Every question on a card is unanswered — answering takes it off the list.
  if (card.questions.some((q) => parseQuestion(q.text).tag === 'user')) {
    holds.push({ kind: 'user', text: 'waiting on you' })
  }
  if (card.status === 'implementing') holds.push({ kind: 'building', text: 'being built' })
  return holds
}

/** The hold that means a card is waiting rather than forgotten, or null (#118). An
 *  unanswered question is not one: nobody is acting on it, so the card is judged like any
 *  other and may be discarded before the user ever answers. */
export const waitingOn = (holds: readonly Hold[]): Hold | null =>
  holds.find((hold) => hold.kind !== 'user') ?? null
