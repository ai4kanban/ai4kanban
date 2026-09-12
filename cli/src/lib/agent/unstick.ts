// ---- the cards an unstick will not judge (#118) -----------------------------
//
// Two answers, because the two reasons are different.
//
// A group root and a recurring card are REFUSED: neither can sit stuck the way a subtask
// can — a root closes itself once its subtasks do, a recurring job repeats by design — so
// the stale listing never reports either, and handing one over by hand is a mistake worth
// saying out loud.
//
// A card being built, or blocked by an unfinished one, is SKIPPED: it is waiting, not
// forgotten. The run says what is holding it and stops, which is what makes a sweep over
// the stale list (#119) read as a list of verdicts rather than a list of errors.
//
// An unanswered `[user]` question is neither. Nobody is acting on it, so the card is judged
// like any other — and a card the sweeper finds no longer worth doing is discarded before
// the user ever answers.

import { heldBy, waitingOn } from '../card-holds'
import { findCard } from '../view/read'

/** Why an unstick will not judge this card, and whether that is a refusal or a skip. */
export interface UnstickStop {
  /** `refused` — the card was never the sweeper's to judge. `waiting` — it is held, and the
   *  run stops having said so. */
  kind: 'refused' | 'waiting'
  why: string
}

/** The reason `akb card unstick <id>` does nothing, or null when the card is the
 *  sweeper's to settle. */
export function unstickStop(id: number, program = 'akb'): UnstickStop | null {
  const card = findCard(id)
  if (!card) return null
  if (card.isGroup) {
    return {
      kind: 'refused',
      why: `#${id} is a group root — it closes itself once its subtasks do, so it never sits stuck. Unstick its subtasks instead.`,
    }
  }
  if (card.recurring) {
    return {
      kind: 'refused',
      why: `#${id} is a recurring job — it repeats by design rather than sitting untouched. Change its cadence, or reject it.`,
    }
  }
  const hold = waitingOn(
    heldBy({
      blockers: card.openBlockers.map((b) => b.id),
      questions: card.questions,
      status: card.status,
    }),
  )
  if (!hold) return null
  return {
    kind: 'waiting',
    why:
      hold.kind === 'building'
        ? `#${id} is being built — it is waiting on its delivery, not forgotten. Nothing to settle.`
        : `#${id} is ${hold.text} — it is waiting on the card ahead of it, not forgotten. Unstick that one instead (\`${program} card unstick <id>\`).`,
  }
}
