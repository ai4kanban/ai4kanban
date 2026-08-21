// The board's side of the ZCode Protocol (#258).
//
// ZCode holds a conversation over `zcode app-server`'s own stdin and stdout, in JSON lines
// of its own shape: a request is `{id, method, params}`, an answer `{id, result}` or
// `{id, error}`, and anything with a method and no id is a notification. There is no
// `jsonrpc` field — the server rejects a message that carries one — so this is not the ACP
// client with different method names, and the two share no code.
//
// We open a session, subscribe to its events, and send the prompt. `session/send` answers
// the moment the prompt is accepted, not when the work is done: the turn ends on a
// `turn.completed` or `turn.failed` event, and everything in between — the agent's text,
// its thinking, each tool call — arrives as `session/event` notifications. The command
// itself keeps running until the runner ends it.
//
// This is ZCode's client and only ZCode's. What it deliberately does NOT know is runs,
// cards, or logs — it is handed pipes and hands back text (agent/client.ts).
//
// Proved by hand against `zcode` 0.16.3 (zcode-app-cli 3.7.7-14) on 2026-08-21: the
// session lifecycle, the event stream, the two questions the server asks back, and the
// shape of a failed turn. What no machine here could prove is a turn that reaches the
// model — that needs a Z.ai Coding Plan key, and the card carries it as a check.

import path from 'node:path'
import type { Readable, Writable } from 'node:stream'

import type { ClientTurn, RunClient, TurnEnd } from './client'
import type { TokenUsage } from './types'

type Json = Record<string, unknown>

interface Message {
  id?: number | string
  method?: string
  params?: Json
  result?: Json
  error?: { code?: number; message?: string }
}

function obj(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

// ---- the wire --------------------------------------------------------------

/** One ZCode Protocol conversation over a pair of pipes. Requests both ways: `call` asks
 *  the server something, `onCall` answers what it asks us. */
function connect(stdout: Readable, stdin: Writable, onCall: (msg: Message) => void) {
  let buf = ''
  let nextId = 1
  let gone: string | undefined
  const waiting = new Map<string, { ok: (result: Json) => void; fail: (err: Error) => void }>()

  const send = (msg: Json) => {
    if (gone) return
    try {
      stdin.write(`${JSON.stringify(msg)}\n`)
    } catch {
      // The far end is already gone; the close below is what reports it.
    }
  }

  const closed = (why: string) => {
    if (gone) return
    gone = why
    for (const { fail } of waiting.values()) fail(new Error(why))
    waiting.clear()
  }

  stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let msg: Message
      try {
        msg = JSON.parse(line) as Message
      } catch {
        // Not a frame. An app-server's stdout is the protocol and nothing else, so this is
        // a stray print — an update notice, a warning — rather than the agent talking.
        continue
      }
      if (msg.method) {
        onCall(msg)
        continue
      }
      const id = msg.id === undefined ? '' : String(msg.id)
      const pending = waiting.get(id)
      if (!pending) continue
      waiting.delete(id)
      if (msg.error) pending.fail(new Error(str(msg.error.message) || `the agent refused (${msg.error.code ?? 'no code'})`))
      else pending.ok(obj(msg.result))
    }
  })
  stdout.on('close', () => closed('the agent closed the connection'))
  stdout.on('error', (err: Error) => closed(String(err)))

  return {
    /** Ask the server something. Rejects with its own words when it says no. */
    call(method: string, params: Json): Promise<Json> {
      if (gone) return Promise.reject(new Error(gone))
      const id = String(nextId++)
      return new Promise<Json>((ok, fail) => {
        waiting.set(id, { ok, fail })
        send({ id, method, params })
      })
    },
    /** Answer something the server asked us. */
    reply(id: number | string, result: Json) {
      send({ id, result })
    },
    /** Say we can't. Sent for anything we never offered to do, so the server gets an
     *  answer rather than waiting on one forever. */
    refuse(id: number | string, message: string) {
      send({ id, error: { code: -32601, message } })
    },
  }
}

// ---- what the agent says ---------------------------------------------------

// The log this writes reads like every other agent's: the agent's words as prose, one
// `⏺ line` per tool call, and `[error]` in front of anything that went wrong. Thinking is
// marked, because unmarked it reads as the answer.
function createTail(log: (text: string) => void) {
  let mode: 'none' | 'text' | 'thought' = 'none'
  let said = '' // the message being written right now — the last one is the run's result
  let final: string | undefined

  const close = () => {
    if (mode === 'none') return
    if (mode === 'text' && said.trim()) final = said.trim()
    said = ''
    mode = 'none'
    log('\n\n')
  }

  return {
    /** A piece of the agent's answer, as it is written. */
    text(chunk: string) {
      if (!chunk) return
      if (mode !== 'text') {
        close()
        mode = 'text'
      }
      said += chunk
      log(chunk)
    },
    /** A piece of the agent's thinking. */
    thought(chunk: string) {
      if (!chunk) return
      if (mode !== 'thought') {
        close()
        mode = 'thought'
        log('💭 ')
      }
      log(chunk)
    },
    /** One line about something that isn't the agent talking. */
    line(text: string) {
      close()
      log(`${text}\n`)
    },
    /** End of the turn: whatever is half-written is finished off. */
    end(): string | undefined {
      close()
      return final
    },
  }
}

// The first line of the text a tool call is recognisable by, bounded — the same hint the
// other renderers put beside a call, so every agent's log reads alike.
function hint(raw: string): string {
  const line = raw.split('\n')[0]!.trim()
  if (!line) return ''
  return `(${line.length > 96 ? `${line.slice(0, 93)}…` : line})`
}

// What a tool call was called on, out of whichever field its input names it in. ZCode's
// tools take a path, a command, a pattern or a URL, and its own permission checks read the
// same list in the same order.
function whereHint(input: unknown, title: string): string {
  const named = obj(input)
  for (const key of ['command', 'file_path', 'path', 'url', 'pattern']) {
    const value = str(named[key]).trim()
    if (value && !title.includes(value)) return hint(value)
  }
  return ''
}

// ZCode counts tokens for the whole session rather than for one turn, so a run that
// carried an earlier conversation on reports what that conversation has used. The agent's
// own numbers either way, and never ones the board added up itself.
function usageOf(value: Json): TokenUsage | undefined {
  const counts: TokenUsage = {
    input: num(value.inputTokens),
    cacheCreation: num(value.cacheCreationTokens),
    cacheRead: num(value.cacheReadTokens),
    output: num(value.outputTokens),
  }
  const sum = counts.input + counts.cacheCreation + counts.cacheRead + counts.output
  return sum > 0 ? counts : undefined
}

// Why a turn that didn't simply finish stopped, in plain words. `success` is the one that
// means it worked; the rest are the agent saying it gave up, and the run failed.
const STOPPED: Record<string, string> = {
  cancelled: 'the turn was cancelled',
  error_max_turns: 'the agent hit its own limit on steps in one turn',
  error_max_budget: 'the agent ran out of the budget set for this turn',
  error_max_tool_calls: 'the agent hit its own limit on tool calls in one turn',
  error_during_execution: 'the agent stopped part-way through',
}

// The model a session is on, as `provider/model` — the form ZCode itself prints and the
// form its own `--resume` output uses.
function modelOf(ref: unknown): string {
  const model = obj(ref)
  const id = str(model.modelId)
  if (!id) return ''
  const provider = str(model.providerId)
  return provider ? `${provider}/${id}` : id
}

// ---- what a turn is made of ------------------------------------------------

// ZCode streams an assistant message as PARTS: a part is started or upserted with its
// whole text so far, and a delta appends to one. Both carry the same text, and which of
// them a build sends depends on the delivery kind — so a log written from one alone is
// either doubled or empty.
//
// So the log keeps what it has already written for each part and only ever appends what is
// new. A delta appends; an upsert whose text continues what we have appends the rest of
// it; an upsert that rewrites a part from the start is the agent replacing its own words,
// and only the new tail is worth a log line.
function createParts(tail: ReturnType<typeof createTail>) {
  const written = new Map<string, string>()
  const tools = new Set<string>()

  const say = (partId: string, kind: string, text: string) => {
    const before = written.get(partId) ?? ''
    const fresh = text.startsWith(before) ? text.slice(before.length) : text
    if (!fresh) return
    written.set(partId, text)
    if (kind === 'reasoning' || kind === 'thought') tail.thought(fresh)
    else tail.text(fresh)
  }

  return {
    /** A whole part, as `part.started` or `part.upserted` sends it. */
    upsert(raw: unknown) {
      const part = obj(raw)
      const type = str(part.type)
      const partId = str(part.partId)
      if (type === 'text' || type === 'reasoning' || type === 'thought') {
        if (partId) say(partId, type, str(part.text))
        else tail.text(str(part.text))
        return
      }
      if (type !== 'tool') return
      // One line per call, when it starts. A call that ends badly gets a second line and
      // nothing else does — the rest is progress on one already in the log.
      const state = obj(part.state)
      const callId = str(part.callId) || partId
      const title = str(state.title) || str(part.tool) || 'tool'
      if (callId && !tools.has(callId)) {
        tools.add(callId)
        tail.line(`⏺ ${title}${whereHint(state.input, title)}`)
      }
      if (str(state.status) === 'error') {
        const why = str(state.error).trim()
        tail.line(`[error] ${title} failed${why ? `: ${why}` : ''}`)
      }
    },
    /** A piece of one part, as `part.delta` sends it. */
    delta(event: Json) {
      const field = str(event.field) || 'text'
      // `input` and `output` are a tool call's arguments and result being streamed. The
      // call already has its line; its arguments are not the agent talking.
      if (field !== 'text' && field !== 'reasoning') return
      const partId = str(event.partId)
      const delta = str(event.delta)
      if (!delta) return
      written.set(partId, (written.get(partId) ?? '') + delta)
      if (field === 'reasoning') tail.thought(delta)
      else tail.text(delta)
    },
  }
}

// ---- one turn --------------------------------------------------------------

export interface ZcodeOptions {
  /** The model to work with, chosen on the session once it is open. Empty leaves ZCode on
   *  the model its own settings name. */
  model?: string
}

/** A client for `zcode app-server`. */
export function createZcodeClient(options: ZcodeOptions = {}): RunClient {
  return { turn: (io) => oneTurn(io, options) }
}

// What a board run may do, said once as the session opens.
//
// `yolo` is ZCode's own answer for a run with nobody at the keyboard — it is what its CLI
// uses for `--prompt`, and the board makes the same choice it made for Cursor's `--force`:
// a headless run that stops to ask is a run that ends having changed nothing, because
// ZCode's answer to an unanswered question is to refuse. ZCode ships no sandbox, so unlike
// Codex and dsh there is no preset that means "inside this project and no further" — this
// is the connector's own line in the guide, not a fence the board can draw.
//
// The questions are still answered, in `decide` below: a rule in the user's own config, or
// a mode a hand-written command picked, can still make something ask, and a question left
// unanswered stops the run dead.
const MODE = 'yolo'

// What the server asks the client about the machine it is running on, answered the way an
// unattended run wants it.
//
// `memoryEnabled` is off: a board run works in the project and writes what it decided onto
// the card, and a memory store outside the repo is somewhere the user can't see it.
// `askUserQuestionAutoResolutionEnabled` is on so the agent answers its own questions
// rather than putting them to a client that has no one to ask.
const RUNTIME_PREFERENCES = {
  nativeSearchEnhancementsEnabled: true,
  memoryEnabled: false,
  askUserQuestionAutoResolutionEnabled: true,
  modelContextBudgetStrategy: 'preflight-v1',
}

async function oneTurn(io: ClientTurn, options: ZcodeOptions): Promise<TurnEnd> {
  const tail = createTail(io.log)
  const parts = createParts(tail)
  // Nothing reaches the log until the prompt goes out. Opening a session is bookkeeping,
  // and re-opening one replays the conversation it already holds — neither is this run's
  // work, and both would bury it.
  let live = false
  let sessionId = ''
  let ended: ((end: { ok: boolean; error?: string }) => void) | undefined
  const finished = new Promise<{ ok: boolean; error?: string }>((resolve) => {
    ended = resolve
  })

  const rpc = connect(io.stdout, io.stdin, (msg) => {
    if (msg.method === 'session/event') {
      const envelope = obj(msg.params)
      if (str(envelope.sessionId) === sessionId) event(envelope, parts, tail, live, ended!)
      return
    }
    if (msg.id === undefined) return // a notification we have nothing to do about
    if (msg.method === 'session/requestRuntimePreferences') {
      rpc.reply(msg.id, RUNTIME_PREFERENCES)
      return
    }
    if (msg.method === 'interaction/requestPermission') {
      rpc.reply(msg.id, decide(obj(msg.params), tail))
      return
    }
    if (msg.method === 'interaction/requestUserInput') {
      // A run has nobody to ask. Declining lets the agent carry on with what it knows;
      // leaving it unanswered would hold the turn open until the runner killed it.
      tail.line('[refused] the agent asked the user a question — a run has nobody to ask')
      rpc.reply(msg.id, { action: 'decline', reason: 'this board run has no one at the keyboard' })
      return
    }
    if (msg.method === 'interaction/requestProviderRuntimeHeaders') {
      // Z.AI's Start plans want headers only the desktop app can mint. Saying so ends the
      // run with a reason; claiming we applied them would fail at the provider instead.
      rpc.reply(msg.id, {
        headersApplied: false,
        errorMessage: 'This plan needs headers only ZCode Desktop can supply. Sign in to a Coding Plan instead.',
      })
      return
    }
    // Everything else is something we never said we could do. Answering keeps the server
    // moving; leaving it unanswered would hang the run.
    rpc.refuse(msg.id, `the board's ZCode client doesn't do ${msg.method}`)
  })

  try {
    const workspacePath = path.resolve(io.cwd)
    const workspace = { workspacePath, workspaceKey: workspacePath }

    // A fresh conversation, or the one this run is carrying on. Resuming replays the
    // history the session already holds, which is the whole point of it: the agent picks
    // up knowing the card, the work done, and the error it died on.
    let opened: Json
    if (io.resumeId) {
      sessionId = io.resumeId
      opened = await rpc.call('session/resume', { sessionId, workspace })
    } else {
      opened = await rpc.call('session/create', {
        workspace,
        mode: MODE,
        // Written to ZCode's own store as it opens, so a run that dies seconds later can
        // still be picked up by the id we were just handed.
        persistence: 'immediate',
        // The session's name is the board's business, not a model call of its own.
        titleGenerationEnabled: false,
      })
      sessionId = str(obj(opened.session).sessionId)
      if (!sessionId) throw new Error('the agent opened a session without giving it an id')
      io.gotResumeId(sessionId)
    }

    // The model is chosen here, on the open session, rather than typed into the command:
    // ZCode has no `--model` flag, and a session carries its own. A model it doesn't know
    // fails the run and says why, like every other agent's Model box.
    let model = modelOf(obj(opened.session).model)
    if (options.model) {
      const wanted = options.model.includes('/')
        ? { providerId: options.model.split('/')[0]!, modelId: options.model.split('/').slice(1).join('/') }
        : { providerId: str(obj(obj(opened.session).model).providerId) || 'zai', modelId: options.model }
      await rpc.call('session/setModel', { sessionId, model: wanted })
      model = modelOf(wanted)
    }
    if (model) io.gotModel(model)

    // From here the session's events arrive as notifications. `afterSeq` is left out on
    // purpose: this run's work is what belongs in its log, not what an earlier one did.
    await rpc.call('session/subscribe', {
      sessionId,
      deliveryKind: 'desktop-continuous',
      includeSnapshot: false,
    })

    live = true
    const accepted = await rpc.call('session/send', { sessionId, content: io.prompt })
    if (accepted.accepted === false) throw new Error('the agent would not take the prompt')

    // `session/send` answers as soon as the prompt is accepted. The turn is over when the
    // session says so, or when the connection goes away under it.
    const done = await finished
    const result = tail.end()
    const usage = await tokensOf(rpc, sessionId)
    if (!done.ok) {
      const why = done.error ?? 'the agent stopped without saying why'
      io.log(`[error] ${why}\n`)
      return { ok: false, result, error: why, usage }
    }
    return { ok: true, result, usage }
  } catch (e) {
    // Whatever went wrong is the agent's own message — a key it wouldn't take, a model it
    // doesn't have, a connection that went away mid-turn. It goes into the log where the
    // user reads it, and nothing is added on top of it.
    const error = e instanceof Error ? e.message : String(e)
    const result = tail.end()
    io.log(`[error] ${error}\n`)
    return { ok: false, result, error }
  }
}

// What the turn used, asked for once it is over. ZCode carries no price — a Coding Plan is
// a quota rather than a per-token bill — so this is tokens and nothing else, and a run
// whose counts never arrive shows blanks rather than a number the board made up.
async function tokensOf(rpc: ReturnType<typeof connect>, sessionId: string): Promise<TokenUsage | undefined> {
  try {
    return usageOf(await rpc.call('session/usage', { sessionId }))
  } catch {
    return undefined
  }
}

// One `session/event` notification, rendered into the log.
function event(
  envelope: Json,
  parts: ReturnType<typeof createParts>,
  tail: ReturnType<typeof createTail>,
  live: boolean,
  ended: (end: { ok: boolean; error?: string }) => void,
): void {
  const payload = obj(envelope.payload)
  switch (str(envelope.type)) {
    case 'part.started':
    case 'part.upserted':
      if (live) parts.upsert(payload.part)
      return
    case 'part.delta':
      if (live) parts.delta(payload)
      return
    case 'turn.completed': {
      const how = str(payload.resultType) || 'success'
      if (how === 'success') return ended({ ok: true })
      return ended({ ok: false, error: STOPPED[how] ?? `the agent stopped: ${how}` })
    }
    case 'turn.failed': {
      const error = obj(payload.error)
      return ended({ ok: false, error: str(error.message) || 'the turn failed' })
    }
    case 'session.closed':
      return ended({ ok: false, error: str(payload.reason) || 'the agent closed the session' })
    default:
      // Todos, checkpoints, the session's title, the raw provider stream, and whatever a
      // newer ZCode adds: noise in a tail.
      return
  }
}

// What to answer when ZCode asks to do something its own rules stopped.
//
// No. The session opens in the mode that asks about nothing, so a question here means a
// rule in the user's own ZCode config, or a mode their hand-written command chose, held
// this back — their setting, not ours to overrule. The log says what was turned down, so a
// run that couldn't finish reads as a refusal rather than as a mystery.
function decide(params: Json, tail: ReturnType<typeof createTail>): Json {
  const tool = str(params.toolName) || 'that'
  tail.line(`[refused] ${tool} — your own ZCode rules ask before this one, and a run has nobody to ask`)
  return { decision: 'deny', reason: "this board run can't answer a permission question" }
}
