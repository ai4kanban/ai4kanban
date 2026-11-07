// What the memory review is handed of each archived Cloud task (#748, #2065, #165, #188, #189):
// the card's summary, what the user approved or reversed on it, the trimmed chat, its modules,
// and the agents whose sections it holds with the memory files each keeps. A card that settled
// nothing is left out.

import fs from 'node:fs'
import path from 'node:path'

import { canonicalSpecAgent } from '../spec-agent-names'
import { locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { agentMemoryDir, memoryNamesOf } from '../memory'
import { rel } from '../paths'
import { readTaskChat } from './task-chats'

/** An agent named on a conversation's card, and the memory it keeps. */
export interface ReviewAgent {
  name: string
  /** Its memory folder, repo-relative. */
  dir: string
  /** The files in that folder today. */
  files: string[]
}

/** One archived card the review is handed. */
export interface ChatToReview {
  /** The Cloud task it belongs to. */
  key: string
  /** The archived card it belongs to. */
  card: { id: number; title: string }
  /** The card's own `modules:` — whose planning folder its notes go in. */
  modules: string[]
  agents: ReviewAgent[]
  /** The card's opening, as written: background for the review, never a reason to run one. */
  summary: string
  /** `Worth noting` and `Overruled by the user`, as written. `Worth noting after implementation`
   *  is the builder's own and the user never approved it, so it stays out (#188). */
  settled: string
  /** The messages oldest first, trimmed of command echoes and warnings; empty with no chat. */
  transcript: string
}

/** These tasks, each `<task>:<card number>`: every one whose card is archived here, not rejected,
 *  and settled something — a chat alone is no reason to spend a run (#189). The Runner marks
 *  them all reviewed. */
export function taskChatsToReview(tasks: string[]): ChatToReview[] {
  const out: ChatToReview[] = []
  for (const ref of [...new Set(tasks)]) {
    const [task, number] = ref.split(':')
    const card = readArchived(Number(number))
    if (!card || card.rejected) continue
    let lines: ReturnType<typeof readTaskChat> = []
    try {
      lines = readTaskChat(task!)
    } catch {
      // read as no chat: the card is still reviewed
    }
    const messages = lines.map((l) => ({ role: l.role === 'user' ? ('you' as const) : ('agent' as const), text: l.text }))
    const review = handed(task!, messages, card)
    if (review.settled) out.push(review)
  }
  return out
}

interface ChatMessage {
  role: 'you' | 'agent'
  text: string
}

// ---- the archived card ------------------------------------------------------

interface ArchivedCard {
  id: number
  title: string
  modules: string[]
  rejected: boolean
  body: string
}

function readArchived(id: number): ArchivedCard | null {
  const found = Number.isInteger(id) && id > 0 ? locateArchived(id) : null
  if (!found) return null
  try {
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    if (!meta) return null
    return { id, title: meta.title, modules: meta.modules ?? [], rejected: meta.rejected, body }
  } catch {
    return null
  }
}

// ---- what the review is handed ----------------------------------------------

function handed(key: string, messages: ChatMessage[], card: ArchivedCard): ChatToReview {
  return {
    key,
    card: { id: card.id, title: card.title },
    modules: [...new Set(card.modules)],
    agents: [...new Set(agentsOn(card.body))].map((name) => ({
      name,
      dir: rel(agentMemoryDir(name)),
      files: [...memoryNamesOf(name)],
    })),
    summary: closed(summaryOf(card.body)),
    settled: closed(settledBy(card.body)),
    transcript: trimmed(messages),
  }
}

const OVERRULED = 'Overruled by the user'

// What stands above the card's first section.
function summaryOf(body: string): string {
  const lines = body.split('\n')
  const end = lines.findIndex((line) => /^##(?!#)\s/.test(line) || line.trim() === '<!-- agent -->')
  return (end < 0 ? lines : lines.slice(0, end)).join('\n').trim()
}

// What the user approved on the card and the agent's calls they reversed, each under its heading.
function settledBy(body: string): string {
  const kept = new Map<string, string[]>()
  let section: string | null = null
  for (const line of body.split('\n')) {
    const title = /^##\s+(.+?)\s*$/.exec(line)?.[1]
    if (title) section = title === 'Worth noting' ? title : null
    else if (/^###\s+Overruled by the user\s*$/.test(line)) section = OVERRULED
    else if ((/^###\s/.test(line) && section === OVERRULED) || line.trim() === '<!-- agent -->') section = null
    else if (section) kept.set(section, [...(kept.get(section) ?? []), line])
  }
  return [...kept]
    .map(([heading, lines]) => [heading, lines.join('\n').trim()])
    .filter(([, text]) => text)
    .map(([heading, text]) => `## ${heading}\n${text}`)
    .join('\n\n')
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
    const text = closed(agent ? message.text.split('\n').filter((line) => !/^\s*[⏺⚠]/.test(line)).join('\n') : message.text)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (text) said.push(`${agent ? 'agent' : 'user'}:\n${text}`)
  }
  return said.join('\n\n')
}

// Nothing a card or a message says can close its own block.
const closed = (text: string): string => text.replace(/<\/conversation/gi, '<\\/conversation')
