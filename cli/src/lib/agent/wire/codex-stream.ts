// Turns `codex exec --json`'s JSONL stream into the same readable log the Claude
// renderer writes (#69). Codex prints only its final message by default, so the
// harness asks for the event stream (see harnesses/codex.ts) and
// this renders it.
//
// The events are Codex's `ThreadEvent`s. Four matter here:
//   • `thread.started` — carries `thread_id`, the id `codex exec resume` takes.
//     It is the run's FIRST event, which is how a Codex run gets a resumable id
//     at all: Codex mints its own and can't be handed ours.
//   • `item.started` / `item.completed` — one per thing the agent did. A command
//     is logged when it starts (a long build should show up while it runs, not
//     after), everything else when it completes and is final.
//   • `turn.completed` — the token counts for the turn.
//
// What a reader wants is what the agent said, the commands it ran and the files
// it changed, so those are rendered and the rest (its reasoning summaries, its
// to-do list, the turn markers) is dropped.
//
// Neither the model nor a cost is on this stream: Codex prices nothing, and its
// events never name what ran them. Both are still shown, from beside the stream
// rather than invented — the thread id above finds the session's rollout on disk,
// that names the model and its provider (codex-session.ts), and the run's tokens
// at that model's list rate are the price (../prices.ts). A model whose rates aren't
// known gets no price, the way it did when nothing was worked out at all.

import { readCodexRunFacts, type CodexRunFacts } from './codex-session'
import { hint, num, obj, str, type Json } from './json'
import { createLineReader, frame, type StreamRenderer } from './stream'
import { priceUsd } from '../prices'
import type { TokenUsage } from '../types'

// A thing the agent started doing. Only the ones worth a line while they run: a
// command can take minutes, and a log that waits for it to finish looks stalled.
function renderStarted(item: Json): string {
  switch (item.type) {
    case 'command_execution':
      return `⏺ Command${hint(str(item.command))}\n`
    case 'mcp_tool_call':
      return `⏺ ${str(item.server)}.${str(item.tool)}\n`
    case 'web_search':
      return `⏺ WebSearch${hint(str(item.query))}\n`
    default:
      return ''
  }
}

// A thing the agent finished. The ones whose content only exists once they are
// done — what it said, which files it wrote, an error it hit. The calls above
// are not repeated here.
function renderCompleted(item: Json): string {
  switch (item.type) {
    case 'agent_message': {
      const said = str(item.text).trim()
      return said ? `${said}\n\n` : ''
    }
    case 'file_change': {
      const changes = Array.isArray(item.changes) ? item.changes : []
      return changes
        .map((raw) => {
          const change = obj(raw)
          const path = str(change.path)
          return path ? `⏺ ${str(change.kind) || 'change'}(${path})\n` : ''
        })
        .join('')
    }
    case 'error':
      return `[error] ${str(item.message)}\n`
    default:
      return ''
  }
}

// The token counts a completed turn carries, in the four buckets the board shows.
//
// Codex counts prompt tokens the other way round from Claude: its `input_tokens`
// is the WHOLE prompt, cached part included, where Claude's is only the fresh
// part and the cache is counted beside it. The board's four are Claude's, and are
// added up as four separate numbers — so the cached tokens are taken back out
// here. Left in, a run's input would carry its cache reads twice.
//
// `reasoning_output_tokens` is dropped for the same reason from the other end:
// it is already inside `output_tokens`. All-zero counts read as "reported
// nothing", like the Claude renderer.
function parseUsage(raw: unknown): TokenUsage | undefined {
  const u = obj(raw)
  const cacheCreation = num(u.cache_write_input_tokens)
  const cacheRead = num(u.cached_input_tokens)
  const usage: TokenUsage = {
    input: Math.max(0, num(u.input_tokens) - cacheCreation - cacheRead),
    cacheCreation,
    cacheRead,
    output: num(u.output_tokens),
  }
  const total = usage.input + usage.cacheCreation + usage.cacheRead + usage.output
  return total > 0 ? usage : undefined
}

// How often the rollout is looked for while a run is going. The runner asks the
// renderer for the model on every chunk of output, and a run arrives in hundreds
// of them; the rollout is a file, and reading it that many times would be a lot
// of nothing. A few seconds is late enough to be cheap and early enough that the
// panel names the model while the run is still working, rather than at the end.
const LOOK_EVERY_MS = 3_000

export function createCodexStreamRenderer(): StreamRenderer {
  let final: string | undefined
  let usage: TokenUsage | undefined
  let threadId: string | undefined
  let facts: CodexRunFacts | undefined
  let lookedAt = 0

  // Look beside the stream for what the stream doesn't say. Nothing to look for
  // until the thread id arrives, and nothing to look for again once the model is
  // known — a turn can't change it. `now` skips the wait, for the last look after
  // a run has ended.
  const look = (now: boolean): void => {
    if (facts?.model || !threadId) return
    const at = Date.now()
    if (!now && at - lookedAt < LOOK_EVERY_MS) return
    lookedAt = at
    facts = readCodexRunFacts(threadId) ?? facts
  }

  const renderLine = (line: string): string => {
    if (!line.trim()) return ''
    const ev = frame(line)
    if (!ev) return `${line}\n`
    switch (ev.type) {
      case 'thread.started':
        // The id to resume by, on the run's first event. First one wins — a
        // resumed run reports the thread it continued, which is the same thread.
        if (!threadId) threadId = str(ev.thread_id).trim() || undefined
        return ''
      case 'item.started':
        return renderStarted(obj(ev.item))
      case 'item.completed': {
        const item = obj(ev.item)
        // The last thing the agent said is the run's result. The UI leads with
        // it and folds the events away; the streamed copy above is trimmed off
        // the tail by the registry.
        if (item.type === 'agent_message') {
          const said = str(item.text).trim()
          if (said) final = said
        }
        return renderCompleted(item)
      }
      case 'turn.completed':
        // Last turn wins. `codex exec` sends one prompt, so there is normally
        // one — and if a run ever takes more, the numbers the board shows are
        // the ones the run ended on rather than a total it can't verify.
        usage = parseUsage(ev.usage) ?? usage
        return ''
      case 'turn.failed':
        return `[error] ${str(obj(ev.error).message)}\n`
      case 'error':
        return `[error] ${str(ev.message)}\n`
      default:
        // turn.started and anything a newer Codex adds: noise in a tail.
        return ''
    }
  }

  const lines = createLineReader(renderLine)
  return {
    push: lines.push,
    flush(): string {
      const out = lines.flush()
      // The run is over: the rollout is complete, and this is the last chance to
      // read it before the record closes.
      look(true)
      return out
    },
    result: () => final,
    usage: () => usage,
    model: () => {
      look(false)
      return facts?.model
    },
    // Worked out here rather than reported: the run's tokens at the model's list
    // rate, and nothing at all unless both the provider and the model are ones
    // whose rates the board knows.
    costUsd: () => {
      look(false)
      return priceUsd(facts?.provider, facts?.model, usage)
    },
    resumeId: () => threadId,
  }
}
