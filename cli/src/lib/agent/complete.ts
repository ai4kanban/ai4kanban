// Completing a card, once its delivery has landed (#307).
//
// Completion is the LAST step of a delivery, never an earlier one. Review used to archive
// the card the moment it passed — before anything had been committed — so a card could
// leave the board while its code was still queued behind another landing, still rebasing,
// or still waiting on a conflict.
//
// It is the board's own work, like landing: no run is started to do it. The two steps that
// need judgment — ticking the todos and writing the shipped line — are the build run's,
// and review checks them. What is left is `akb board archive`, which is a board command.
//
// The delivery is ended BEFORE this is called, so nothing is still holding the card when
// it is archived.

import { archiveCard } from '../board'
import { say } from '../io'
import { boardCommand } from './command'

/** Take the card off the board, now that its delivery is over — the board's own archive
 *  operation, like every other write a run makes (#312).
 *
 *  Best-effort and never thrown from: the code has landed either way, and a card that
 *  could not be archived is one board command away rather than a lost delivery. What went
 *  wrong is said out loud, with the command that finishes the job. */
export async function completeCard(cardId: number, deliveryId: string): Promise<void> {
  let why: string
  try {
    const res = await archiveCard(cardId)
    if (res.ok) {
      say(`#${cardId} archived — delivery ${deliveryId} is done.`)
      return
    }
    why = res.error
  } catch (e) {
    // A board another writer is holding refuses by throwing, and this path must not.
    why = e instanceof Error ? e.message : String(e)
  }
  say(
    `delivery ${deliveryId} is done, but #${cardId} could not be archived: ${why} ` +
      `Archive it with \`${boardCommand()} board archive ${cardId}\`.`,
  )
}
