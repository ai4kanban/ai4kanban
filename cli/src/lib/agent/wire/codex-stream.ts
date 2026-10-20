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
//   • `turn.completed` — the THREAD's running token total, not the turn's: a resumed or
//     forked thread carries everything spent before it.
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

import { codexUsage, readCodexRunFacts, sameUsage, type CodexRunFacts, type CodexTurn } from './codex-session'
import { hint, obj, str, type Json } from './json'
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

// How often the rollout is looked for while a run is going. The runner asks the
// renderer for the model on every chunk of output, and a run arrives in hundreds
// of them; the rollout is a file, and reading it that many times would be a lot
// of nothing. A few seconds is late enough to be cheap and early enough that the
// panel names the model while the run is still working, rather than at the end.
const LOOK_EVERY_MS = 3_000

/** `carried` is a run that resumes or forks a thread, whose stream total holds earlier turns. */
export function createCodexStreamRenderer(carried = false): StreamRenderer {
  let final: string | undefined
  let total: TokenUsage | undefined
  let threadId: string | undefined
  let failure: string | undefined
  let facts: CodexRunFacts | undefined
  let lookedAt = 0

  // Look beside the stream for what the stream doesn't say. Nothing to look for until the
  // thread id arrives, and kept up after that rather than stopped once the model is known:
  // the context reading moves with every request that comes back (#675), so the ring would
  // freeze at the first one. The wait below is what keeps that cheap, and `now` skips it for
  // the last look after a run has ended.
  const look = (now: boolean): void => {
    if (!threadId) return
    const at = Date.now()
    if (!now && at - lookedAt < LOOK_EVERY_MS) return
    lookedAt = at
    facts = readCodexRunFacts(threadId) ?? facts
  }

  // The turn this run closed: the newest one in the rollout that ended on the stream's total.
  const turn = (): CodexTurn | undefined => {
    look(false)
    return total && facts?.turns?.filter((t) => sameUsage(t.total, total!)).pop()
  }

  // The turn's own share. With no rollout to subtract by, a new thread's total is its own and
  // a carried thread's is unknown — never the history's.
  const own = (): TokenUsage | undefined => {
    const t = turn()
    if (t) return t.own
    return carried ? undefined : total
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
        total = codexUsage(ev.usage) ?? total
        return ''
      // The two events that say the RUN did not get there — the turn giving up, and the
      // stream itself failing. Kept as the run's failure (#525), because `codex exec`
      // reports its reason on this stream and nowhere else, and a retry has to read it.
      // An item's own `error` is not one of them: a tool that failed is the agent's
      // problem to work around, and the turn around it may still finish.
      case 'turn.failed': {
        const said = str(obj(ev.error).message)
        failure = said || failure
        return `[error] ${said}\n`
      }
      case 'error': {
        const said = str(ev.message)
        failure = said || failure
        return `[error] ${said}\n`
      }
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
    usage: own,
    // Off the rollout, not the stream: no thread event carries a count, and the rollout
    // gains a `token_count` every time a request comes back — so a long run's ring climbs
    // while it works (./codex-session.ts).
    context: () => {
      look(false)
      return facts?.context
    },
    model: () => {
      look(false)
      return facts?.model
    },
    // Worked out here rather than reported: the turn's own tokens at the model's list
    // rate, and nothing at all unless both the provider and the model are ones
    // whose rates the board knows.
    costUsd: () => priceUsd(facts?.provider, turn()?.model ?? facts?.model, own()),
    resumeId: () => threadId,
    failure: () => failure,
  }
}
