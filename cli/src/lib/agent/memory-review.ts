// Which conversations the daily memory review has to read (#748).
//
// A chat writes no memory of its own: one turn cannot see where the exchange is going, so a
// "what if" thrown out and taken back three turns later used to land in `decisions.md` as a
// decision. The review reads each conversation right through instead, once a day, and
// decides from the whole of it.
//
// What this file answers is only WHICH ones. The conversations are the `chats/` files on
// this machine — not the rail's list: a card that has left the board and a discussion
// somebody put away both keep their transcript, and what was settled in one is worth
// remembering whatever happened to the row.
//
// Two stages, because the first of them runs on every tick of the board's timer. The
// shortlist is the files' modification times alone — no JSON parsed, no board walked. Only
// those files are then opened, and only the review itself resolves the card behind one.

import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { CHATS_DIR, MEMORY, rel } from '../paths'
import { DISCUSSION_PREFIX } from './types'

/** The name a card conversation's file carries (`./chat.ts` names it). */
const CARD_FILE = /^card-(\d+)\.json$/

/** And a discussion's — the prefix plus the uuid it was opened under. */
const DISCUSSION_FILE = new RegExp(`^${DISCUSSION_PREFIX}[0-9a-f-]{36}\\.json$`)

/** One conversation the review has to read. */
export interface ChatToReview {
  /** The transcript to read, repo-relative — a JSON file holding `messages[]`. */
  file: string
  /** What it is about: the card's title, or the subject the discussion was named by. */
  name: string
  /** The card it hangs on, or null for a discussion. */
  cardId: number | null
  /** Where that card is: on the board, in the archive, or gone from both. Null for a
   *  discussion, which hangs on no card at all. */
  card: 'open' | 'archived' | 'gone' | null
  /** The memory folders a note off this conversation belongs in, repo-relative — the copies
   *  the card's `modules:` names, or the project-wide one. */
  memory: string[]
  /** How many messages the transcript holds. */
  messages: number
}

/** The conversations spoken to since `since`, as the review reads them.
 *
 *  `since` is a millisecond time — the moment the last review that passed began. `0` is a
 *  board that has never reviewed, and takes every conversation on the machine. */
export function chatsToReview(since: number): ChatToReview[] {
  return spokenTo(since).map(({ file, target, chat }) => {
    const cardId = typeof target === 'number' ? target : null
    const found = cardId === null ? null : cardOf(cardId)
    return {
      file: rel(file),
      name: found?.title || subjectOf(chat) || (cardId === null ? '(unnamed)' : `#${cardId}`),
      cardId,
      card: cardId === null ? null : found ? found.where : 'gone',
      memory: memoryDirs(found?.modules ?? []),
      messages: messagesOf(chat).length,
    }
  })
}

/** Whether anything has been said since `since` — what the board's timer asks once a tick.
 *  It stops at the first conversation that has, and looks up no card. */
export function anyChatSince(since: number): boolean {
  return spokenTo(since, true).length > 0
}

// ---- the two stages ---------------------------------------------------------

interface Spoken {
  file: string
  target: number | string
  chat: Record<string, unknown>
}

// The shortlist, then the read. A file is only opened when its modification time is past the
// window, and `updatedAt` is what decides in the end: archiving a discussion or naming one
// rewrites the file without anything having been said in it.
function spokenTo(since: number, firstOnly = false): Spoken[] {
  const found: Spoken[] = []
  for (const name of chatFiles()) {
    const file = path.join(CHATS_DIR, name)
    const target = targetOf(name)
    if (target === null) continue
    let mtime = 0
    try {
      mtime = fs.statSync(file).mtimeMs
    } catch {
      continue // it went away between the listing and the stat
    }
    if (mtime <= since) continue
    const chat = readTranscript(file)
    if (!chat || !messagesOf(chat).length) continue
    const updatedAt = typeof chat.updatedAt === 'number' ? chat.updatedAt : mtime
    if (updatedAt <= since) continue
    found.push({ file, target, chat })
    if (firstOnly) break
  }
  return found
}

function chatFiles(): string[] {
  try {
    return fs.readdirSync(CHATS_DIR).sort()
  } catch {
    return []
  }
}

// A card's id, a discussion's uuid, or null for anything else in the folder — the board's own
// conversation, a picture folder, a marker file.
function targetOf(name: string): number | string | null {
  const card = CARD_FILE.exec(name)
  if (card) return Number(card[1])
  if (DISCUSSION_FILE.test(name)) return name.slice(0, -'.json'.length)
  return null
}

// Read only, and a transcript nobody can parse reads as no conversation: the answer to a
// damaged file is to leave it out of the review, not to fail the review.
function readTranscript(file: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const messagesOf = (chat: Record<string, unknown>): unknown[] =>
  Array.isArray(chat.messages) ? chat.messages : []

// What a discussion is called, when the board named it off the plan it settled. A card's own
// title is read off the card instead, which is the one that stays right when it is renamed.
const subjectOf = (chat: Record<string, unknown>): string =>
  typeof chat.title === 'string' ? chat.title.trim() : ''

// ---- the card behind a conversation -----------------------------------------

// The card the conversation hangs on, wherever it is now. The archive is read too: a card
// finished a week ago is still what says which module's memory its conversation belongs in.
function cardOf(id: number): { where: 'open' | 'archived'; title: string; modules: string[] } | null {
  for (const [where, found] of [
    ['open', locate(id)],
    ['archived', locateArchived(id)],
  ] as const) {
    if (!found) continue
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    try {
      const meta = parseFrontmatter(fs.readFileSync(file, 'utf8')).meta
      return { where, title: meta?.title ?? '', modules: meta?.modules ?? [] }
    } catch {
      return { where, title: '', modules: [] }
    }
  }
  return null
}

// Which copy of the memory set a note belongs in — "The memory set" in `akb guide board`. A
// card naming modules points at each of theirs; everything else at the project's own. Read
// only: nothing is scaffolded here, and the review's own write is what creates a file.
const memoryDirs = (modules: string[]): string[] =>
  modules.length ? modules.map((m) => rel(path.join(MEMORY, m))) : [rel(MEMORY)]
