// What one round of applied answers did to a delivery's requirements (#637).
//
// A delivery builds the card as it was approved when it started, and answering the card's
// open questions is the one thing that rewrites that card underneath it. So answering is the
// one moment a delivery can be building the wrong thing — and the board used to decide by
// comparing its frozen copy with the card as it now reads.
//
// Text is not requirements. Tidying a sentence read as a changed plan; a card written from a
// plan never matched the plan at all, so confirming an option that was already built
// cancelled the build and started it again (#613).
//
// The run that APPLIES the answers is the one thing that can tell, so it says so:
// `akb delivery answered <id> --changed|--unchanged "<why>"`, written down before the
// questions are dropped. The review an answer resumes and the landing queue both read that
// conclusion; neither reads card text.
//
// A conclusion belongs to ONE delivery and one round. It never reaches the fresh delivery a
// supersede opens — that one starts on the card as it then reads, with none — and `actedAt`
// is what stops one from concluding twice.

import { boardCommand } from './command'
import { withStore } from './store'
import type { AnswerOutcome, AnswerVerdict, DeliveryRecord } from './types'

/** The fixed opening words landing writes while a round of answers has no conclusion. Same
 *  trick as the holds in `pause.ts`: it tells this wait from a refusal, and from the question
 *  hold it replaces, without a field of its own. */
export const UNJUDGED = 'waiting on what your answer changed'

/** The conclusions nothing has acted on yet, oldest first. */
export const pendingAnswers = (delivery: DeliveryRecord): AnswerVerdict[] =>
  (delivery.answers ?? []).filter((a) => !a.actedAt)

/** What the rounds this delivery has not acted on concluded, or `none` when no run judged
 *  them.
 *
 *  `changed` wins: a later round that moved nothing does not undo an earlier one that did, so
 *  a real change can never be answered away by the answers that followed it. */
export function answerOutcome(delivery: DeliveryRecord): AnswerOutcome | 'none' {
  const pending = pendingAnswers(delivery)
  if (!pending.length) return 'none'
  return pending.some((a) => a.outcome === 'changed') ? 'changed' : 'unchanged'
}

/** Take the conclusions a fresh round of questions leaves spent — the rounds that said
 *  nothing moved. They stay on the record as history and are never read as a verdict again.
 *
 *  A `changed` nobody acted on is not spent: the supersede it asks for is still owed, and
 *  taking it here is how a later round that moved nothing would answer for it. */
export function takeUnchanged(delivery: DeliveryRecord): void {
  // Read off the copy the caller already has, so a pass with nothing to take never reaches
  // the record's lock — every process on this board waits behind it.
  if (!pendingAnswers(delivery).some((a) => a.outcome === 'unchanged')) return
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live) return
    const now = Date.now()
    for (const answer of live.answers ?? []) if (!answer.actedAt && answer.outcome === 'unchanged') answer.actedAt = now
  })
}

/** Write down what one round of answers concluded. Refused on a delivery that is not in
 *  flight: a conclusion about a build nobody is running would sit unread for good. */
export function recordAnswer(
  deliveryId: string,
  outcome: AnswerOutcome,
  why: string,
): { ok: true } | { ok: false; error: string } {
  const line = why.trim()
  if (!line) return { ok: false, error: 'say in one sentence what the answers did — an unexplained conclusion is not one.' }
  return withStore<{ ok: true } | { ok: false; error: string }>((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
    if (!delivery) return { ok: false, error: `no delivery here answers to "${deliveryId}".` }
    if (delivery.status !== 'active') return { ok: false, error: `delivery ${deliveryId} has already ended.` }
    delivery.answers = [...(delivery.answers ?? []), { outcome, why: line, at: Date.now() }]
    return { ok: true }
  })
}

/** Why a delivery whose questions are all answered is going nowhere: nothing recorded what
 *  the answers did, and the board does not guess — comparing the card's text is exactly the
 *  judgement this replaces. */
export const unjudgedWhy = (delivery: DeliveryRecord): string =>
  `${UNJUDGED}: #${delivery.cardId} has no open question left, but no run said whether the answers changed what ` +
  `${delivery.deliveryId} is building — \`${boardCommand()} delivery answered ${delivery.deliveryId} ` +
  `--changed|--unchanged "<why>"\` settles it`
