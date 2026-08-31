// The board's side of the ZCode Protocol (#258).
//
// ZCode holds a conversation over `zcode app-server`'s own stdin and stdout, in JSON lines
// of its own shape: a request is `{id, method, params}`, an answer `{id, result}` or
// `{id, error}`, and anything with a method and no id is a notification. There is no
// `jsonrpc` field — the server rejects a message that carries one, which is the one thing
// wire/rpc.ts is told about a dialect. The methods, the session lifecycle and the events
// below are ZCode's alone.
//
// We open a session, subscribe to its events, and send the prompt. `session/send` answers
// the moment the prompt is accepted, not when the work is done: the turn ends on a
// `turn.completed` or `turn.failed` event, and everything in between — the agent's text,
// its thinking, each tool call — arrives as `session/event` notifications. The command
// itself keeps running until the runner ends it.
//
// This is ZCode's client and only ZCode's. What it deliberately does NOT know is runs,
// cards, or logs — it is handed pipes and hands back text (wire/client.ts).
//
// Proved by hand against `zcode` 0.16.3 (zcode-app-cli 3.7.7-14) on 2026-08-21 and again
// against 0.16.5 (3.10.1-17) on 2026-08-31, that time through a real turn on a Coding Plan
// key: the session lifecycle, the event stream, the two questions the server asks back, and
// the shape of a failed turn. The two releases stream a turn differently — see below.

import path from 'node:path'

import { hint, num, obj, str, type Json } from './json'
import { connect, type Rpc } from './rpc'
import { createTail, type Tail } from './tail'
import type { ClientTurn, RunClient, TurnEnd } from './client'
import type { TokenUsage } from '../types'

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

// The agent's own token counts, out of either place it reports them: the turn's own
// `turn.completed`, and `session/usage` — which counts the whole session, so a run that
// carried an earlier conversation on reports what that conversation has used. The two spell
// the cache-write count differently. Never numbers the board added up itself.
function usageOf(value: Json): TokenUsage | undefined {
  const counts: TokenUsage = {
    input: num(value.inputTokens),
    cacheCreation: num(value.cacheCreationTokens) || num(value.cacheWriteTokens),
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

// ZCode has said a turn two ways across releases, and a build sends one or the other:
//
//   • PARTS (through 0.16.3) — a part is started or upserted with its whole text so far,
//     and a delta appends to one. Both carry the same text, so a log written from one
//     alone is either doubled or empty.
//   • STREAMING (0.16.5) — `model.streaming` deltas for the agent's words and its
//     thinking, `tool_call` for a call once its arguments are whole, and the call's
//     outcome on separate `tool.updated` events. No parts at all, under either delivery
//     kind.
//
// Both are handled, because neither is a version the board can insist on. For parts the
// log keeps what it has already written for each one and only ever appends what is new: a
// delta appends; an upsert whose text continues what we have appends the rest of it; an
// upsert that rewrites a part from the start is the agent replacing its own words, and only
// the new tail is worth a log line.
function createParts(tail: Tail) {
  const written = new Map<string, string>()
  const tools = new Set<string>()
  // What each call was named, kept because the event carrying its result names only the id.
  const named = new Map<string, string>()

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
    /** A piece of the turn, as `model.streaming` sends it. */
    streaming(payload: Json) {
      const kind = str(payload.kind)
      if (kind === 'text_delta') return tail.text(str(payload.delta))
      if (kind === 'reasoning_delta') return tail.thought(str(payload.delta))
      // `tool_input_start`, `tool_input_delta` and `tool_input_end` are one call's
      // arguments being spelled out; `tool_call` is the same call with them all in.
      if (kind !== 'tool_call') return
      const callId = str(payload.toolCallId)
      const name = str(payload.toolName) || 'tool'
      named.set(callId, name)
      if (callId && tools.has(callId)) return
      tools.add(callId)
      tail.line(`⏺ ${name}${whereHint(payload.input, name)}`)
    },
    /** How a call went, as `tool.updated` sends it. `scheduled`, `started`, `result` and
     *  `batch` are progress on a call that already has its line; only `error` is worth a
     *  second one. */
    toolUpdate(payload: Json) {
      if (str(payload.kind) !== 'error') return
      const name = named.get(str(payload.toolCallId)) ?? 'tool'
      const why = str(obj(payload.error).message).split('\n')[0]!.trim()
      tail.line(`[error] ${name} failed${why ? `: ${why.slice(0, 200)}` : ''}`)
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

// A run with no key stops on ZCode's own message, and that message names the provider
// ZCode's config points at rather than anything the user picked — so it reads as a board
// fault. The board answers with where the key goes, under the error and nowhere else: on
// any other failure the same line would point a wrong model id at the key box.
const MISSING_KEY = /missing an API key/i

function stopped(io: ClientTurn, why: string): void {
  io.log(`[error] ${why}\n`)
  if (MISSING_KEY.test(why)) {
    io.log("[board] paste a Z.AI or BigModel Coding Plan key into ZCode's key box in Configuration.\n")
  }
}

/** How the session said the turn ended, and what it said on the way out. */
interface TurnStop {
  ok: boolean
  error?: string
  /** The agent's closing message, as the ending event repeats it. */
  response?: string
  /** What this turn used, when the ending event counted it. */
  usage?: TokenUsage
}

async function oneTurn(io: ClientTurn, options: ZcodeOptions): Promise<TurnEnd> {
  const tail = createTail(io.log)
  const parts = createParts(tail)
  // Nothing reaches the log until the prompt goes out. Opening a session is bookkeeping,
  // and re-opening one replays the conversation it already holds — neither is this run's
  // work, and both would bury it.
  let live = false
  let sessionId = ''
  let ended: ((end: TurnStop) => void) | undefined
  const finished = new Promise<TurnStop>((resolve) => {
    ended = resolve
  })

  const rpc = connect(
    io.stdout,
    io.stdin,
    (msg) => {
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
    },
    { stringIds: true },
  )

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
    // The message the log ends on, or — on a build that streamed nothing we could render —
    // the one the ending event repeats. Never both, and never nothing when the agent spoke.
    const result = tail.end() || done.response || undefined
    const usage = done.usage ?? (await tokensOf(rpc, sessionId))
    if (!done.ok) {
      const why = done.error ?? 'the agent stopped without saying why'
      stopped(io, why)
      return { ok: false, result, error: why, usage }
    }
    return { ok: true, result, usage }
  } catch (e) {
    // Whatever went wrong is the agent's own message — a key it wouldn't take, a model it
    // doesn't have, a connection that went away mid-turn. It goes into the log where the
    // user reads it, and nothing is added on top of it but the missing-key line.
    const error = e instanceof Error ? e.message : String(e)
    const result = tail.end()
    stopped(io, error)
    return { ok: false, result, error }
  }
}

// What the turn used, asked for once it is over. ZCode carries no price — a Coding Plan is
// a quota rather than a per-token bill — so this is tokens and nothing else, and a run
// whose counts never arrive shows blanks rather than a number the board made up.
async function tokensOf(rpc: Rpc, sessionId: string): Promise<TokenUsage | undefined> {
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
  tail: Tail,
  live: boolean,
  ended: (end: TurnStop) => void,
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
    case 'model.streaming':
      if (live) parts.streaming(payload)
      return
    case 'tool.updated':
      if (live) parts.toolUpdate(payload)
      return
    case 'turn.completed': {
      // The turn's own counts and its closing message, which is the one place a streaming
      // build states either — `session/usage` counts the session and leaves the cache out.
      const usage = usageOf(obj(payload.usage))
      const response = str(payload.response)
      const how = str(payload.resultType) || 'success'
      if (how === 'success') return ended({ ok: true, response, usage })
      return ended({ ok: false, error: STOPPED[how] ?? `the agent stopped: ${how}`, response, usage })
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
function decide(params: Json, tail: Tail): Json {
  const tool = str(params.toolName) || 'that'
  tail.line(`[refused] ${tool} — your own ZCode rules ask before this one, and a run has nobody to ask`)
  return { decision: 'deny', reason: "this board run can't answer a permission question" }
}
