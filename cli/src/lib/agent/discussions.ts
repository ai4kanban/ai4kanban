// The discussions a board is holding (#496).
//
// A discussion is a conversation with an identity: its own transcript, its own agent session
// and its own plans. A board holds many at once, so Create task opens a new one on every
// press and the rail lists the ones already going.
//
// There is no index file. The list IS the `.chats/discussion-*.json` files — one read of a
// folder that never holds more than a couple of dozen entries — so nothing can drift out of
// step with the conversations themselves.

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { CHATS_DIR } from '../paths'
import { dropPlan, planPathInText } from '../plans'
import {
  answeringOn,
  chatFile,
  chatPlan,
  firstLine,
  keyOf,
  readChat,
  setChatArchived,
  setChatTitle,
} from './chat'
import {
  DISCUSSION_PREFIX,
  discussionIdOf,
  discussionTarget,
  isDiscussion,
  type Chat,
  type DiscussionRow,
  type DiscussionTarget,
} from './types'

/** How many discussions the rail holds. Past this the oldest drop off on their own: a board
 *  with a hundred subjects going is a list nobody reads, and the transcript of one that fell
 *  off is still on disk. */
export const KEEP = 20

/** The names this folder's discussion files are allowed to have, so nothing outside it can
 *  be read as one. */
const FILE = new RegExp(`^${DISCUSSION_PREFIX}[0-9a-f-]{36}\\.json$`)

// Whether a string is an id this board would have written. Checked wherever one arrives from
// a browser or a terminal, so a target can never name a file of ours by accident.
const knownDiscussionId = (id: string): boolean => FILE.test(`${DISCUSSION_PREFIX}${id}.json`)

/** Open a discussion. Nothing is written until the first message: an empty file would be a
 *  row for a subject nobody has named yet, and Create task opens one on every press. */
export function startDiscussion(): DiscussionTarget {
  return discussionTarget(randomUUID())
}

/** Every discussion this board is holding, most recently spoken to first.
 *
 *  It is also where the list is held to its length: the ones past `KEEP` are archived here,
 *  oldest first, so nothing has to run on a timer and a board left alone for a month tidies
 *  itself the moment someone looks at it. One whose agent is answering is never taken — the
 *  reply it is writing has somewhere to land. */
export function listDiscussions(): DiscussionRow[] {
  adoptBoardChat()
  const rows: DiscussionRow[] = []
  for (const target of discussionFiles()) {
    const chat = readChat(target)
    if (!chat || chat.archived) continue
    rows.push(rowOf(target, chat))
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt)
  const over = rows.slice(KEEP).filter((row) => !row.answering)
  for (const row of over) setChatArchived(row.target, true)
  return over.length ? rows.filter((row) => !over.includes(row)) : rows
}

/** Name one discussion. The board writes this off the plan the discussion named; nothing
 *  asks the agent to spell it. */
export function titleDiscussion(target: DiscussionTarget, title: string): void {
  setChatTitle(target, title)
}

/** Take one discussion out of the list, and its plans with it: a discussion put away is the
 *  end of the subject, and a plan nothing came of is a file nobody would ever open again —
 *  the board lists plans nowhere, so what is left in `plans/` is unreachable by hand.
 *
 *  A plan handed to a run stays. The cards that run wrote name it in `## Source`, and that
 *  path is the only way back to the file.
 *
 *  Its transcript stays on disk — `akb chat --clear` is still the only thing that forgets a
 *  conversation. */
export function archiveDiscussion(
  target: DiscussionTarget,
): { ok: true; plans: string[] } | { error: string } {
  const chat = readChat(target)
  if (!chat) return { error: `no discussion called "${target}" on this board.` }
  const dropped = (chat.plans ?? []).filter((p) => !p.run && dropPlan(p.path)).map((p) => p.path)
  setChatArchived(target, true)
  return { ok: true, plans: dropped }
}

// ---- the files -------------------------------------------------------------

function discussionFiles(): DiscussionTarget[] {
  let names: string[]
  try {
    names = fs.readdirSync(CHATS_DIR)
  } catch {
    return []
  }
  return names.filter((name) => FILE.test(name)).map((name) => name.slice(0, -'.json'.length) as DiscussionTarget)
}

function rowOf(target: DiscussionTarget, chat: Chat): DiscussionRow {
  const plan = chatPlan(chat)
  return {
    id: discussionIdOf(target),
    target,
    // What the agent called it once it had read the exchange — the title of the plan it
    // named — else the first line the user typed. Derived rather than written down, so a
    // discussion held in a terminal and one adopted from an older board are named too.
    name: chat.title ?? firstLine(chat.messages.find((m) => m.role === 'you')?.text ?? ''),
    updatedAt: chat.updatedAt,
    messages: chat.messages.length,
    answering: answeringOn(target),
    plan: plan ? planPathInText(plan.path) : undefined,
  }
}

/** The mark that the upgrade below has been done on this board. It is written on the first
 *  read whether or not there was anything to move, because the board's own chat rail is
 *  still a conversation of its own (Window.tsx) — without the mark, every message typed
 *  into it would be swallowed into a discussion by the next poll. */
const adoptedMark = (): string => path.join(CHATS_DIR, '.board-adopted')

/** The one conversation a board held before this (#496), taken into the list as its first
 *  discussion — transcript, session, pictures and all — so upgrading keeps what was being
 *  talked about rather than throwing it away.
 *
 *  Done once, ever: the mark above says it happened, so the board's own conversation is the
 *  board's again from there and nothing is ever read twice. */
function adoptBoardChat(): void {
  if (fs.existsSync(adoptedMark())) return
  const from = chatFile(null)
  const chat = readChat(null)
  if (!chat?.messages.length) return markAdopted()
  const target = startDiscussion()
  const moved: Chat = { ...chat, cardId: target, archived: false }
  try {
    fs.mkdirSync(CHATS_DIR, { recursive: true })
    fs.writeFileSync(chatFile(target), JSON.stringify(moved, null, 2) + '\n')
    fs.rmSync(from, { force: true })
  } catch {
    // Nothing moved, so nothing is lost: the board's conversation is where it was, and the
    // next read tries again.
    return
  }
  // Its pictures go with it — a message that carried one still draws it in the new row.
  const pictures = path.join(CHATS_DIR, `${keyOf(null)}.images`)
  try {
    if (fs.existsSync(pictures)) fs.renameSync(pictures, path.join(CHATS_DIR, `${keyOf(target)}.images`))
  } catch {
    // The transcript is what matters; a picture that could not follow it draws as one that
    // is no longer on this machine, which is a state the record already has.
  }
  markAdopted()
}

function markAdopted(): void {
  try {
    fs.mkdirSync(CHATS_DIR, { recursive: true })
    fs.writeFileSync(adoptedMark(), '')
  } catch {
    // Unmarked, so the next read tries the upgrade again — which is only ever a move of a
    // file that is no longer there.
  }
}

/** The discussion one string names, spelled either way — the target this board writes, or
 *  the bare id inside it. Null for anything that is not a discussion of ours, so nothing
 *  arriving from a browser or a terminal can name a file this board did not write. */
export function asDiscussion(named: string): DiscussionTarget | null {
  const id = isDiscussion(named as DiscussionTarget) ? discussionIdOf(named as DiscussionTarget) : named.trim()
  return knownDiscussionId(id) ? discussionTarget(id) : null
}
