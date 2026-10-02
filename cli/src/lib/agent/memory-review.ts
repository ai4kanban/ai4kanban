// Which conversations the memory review reads, and what it is handed of each (#748, #1322).
//
// A chat writes no memory of its own: one turn cannot see where the exchange is going. The
// review reads a conversation whole instead — once, after its card is archived, so it is
// complete when read. Everything the review needs is prepared here and printed with the
// task: the trimmed transcript, the card's modules, and the agents whose sections the card
// holds with the memory files each keeps.

import fs from 'node:fs'
import path from 'node:path'

import { canonicalSpecAgent } from '../spec-agent-names'
import { boardCardIds, idPrefix, walkMd } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { agentMemoryDir, memoryNamesOf } from '../memory'
import { ARCHIVE, CHATS_DIR, rel } from '../paths'
import { awaitsReview, becameCards, dropKeptChat, keptChats, readChat, readKeptChat, setChatReviewed } from './chat'
import { noteMemoryReviewRemaining } from './settings'
import { DISCUSSION_PREFIX, type ChatMessage, type ChatTarget } from './types'

/** How many archived cards' conversations one review run takes. */
export const REVIEW_BATCH_CARDS = 10

const CARD_KEY = /^card-(\d+)$/
const DISCUSSION_KEY = new RegExp(`^${DISCUSSION_PREFIX}[0-9a-f-]{36}$`)

/** An agent named on a conversation's card, and the memory it keeps. */
export interface ReviewAgent {
  name: string
  /** Its memory folder, repo-relative. */
  dir: string
  /** The files in that folder today. */
  files: string[]
}

/** One conversation the review is handed. */
export interface ChatToReview {
  /** The name it is marked reviewed by: `card-<id>`, `discussion-<uuid>`, or a kept chat's
   *  `card-<id>.<keptAt>`. */
  key: string
  /** The archived cards it belongs to: a card chat's own card, or every card a discussion
   *  became, in archive order. The last is the one its batch is counted by. */
  cards: { id: number; title: string }[]
  /** What a discussion was named, or empty. */
  subject: string
  discussion: boolean
  /** The `## <module>` topics its notes belong under: the cards' own `modules:`. */
  topics: string[]
  agents: ReviewAgent[]
  /** The messages oldest first, trimmed of command echoes and warnings. */
  transcript: string
}

export interface ReviewBatch {
  chats: ChatToReview[]
  /** Whether conversations are waiting beyond this batch. */
  remaining: boolean
}

/** The next batch: the conversations of the first `REVIEW_BATCH_CARDS` archived cards that
 *  have one waiting, by archive day then id. */
export function reviewBatch(): ReviewBatch {
  const waiting = waitingChats()
  const anchors = [...new Map(waiting.map((w) => [w.anchor.id, w.anchor])).values()].sort(byArchive)
  const taken = new Set(anchors.slice(0, REVIEW_BATCH_CARDS).map((c) => c.id))
  return {
    chats: waiting
      .filter((w) => taken.has(w.anchor.id))
      .sort((a, b) => byArchive(a.anchor, b.anchor) || Number(a.discussion) - Number(b.discussion) || a.at - b.at)
      .map(handed),
    remaining: anchors.length > taken.size,
  }
}

/** Whether any conversation is waiting — what the board's timer asks. Stops at the first. */
export function anyChatToReview(): boolean {
  return waitingChats(true).length > 0
}

/** Mark these conversations reviewed, and record whether any are still waiting. A kept chat
 *  is deleted instead (#1345). `unknown` are the keys no conversation answers to. */
export function markChatsReviewed(keys: string[]): { marked: string[]; unknown: string[]; remaining: boolean } {
  const now = Date.now()
  const marked: string[] = []
  const unknown: string[] = []
  for (const key of [...new Set(keys)]) {
    const target = targetOf(key)
    if (dropKeptChat(key) || (target !== null && setChatReviewed(target, now))) marked.push(key)
    else unknown.push(key)
  }
  const remaining = anyChatToReview()
  noteMemoryReviewRemaining(remaining, now)
  return { marked, unknown, remaining }
}

// ---- which are waiting ------------------------------------------------------

interface ArchivedCard {
  id: number
  title: string
  /** Its `archived:` day, or empty. */
  day: string
  modules: string[]
  rejected: boolean
  body: string
}

interface Waiting {
  key: string
  messages: ChatMessage[]
  /** What a discussion was named. */
  title?: string
  discussion: boolean
  /** Where it sorts among its card's conversations: when a kept chat was set aside, and
   *  last for the live one. */
  at: number
  /** Its archived cards that were not rejected, in archive order. */
  cards: ArchivedCard[]
  /** The last of them to be archived. */
  anchor: ArchivedCard
}

const byArchive = (a: ArchivedCard, b: ArchivedCard): number => a.day.localeCompare(b.day) || a.id - b.id

// A conversation waits when it was never marked, was last spoken to after `reviewedBefore`,
// and its card is archived — every card it became, for a discussion. A card still on the
// board, gone from both, or rejected keeps its conversation out. A kept chat (#1345) passed
// the first two when it was set aside.
function waitingChats(firstOnly = false): Waiting[] {
  const archive = archiveIndex()
  if (!archive.size) return []
  const found: Waiting[] = []
  for (const { key, cardId, keptAt } of keptChats()) {
    const card = archive.get(cardId)?.()
    if (!card || card.rejected) continue
    const messages = readKeptChat(key)
    if (!messages?.length) continue
    found.push({ key, messages, discussion: false, at: keptAt, cards: [card], anchor: card })
    if (firstOnly) return found
  }
  for (const key of chatKeys()) {
    const target = targetOf(key)
    if (target === null) continue
    // The file name alone settles most card chats, so they are never opened.
    if (typeof target === 'number' && !archive.has(target)) continue
    const chat = readChat(target)
    if (!chat || !awaitsReview(chat)) continue
    const ids = typeof target === 'number' ? [target] : becameCards(chat)
    if (!ids.length || !ids.every((id) => archive.has(id))) continue
    const cards = ids
      .map((id) => archive.get(id)!())
      .filter((card): card is ArchivedCard => card !== null && !card.rejected)
      .sort(byArchive)
    if (!cards.length) continue
    found.push({
      key,
      messages: chat.messages,
      title: chat.title,
      discussion: typeof target !== 'number',
      at: Number.MAX_SAFE_INTEGER,
      cards,
      anchor: cards[cards.length - 1]!,
    })
    if (firstOnly) break
  }
  return found
}

function chatKeys(): string[] {
  try {
    return fs
      .readdirSync(CHATS_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort()
  } catch {
    return []
  }
}

// A card's id, a discussion's target, or null for anything else — the board's own
// conversation, a picture folder, a marker file.
function targetOf(key: string): ChatTarget {
  const card = CARD_KEY.exec(key)
  if (card) return Number(card[1])
  return DISCUSSION_KEY.test(key) ? (key as ChatTarget) : null
}

// Every card in the archive and off the board, by id — one walk, each file read only when
// a conversation asks for it.
function archiveIndex(): Map<number, () => ArchivedCard | null> {
  const index = new Map<number, () => ArchivedCard | null>()
  if (!fs.existsSync(ARCHIVE)) return index
  const open = boardCardIds()
  for (const file of walkMd(ARCHIVE)) {
    const name = path.basename(file)
    const id = name === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(name)
    if (id === null || open.has(id)) continue
    let read: ArchivedCard | null | undefined
    index.set(id, () => (read === undefined ? (read = readArchived(id, file)) : read))
  }
  return index
}

function readArchived(id: number, file: string): ArchivedCard | null {
  try {
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    if (!meta) return null
    return { id, title: meta.title, day: String(meta.archived ?? ''), modules: meta.modules ?? [], rejected: meta.rejected, body }
  } catch {
    return null
  }
}

// ---- what the review is handed ----------------------------------------------

function handed({ key, messages, title, discussion, cards }: Waiting): ChatToReview {
  return {
    key,
    cards: cards.map(({ id, title }) => ({ id, title })),
    subject: discussion ? (title ?? '') : '',
    discussion,
    topics: [...new Set(cards.flatMap((c) => c.modules))],
    agents: [...new Set(cards.flatMap((c) => agentsOn(c.body)))].map((name) => ({
      name,
      dir: rel(agentMemoryDir(name)),
      files: [...memoryNamesOf(name)],
    })),
    transcript: trimmed(messages),
  }
}

// The agents whose `## By `<agent>` agent` sections a card holds, by the name each goes by now.
function agentsOn(body: string): string[] {
  return [...body.matchAll(/^##\s+By\s+`([^`]+)`\s+(?:skill|agent)\s*$/gim)].map((m) => canonicalSpecAgent(m[1]!))
}

// The user's messages whole; the agent's without the lines that echo a command (`⏺`) or
// report a failure (`⚠`).
function trimmed(messages: ChatMessage[]): string {
  const said: string[] = []
  for (const message of messages) {
    const agent = message.role === 'agent'
    const text = (agent ? message.text.split('\n').filter((line) => !/^\s*[⏺⚠]/.test(line)).join('\n') : message.text)
      .replace(/\n{3,}/g, '\n\n')
      // A message cannot close its own block.
      .replace(/<\/conversation/gi, '<\\/conversation')
      .trim()
    if (text) said.push(`${agent ? 'agent' : message.fromBoard ? 'board' : 'user'}:\n${text}`)
  }
  return said.join('\n\n')
}
