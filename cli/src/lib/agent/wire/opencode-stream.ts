// Turns `opencode run --format json`'s JSONL stream into the same readable log
// the other renderers write (#160). OpenCode's default mode prints a formatted
// transcript meant for a terminal, so the harness asks for the raw events (see
// harnesses/opencode.ts) and this renders them.
//
// Every line is `{type, timestamp, sessionID, ...}`. Four types matter here:
//   • `text` — something the agent said, in `part.text`. Sent once the block is
//     finished, so each one is new text.
//   • `tool_use` — one call the agent made, sent once it completed or failed:
//     `part.tool` names it, `part.state.input` carries its arguments.
//   • `step_finish` — the cost and token counts of one step. A run makes one
//     step per model call, so these are SUMMED rather than replaced.
//   • `error` — the run's own failure.
//
// `sessionID` rides on every event, and `opencode run --session <id>` takes it,
// so an OpenCode run is resumable from its first event.
//
// No model: OpenCode names the model only in its formatted output, never in the
// JSON stream, so a run on it names none rather than one the board made up from
// the Model box.

import { argHint, num, obj, str } from './json'
import { createLineReader, frame, type StreamRenderer } from './stream'
import type { TokenUsage } from '../types'

// What a call was called on. OpenCode's own tools name their arguments
// `filePath`, `command`, `pattern` and so on, and an MCP tool brings whatever
// names its server chose — so the first recognisable string wins and a tool with
// none is logged by name alone.
// `description` is last and is the one that isn't a thing: a subagent is called on a task
// rather than on a file, and without it every `task` call reads as the same bare line.
const ARG_KEYS = ['command', 'filePath', 'file_path', 'path', 'pattern', 'query', 'url', 'description'] as const

// A subagent dispatched into the background, and why it is worth a line of its own.
//
// OpenCode's own `task` tool runs a subagent inline: the call doesn't come back until the
// subagent has, and its answer is in the parent's next step. Some plugins add a background
// mode instead — the call returns "launched" at once, the subagent works on in a session of
// its own, and its result is promised to the parent as a later notification.
//
// `opencode run` ends when the MAIN agent's turn ends, and takes its server with it. So a
// background subagent is not merely unwaited-for: it is cut off part way, and its own
// session's events were never in this stream to begin with. Nothing on this end can wait
// for it — hence a line saying so, rather than a log that reads as if the work was done.
const BACKGROUND_SUBAGENT =
  '[board] this subagent runs in the background, and OpenCode ends the run with the main agent’s turn — so its work is cut off and never reported. `--pure` in Extra arguments runs OpenCode without the plugins that dispatch these.\n'

function dispatchedInBackground(input: unknown): boolean {
  return obj(input).run_in_background === true
}

export function createOpencodeStreamRenderer(): StreamRenderer {
  let final: string | undefined
  let sessionId: string | undefined
  let cost = 0
  const total: TokenUsage = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 }

  const renderLine = (line: string): string => {
    if (!line.trim()) return ''
    const ev = frame(line)
    // A stray CLI warning, or the usage text OpenCode prints when it doesn't
    // know a flag — either way the user needs to read it.
    if (!ev) return `${line}\n`
    // The id to resume by rides on every event; the first one wins, and a
    // resumed run reports the same session it continued.
    if (!sessionId) sessionId = str(ev.sessionID).trim() || undefined
    const part = obj(ev.part)
    switch (ev.type) {
      case 'text': {
        // The last thing the agent said is the run's result. The UI leads with
        // it and folds the events away.
        const said = str(part.text).trim()
        if (!said) return ''
        final = said
        return `${said}\n\n`
      }
      case 'tool_use': {
        const state = obj(part.state)
        const name = str(part.tool) || 'tool'
        const call = `⏺ ${name}${argHint(state.input, ARG_KEYS)}\n`
        if (state.status === 'error') return `${call}[error] ${str(state.error)}\n`
        return dispatchedInBackground(state.input) ? `${call}${BACKGROUND_SUBAGENT}` : call
      }
      case 'step_finish':
        // One step is one model call, so a run that used tools reports several.
        // They are added up: what the run cost is what all of its calls cost.
        cost += typeof part.cost === 'number' && Number.isFinite(part.cost) && part.cost > 0 ? part.cost : 0
        {
          const tokens = obj(part.tokens)
          const cache = obj(tokens.cache)
          total.input += num(tokens.input)
          total.output += num(tokens.output)
          total.cacheRead += num(cache.read)
          total.cacheCreation += num(cache.write)
        }
        return ''
      case 'error': {
        // The error is a structured object, and which key carries the sentence
        // depends on what failed — so the readable line is preferred and the
        // whole object is the fallback, never nothing.
        const err = obj(ev.error)
        const said = str(obj(err.data).message) || str(err.name) || JSON.stringify(ev.error)
        return `[error] ${said}\n`
      }
      default:
        // `step_start`, `reasoning`, and anything a newer OpenCode adds: noise
        // in a tail.
        return ''
    }
  }

  return {
    ...createLineReader(renderLine),
    result: () => final,
    // A free model reports a cost of 0, which is a real answer and not one worth
    // printing — the UI shows a price only when the run was charged for one.
    costUsd: () => (cost > 0 ? cost : undefined),
    usage: () => {
      const sum = total.input + total.cacheCreation + total.cacheRead + total.output
      return sum > 0 ? { ...total } : undefined
    },
    // No model on purpose — see the note at the top.
    resumeId: () => sessionId,
  }
}
