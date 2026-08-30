// Turns `claude -p --output-format stream-json`'s NDJSON into a readable log (task #14).
// Claude Code in its default text mode prints nothing until the session ends, so there is
// no live tail to show; the spawn asks for the event stream (see harnesses/claude-code.ts)
// and this renders each event — the agent's turn text and its tool calls — into log lines
// as they happen. The final `result` event is captured separately: the UI leads with it
// once the session completes and folds the event lines away.

import { argHint, num } from './json'
import { createLineReader, frame, type StreamRenderer } from './stream'
import type { TokenUsage } from '../types'

// The argument a human would recognise a call by, across the tools Claude Code ships.
const ARG_KEYS = ['command', 'file_path', 'path', 'pattern', 'description', 'prompt', 'query', 'url'] as const

// The model id an event names, if it names one. Claude Code says it twice over:
// the `system`/`init` banner it opens with carries `model`, and every assistant
// turn repeats it under `message.model`. The banner comes first — which is what
// makes the model showable from the run's first second — and the turn is the
// fallback for output that opens with no banner.
function eventModel(ev: Record<string, unknown>): string | undefined {
  if (ev.type === 'system' && ev.subtype === 'init' && typeof ev.model === 'string') {
    return ev.model.trim() || undefined
  }
  if (ev.type === 'assistant') {
    const msg = ev.message as { model?: unknown } | undefined
    if (typeof msg?.model === 'string') return msg.model.trim() || undefined
  }
  return undefined
}

export function createStreamRenderer(): StreamRenderer {
  let final: string | undefined
  let cost: number | undefined
  let model: string | undefined
  let usage: TokenUsage | undefined

  const renderLine = (line: string): string => {
    if (!line.trim()) return ''
    const ev = frame(line)
    if (!ev) return `${line}\n`
    // Which model is doing the work, taken from the run's own output as it goes.
    // First one wins, so this settles on the opening banner's id and never drifts
    // to whatever a later turn happens to say.
    if (model === undefined) model = eventModel(ev)
    switch (ev.type) {
      case 'assistant': {
        const msg = ev.message as { content?: unknown } | undefined
        const blocks: unknown[] = Array.isArray(msg?.content) ? msg.content : []
        const out: string[] = []
        for (const raw of blocks) {
          const b = raw as Record<string, unknown>
          if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
            out.push(`${b.text.trim()}\n\n`)
          } else if (b?.type === 'tool_use' && typeof b.name === 'string') {
            out.push(`⏺ ${b.name}${argHint(b.input, ARG_KEYS)}\n`)
          }
        }
        return out.join('')
      }
      case 'result':
        if (typeof ev.result === 'string') final = ev.result
        // `total_cost_usd` is claude's own arithmetic — the run's tokens at list
        // prices, worked out locally. A run on a subscription plan still reports
        // one even though nothing was charged for it, which is exactly why the UI
        // calls it an estimate. Only a positive, finite number counts; anything
        // else means the run has no cost to show (task #90).
        if (typeof ev.total_cost_usd === 'number' && Number.isFinite(ev.total_cost_usd) && ev.total_cost_usd > 0) {
          cost = ev.total_cost_usd
        }
        // The same event carries the token counts the cost was worked out from:
        // `usage.input_tokens` and friends, totals for the whole run. All-zero
        // counts read as "reported nothing" — no numbers over four zeros.
        {
          const u = ev.usage as Record<string, unknown> | undefined
          if (u && typeof u === 'object') {
            const parsed: TokenUsage = {
              input: num(u.input_tokens),
              cacheCreation: num(u.cache_creation_input_tokens),
              cacheRead: num(u.cache_read_input_tokens),
              output: num(u.output_tokens),
            }
            if (parsed.input + parsed.cacheCreation + parsed.cacheRead + parsed.output > 0) {
              usage = parsed
            }
          }
        }
        return ''
      default:
        // system/init banners and tool results are noise in a tail.
        return ''
    }
  }

  return {
    ...createLineReader(renderLine),
    result: () => final,
    costUsd: () => cost,
    usage: () => usage,
    model: () => model,
  }
}
