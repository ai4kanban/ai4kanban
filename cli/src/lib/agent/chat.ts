// The conversation the board holds with its agent.
//
// A run is one job: the board sends the work, the agent does it, the run is over. A chat is
// the other shape — the user types, the agent answers, and the next message lands in the
// same session with everything said before still in it. So a chat is NOT a run, and nothing
// here touches the run record: a conversation never shows in the runs panel, never holds a
// card, and never keeps a run off the card it is about.
//
// How the session stays open: the agent's own CLI keeps it. Each turn is one more spawn of
// that command pointed at the session the first turn opened — `--resume`, `resume <thread>`,
// `--session`, or ACP's `session/load` (agent/harnesses/) — so the exchange is never sent
// again and the tenth message costs what the first one did. An agent whose command can't
// take a second message into its own session can't hold a conversation at all, and is turned
// away by name.
//
// What sits on this machine is one file per conversation, beside the run logs and out of
// git: the transcript, and the id the agent carries the conversation on by. The transcript
// is the visible record — the agent keeps its own copy of the history and the board never
// sends one back.

import { spawn, type ChildProcessByStdio, type StdioNull, type StdioPipe } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Readable, Writable } from 'node:stream'

import { locate } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { pidAlive } from '../lock'
import { reportChatMessage } from '../machine/usage'
import { CHATS_DIR, REPO_ROOT } from '../paths'
import { planFile } from '../plans'
import { ensureSkillInstalled } from '../skill/install'
import { languageNote } from './language'
import { pictureName, savePicture } from './pictures'
import {
  chatAgent,
  chatRuntimes,
  harnessImages,
  harnessLabel,
  openPlan,
  planResume,
  planRun,
  runtimeModel,
  runtimeName,
  skillPrompt,
  type RunPlan,
} from './resolve'
import { DISCUSSION_ROLE } from './roles'
import { chatRuleBlock } from './rules'
import { readRuntimes, runtimeById } from './runtimes'
import { SETUP_REMINDER, setupSubject } from './setup-chat'
import { createStderrFilter } from './wire'
import { discussionEnv } from './env'
import { isDiscussion } from './types'
import type {
  Chat,
  ChatMessage,
  ChatPick,
  ChatPlan,
  ChatReply,
  ChatTarget,
  ChatView,
  ModelChange,
  PlanAnswer,
  TokenUsage,
} from './types'

// Whose connector, model and rule a conversation runs on (#443, #502). Every conversation
// the board holds is the discussion helper's — the role that helps decide what is worth
// building, before anything is planned.
const CHAT_AGENT = DISCUSSION_ROLE

/** The guide a discussion follows — the discussion helper's own brief (`akb guide
 *  discuss-idea`). The Discuss screen names it on every turn; a terminal names nothing, so
 *  it is the default here and the same agent answers either way. */
export const DISCUSSION_GUIDE = 'discuss-idea'

/** A conversation's file is named by what it is about, so the board's conversation, the
 *  first run's, each card's and each discussion's are separate by construction and one can
 *  never be read as another's. A discussion's target IS its key (#496). */
export const keyOf = (target: ChatTarget): string =>
  target === null ? 'board' : typeof target === 'string' ? target : `card-${target}`

export const chatFile = (target: ChatTarget): string => path.join(CHATS_DIR, `${keyOf(target)}.json`)

// A conversation is this machine's record of what was said to an agent on it — the same
// kind of thing as a run's log, and no more the repo's business than one.
export const CHAT_IGNORE_LINE = {
  line: '.chats/',
  comment: '# The conversations held with the agent, on this machine.',
}

// ---- the file --------------------------------------------------------------

/** One conversation as it stands, or null when there has never been one. Reads only, and
 *  a damaged file reads as no conversation rather than throwing: the answer to a transcript
 *  nobody can parse is to start again, which is what clearing already does. */
export function readChat(cardId: ChatTarget): Chat | null {
  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(chatFile(cardId), 'utf8'))
  } catch {
    return null
  }
  const raw = data as Partial<Chat>
  if (!raw || typeof raw.harness !== 'string' || !Array.isArray(raw.messages)) return null
  const messages: ChatMessage[] = []
  for (const entry of raw.messages as Partial<ChatMessage>[]) {
    if (!entry || typeof entry.text !== 'string') continue
    messages.push({
      role: entry.role === 'agent' ? 'agent' : 'you',
      text: entry.text,
      at: typeof entry.at === 'number' ? entry.at : 0,
      stoppedWhy: typeof entry.stoppedWhy === 'string' ? entry.stoppedWhy : undefined,
      ms: typeof entry.ms === 'number' ? entry.ms : undefined,
      usage: usageOf(entry.usage),
      costUsd: typeof entry.costUsd === 'number' ? entry.costUsd : undefined,
      images: imagesOf(entry.images),
    })
  }
  return {
    cardId,
    harness: raw.harness,
    resumeId: typeof raw.resumeId === 'string' && raw.resumeId ? raw.resumeId : undefined,
    model: typeof raw.model === 'string' && raw.model ? raw.model : undefined,
    // A conversation held before #467 pinned a HARNESS, and `pickRuntime` reads that as the
    // runtime that harness's block became — so a held chat carries across rather than
    // silently going back to the discussion helper's. The model it held is dropped: the row it maps to
    // already carries one.
    runtime: pinOf(raw),
    modelChanges: changesOf(raw.modelChanges),
    plans: plansOf(raw),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : undefined,
    archived: raw.archived === true,
    messages,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  }
}

// What this conversation pins, as the transcript holds it: a runtime id, or the harness one
// written before #467 named.
function pinOf(raw: Partial<Chat> & { pickedHarness?: unknown }): string | undefined {
  for (const value of [raw.runtime, raw.pickedHarness]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

// The plans this conversation has written (#427, #496), oldest first. A file written before
// the list existed names one plan in `plan`, and reads as a list of that one.
function plansOf(raw: Partial<Chat> & { plan?: unknown }): ChatPlan[] | undefined {
  const held = Array.isArray(raw.plans) ? raw.plans : raw.plan !== undefined ? [raw.plan] : []
  const plans = held.map(planOf).filter((p): p is ChatPlan => p !== undefined)
  return plans.length ? plans : undefined
}

// One plan on the list. A path is the whole of it; an entry that names none, or names one
// that is not a plan of this board's, reads as no plan at all.
function planOf(value: unknown): ChatPlan | undefined {
  const p = value as Partial<ChatPlan> | undefined
  if (!p || typeof p.path !== 'string' || !planFile(p.path)) return undefined
  return {
    path: p.path,
    run: typeof p.run === 'string' && p.run ? p.run : undefined,
    // A plan handed over before the third answer existed (#481) names none, and Start
    // planning is the only thing it could have been.
    answer: p.run ? (p.answer === 'build' ? 'build' : 'plan') : undefined,
    done: p.done === true ? true : undefined,
    title: typeof p.title === 'string' && p.title.trim() ? p.title.trim() : undefined,
  }
}

// Where the model changed (#272), as far as the file can be believed: a mark needs a time
// and an id, and anything else is dropped rather than drawn as a line saying nothing.
function changesOf(value: unknown): ModelChange[] | undefined {
  if (!Array.isArray(value)) return undefined
  const marks: ModelChange[] = []
  for (const entry of value as Partial<ModelChange>[]) {
    if (!entry || typeof entry.at !== 'number' || typeof entry.model !== 'string') continue
    marks.push({ at: entry.at, model: entry.model })
  }
  return marks.length ? marks : undefined
}

// A transcript is a file on disk: what it says a turn consumed is believed only when it is
// four numbers. Anything else reads as a turn that reported nothing, which is what a
// connector that counts nothing already looks like.
function usageOf(value: unknown): TokenUsage | undefined {
  const u = value as Partial<TokenUsage> | undefined
  if (!u || typeof u !== 'object') return undefined
  const four = [u.input, u.cacheCreation, u.cacheRead, u.output]
  if (four.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return undefined
  return { input: u.input!, cacheCreation: u.cacheCreation!, cacheRead: u.cacheRead!, output: u.output! }
}

// The pictures one message carried (#441). Names, never paths: a file this conversation's
// own folder doesn't hold is not this conversation's picture, whatever the transcript says.
function imagesOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const names = value.filter((n): n is string => typeof n === 'string' && pictureName(n))
  return names.length ? names : undefined
}

// Write, then rename, so a UI polling the file never catches half of one.
function writeChat(chat: Chat): void {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  const file = chatFile(chat.cardId)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(chat, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

/** Forget a conversation and start fresh. True when there was one to forget.
 *
 *  Only our end is dropped. The agent's own session stays wherever that CLI keeps it, and is
 *  never spoken to again — nothing on this board holds its id any more. */
export function clearChat(cardId: ChatTarget): boolean {
  // The pictures go with the transcript that named them (#441) — the ones already sent and
  // the ones still waiting in the box, which is the whole of what this folder holds.
  fs.rmSync(imagesDir(cardId), { recursive: true, force: true })
  try {
    fs.unlinkSync(chatFile(cardId))
    return true
  } catch {
    return false
  }
}

// ---- the pictures pasted into one conversation (#441) -----------------------
//
// One folder per conversation, beside its transcript and gitignored with it: a pasted
// picture is this machine's record of what was asked, exactly as the transcript is, so it
// lives and dies with it.
//
// What travels between the box, the transcript and this file is a NAME, never a path. A
// browser can then ask for nothing but a picture of the conversation it is showing, and a
// message can carry no path that this board did not write itself.

const imagesDir = (cardId: ChatTarget): string => path.join(CHATS_DIR, `${keyOf(cardId)}.images`)

/** Where one of this conversation's pictures is on disk, or null when it is not there any
 *  more — the file was deleted by hand, or the name was never one of ours. */
export function chatImageFile(cardId: ChatTarget, name: string): string | null {
  if (!pictureName(name)) return null
  const file = path.join(imagesDir(cardId), name)
  return fs.existsSync(file) ? file : null
}

/** Save one pasted picture beside this conversation and answer with the name it is filed
 *  under. */
export function addChatImage(
  cardId: ChatTarget,
  data: Uint8Array,
  type: string,
): { name: string } | { error: string } {
  return savePicture(imagesDir(cardId), data, type)
}

/** Take one picture back out of the box before it is sent. Its file goes with it — nothing
 *  else on this board is holding it. */
export function dropChatImage(cardId: ChatTarget, name: string): void {
  const file = chatImageFile(cardId, name)
  if (file) fs.rmSync(file, { force: true })
}

// ---- the plan one conversation is writing (#427) ----------------------------
//
// Discuss keeps the plan's path here rather than guessing at the newest file in `plans/`:
// the transcript is the chat rail's too and is never cleared, so nothing else in the file
// could say which plan the live discussion is writing.

/** The conversation as it stands, or a fresh empty one to hang the plan off. A discussion
 *  names its plan before the first reply has landed, so there is not always a file yet. */
function chatOrOpen(cardId: ChatTarget): Chat {
  const now = Date.now()
  return readChat(cardId) ?? { cardId, harness: chatAgent().name, messages: [], startedAt: now, updatedAt: now }
}

/** The plan one conversation is writing right now: the last one it named, until that one is
 *  let go. A conversation writing none answers undefined. */
export function chatPlan(chat: Chat | null): ChatPlan | undefined {
  const last = chat?.plans?.[chat.plans.length - 1]
  return last && !last.done ? last : undefined
}

// Write the list back, and with it the name the discussion goes under: the live plan's title,
// so a row is named by what the discussion is about rather than by the words it opened on.
function writePlans(cardId: ChatTarget, plans: ChatPlan[]): void {
  const chat = chatOrOpen(cardId)
  chat.plans = plans.length ? plans : undefined
  const named = [...plans].reverse().find((p) => p.title)
  if (named?.title) chat.title = named.title
  chat.updatedAt = Date.now()
  writeChat(chat)
}

/** Point one conversation at a plan it is writing. It is appended to the list rather than
 *  replacing what is there: a discussion writes one plan at a time, but the ones it finished
 *  are still its own (#496), and naming a new one only lets the live slot go. */
export function setChatPlan(
  cardId: ChatTarget,
  planPath: string,
  title?: string,
): { ok: true } | { error: string } {
  if (!planFile(planPath)) return { error: `${planPath} is not a plan of this board's.` }
  const held = readChat(cardId)?.plans ?? []
  // Naming the same file again is the same plan, not a second one.
  const rest = held.filter((p) => p.path !== planPath).map((p) => ({ ...p, done: true as const }))
  writePlans(cardId, [...rest, { path: planPath, title: title?.trim() || undefined }])
  return { ok: true }
}

/** The run this plan was handed to has started, and which answer handed it over (#481). The
 *  ask is answered by it, so it goes; the plan is held until that run has written a card. */
export function setChatPlanRun(cardId: ChatTarget, sessionId: string, answer: PlanAnswer): void {
  const chat = readChat(cardId)
  const live = chatPlan(chat)
  if (!live) return
  writePlans(
    cardId,
    (chat?.plans ?? []).map((p) => (p.path === live.path ? { ...p, run: sessionId, answer } : p)),
  )
}

/** Let the live plan go — its cards are written, and the next idea starts a file of its own.
 *  It stays on the list: the discussion wrote it, and that does not stop being true. */
export function clearChatPlan(cardId: ChatTarget): void {
  const chat = readChat(cardId)
  const live = chatPlan(chat)
  if (!live) return
  writePlans(
    cardId,
    (chat?.plans ?? []).map((p) => (p.path === live.path ? { ...p, done: true } : p)),
  )
}

/** Name one discussion (#496). Written straight onto its file, so the rail and `akb chat`
 *  read the same name. */
export function setChatTitle(cardId: ChatTarget, title: string): void {
  const words = title.trim()
  if (!words) return
  const chat = chatOrOpen(cardId)
  chat.title = words
  writeChat(chat)
}

/** Take one discussion out of the list, or put it back (#496). The transcript stays where it
 *  is — archiving only ever hides the row. */
export function setChatArchived(cardId: ChatTarget, archived: boolean): void {
  const chat = readChat(cardId)
  if (!chat) return
  chat.archived = archived
  writeChat(chat)
}

/** Write one line into the transcript as something the user said, with no turn behind it.
 *  It is how a pressed answer reads as an answer given (#427) — the board acts on it, so
 *  asking the agent to reply to it as well would be one turn spent saying nothing. */
export function noteChatMessage(cardId: ChatTarget, text: string): void {
  const words = text.trim()
  if (!words) return
  const chat = chatOrOpen(cardId)
  const now = Date.now()
  chat.messages.push({ role: 'you', text: words, at: now })
  chat.updatedAt = now
  writeChat(chat)
}

// ---- what can be said right now --------------------------------------------

// The one place a refusal is worked out, so the CLI and a screen say the same words.
//
// A conversation that picked its own agent (#272) is judged against THAT agent, not the
// board's: it goes on running what it picked whatever Configuration is switched to. One that
// never picked follows the board, and is still turned away when the board moves under it.
function blockedBy(cardId: ChatTarget, chat: Chat | null): string | undefined {
  const agent = chatAgent(chat?.runtime)
  if (!agent.canChat) {
    return `chat is not available on ${agent.label}. The agents that can hold a conversation: ${agent.able.join(', ')}.`
  }
  // A transcript with nothing in it was held with nobody — a model typed into the box
  // before the first message leaves one (#272), and it is not something to clear.
  if (chat?.messages.length && chat.harness !== agent.name) {
    return (
      `this conversation was held with ${harnessLabel(chat.harness)}, and ${agent.label} can't pick it up — ` +
      `its session means nothing to another agent. Clear it to start fresh with ${agent.label}.`
    )
  }
  if (answeringOn(cardId)) return 'this conversation is still answering the last message.'
  return undefined
}

/** Why this conversation can't be sent a picture (#441), judged against the agent it
 *  actually runs. One sentence, written here so the window's refusal and `akb chat`'s are
 *  the same words — the box turns a paste away before it gets this far, and this is the
 *  second look that a send takes whatever the box thought. */
function imagesRefusedBy(chat: Chat | null): string | undefined {
  const agent = chatAgent(chat?.runtime)
  if (agent.seesImages) return undefined
  return `${agent.label} can't see images. The agents that can: ${agent.imagesAble.join(', ')}.`
}

/** One conversation and what the board can do about it right now. */
export function readChatView(cardId: ChatTarget): ChatView {
  const chat = readChat(cardId)
  const agent = chatAgent(chat?.runtime)
  return {
    cardId,
    chat,
    canChat: agent.canChat,
    agent: agent.label,
    able: agent.able,
    seesImages: agent.seesImages,
    imagesAble: agent.imagesAble,
    // Whoever is answering — this process or a terminal on the other side of the machine.
    // A screen reads it to keep up with a reply it never started, and with the board that
    // reply is changing as it goes.
    answering: answeringOn(cardId),
    blocked: blockedBy(cardId, chat),
    pick: pickOf(chat),
  }
}

// ---- what one conversation runs on (#272, #467) ----------------------------
//
// The discussion helper's runtime is where every conversation starts. A pick is this conversation's
// alone: it is kept with the transcript, nothing of it reaches ui.config.json, and another
// chat is unaffected. One control, because a runtime already carries the model — there is no
// separate model box any more.

/** The runtime a conversation runs, picked or inherited. */
const runtimeOf = (chat: Chat | null): string => chat?.runtime ?? chatAgent().runtime

function pickOf(chat: Chat | null): ChatPick {
  // The row that would actually run: a pin the board no longer has resolves to **Global
  // default**, and the pick says so rather than naming a row nobody could open.
  const agent = chatAgent(runtimeOf(chat))
  const pinned = chat?.runtime
  return {
    runtime: agent.runtime,
    name: runtimeName(agent.runtime),
    harness: agent.name,
    model: runtimeModel(agent.runtime),
    // It pinned something, and that pin still names a row this board has — by id, or by the
    // harness a pin written before #467 named. A pin nothing answers to reads as following
    // the board, which is what it is now doing.
    own: Boolean(pinned) && readRuntimes().some((r) => r.id === pinned || r.harness === pinned),
    boardRuntime: chatAgent().runtime,
    runtimes: chatRuntimes(),
  }
}

/** Point one conversation at a runtime. `null` puts it back on the discussion helper's, which is a
 *  switch like any other.
 *
 *  A transcript can't move to a CLI that never opened its session, so a pick that changes the
 *  HARNESS throws the conversation away and starts a fresh one — `cleared` says whether there
 *  was anything to lose. A pick that keeps the harness and only changes what it runs as is
 *  marked in the transcript instead, so a reply can be read against what wrote it.
 *
 *  Refused while a reply is coming: the agent writing it is the one being taken away. */
export function pickChatRuntime(
  cardId: ChatTarget,
  runtime: string | null,
): { ok: true; cleared: boolean; restarted: boolean; runtime: string } | { error: string } {
  const offered = chatRuntimes()
  const want = runtime ?? chatAgent().runtime
  if (!offered.some((r) => r.id === want)) {
    const known = runtimeById(want)
    return {
      error: known
        ? `${known.name} can't hold a conversation. The runtimes that can: ${offered.map((r) => r.name).join(', ')}.`
        : `this board has no runtime called "${want}". It has: ${offered.map((r) => r.id).join(', ')}.`,
    }
  }
  if (answeringOn(cardId)) return { error: 'this conversation is still answering the last message.' }

  const chat = readChat(cardId)
  const own = runtime === null ? undefined : want
  const before = runtimeOf(chat)
  // Nothing to throw away where the CLI does not actually change — another runtime on the
  // same harness carries the session on, and only what it runs as moves.
  if (chat && chatAgent(before).name === chatAgent(want).name) {
    const now = Date.now()
    if (chat.runtime !== own) {
      chat.runtime = own
      const after = runtimeModel(want)
      if (before !== want && chat.messages.length && after !== runtimeModel(before)) {
        chat.modelChanges = [...(chat.modelChanges ?? []), { at: now, model: after }]
      }
      chat.updatedAt = now
      writeChat(chat)
    }
    return { ok: true, cleared: false, restarted: false, runtime: want }
  }
  const had = Boolean(chat?.messages.length)
  clearChat(cardId)
  // Nothing of the old conversation carries over: an id is one CLI's vocabulary, and it would
  // mean nothing to the one being switched to.
  if (own) {
    const now = Date.now()
    writeChat({ cardId, harness: chatAgent(want).name, runtime: own, messages: [], startedAt: now, updatedAt: now })
  }
  // `cleared` is what there was to lose; `restarted` is that the conversation was thrown
  // away at all. They differ on one that had never been spoken to and yet held a pasted
  // picture (#441) — its file has gone with the rest, and the box has to let go of it.
  return { ok: true, cleared: had, restarted: true, runtime: want }
}

// ---- one at a time on one conversation -------------------------------------
//
// A reply takes as long as the agent takes, and two of them into one session would
// interleave: both would be sent the same "carry on from here", and whichever finished last
// would write a transcript missing the other's message. So a conversation answers one
// message at a time, and a second is refused rather than queued — the user is sitting there
// watching the first, and a queue they can't see is worse than a plain no.

const busyDir = (cardId: ChatTarget): string => path.join(CHATS_DIR, `${keyOf(cardId)}.answering`)

// How long a marker that names nobody is believed. Whoever takes one writes their pid in
// the next instruction, so an unnamed marker older than this belongs to a process that died
// in that instant — and a conversation nobody can ever speak to again is the one outcome
// worth breaking a marker for.
const UNNAMED_MS = 10_000

// Who is answering, or nobody — and a marker left behind by a process that is gone is
// cleared here rather than left to block the conversation for good.
export function answeringOn(cardId: ChatTarget): boolean {
  const dir = busyDir(cardId)
  let age: number
  try {
    age = Date.now() - fs.statSync(dir).mtimeMs
  } catch {
    return false
  }
  const owner = ownerOf(dir)
  if (owner === undefined ? age < UNNAMED_MS : pidAlive(owner)) return true
  fs.rmSync(dir, { recursive: true, force: true })
  return false
}

function ownerOf(dir: string): number | undefined {
  try {
    const pid = Number(fs.readFileSync(path.join(dir, 'owner'), 'utf8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

// Take the marker, or hand back nothing when someone else already has it. mkdir settles
// which of two callers gets it, the same way it settles every other lock on this board.
function startAnswering(cardId: ChatTarget): (() => void) | null {
  const dir = busyDir(cardId)
  if (answeringOn(cardId)) return null
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  try {
    fs.mkdirSync(dir, { recursive: false })
  } catch {
    return null
  }
  try {
    fs.writeFileSync(path.join(dir, 'owner'), `${process.pid}\n`)
  } catch {
    // Unnamed. The age rule above covers it — it is believed for a few seconds and then
    // taken away, rather than holding the conversation shut for good.
  }
  return () => fs.rmSync(dir, { recursive: true, force: true })
}

// ---- sending one message ---------------------------------------------------

export interface SendOptions {
  /** The card's title as the caller already has it, so the opening names the card rather
   *  than only numbering it. Looked up here when it isn't given. */
  title?: string
  /** The reply as it is written — this is what makes it arrive a piece at a time rather
   *  than all at once at the end. */
  onText?(chunk: string): void
  /** Handed a way to end the reply early, once the agent is running. What arrives before
   *  it is called is kept, the same as a reply that dies on its own. */
  onOpen?(stop: () => void): void
  /** The board is speaking, not the user (#280) — the message is sent and the reply kept,
   *  but nothing is written into the transcript as something the user said. It is how a
   *  conversation opens with the agent's turn rather than waiting to be spoken to. */
  fromBoard?: boolean
  /** The flow this message is part of (#427) — a `akb guide <name>` topic. It rides in
   *  front of the words, on every turn and not only the first, for the reason the language
   *  note does: a session told once at the top drifts away from it as it grows. Nothing of
   *  it is written into the transcript, which holds what the user said. */
  guide?: string
  /** The pictures pasted into this message (#441), as the names `addChatImage` filed them
   *  under. They are sent again rather than saved again on a resend, so one whose file has
   *  gone since is dropped here rather than failing the turn. */
  images?: string[]
}

/** What one turn sends.
 *
 *  A fresh conversation opens with the skill call and what the conversation is about, then
 *  the user's words. The subject is not optional: the skill call alone leaves "what is this
 *  about?" reading as a question about the skill, and it gets answered as one.
 *
 *  Every turn after the first is the user's words alone — the skill, the subject and the
 *  exchange are already in that agent's session.
 *
 *  Except the language the board is read in (#337), which every turn carries: a session told
 *  once at the top drifts back to English as it grows, and a language switched mid-
 *  conversation would never reach it at all. An English board carries nothing. */
export function chatPrompt(
  cardId: ChatTarget,
  message: string,
  /** `harness` is the agent this conversation picked for itself (#272), whose own syntax
   *  the skill call follows; with none it is the board's. `pictures` are the paths a
   *  connector reads out of the words (#441) — empty for one whose CLI takes a flag per
   *  file, which is handed them instead of being told about them. */
  opts: {
    resuming?: boolean
    title?: string
    harness?: string
    guide?: string
    pictures?: string[]
  } = {},
): string {
  const language = languageNote()
  const flow = guideLine(opts.guide ?? defaultGuide(cardId))
  const rule = chatRuleBlock(CHAT_AGENT)
  const shots = pictureLines(opts.pictures)
  if (opts.resuming) {
    // The first run's later turns carry one more line: the session already holds the
    // instructions, and what a long conversation drifts away from is the answer's shape.
    const reminder = cardId === 'setup' ? SETUP_REMINDER : ''
    return [flow, language, rule, shots, message, reminder].filter(Boolean).join('\n\n')
  }
  const title = opts.title ?? (typeof cardId === 'number' ? cardTitle(cardId) : undefined)
  const subject =
    cardId === 'setup'
      ? setupSubject()
      : cardId === null || isDiscussion(cardId)
        ? `This is a chat about this project's board.`
        : `This is a chat about task #${cardId}${title ? ` ("${title}")` : ''} on this project's board. ` +
          `Read the card before you answer, and take "it", "this" and "this task" to mean that card ` +
          `unless I name another.`
  return skillPrompt([subject, flow, language, rule, shots, message].filter(Boolean).join('\n\n'), opts.harness)
}

/** The flow a conversation follows when the screen naming one didn't (#502). A discussion is
 *  the discussion helper's own work — deciding what is worth building — so `akb chat` in a
 *  terminal is held the same way the Discuss screen holds it. A chat about a card follows
 *  none: it is about that card, and the card says what it is. */
const defaultGuide = (cardId: ChatTarget): string | undefined =>
  cardId === null || isDiscussion(cardId) ? DISCUSSION_GUIDE : undefined

/** The pictures that came with this message, for a connector that opens a path written into
 *  the words. Above the message rather than under it, the way they sit above the words in
 *  the box — and named as files to read, since that is the only thing the agent can do with
 *  a path. */
function pictureLines(pictures: string[] | undefined): string {
  if (!pictures?.length) return ''
  const one = pictures.length === 1
  return (
    `${one ? 'A picture came' : `${pictures.length} pictures came`} with this message. ` +
    `Read ${one ? 'it' : 'them'} before you answer:\n` +
    pictures.map((file) => `- ${file}`).join('\n')
  )
}

/** The one line that puts a conversation on a flow. The name reaches here from a screen, so
 *  anything that is not a plain topic name is dropped rather than pasted into a prompt. */
function guideLine(guide: string | undefined): string {
  return guide && /^[a-z][a-z0-9-]*$/.test(guide) ? `Follow \`akb guide ${guide}\`.` : ''
}

// The card's title, off its own file. Read here rather than through `titleOf` in
// agent/sessions: that module reaches the board's writes, and `akb init` imports this one.
function cardTitle(cardId: number): string | undefined {
  try {
    const found = locate(cardId)
    if (!found) return undefined
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    return parseFrontmatter(fs.readFileSync(file, 'utf8')).meta?.title
  } catch {
    return undefined
  }
}

/** Send one message and answer with the reply. Never throws: everything that can go wrong
 *  is something to tell the user in the conversation they are having. */
export async function sendChatMessage(
  cardId: ChatTarget,
  message: string,
  options: SendOptions = {},
): Promise<ChatReply | { error: string }> {
  const text = message.trim()
  const chat = readChat(cardId)
  const blocked = blockedBy(cardId, chat)
  if (blocked) return { error: blocked }
  // The pictures this turn really has (#441): the ones still on this machine, in the order
  // they went into the box. A resend sends the same files again rather than saving a second
  // copy, so one deleted since is dropped here — and a message that was nothing but that
  // picture then has nothing left to send.
  const named = options.images ?? []
  const shots = named.filter((name) => chatImageFile(cardId, name) !== null)
  if (shots.length) {
    const refused = imagesRefusedBy(chat)
    if (refused) return { error: refused }
  }
  if (!text && !shots.length) {
    return { error: named.length ? 'those pictures are no longer on this machine.' : 'say something to send.' }
  }

  const release = startAnswering(cardId)
  if (!release) return { error: 'this conversation is still answering the last message.' }
  try {
    const agent = chatAgent(chat?.runtime)
    const now = Date.now()
    const held: Chat = chat ?? {
      cardId,
      harness: agent.name,
      messages: [],
      startedAt: now,
      updatedAt: now,
    }
    if (!held.resumeId) {
      // No session yet, so nothing belongs to the agent this file last named: the one about
      // to open one is the one it was held with. A model picked before the first message
      // leaves such a file (#272), and it must not go stale against the board.
      held.harness = agent.name
      const skill = ensureSkillInstalled(REPO_ROOT)
      if (!skill.ok) return { error: skill.error || 'the kanban skill could not be installed.' }
    }
    // Written down before the agent is asked anything, so a reply that never arrives still
    // leaves the conversation holding what the user said. The board's own opening turn is
    // the exception: it was never said by the user, so it is not shown as though it were.
    if (!options.fromBoard) {
      held.messages.push({ role: 'you', text, at: now, ...(shots.length ? { images: shots } : {}) })
    }
    held.updatedAt = now
    writeChat(held)
    // Counted here, and only what the user said (#295): the name of the action and nothing
    // of the message. The board's own opening turn was nobody's message, so it is not one.
    if (!options.fromBoard) reportChatMessage()

    // What this conversation picked for itself (#272, #467): one runtime, which carries the
    // whole of what a turn runs as. Empty on a conversation that never picked, which is the
    // discussion helper's answer and exactly what a run takes.
    const own = held.runtime ? { pin: held.runtime } : {}
    // A fresh session, or one more turn into the session the last message left open.
    const plan = held.resumeId
      ? planResume(held.harness, held.resumeId, REPO_ROOT, CHAT_AGENT, own)
      : planRun(randomUUID(), REPO_ROOT, CHAT_AGENT, own)
    if (!plan) {
      return { error: `${agent.label} can't carry on a ${harnessLabel(held.harness)} conversation. Clear it to start fresh.` }
    }
    // Where the pictures go is the connector's own answer (agent/harnesses/types.ts): one
    // that reads a path out of the words is told them, and one with a flag per file is
    // handed them on the command line and told nothing.
    const files = shots.map((name) => path.join(imagesDir(cardId), name))
    const takes = harnessImages(held.runtime)
    const say = {
      title: options.title,
      harness: held.runtime,
      guide: options.guide,
      pictures: takes?.as === 'message' ? files : [],
    }
    const prompt = chatPrompt(cardId, text, { ...say, resuming: Boolean(held.resumeId) })
    // And what to say if that session turns out to be gone (#395): the opening prompt, which
    // carries the skill and what this conversation is about. Without it the thread keeps a
    // dead id and fails every message after it until someone clears it.
    const restart = held.resumeId ? chatPrompt(cardId, text, say) : undefined

    const asked = Date.now()
    const spoken = await speak({
      plan,
      prompt,
      restart,
      continuing: held.resumeId,
      pictures: files,
      // The discussion this turn is answering (#496), so `akb raw plan new` called from
      // inside it lands on this discussion rather than on the board's one conversation.
      discussion: isDiscussion(cardId) ? cardId : undefined,
      onText: options.onText ?? (() => {}),
      onOpen: options.onOpen,
    })

    // The reply as the user saw it: the agent's words, its thinking and the tool calls it
    // made, in the order they went past. The closing message stands in only for an agent
    // that streamed nothing at all, so nothing is ever shown twice.
    const reply = spoken.text.trim() || spoken.result?.trim() || ''
    const stoppedWhy = spoken.ok
      ? reply
        ? undefined
        : 'the agent ended the turn without saying anything.'
      : spoken.error || 'the reply stopped before the agent had finished.'

    const landed = Date.now()
    held.messages.push({
      role: 'agent',
      text: reply,
      at: landed,
      stoppedWhy,
      // The board's own clock for the time, and the connector's own numbers for the rest —
      // a turn that reported none carries none rather than a zero.
      ms: landed - asked,
      usage: spoken.usage,
      costUsd: spoken.costUsd,
    })
    // The id even on a reply that stopped short: it is what the next message carries on by,
    // and a conversation that produced a word is a conversation worth continuing. Nothing is
    // saved for a turn that never got off the ground — an id for a session that was never
    // opened would fail every message after it. A reseed is the exception: that session WAS
    // opened, so keeping its id is what stops the next message reseeding all over again.
    if (spoken.resumeId && (spoken.ok || reply || spoken.reseeded)) held.resumeId = spoken.resumeId
    if (spoken.model) held.model = spoken.model
    // The plan the reply itself named (#427): `akb raw plan` writes this same file from
    // inside the turn, so what it left is newer than what this one has held since the
    // message was sent. Nothing else can have moved — a runtime is only picked between
    // turns (#467).
    const since = readChat(cardId)
    if (since) {
      held.plans = since.plans
      held.title = since.title ?? held.title
    }
    held.updatedAt = Date.now()
    writeChat(held)
    return { text: reply, stoppedWhy, model: spoken.model, chat: held }
  } finally {
    release()
  }
}

// ---- the agent, for one turn -----------------------------------------------
//
// The same spawn a run makes, and deliberately the same one call behind it: `openPlan` is
// where a command, its flags and its environment are settled, so a chat and a run reach the
// agent through one set of rules. What is not shared is everything around it — a run is a
// detached process with a log, a card and a record, and a chat is this call and its caller.

interface Spoken {
  ok: boolean
  /** Everything the agent wrote, in the order it wrote it. */
  text: string
  /** Its closing message, for a connector that reports one apart from the stream. */
  result?: string
  error?: string
  model?: string
  /** What the turn consumed and what it cost, for a connector that reports them
   *  (`reports` in agent/harnesses/). Both absent on one that doesn't. */
  usage?: TokenUsage
  costUsd?: number
  /** The id this conversation carries on by, once the agent has named one. */
  resumeId?: string
  /** True when the session being carried on was gone and a fresh one opened in its place.
   *  That id names a session the agent really holds, so the thread keeps it even after a
   *  turn that then said nothing — the alternative is holding the dead id one turn longer. */
  reseeded?: boolean
}

// How long a stopped reply is given to end on its own before the turn is declared over
// anyway. Something downstream of the agent can hold its output pipe open long after the
// agent itself is gone, and a chat that never returns is worse than one cut a moment early.
const CLOSE_GRACE_MS = 3_000

// How long a turn may produce NOTHING AT ALL before it is given up on.
//
// A chat has none of a run's safety net — no row in `akb run list`, no log file, no stop
// command — so an agent that wedges holds the conversation until someone deletes its file
// by hand, and a wedged reply and a slow one look exactly the same from outside. This is
// what makes them tell apart on their own.
//
// Counted from the last byte, not from the start, and it is raw bytes on either pipe rather
// than rendered text: an agent grinding through a long tool call is still writing events,
// even ones that render to nothing. So the window only runs out on a conversation that has
// genuinely stopped saying anything — long enough that a slow first token or a minutes-long
// test run doesn't trip it.
const SILENCE_MS = 5 * 60_000

const SILENCE_SAID = `the agent said nothing for ${SILENCE_MS / 60_000} minutes, so the reply was given up on.`

/** The mark in front of a line the CLI itself printed, which the chat rail folds away
 *  (kanban-ui/components/Chat.tsx). */
const NOTE = '⚠ '

// The CLI's own lines, marked as the CLI's. Unmarked, the rail reads a line as the agent's
// words: a stray MCP trace or a startup notice opened the reply as prose. Marked, it folds
// under "Worked for …" wherever in the turn it arrived, and stays one click away.
//
// Its own mark rather than the tool-call one, because a note is not a step: it must not
// count as the last thing the agent did, or a trace printed on the way out would push the
// answer itself into the fold.
function noted(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `${NOTE}${line}` : line))
    .join('\n')
}

async function speak(io: {
  plan: RunPlan
  prompt: string
  /** What to send instead when the session being carried on is gone and a fresh one opens
   *  in its place. */
  restart?: string
  continuing?: string
  /** The pictures this turn carries (#441), as paths on this machine. Only a connector
   *  that takes a flag per file uses them here; one that reads them out of the words has
   *  them in the prompt already. */
  pictures?: string[]
  /** The discussion this turn is answering (#496), for the agent's own environment. */
  discussion?: string
  onText(chunk: string): void
  onOpen?(stop: () => void): void
}): Promise<Spoken> {
  const active = openPlan(io.plan)
  const takes = active.images
  // Ahead of the prompt, which is always the last argument: for Codex the flags belong to
  // the `resume` subcommand the argv ends on, and for OpenCode to the message itself.
  const shots =
    takes?.as === 'args' ? (io.pictures ?? []).flatMap((file) => takes.args(file)) : []
  const [cmd, ...args] = [...active.argv, ...shots]
  const client = active.client
  let text = ''
  const push = (chunk: string): void => {
    if (!chunk) return
    text += chunk
    io.onText(chunk)
  }
  let resumeId = io.plan.resumeId ?? undefined
  let reseeded = false
  let model: string | undefined
  let spawnError: string | undefined
  // A client hands its numbers back when the turn ends; a renderer is asked for them once
  // the closing event is in (see `finish`).
  let usage: TokenUsage | undefined
  let costUsd: number | undefined

  // stdout and stderr are pipes whichever shape this is; only stdin differs.
  const stdio: [StdioNull | StdioPipe, StdioPipe, StdioPipe] = [client ? 'pipe' : 'ignore', 'pipe', 'pipe']
  let child: ChildProcessByStdio<Writable | null, Readable, Readable>
  try {
    // A connector the board talks to is handed its prompt inside the conversation and needs
    // its stdin kept open; one that prints takes the prompt on its command line and gets no
    // stdin at all (agent/wire/client.ts).
    child = spawn(cmd!, client ? args : [...args, io.prompt], {
      // The project, not this process's cwd: a chat runs inside the board server, whose cwd
      // is its own bundled folder in the app. See the note in agent/test.ts.
      cwd: REPO_ROOT,
      env: io.discussion ? discussionEnv(active.env, io.discussion) : active.env,
      shell: false,
      stdio,
    }) as ChildProcessByStdio<Writable | null, Readable, Readable>
  } catch (e) {
    return { ok: false, text: '', error: String(e) }
  }

  // Set once the promise below is running, which is where the child can be ended. Every
  // byte off either pipe calls it, and that is the whole of what keeps the turn alive.
  let touch = (): void => {}

  const renderer = active.renderer
  child.stdout.on('data', (d: Buffer) => {
    touch()
    if (!renderer) return
    push(renderer.push(d.toString()))
    resumeId ??= renderer.resumeId?.()
    model ??= renderer.model?.()
  })
  // Whatever the CLI itself has to say — a warning about a flag, a login that expired.
  // Shown rather than swallowed: it is usually the reason a reply reads oddly. Its own
  // housekeeping chatter is the exception, and is left out (agent/harnesses/types.ts).
  const errs = createStderrFilter(active.quietStderr)
  child.stderr.on('data', (d: Buffer) => {
    touch()
    push(noted(errs.push(d.toString())))
  })
  child.on('error', (err) => {
    spawnError =
      (err as NodeJS.ErrnoException)?.code === 'ENOENT'
        ? `${cmd} isn't installed, or isn't on this command's PATH. Install it with: ${active.install}`
        : String(err)
  })

  return await new Promise<Spoken>((resolve) => {
    let done = false
    let stopped = false
    let silent = false
    let idle: ReturnType<typeof setTimeout> | undefined
    const finish = (ok: boolean, error?: string, result?: string): void => {
      if (done) return
      done = true
      if (idle) clearTimeout(idle)
      if (renderer) {
        push(renderer.flush())
        resumeId ??= renderer.resumeId?.()
        model ??= renderer.model?.()
        usage ??= renderer.usage?.()
        costUsd ??= renderer.costUsd?.()
      }
      push(noted(errs.flush()))
      resolve({
        ok: ok && !spawnError && !stopped && !silent,
        text,
        result: result ?? renderer?.result(),
        error:
          spawnError ??
          (stopped ? 'you stopped the reply.' : silent ? SILENCE_SAID : error),
        model,
        usage,
        costUsd,
        resumeId,
        reseeded,
      })
    }

    // Ending the command: because the turn is over, or because the user asked. A command
    // that answers back is a server and never exits on its own, so this is how every one of
    // them ends. The turn's own answer is the verdict — the exit code of a process we killed
    // says nothing.
    const endChild = (): void => {
      try {
        child.stdin?.end()
      } catch {
        // already gone
      }
      try {
        child.kill('SIGTERM')
      } catch {
        // already gone
      }
    }
    // Ending the turn, the same two steps a stop takes: put the command down, then declare
    // it over whether or not its pipes come with it.
    const giveUp = (why: () => void): void => {
      if (done) return
      why()
      endChild()
      const t = setTimeout(() => finish(false), CLOSE_GRACE_MS)
      if (typeof t.unref === 'function') t.unref()
    }

    io.onOpen?.(() => giveUp(() => (stopped = true)))

    // The silence window, restarted by every byte the command writes (see SILENCE_MS).
    touch = () => {
      if (done) return
      if (idle) clearTimeout(idle)
      idle = setTimeout(() => giveUp(() => (silent = true)), SILENCE_MS)
      if (typeof idle.unref === 'function') idle.unref()
    }
    touch()

    if (client) {
      const toAgent = child.stdin
      if (!toAgent) {
        finish(false, `nothing could be written to ${cmd}, so there was no way to send the message`)
      } else {
        void client
          .turn({
            stdout: child.stdout,
            stdin: toAgent,
            prompt: io.prompt,
            cwd: REPO_ROOT,
            resumeId: io.continuing,
            restartPrompt: io.restart,
            log: push,
            gotResumeId: (id, restarted) => {
              // A restarted session is a different conversation, so its id goes over the
              // dead one rather than losing to it.
              if (restarted) {
                resumeId = id
                reseeded = true
              } else resumeId ??= id
            },
            gotModel: (name) => {
              model ??= name
            },
          })
          .then((end) => {
            endChild()
            usage ??= end.usage
            costUsd ??= end.costUsd
            finish(end.ok, end.error, end.result)
          })
      }
    }

    child.on('close', (code) => finish(code === 0, code === null ? undefined : `the agent exited with code ${code}`))
  })
}

/** The first line of what was typed, cut to something a rail row can hold. What a discussion
 *  is called before its plan has named it (#496). */
export function firstLine(text: string): string {
  const line = text.trim().split('\n').find((l) => l.trim()) ?? ''
  const words = line.trim()
  return words.length > 80 ? `${words.slice(0, 79).trimEnd()}…` : words
}
