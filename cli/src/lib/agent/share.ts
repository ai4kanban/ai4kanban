// What a shared conversation does when it ends (#659, #679, #685).
//
// The switch under the box collects nothing while the conversation is going. It says one
// thing only: that ending this conversation submits it. So this file is the whole cost of
// "share with the team" — one turn, after the end, on the conversation that just ended.
//
// And it says it about ONE end. The switch is spent here and goes off, so a conversation
// carried on past its end shares again only when the user asks again — and that second end is
// a submission of its own, with a number of its own, because the first one has already gone.
//
// The turn is the board's own, so nothing of it reaches the transcript as something the user
// said and an ended conversation never comes back to the rail because of it. The screen waits
// on none of it either: it has already cleared, and a submission that takes a minute — or a
// reply that was still being written when the end came — must not hold it there.

import { caseOffered, openCase, type CaseRecord } from '../case'
import { answeringOn, endChatShare, keyOf, readChat, sendChatMessage } from './chat'
import { isDiscussion, type Chat, type ChatTarget } from './types'

/** What the board says to open the submitting turn. The conversation itself is above it in
 *  the session, so this says what happened and what to do — never what was said. */
const SUBMIT =
  'I have ended this conversation and shared it with the AI4Kanban team. ' +
  'Read the whole conversation above, work out where the spec and what I expected came apart, ' +
  'and submit it. Nobody is reading this conversation any more, so settle every open point ' +
  'yourself and write down as a gap whatever you could not establish.'

/**
 * Submit this conversation, if it was shared.
 *
 * Called after the end has already happened, and answers nothing: every way out of it — the
 * switch was off, this machine does not take part, no card to file it under, a reply that
 * never finished — is a conversation that ends the way it always did.
 *
 * The switch goes off the moment that decision is made (#685), before the wait below. The
 * promise it carried has been kept by this end, so the next one is a fresh answer — and an
 * end that arrives while the wait is running finds the switch already off and queues nothing.
 * What it does NOT do is drop the submission: that is what turning it off BY HAND means, and
 * doing it here would have this end delete its own material.
 */
export async function shareOnEnd(target: ChatTarget): Promise<void> {
  const open = await endShared(target)
  if (!open) return
  await sendChatMessage(target, SUBMIT, {
    fromBoard: true,
    feedback: { cardId: open.cardId, share: true },
  })
}

/**
 * Everything the end does before that turn: decide, spend the switch, wait out a reply that
 * was still being written, and file the submission. Null is every reason not to submit one.
 *
 * Its own function because the order in it is the whole of #685 — and because the turn above
 * is the only part of an end that needs an agent.
 */
export async function endShared(target: ChatTarget): Promise<CaseRecord | null> {
  // Read before anything is waited on, so an ordinary end costs nothing at all.
  const card = endCard(target)
  if (!card) return null
  endChatShare(target)
  if (!(await replyOver(target))) return null
  // The decision already made, not the switch as it now stands: re-reading it here would
  // have the end block its own submission on the switch it has just turned off.
  return openEndCase(target, card)
}

/**
 * The card this conversation's end files its submission under, or null.
 *
 * The whole decision — is it shared, does this machine take part, which card is it about —
 * in one answer, so it can be made before the end waits on anything and acted on after.
 */
export function endCard(target: ChatTarget): number | null {
  const chat = readChat(target)
  if (!chat?.shareOnEnd || !caseOffered()) return null
  // A card's conversation is about that card. A discussion is about the card the user linked
  // — and `endBlocked` is why one that linked none never gets this far.
  const card = typeof target === 'number' ? target : chat.linkedCard
  return card ?? null
}

/**
 * File the submission this conversation's end makes, and answer with it.
 *
 * Split from the turn above so the decision stands on its own: `card` is that decision as it
 * was made, and without one it is made here. Null is every reason not to submit, and each of
 * them is a conversation that ends the way it always did.
 */
export function openEndCase(target: ChatTarget, card = endCard(target)): CaseRecord | null {
  const chat = readChat(target)
  if (!chat || !card) return null
  return openCase(keyOf(target), card, transcript(chat))
}

/** Why a conversation is not allowed to end (#659). A code, not a sentence: the screen has
 *  its own words for it, in its own two languages. */
export type EndBlock = 'share-needs-card'

/** What the terminal says for it — `akb raw discussion archive`, which has no screen. */
export const END_BLOCK_SAID: Record<EndBlock, string> = {
  'share-needs-card':
    'this discussion shares when it ends but is linked to no card. Link one, or turn sharing off.',
}

/**
 * Whether ending this conversation is refused, and why (#659).
 *
 * The switch is a promise that ending submits. A discussion that linked no card has nothing
 * to file that submission under, so ending it would keep the promise by sending nothing —
 * the one outcome the switch must never have. It is held instead, until a card is picked or
 * the switch goes off.
 *
 * Only a discussion: a card's conversation is about that card and has nothing to pick.
 */
export function endBlocked(target: ChatTarget): EndBlock | null {
  if (!isDiscussion(target)) return null
  const chat = readChat(target)
  if (!chat?.shareOnEnd || chat.linkedCard) return null
  return 'share-needs-card'
}

/** How long the end waits on a reply that was still being written when it came. A
 *  conversation is ended mid-reply often enough — nobody is reading it any more — and the
 *  submitting turn cannot start until that one is done. */
const REPLY_WAIT_MS = 10 * 60_000
const REPLY_STEP_MS = 2_000

/** Wait that reply out, so the submission carries the conversation as the user last saw it
 *  rather than stopping short of its final answer. False is one that never finished, and
 *  nothing is filed for it. */
export async function replyOver(target: ChatTarget): Promise<boolean> {
  for (let waited = 0; waited < REPLY_WAIT_MS; waited += REPLY_STEP_MS) {
    if (!answeringOn(target)) return true
    await new Promise((done) => setTimeout(done, REPLY_STEP_MS))
  }
  return !answeringOn(target)
}

/** The conversation as the pack carries it: both sides, in the order they were said, whole. A
 *  reply that stopped short goes as far as it got — what the user saw is what was shared.
 *
 *  The board's own turns are left out (#685). The submitting turn it starts is the board
 *  talking to itself about this conversation, and a second end would otherwise carry the last
 *  one's reply in as something the user had been told. */
function transcript(chat: Chat): string {
  return chat.messages
    .filter((message) => !message.fromBoard)
    .map((message) => `${message.role === 'you' ? 'User' : 'Agent'}: ${message.text}`)
    .join('\n\n')
}
