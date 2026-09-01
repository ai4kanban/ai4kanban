// Turns `kimi -p --output-format stream-json`'s JSONL into the same readable log the other
// renderers write (#377). Kimi's default print mode streams a transcript styled for a
// terminal, so the harness asks for the JSON rows (see harnesses/kimi.ts) and this renders
// them.
//
// Every row is one OpenAI-shaped chat message, and there are three kinds:
//   • `{role:'assistant', content?, tool_calls?}` — one finished block. `content` is
//     something the agent said; `tool_calls` are the calls it made, each with its arguments
//     as a JSON STRING rather than an object.
//   • `{role:'tool', tool_call_id, content}` — what a call returned, in full. Not logged:
//     one Read is a whole file, and the call line above already says what happened.
//   • `{role:'meta', type, …}` — the run about itself. `session.resume_hint` carries the
//     session id, `turn.step.retrying` a provider retry, `system.version` the build.
//
// Thinking, tool progress and Kimi's own "resuming session" notice all go to stderr, which
// the log keeps as it arrives.
//
// The model and the token counts are on none of these rows. They are read off disk instead,
// out of the session Kimi wrote — the one `session.resume_hint` names, or, for a run that
// died before printing it, the newest one opened in this folder since (./kimi-session).

import { argHint, num, obj, str } from './json'
import { createLineReader, frame, type StreamRenderer } from './stream'
import { findKimiSession, readKimiRunFacts, type KimiRunFacts } from './kimi-session'

// What a call was called on, across the tools Kimi ships: `path` for the file tools,
// `command` for Bash, `pattern` for Grep and Glob, `query`/`url` for the web ones, and
// `prompt`/`prompt_template` for a subagent, which is called on a task rather than a file.
const ARG_KEYS = ['command', 'path', 'pattern', 'query', 'url', 'prompt', 'prompt_template', 'description'] as const

// A call's arguments arrive as a JSON string, so they are parsed before the hint is taken.
function callArgs(raw: unknown): unknown {
  const text = str(raw)
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

// One `⏺ name(hint)` line per call the agent made.
function toolCalls(row: Record<string, unknown>): string {
  const calls = Array.isArray(row.tool_calls) ? row.tool_calls : []
  return calls
    .map((raw) => {
      const call = obj(raw)
      const fn = obj(call.function)
      const name = str(fn.name) || 'tool'
      return `⏺ ${name}${argHint(callArgs(fn.arguments), ARG_KEYS)}\n`
    })
    .join('')
}

// A provider retry, in the numbers Kimi reports it with. Worth a line: a run that took ten
// minutes because it was retried four times reads exactly like a slow one otherwise, and
// the reason is the answer to why it eventually failed.
function retry(row: Record<string, unknown>): string {
  const why = str(row.error_message) || str(row.error_name) || 'the provider failed'
  const attempt = `${num(row.next_attempt)}/${num(row.max_attempts)}`
  return `[retry ${attempt}] ${why}\n`
}

// How often the session is looked for on disk while a run is going. The runner asks the
// renderer for the model and the resume id on every chunk of output, and a run arrives in
// hundreds of them. A few seconds is late enough to be cheap and early enough that the
// panel names the model while the run is still working.
const LOOK_EVERY_MS = 3_000

export function createKimiStreamRenderer(cwd: string): StreamRenderer {
  // A crashed run's session is looked for among the ones opened SINCE this renderer was
  // built, so it can never settle on the previous run's (./kimi-session).
  const startedAt = Date.now()
  let final: string | undefined
  let sessionId: string | undefined
  let facts: KimiRunFacts | undefined
  let lookedAt = 0

  // Look beside the stream for what the stream doesn't say. Nothing to look for again once
  // the model is known — a turn can't change it — except on the last look after a run has
  // ended, which is the one the token counts come from. `now` skips the wait for that one.
  const look = (now: boolean): void => {
    if (facts?.model && !now) return
    const at = Date.now()
    if (!now && at - lookedAt < LOOK_EVERY_MS) return
    lookedAt = at
    sessionId ??= findKimiSession(cwd, startedAt)
    if (sessionId) facts = readKimiRunFacts(sessionId) ?? facts
  }

  const renderLine = (line: string): string => {
    if (!line.trim()) return ''
    const row = frame(line)
    // A stray CLI warning, or the usage text Kimi prints when it doesn't know a flag —
    // either way the user needs to read it.
    if (!row) return `${line}\n`
    switch (row.role) {
      case 'assistant': {
        const said = str(row.content).trim()
        // The last thing the agent said is the run's result. The UI leads with it and folds
        // the events away.
        if (said) final = said
        return `${said ? `${said}\n\n` : ''}${toolCalls(row)}`
      }
      case 'meta':
        // `kimi -p` closes by printing the id its own `--session` takes, so a run that got
        // this far is resumable and no folder has to be searched for it.
        if (row.type === 'session.resume_hint') sessionId ??= str(row.session_id).trim() || undefined
        return row.type === 'turn.step.retrying' ? retry(row) : ''
      default:
        // `tool` rows, and anything a newer Kimi adds: noise in a tail.
        return ''
    }
  }

  const lines = createLineReader(renderLine)
  return {
    push: lines.push,
    flush(): string {
      const out = lines.flush()
      // The run is over: the session is complete, and this is the last chance to read it
      // before the record closes.
      look(true)
      return out
    },
    result: () => final,
    usage: () => facts?.usage,
    model: () => {
      look(false)
      return facts?.model
    },
    // No cost. Kimi's own output prices nothing, and the board's rate table names no Kimi
    // model — a run on a subscription or a gateway has no published rate to price it at, so
    // it shows a blank rather than a number nobody could stand behind.
    resumeId: () => {
      look(false)
      return sessionId
    },
  }
}
