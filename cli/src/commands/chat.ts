// Talking to the agent, rather than setting it a job.
//
// `akb chat "…"` is about the whole board, `akb chat 12 "…"` about that card, and the two
// are separate conversations that never mix. Each message lands in the session the last one
// left open, so the agent still has everything said before — which is what makes it a
// conversation and not a run repeated (lib/agent/chat.ts).
//
// With no message it prints the conversation so far. There is no prompt to type into: every
// message is one command, so the same conversation is picked up from a terminal, from
// another terminal, or from the board app, and closing any of them loses nothing.

import { clearChat, pickChatAgent, pickChatModel, readChatView, sendChatMessage } from '../lib/agent/chat'
import { harnessLabel } from '../lib/agent/resolve'
import { titleOf } from '../lib/agent/sessions'
import type { ChatView } from '../lib/agent/types'
import { collecting, say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

/** `akb chat`, as its command declares it (lib/cli/agent.ts). */
export interface ChatOptions {
  /** The card the conversation is about; left off, it is the board's. */
  id?: number
  message?: string[]
  clear?: boolean
  agent?: string
  model?: string
}

export async function cmdChat(opts: ChatOptions, program = 'akb'): Promise<MoveResult> {
  const cardId = opts.id ?? null
  const message = (opts.message ?? []).join(' ').trim()
  const about = cardId === null ? 'the board' : `#${cardId}`

  // Clearing is the one thing that doesn't ask whether the card is still on the board:
  // it is how a conversation left behind by anything is tidied away.
  if (opts.clear === true) {
    if (message) die('--clear forgets the conversation, so it takes no message', { kind: 'bad-option' })
    const had = clearChat(cardId)
    say(had ? `forgot the conversation about ${about} — the next message starts a fresh one.` : `no conversation about ${about} to forget.`)
    return { cardId, cleared: had }
  }

  if (cardId !== null) assertCardExists(cardId)

  // What this one conversation runs on (#272), before anything is said on it. Both stay
  // with the transcript, so the next `akb chat` and the board app read the same pick.
  if (opts.agent !== undefined) {
    const name = opts.agent.trim()
    const picked = pickChatAgent(cardId, name || null)
    if ('error' in picked) die(picked.error, { kind: 'chat-refused' })
    say(
      picked.cleared
        ? `the conversation about ${about} now runs ${harnessLabel(picked.harness)} — what it had is gone, because that session was the old agent's.`
        : `the conversation about ${about} now runs ${harnessLabel(picked.harness)}.`,
    )
  }
  if (opts.model !== undefined) {
    const id = opts.model.trim()
    const picked = pickChatModel(cardId, id || null)
    if ('error' in picked) die(picked.error, { kind: 'chat-refused' })
    say(
      id
        ? `the conversation about ${about} now runs on ${id}.`
        : `the conversation about ${about} is back on the board's model.`,
    )
  }

  const view = readChatView(cardId)
  if (!message) {
    printChat(view, program)
    return { cardId, chat: view.chat, canChat: view.canChat, blocked: view.blocked, pick: view.pick }
  }
  if (view.blocked) die(view.blocked, { kind: 'chat-refused' })

  // The reply goes to the terminal as it is written. Under `--json` it does not: the answer
  // is one object, and pieces of a reply landing in the middle of it would be no answer at
  // all — the whole reply comes back in that object instead.
  const live = !collecting()
  if (live) process.stdout.write('\n')
  const sent = await sendChatMessage(cardId, message, {
    onText: live ? (chunk) => process.stdout.write(chunk) : undefined,
    // Ctrl-C ends the reply rather than this command: what arrived is still kept, and the
    // conversation carries on from the next message.
    onOpen: live
      ? (stop) => {
          process.once('SIGINT', stop)
        }
      : undefined,
  })
  if ('error' in sent) die(sent.error, { kind: 'chat-refused' })
  if (live) process.stdout.write('\n')
  if (sent.stoppedWhy) {
    say('')
    say(`— ${sent.stoppedWhy} What arrived is kept; send another message to carry on.`)
  }
  return {
    cardId,
    reply: sent.text,
    stopped: sent.stoppedWhy,
    model: sent.model,
    messages: sent.chat.messages.length,
  }
}

// A conversation about a card the board hasn't got is a typo, not a conversation.
function assertCardExists(cardId: number): void {
  const title = titleOf(cardId)
  if (!title) die(`no card #${cardId} on this board. \`akb board list\` says what is open.`, { kind: 'card-not-found', id: cardId })
}

// ---- how a conversation reads ----------------------------------------------

function printChat(view: ChatView, program: string): void {
  const about = view.cardId === null ? 'the board' : `#${view.cardId}`
  const target = view.cardId === null ? '' : ` ${view.cardId}`
  const chat = view.chat
  // What it runs on, said whether or not anything has been said on it — a pick made before
  // the first message is still the pick.
  const { pick } = view
  const own = [pick.ownAgent && 'agent', pick.ownModel && 'model'].filter(Boolean).join(' and ')
  const runs =
    `${harnessLabel(pick.harness)}${pick.model ? ` · ${pick.model}` : ''}` +
    (own ? ` — this conversation's own ${own}, not the board's` : '')
  if (!chat || !chat.messages.length) {
    say(`nothing said about ${about} yet. it runs ${runs}`)
  } else {
    const count = chat.messages.length
    say(`the conversation about ${about} — ${count} message${count === 1 ? '' : 's'}, with ${runs}`)
    for (const m of chat.messages) {
      say('')
      say(`${m.role} · ${ago(Date.now() - m.at)} ago`)
      say(indent(m.text || '(nothing)'))
      if (m.stoppedWhy) say(`  — ${m.stoppedWhy}`)
    }
  }
  say('')
  if (view.blocked) say(view.blocked)
  say(`say something: ${program} chat${target} "your message"`)
  say(`another model: ${program} chat${target} --model <id>        ("" for the board's)`)
  say(`another agent: ${program} chat${target} --agent <name>      (starts the conversation over)`)
  if (chat) say(`start again:   ${program} chat${target} --clear`)
}

const indent = (text: string): string =>
  text
    .trimEnd()
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d`
}
