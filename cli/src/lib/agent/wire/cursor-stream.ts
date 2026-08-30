// Turns `cursor-agent -p --output-format stream-json`'s NDJSON into the same
// readable log the other renderers write (#160). Cursor's default text mode
// prints one blob at the end, so the harness asks for the event stream (see the
// Cursor entry in harnesses/cursor.ts) and this renders it.
//
// Four event types matter here:
//   • `system` / `init` — the run's opening banner. It carries `model`, the
//     display name of the model doing the work, and `session_id`.
//   • `assistant` — one thing the agent said, as `message.content[]` text
//     blocks. Cursor aggregates its own deltas into one event per complete
//     message between tool calls, so each event's text is new text.
//   • `tool_call` — one per call the agent made, `started` then `completed`.
//     The call's name is the key inside `tool_call` (`readToolCall`,
//     `shellToolCall`, …) and its arguments sit under that key's `args`.
//   • `result` — the run's final message, once.
//
// `session_id` rides on every event, and `cursor-agent --resume <id>` takes it,
// so a Cursor run is resumable from its first event.
//
// No cost and no token counts: Cursor's stream reports neither, so both are left
// off rather than invented and the UI shows nothing where Claude Code shows a
// number.

import { argHint, obj, str, type Json } from './json'
import { createLineReader, frame, type StreamRenderer } from './stream'

// The argument a human would recognise a call by, across the tools Cursor
// ships. Same list the Claude renderer keeps, plus Cursor's own `path`.
const ARG_KEYS = ['command', 'path', 'file_path', 'pattern', 'query', 'url', 'prompt'] as const

// Cursor names a call by the KEY it puts inside `tool_call`, not by a `name`
// field: `{"tool_call":{"readToolCall":{"args":{"path":"a.ts"}}}}`. So the call
// is whatever single key is there, and its arguments are that key's `args`.
// `readToolCall` reads as `read` — the suffix is Cursor's wire naming, not
// something a log should repeat on every line.
function callOf(ev: Json): { name: string; args: Json } | null {
  const call = obj(ev.tool_call)
  const [key] = Object.keys(call)
  if (!key) return null
  return { name: key.replace(/ToolCall$/, ''), args: obj(obj(call[key]).args) }
}

// The text an assistant event carries, joined from its content blocks.
function saidIn(ev: Json): string {
  const msg = ev.message as { content?: unknown } | undefined
  const blocks: unknown[] = Array.isArray(msg?.content) ? msg.content : []
  return blocks
    .map((raw) => {
      const b = obj(raw)
      return b.type === 'text' ? str(b.text) : ''
    })
    .join('')
}

export function createCursorStreamRenderer(): StreamRenderer {
  let final: string | undefined
  let model: string | undefined
  let sessionId: string | undefined
  // The last thing logged, so a message Cursor flushes twice is written once.
  // Its stream aggregates deltas itself, and a flush at the end of a message can
  // repeat what the previous event already carried.
  let said = ''

  const renderLine = (line: string): string => {
    if (!line.trim()) return ''
    const ev = frame(line)
    if (!ev) return `${line}\n`
    // The id to resume by rides on every event; the first one wins, and a
    // resumed run reports the same session it continued.
    if (!sessionId) sessionId = str(ev.session_id).trim() || undefined
    switch (ev.type) {
      case 'system':
        // The opening banner names the model, which is what lets a Cursor run
        // show one from its first second.
        if (ev.subtype === 'init' && !model) model = str(ev.model).trim() || undefined
        return ''
      case 'assistant': {
        const whole = saidIn(ev).trim()
        if (!whole || whole === said) return ''
        said = whole
        return `${whole}\n\n`
      }
      case 'tool_call': {
        // Logged when it STARTS: a shell command or a long search should show up
        // while it runs, not once it's over. The matching `completed` event
        // repeats the call and is dropped, so one call is one line.
        if (ev.subtype !== 'started') return ''
        const call = callOf(ev)
        if (!call) return ''
        said = ''
        return `⏺ ${call.name}${argHint(call.args, ARG_KEYS)}\n`
      }
      case 'result': {
        // The run's own summary of what it did. The UI leads with it and folds
        // the events away.
        const result = str(ev.result).trim()
        if (result) final = result
        // An error the CLI reports as the result rather than as a message —
        // otherwise the log would end on the events and say nothing about why.
        if (ev.is_error === true) return `[error] ${result || 'the session failed'}\n`
        return ''
      }
      default:
        // `user` (the prompt echoed back) and anything a newer Cursor adds:
        // noise in a tail.
        return ''
    }
  }

  return {
    ...createLineReader(renderLine),
    result: () => final,
    model: () => model,
    // No costUsd and no usage on purpose — see the note at the top.
    resumeId: () => sessionId,
  }
}
