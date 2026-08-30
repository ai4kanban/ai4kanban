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
import { CHATS_DIR, REPO_ROOT } from '../paths'
import { ensureSkillInstalled } from '../skill/install'
import { languageNote } from './language'
import { chatAgent, harnessLabel, openPlan, planResume, planRun, skillPrompt, type RunPlan } from './resolve'
import { createStderrFilter } from './wire'
import type { Chat, ChatMessage, ChatReply, ChatView } from './types'

/** A conversation's file is named by what it is about, so the board's conversation and each
 *  card's are separate by construction and one card's can never be read as another's. */
const keyOf = (cardId: number | null): string => (cardId === null ? 'board' : `card-${cardId}`)

const chatFile = (cardId: number | null): string => path.join(CHATS_DIR, `${keyOf(cardId)}.json`)

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
export function readChat(cardId: number | null): Chat | null {
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
    })
  }
  return {
    cardId,
    harness: raw.harness,
    resumeId: typeof raw.resumeId === 'string' && raw.resumeId ? raw.resumeId : undefined,
    model: typeof raw.model === 'string' && raw.model ? raw.model : undefined,
    messages,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  }
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
export function clearChat(cardId: number | null): boolean {
  try {
    fs.unlinkSync(chatFile(cardId))
    return true
  } catch {
    return false
  }
}

// ---- what can be said right now --------------------------------------------

// The one place a refusal is worked out, so the CLI and a screen say the same words.
function blockedBy(cardId: number | null, chat: Chat | null): string | undefined {
  const agent = chatAgent()
  if (!agent.canChat) {
    return `chat is not available on ${agent.label}. The agents that can hold a conversation: ${agent.able.join(', ')}.`
  }
  if (chat && chat.harness !== agent.name) {
    return (
      `this conversation was held with ${harnessLabel(chat.harness)}, and ${agent.label} can't pick it up — ` +
      `its session means nothing to another agent. Clear it to start fresh with ${agent.label}.`
    )
  }
  if (answering(cardId)) return 'this conversation is still answering the last message.'
  return undefined
}

/** One conversation and what the board can do about it right now. */
export function readChatView(cardId: number | null): ChatView {
  const chat = readChat(cardId)
  const agent = chatAgent()
  return {
    cardId,
    chat,
    canChat: agent.canChat,
    agent: agent.label,
    able: agent.able,
    // Whoever is answering — this process or a terminal on the other side of the machine.
    // A screen reads it to keep up with a reply it never started, and with the board that
    // reply is changing as it goes.
    answering: answering(cardId),
    blocked: blockedBy(cardId, chat),
  }
}

// ---- one at a time on one conversation -------------------------------------
//
// A reply takes as long as the agent takes, and two of them into one session would
// interleave: both would be sent the same "carry on from here", and whichever finished last
// would write a transcript missing the other's message. So a conversation answers one
// message at a time, and a second is refused rather than queued — the user is sitting there
// watching the first, and a queue they can't see is worse than a plain no.

const busyDir = (cardId: number | null): string => path.join(CHATS_DIR, `${keyOf(cardId)}.answering`)

// How long a marker that names nobody is believed. Whoever takes one writes their pid in
// the next instruction, so an unnamed marker older than this belongs to a process that died
// in that instant — and a conversation nobody can ever speak to again is the one outcome
// worth breaking a marker for.
const UNNAMED_MS = 10_000

// Who is answering, or nobody — and a marker left behind by a process that is gone is
// cleared here rather than left to block the conversation for good.
function answering(cardId: number | null): boolean {
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
function startAnswering(cardId: number | null): (() => void) | null {
  const dir = busyDir(cardId)
  if (answering(cardId)) return null
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
  cardId: number | null,
  message: string,
  opts: { resuming?: boolean; title?: string } = {},
): string {
  const language = languageNote()
  if (opts.resuming) return [language, message].filter(Boolean).join('\n\n')
  const title = opts.title ?? (cardId === null ? undefined : cardTitle(cardId))
  const subject =
    cardId === null
      ? `This is a chat about this project's board.`
      : `This is a chat about task #${cardId}${title ? ` ("${title}")` : ''} on this project's board. ` +
        `Read the card before you answer, and take "it", "this" and "this task" to mean that card ` +
        `unless I name another.`
  return skillPrompt([subject, language, message].filter(Boolean).join('\n\n'))
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
  cardId: number | null,
  message: string,
  options: SendOptions = {},
): Promise<ChatReply | { error: string }> {
  const text = message.trim()
  if (!text) return { error: 'say something to send.' }
  const chat = readChat(cardId)
  const blocked = blockedBy(cardId, chat)
  if (blocked) return { error: blocked }

  const release = startAnswering(cardId)
  if (!release) return { error: 'this conversation is still answering the last message.' }
  try {
    const agent = chatAgent()
    const now = Date.now()
    const held: Chat = chat ?? {
      cardId,
      harness: agent.name,
      messages: [],
      startedAt: now,
      updatedAt: now,
    }
    if (!held.resumeId) {
      const skill = ensureSkillInstalled(REPO_ROOT)
      if (!skill.ok) return { error: skill.error || 'the kanban skill could not be installed.' }
    }
    // Written down before the agent is asked anything, so a reply that never arrives still
    // leaves the conversation holding what the user said.
    held.messages.push({ role: 'you', text, at: now })
    held.updatedAt = now
    writeChat(held)

    // A fresh session, or one more turn into the session the last message left open.
    const plan = held.resumeId ? planResume(held.harness, held.resumeId) : planRun(randomUUID())
    if (!plan) {
      return { error: `${agent.label} can't carry on a ${harnessLabel(held.harness)} conversation. Clear it to start fresh.` }
    }
    const prompt = chatPrompt(cardId, text, { resuming: Boolean(held.resumeId), title: options.title })

    const spoken = await speak({
      plan,
      prompt,
      continuing: held.resumeId,
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

    held.messages.push({ role: 'agent', text: reply, at: Date.now(), stoppedWhy })
    // The id even on a reply that stopped short: it is what the next message carries on by,
    // and a conversation that produced a word is a conversation worth continuing. Nothing is
    // saved for a turn that never got off the ground — an id for a session that was never
    // opened would fail every message after it.
    if (spoken.resumeId && (spoken.ok || reply)) held.resumeId = spoken.resumeId
    if (spoken.model) held.model = spoken.model
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
  /** The id this conversation carries on by, once the agent has named one. */
  resumeId?: string
}

// How long a stopped reply is given to end on its own before the turn is declared over
// anyway. Something downstream of the agent can hold its output pipe open long after the
// agent itself is gone, and a chat that never returns is worse than one cut a moment early.
const CLOSE_GRACE_MS = 3_000

// How long a turn may produce NOTHING AT ALL before it is given up on.
//
// A chat has none of a run's safety net — no row in `akb runs`, no log file, no stop
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

async function speak(io: {
  plan: RunPlan
  prompt: string
  continuing?: string
  onText(chunk: string): void
  onOpen?(stop: () => void): void
}): Promise<Spoken> {
  const active = openPlan(io.plan)
  const [cmd, ...args] = active.argv
  const client = active.client
  let text = ''
  const push = (chunk: string): void => {
    if (!chunk) return
    text += chunk
    io.onText(chunk)
  }
  let resumeId = io.plan.resumeId ?? undefined
  let model: string | undefined
  let spawnError: string | undefined

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
      env: active.env,
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
    push(errs.push(d.toString()))
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
      }
      push(errs.flush())
      resolve({
        ok: ok && !spawnError && !stopped && !silent,
        text,
        result: result ?? renderer?.result(),
        error:
          spawnError ??
          (stopped ? 'you stopped the reply.' : silent ? SILENCE_SAID : error),
        model,
        resumeId,
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
            log: push,
            gotResumeId: (id) => {
              resumeId ??= id
            },
            gotModel: (name) => {
              model ??= name
            },
          })
          .then((end) => {
            endChild()
            finish(end.ok, end.error, end.result)
          })
      }
    }

    child.on('close', (code) => finish(code === 0, code === null ? undefined : `the agent exited with code ${code}`))
  })
}
