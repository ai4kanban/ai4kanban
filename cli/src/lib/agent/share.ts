// What a shared conversation does when it ends (#659, #679).
//
// The switch under the box collects nothing while the conversation is going. It says one
// thing only: that ending this conversation submits it. So this file is the whole cost of
// "share with the team" — one turn, after the end, on the conversation that just ended.
//
// The turn is the board's own, so nothing of it reaches the transcript as something the user
// said and an ended conversation never comes back to the rail because of it. The screen waits
// on none of it either: it has already cleared, and a submission that takes a minute — or a
// reply that was still being written when the end came — must not hold it there.

import { caseOffered, openCase, type CaseRecord } from '../case'
import { answeringOn, keyOf, readChat, sendChatMessage } from './chat'
import type { Chat, ChatTarget } from './types'

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
 */
export async function shareOnEnd(target: ChatTarget): Promise<void> {
  // Read before anything is waited on, so an ordinary end costs nothing at all.
  if (!readChat(target)?.shareOnEnd) return
  if (!(await replyOver(target))) return
  const open = openEndCase(target)
  if (!open) return
  await sendChatMessage(target, SUBMIT, {
    fromBoard: true,
    feedback: { cardId: open.cardId, share: true },
  })
}

/**
 * File the submission this conversation's end makes, and answer with it.
 *
 * Split from the turn above so the decision — is it shared, does this machine take part,
 * which card is it about — stands on its own. Null is every reason not to submit, and each of
 * them is a conversation that ends the way it always did.
 */
export function openEndCase(target: ChatTarget): CaseRecord | null {
  const chat = readChat(target)
  if (!chat?.shareOnEnd || !caseOffered()) return null
  // A card's conversation is about that card. A discussion is about the card the user linked
  // — and one that linked none has nothing to file a submission under. Whether such a
  // discussion can be shared at all is #659's open question, not this file's.
  const card = typeof target === 'number' ? target : chat.linkedCard
  if (!card) return null
  return openCase(keyOf(target), card, transcript(chat))
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

/** The conversation as the pack carries it: both sides, in the order they were said. A reply
 *  that stopped short goes as far as it got — what the user saw is what was shared. */
function transcript(chat: Chat): string {
  return chat.messages
    .map((message) => `${message.role === 'you' ? 'User' : 'Agent'}: ${message.text}`)
    .join('\n\n')
}
