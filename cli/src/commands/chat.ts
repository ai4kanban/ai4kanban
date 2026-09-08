// Talking to the agent, rather than setting it a job.
//
// `akb chat 12 "…"` is about that card; everything else is a discussion (#496) — the same
// discussions the board app lists in its rail, so the terminal shares them instead of
// holding a conversation of its own. Each message lands in the session the last one left
// open, so the agent still has everything said before — which is what makes it a
// conversation and not a run repeated (lib/agent/chat.ts).
//
// With no message and no card it prints the discussions going. There is no prompt to type
// into: every message is one command, so the same conversation is picked up from a terminal,
// from another terminal, or from the board app, and closing any of them loses nothing.

import { clearChat, pickChatRuntime, readChatView, sendChatMessage } from '../lib/agent/chat'
import { asDiscussion, listDiscussions, startDiscussion } from '../lib/agent/discussions'
import { titleOf } from '../lib/agent/sessions'
import { isDiscussion, type ChatTarget, type ChatView } from '../lib/agent/types'
import { collecting, say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

/** `akb chat`, as its command declares it (lib/cli/agent.ts). */
export interface ChatOptions {
  /** The card the conversation is about; left off, it is a discussion. */
  id?: number
  message?: string[]
  clear?: boolean
  runtime?: string
  /** Which discussion a message continues. Left off, it is the one spoken to most recently. */
  discussion?: string
  /** Start a fresh discussion and say this into it. */
  new?: boolean
}

export async function cmdChat(opts: ChatOptions, program = 'akb'): Promise<MoveResult> {
  const message = (opts.message ?? []).join(' ').trim()
  // The list is what `akb chat` on its own is for: no card, nothing to say, and nothing
  // naming one discussion.
  if (opts.id === undefined && !message && !opts.clear && opts.runtime === undefined && !opts.new && !opts.discussion) {
    return listing(program)
  }
  const cardId = opts.id ?? discussionFor(opts, Boolean(message))
  const about = describe(cardId)

  // Clearing is the one thing that doesn't ask whether the card is still on the board:
  // it is how a conversation left behind by anything is tidied away.
  if (opts.clear === true) {
    if (message) die('--clear forgets the conversation, so it takes no message', { kind: 'bad-option' })
    const had = clearChat(cardId)
    say(had ? `forgot the conversation about ${about} — the next message starts a fresh one.` : `no conversation about ${about} to forget.`)
    return { cardId, cleared: had }
  }

  if (typeof cardId === 'number') assertCardExists(cardId)

  // What this one conversation runs on (#272, #467) — one runtime, before anything is said on
  // it. It stays with the transcript, so the next `akb chat` and the board app read the same
  // pick.
  if (opts.runtime !== undefined) {
    const id = opts.runtime.trim()
    const picked = pickChatRuntime(cardId, id || null)
    if ('error' in picked) die(picked.error, { kind: 'chat-refused' })
    const now = readChatView(cardId).pick
    say(
      picked.cleared
        ? `the conversation about ${about} now runs "${now.name}" — what it had is gone, because that session was the old CLI's.`
        : `the conversation about ${about} now runs "${now.name}".`,
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

// ---- which conversation this is --------------------------------------------

/** How a conversation is named in a sentence. */
function describe(target: ChatTarget): string {
  if (typeof target === 'number') return `#${target}`
  return isDiscussion(target) ? 'this discussion' : 'the board'
}

/** The discussion a message continues: the one named, a fresh one where `--new` was asked
 *  for, else the one spoken to most recently. A first message on a board holding none opens
 *  one — there is nothing to carry on, and refusing it would be a no with no way past it. */
function discussionFor(opts: ChatOptions, saying: boolean): ChatTarget {
  if (opts.discussion) {
    const named = asDiscussion(opts.discussion)
    if (!named) {
      die(`"${opts.discussion}" is not a discussion of this board's. \`chat\` on its own lists them.`, {
        kind: 'bad-option',
      })
    }
    return named
  }
  if (opts.new) return startDiscussion()
  const latest = listDiscussions()[0]
  if (latest) return latest.target
  if (saying) return startDiscussion()
  die('no discussions going. Say something to start one: `chat "your message"`.', { kind: 'bad-option' })
}

/** `akb chat` on its own: what is going, and how to carry one on. */
function listing(program: string): MoveResult {
  const rows = listDiscussions()
  if (!rows.length) {
    say('no discussions going.')
  } else {
    say(`${rows.length} discussion${rows.length === 1 ? '' : 's'}, most recently spoken to first:`)
    for (const row of rows) {
      const marks = [`${row.messages} message${row.messages === 1 ? '' : 's'}`, `${ago(Date.now() - row.updatedAt)} ago`]
      if (row.answering) marks.push('answering')
      say('')
      say(`  ${row.name || '(unnamed)'}`)
      say(`  ${row.target} — ${marks.join(' · ')}`)
      if (row.plan) say(`  ${row.plan}`)
    }
  }
  say('')
  say(`carry one on: ${program} chat --discussion <id> "your message"`)
  say(`start a new:  ${program} chat --new "your message"`)
  say(`one card's:   ${program} chat <id> "your message"`)
  return { discussions: rows }
}

// A conversation about a card the board hasn't got is a typo, not a conversation.
function assertCardExists(cardId: number): void {
  const title = titleOf(cardId)
  if (!title) die(`no card #${cardId} on this board. \`akb raw list\` says what is open.`, { kind: 'card-not-found', id: cardId })
}

// ---- how a conversation reads ----------------------------------------------

function printChat(view: ChatView, program: string): void {
  const about = describe(view.cardId)
  // How this same conversation is named again on the command line under it.
  const target =
    typeof view.cardId === 'number'
      ? ` ${view.cardId}`
      : isDiscussion(view.cardId)
        ? ` --discussion ${view.cardId}`
        : ''
  const chat = view.chat
  // What it runs on, said whether or not anything has been said on it — a pick made before
  // the first message is still the pick.
  const { pick } = view
  const runs =
    `${pick.name} — ${pick.harness}${pick.model ? ` · ${pick.model}` : ''}` +
    (pick.own ? " — this conversation's own runtime, not the board's" : '')
  if (!chat || !chat.messages.length) {
    say(`nothing said about ${about} yet. it runs ${runs}`)
  } else {
    const count = chat.messages.length
    say(`the conversation about ${about} — ${count} message${count === 1 ? '' : 's'}, with ${runs}`)
    for (const m of chat.messages) {
      // What a message carried besides its words (#441), said rather than drawn: a printed
      // conversation is the one place a picture can't be shown, so it is counted instead.
      const shots = m.images?.length ?? 0
      say('')
      say(`${m.role} · ${ago(Date.now() - m.at)} ago${shots ? ` · ${shots} picture${shots === 1 ? '' : 's'}` : ''}`)
      say(indent(m.text || (shots ? '(the pictures are the message)' : '(nothing)')))
      if (m.stoppedWhy) say(`  — ${m.stoppedWhy}`)
    }
  }
  say('')
  if (view.blocked) say(view.blocked)
  say(`say something:   ${program} chat${target} "your message"`)
  say(`another runtime: ${program} chat${target} --runtime <id>    ("" for the board's)`)
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
