// What the memory review is handed of each Cloud task's chat (#748, #2065): the trimmed
// transcript, the card's modules, and the agents whose sections the card holds with the
// memory files each keeps.

import fs from 'node:fs'
import path from 'node:path'

import { canonicalSpecAgent } from '../spec-agent-names'
import { idPrefix, walkMd } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { agentMemoryDir, memoryNamesOf } from '../memory'
import { ARCHIVE, rel } from '../paths'
import { readTaskChat } from './task-chats'

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
  /** The Cloud task it belongs to. */
  key: string
  /** The archived card it belongs to. */
  card: { id: number; title: string }
  /** The card's own `modules:` — whose planning folder its notes go in. */
  modules: string[]
  agents: ReviewAgent[]
  /** The messages oldest first, trimmed of command echoes and warnings. */
  transcript: string
}

/** The chats of these Cloud tasks, as the Runner that answered them keeps them (#2065): each
 *  one whose card is archived here and that has a record. The Runner marks them reviewed. */
export function taskChatsToReview(tasks: string[]): ChatToReview[] {
  const cards = fs.existsSync(ARCHIVE) ? walkMd(ARCHIVE) : []
  const out: ChatToReview[] = []
  for (const task of [...new Set(tasks)]) {
    const slug = task.toLowerCase().replace(/_/g, '-')
    const file = cards.find((f) => /^\d+-/.test(path.basename(f)) && path.basename(f).endsWith(`-${slug}.md`))
    const id = file ? idPrefix(path.basename(file)) : null
    const card = file && id !== null ? readArchived(id, file) : null
    let lines: ReturnType<typeof readTaskChat> = []
    try {
      lines = readTaskChat(task)
    } catch {
      continue
    }
    if (!card || card.rejected || !lines.length) continue
    const messages = lines.map((l) => ({ role: l.role === 'user' ? ('you' as const) : ('agent' as const), text: l.text }))
    out.push(handed(task, messages, card))
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

function readArchived(id: number, file: string): ArchivedCard | null {
  try {
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
    if (text) said.push(`${agent ? 'agent' : 'user'}:\n${text}`)
  }
  return said.join('\n\n')
}
