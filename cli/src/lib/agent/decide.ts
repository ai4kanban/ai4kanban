// The decider (#447): when the board answers a card's questions instead of stopping.
//
// A card left with nothing but `[user]` questions waits for the user — that is the whole of
// what `[user]` means. With the decider switched on (agent/settings.ts) one `decide` run
// stands in for them: it chooses from the project's goal, the modules' `decisions.md` and
// each question's own recommendation, applies its answers the way `resolve` does, and takes
// every question off the card.
//
// Two rules shape everything here:
//
//   • It fires on TWO events and no scan — QA converging with only `[user]` questions left
//     (`refine.ts`), and the run that leaves a delivery stopped or held on them
//     (`deliveries.ts`). The tick's `answeredWork` re-reads every live delivery each round,
//     so hanging the decider there would let one flip of the switch loose on every card
//     already stopped. Nothing counts rounds either: each new appearance of a `[user]`
//     question starts one, however many it has already answered on that card.
//   • The switch is read at the moment a run would START. A decide queued behind another run
//     asks again, so switching the decider off stops what it had lined up, and every card
//     still carrying questions goes back to waiting on the user.

import { findCard } from '../view/read'
import { parseQuestion } from '../view/rules'
import type { Card } from '../view/types'
import { flowRefusal } from './flows'
import { deciderOn } from './settings'
import { readStore } from './store'
import type { AgentRequest } from './types'

/** Whether the board may answer this card's questions by itself: it has questions, every one
 *  of them is the user's call, and nothing else is in the way. A card whose questions are
 *  still untriaged belongs to QA, not here.
 *
 *  Typing `akb card decide <id>` bypasses all of it, as every flow does. */
export function decidable(card: Card): boolean {
  return (
    card.questions.length > 0 &&
    card.questions.every((q) => parseQuestion(q.text).tag === 'user') &&
    card.openBlockers.length === 0 &&
    !card.recurring
  )
}

/** The decide run to start on this card now, or null. The switch is read here, as the run is
 *  about to start, so the last change is the one that counts. */
export function decideRunAfter(cardId: number | null): AgentRequest | null {
  if (cardId === null || !deciderOn()) return null
  // A board whose solution has no `decide` never starts one by itself either (#435) — the
  // switch may say on, but there is nothing behind it to run.
  if (flowRefusal('decide')) return null
  let card: Card | null
  try {
    card = findCard(cardId)
  } catch {
    return null
  }
  if (!card || !decidable(card)) return null
  return { action: 'decide', id: card.id, title: card.title }
}

/** True while the board would still answer this card's questions itself — what the card page
 *  and a delivery's hold are worded from.
 *
 *  A decide that failed or was stopped is never started again on its own, so the card is the
 *  user's again from that moment and says so. A new `[user]` question on a later event still
 *  starts a fresh one: that is a new trigger, not a retry of the run that gave up. */
export function decidingOn(cardId: number | null): boolean {
  if (cardId === null || !deciderOn() || flowRefusal('decide')) return false
  let last: { status: string; startedAt: number } | undefined
  try {
    for (const run of readStore().runs) {
      if (run.action !== 'decide' || run.cardId !== cardId) continue
      if (!last || run.startedAt > last.startedAt) last = run
    }
  } catch {
    return true
  }
  return !last || last.status === 'running' || last.status === 'done'
}
