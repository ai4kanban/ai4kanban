// The board's side of the Agent Client Protocol (#225).
//
// ACP is a conversation over the command's own stdin and stdout, in JSON-RPC lines: we
// open a session, send the prompt, and from then on the agent tells us what it is doing —
// its text and its thinking as they are written, each tool call as it runs — and asks us
// the things only the client can answer. The turn is over when the agent says so, in the
// reply to the prompt we sent; the command itself keeps running until the runner ends it.
//
// This is dsh's client, and only dsh's. What it knows is the protocol, not the agent: any
// command that speaks ACP is driven by the same file. What it deliberately does NOT know
// is runs, cards, or logs — it is handed pipes and hands back text (agent/client.ts).
//
// Proved by hand against `dsh-acp` 0.4.14 (@openma/deepseek-harness-acp) over
// @deepseek-ai/dsh 0.1.0-rc.7, ACP protocol version 1, on 2026-08-18.

import type { Readable, Writable } from 'node:stream'

import type { ClientTurn, RunClient, TurnEnd } from './client'
import type { TokenUsage } from './types'
import { SKILL_VERSION } from '../../version'

/** The protocol version this client speaks. */
const PROTOCOL_VERSION = 1

// What the board can do for the agent, said once at `initialize`. It is a short list on
// purpose: no file reads or writes through us, no terminals. The agent uses its own tools
// under its own sandbox, exactly as the four printing agents do — a client that offered to
// read and write files for it would be a way around that sandbox, opened by us.
const CLIENT_CAPABILITIES = {
  fs: { readTextFile: false, writeTextFile: false },
  terminal: false,
}

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

/** One JSON-RPC conversation over a pair of pipes. Requests both ways: `call` asks the
 *  agent something, `onCall` answers what it asks us. */
function connect(stdout: Readable, stdin: Writable, onCall: (msg: Message) => void) {
  let buf = ''
  let nextId = 1
  let gone: string | undefined
  const waiting = new Map<number, { ok: (result: Json) => void; fail: (err: Error) => void }>()

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
        // Not a frame. An ACP command's stdout is the protocol and nothing else, so this
        // is a stray print from something that shouldn't have printed — ignored rather
        // than passed off as the agent talking.
        continue
      }
      if (msg.method) {
        onCall(msg)
        continue
      }
      if (typeof msg.id !== 'number') continue
      const pending = waiting.get(msg.id)
      if (!pending) continue
      waiting.delete(msg.id)
      if (msg.error) pending.fail(new Error(str(msg.error.message) || `the agent refused (${msg.error.code ?? 'no code'})`))
      else pending.ok(obj(msg.result))
    }
  })
  stdout.on('close', () => closed('the agent closed the connection'))
  stdout.on('error', (err: Error) => closed(String(err)))

  return {
    /** Ask the agent something. Rejects with the agent's own words when it says no. */
    call(method: string, params: Json): Promise<Json> {
      if (gone) return Promise.reject(new Error(gone))
      const id = nextId++
      return new Promise<Json>((ok, fail) => {
        waiting.set(id, { ok, fail })
        send({ jsonrpc: '2.0', id, method, params })
      })
    },
    /** Answer something the agent asked us. */
    reply(id: number | string, result: Json) {
      send({ jsonrpc: '2.0', id, result })
    },
    /** Say we can't. Sent for anything we never offered to do, so the agent gets an answer
     *  rather than waiting on one forever. */
    refuse(id: number | string, message: string) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message } })
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

// What a tool call was called on: the file it names, when its title doesn't already say.
function whereHint(update: Json, title: string): string {
  const locations = Array.isArray(update.locations) ? update.locations : []
  const path = str(obj(locations[0]).path)
  return path && !title.includes(path) ? hint(path) : ''
}

// The readable part of what a tool call reported back — its text content, if it has any.
function saidBy(update: Json): string {
  const content = Array.isArray(update.content) ? update.content : []
  for (const raw of content) {
    const part = obj(raw)
    const text = str(obj(part.content).text) || str(part.text)
    if (text.trim()) return text.trim()
  }
  return ''
}

// The model an agent's config options say the session is on. dsh reports its live catalog
// this way (`{id: "model", currentValue: "deepseek-v4-flash", …}`), so this is the model
// the run is really working with — never the Model box, which most people leave empty.
function modelOf(configOptions: unknown): string | undefined {
  const list = Array.isArray(configOptions) ? configOptions : []
  for (const raw of list) {
    const option = obj(raw)
    if (option.id === 'model') return str(option.currentValue).trim() || undefined
  }
  return undefined
}

// The tokens a turn reported, in the four counts the board keeps. The agent counts them
// for the session rather than for one turn, so a run that continued an earlier
// conversation reports what that whole conversation has used — the agent's own number
// either way, and never one the board added up itself.
function usageOf(value: unknown): TokenUsage | undefined {
  const usage = obj(value)
  if (!Object.keys(usage).length) return undefined
  const counts: TokenUsage = {
    input: num(usage.inputTokens),
    cacheCreation: num(usage.cachedWriteTokens),
    cacheRead: num(usage.cachedReadTokens),
    output: num(usage.outputTokens),
  }
  const sum = counts.input + counts.cacheCreation + counts.cacheRead + counts.output
  return sum > 0 ? counts : undefined
}

// Why a turn that didn't simply end stopped, in plain words. `end_turn` is the one that
// means it finished; the rest are the agent saying it gave up, and the run failed.
const STOPPED: Record<string, string> = {
  max_tokens: 'the agent ran out of tokens for this turn',
  max_turn_requests: 'the agent hit its own limit on steps in one turn',
  refusal: 'the agent refused to continue',
  cancelled: 'the turn was cancelled',
}

// ---- one turn --------------------------------------------------------------

export interface AcpOptions {
  /** The model to work with, chosen as the session opens. Empty leaves the agent on its
   *  own default. */
  model?: string
}

/** A client for any command that speaks ACP over its own stdin and stdout. */
export function createAcpClient(options: AcpOptions = {}): RunClient {
  return { turn: (io) => oneTurn(io, options) }
}

async function oneTurn(io: ClientTurn, options: AcpOptions): Promise<TurnEnd> {
  const tail = createTail(io.log)
  // Nothing reaches the log until the prompt goes out. Opening a session is bookkeeping,
  // and re-opening one replays the whole earlier conversation — neither is this run's
  // work, and both would bury it.
  let live = false
  let costUsd: number | undefined

  const rpc = connect(io.stdout, io.stdin, (msg) => {
    if (msg.method === 'session/update') {
      if (live) update(obj(msg.params).update, tail, (usd) => (costUsd = usd))
      return
    }
    if (msg.id === undefined) return // a notification we have nothing to do about
    if (msg.method === 'session/request_permission') {
      rpc.reply(msg.id, decide(obj(msg.params), tail))
      return
    }
    // Everything else is something we never said we could do — the agent asking us to read
    // a file for it, or to hold a terminal. Answering "no" keeps it moving; leaving it
    // unanswered would hang the run.
    rpc.refuse(msg.id, `the board's ACP client doesn't do ${msg.method}`)
  })

  try {
    await rpc.call('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: CLIENT_CAPABILITIES,
      clientInfo: { name: 'ai4kanban', version: SKILL_VERSION },
    })

    // A fresh conversation, or the one this run is carrying on. Loading replays the
    // history the session already holds, which is the whole point of resuming: the agent
    // picks up knowing the card, the work done, and the error it died on.
    let sessionId = io.resumeId ?? ''
    let opened: Json
    if (sessionId) {
      opened = await rpc.call('session/load', { sessionId, cwd: io.cwd, mcpServers: [] })
    } else {
      opened = await rpc.call('session/new', { cwd: io.cwd, mcpServers: [] })
      sessionId = str(opened.sessionId)
      if (!sessionId) throw new Error('the agent opened a session without giving it an id')
      io.gotResumeId(sessionId)
    }

    // The model is chosen here, on the open session, rather than typed into the command:
    // an ACP agent carries its live catalog per session, so this is the one place a pick
    // means anything. A model it doesn't know fails the run, and says so, like every other
    // agent's Model box.
    let model = modelOf(opened.configOptions)
    if (options.model) {
      const set = await rpc.call('session/set_config_option', {
        sessionId,
        configId: 'model',
        value: options.model,
      })
      model = modelOf(set.configOptions) ?? options.model
    }
    if (model) io.gotModel(model)

    live = true
    const done = await rpc.call('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: io.prompt }],
    })
    const result = tail.end()
    const stopReason = str(done.stopReason)
    const usage = usageOf(done.usage)
    if (stopReason && stopReason !== 'end_turn') {
      const why = STOPPED[stopReason] ?? `the agent stopped: ${stopReason}`
      io.log(`[error] ${why}\n`)
      return { ok: false, result, error: why, usage, costUsd }
    }
    return { ok: true, result, usage, costUsd }
  } catch (e) {
    // Whatever went wrong is the agent's own message — a key it wouldn't take, a model it
    // doesn't have, a connection that went away mid-turn. It goes into the log where the
    // user reads it, and nothing is added on top of it.
    const error = e instanceof Error ? e.message : String(e)
    const result = tail.end()
    io.log(`[error] ${error}\n`)
    return { ok: false, result, error, usage: undefined, costUsd }
  }
}

// One `session/update` notification, rendered into the log.
function update(raw: unknown, tail: ReturnType<typeof createTail>, gotCost: (usd: number) => void): void {
  const change = obj(raw)
  switch (change.sessionUpdate) {
    case 'agent_message_chunk':
      tail.text(str(obj(change.content).text))
      return
    case 'agent_thought_chunk':
      tail.thought(str(obj(change.content).text))
      return
    case 'tool_call': {
      const title = str(change.title) || str(change.name) || 'tool'
      tail.line(`⏺ ${title}${whereHint(change, title)}`)
      return
    }
    case 'tool_call_update': {
      // Only a call that failed is worth a second line; the rest are progress on one we
      // already logged.
      if (change.status !== 'failed') return
      const why = saidBy(change)
      tail.line(`[error] ${str(change.title) || 'that tool call'} failed${why ? `: ${why}` : ''}`)
      return
    }
    case 'usage_update': {
      // A running total for the session, in whatever currency the agent priced it. Only
      // dollars are taken: the board's number is a US dollar figure everywhere else, and
      // converting one is not the board's business.
      const cost = obj(change.cost)
      const amount = cost.amount
      if (str(cost.currency).toUpperCase() === 'USD' && typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        gotCost(amount)
      }
      return
    }
    default:
      // Plans, mode changes, the command list, the session's title, and whatever a newer
      // agent adds: noise in a tail.
      return
  }
}

// What to answer when the agent asks to do something its sandbox stopped.
//
// No. A run may write inside the project without asking — that is what the permission
// preset the command starts under already allows, and nothing outside the project raises a
// question in the first place. So a question here IS the agent asking to reach further
// than the board's other agents can, and the board answers it the same way Codex's sandbox
// does: it doesn't happen. The log says what was turned down, so a run that couldn't
// finish reads as a refusal rather than as a mystery.
function decide(params: Json, tail: ReturnType<typeof createTail>): Json {
  const options = Array.isArray(params.options) ? params.options : []
  const no = options.map(obj).find((option) => str(option.kind).startsWith('reject'))
  const title = str(obj(params.toolCall).title) || 'that'
  tail.line(`[refused] ${title} — a run reaches no further than this project`)
  if (!no) return { outcome: { outcome: 'cancelled' } }
  return { outcome: { outcome: 'selected', optionId: no.optionId } }
}
