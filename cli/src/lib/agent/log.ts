// A run's log file — the durable record, and the only thing every process can read.
//
// One file per run, under docs/kanban/.sessions/. The run writes it as it goes, so anyone
// can follow any run, including one they did not start; and it outlives both the command
// that started the run and the process that watched it.
//
// A few bookkeeping stamps go in at the close, each on its own marker line. The record in
// .sessions.json answers these while it holds the run, but it keeps only the newest — the
// log file is what is left afterwards, so the numbers are stamped here too and read back
// out. They are stripped before the log is shown, so they never read as agent output.

import fs from 'node:fs'

import type { TokenUsage } from './types'

/** Written just before the agent's final message, so a log can be split back into events +
 *  final message long after the run. The events are rendered tool/turn lines, so this
 *  bracketed token won't collide with them. */
export const RESULT_MARKER = '<<<kanban:result>>>'

/** How long the run took, in ms. */
export const DURATION_MARKER = '<<<kanban:duration>>>'

/** What the run cost, in US dollars. */
export const COST_MARKER = '<<<kanban:cost>>>'

/** Which model did the work, as the run's own output named it. */
export const MODEL_MARKER = '<<<kanban:model>>>'

/** What the run consumed in tokens — the TokenUsage object as JSON. */
export const USAGE_MARKER = '<<<kanban:usage>>>'

/** How many run logs to keep on disk. */
export const KEEP_LOGS = 30

// The last few KB of a log, which is what a reader is shown by default.
const TAIL_BYTES = 16 * 1024

export const durationLine = (ms: number): string => `\n${DURATION_MARKER} ${Math.max(0, ms)}\n`
export const costLine = (costUsd: number): string => `${COST_MARKER} ${costUsd}\n`
export const modelLine = (model: string): string => `${MODEL_MARKER} ${model}\n`
export const usageLine = (usage: TokenUsage): string => `${USAGE_MARKER} ${JSON.stringify(usage)}\n`

/** A TokenUsage read back from somewhere untrusted — the record, or a log stamp. All four
 *  counts or nothing: a partial object shows no numbers rather than zeros it didn't earn. */
export function asUsage(v: unknown): TokenUsage | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const nums = [o.input, o.cacheCreation, o.cacheRead, o.output]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return undefined
  return {
    input: o.input as number,
    cacheCreation: o.cacheCreation as number,
    cacheRead: o.cacheRead as number,
    output: o.output as number,
  }
}

/** The tail of a log file. Bounded so a long run doesn't have to be read whole; pass
 *  Infinity for all of it. Null when there is no file yet. */
export function readLogTail(logPath: string, maxBytes = TAIL_BYTES): string | null {
  let fd: number | undefined
  try {
    const size = fs.statSync(logPath).size
    const start = Math.max(0, size - maxBytes)
    const len = size - start
    if (len === 0) return ''
    fd = fs.openSync(logPath, 'r')
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, start)
    let text = buf.toString('utf8')
    // We cut at a byte offset, so drop a partial first line if we didn't start at the top
    // — otherwise the view opens on half a line.
    if (start > 0) {
      const nl = text.indexOf('\n')
      if (nl >= 0) text = text.slice(nl + 1)
    }
    return text
  } catch {
    return null // no log file yet, or unreadable
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        // ignore
      }
    }
  }
}

/** Split a log into the run's events, its final message, and the stamps at the close. */
export function splitLog(logText: string): {
  tail: string
  result?: string
  durationMs?: number
  costUsd?: number
  model?: string
  usage?: TokenUsage
} {
  // Pull the bookkeeping stamps out first: they're not agent output, so they must not
  // reach a reader — and left in place they would land after the last tool line and the
  // legacy fallback below would read them as the final message.
  let durationMs: number | undefined
  let costUsd: number | undefined
  let model: string | undefined
  let usage: TokenUsage | undefined
  const kept: string[] = []
  for (const line of logText.split('\n')) {
    if (line.startsWith(DURATION_MARKER)) {
      const ms = Number(line.slice(DURATION_MARKER.length).trim())
      if (Number.isFinite(ms)) durationMs = ms
      continue
    }
    if (line.startsWith(COST_MARKER)) {
      const usd = Number(line.slice(COST_MARKER.length).trim())
      if (Number.isFinite(usd) && usd > 0) costUsd = usd
      continue
    }
    if (line.startsWith(MODEL_MARKER)) {
      model = line.slice(MODEL_MARKER.length).trim() || undefined
      continue
    }
    if (line.startsWith(USAGE_MARKER)) {
      try {
        usage = asUsage(JSON.parse(line.slice(USAGE_MARKER.length).trim()))
      } catch {
        // a garbled stamp shows no numbers
      }
      continue
    }
    kept.push(line)
  }
  return { ...splitBody(kept.join('\n')), durationMs, costUsd, model, usage }
}

// The final assistant turn is streamed into the log as it happens, then the same text
// arrives AGAIN as the `result` event, which is written behind the marker. A reader that
// leads with the message would show it twice, so the trailing copy is cut from the events.
// The FILE keeps both on purpose: the streamed copy is part of the durable event record.
export function stripTrailingResult(tail: string, result: string): string {
  const r = result.trim()
  const t = tail.replace(/\s+$/, '')
  if (!r || !t.endsWith(r)) return tail
  return t.slice(0, t.length - r.length).replace(/\s+$/, '')
}

function splitBody(logText: string): { tail: string; result?: string } {
  // Exact path — a log written after the marker landed: everything after the marker is the
  // final message, everything before it is the events. lastIndexOf so a marker-like token
  // in the events can't beat the real one appended last.
  const at = logText.lastIndexOf(RESULT_MARKER)
  if (at !== -1) {
    const tail = logText.slice(0, at).replace(/\n+$/, '')
    const result = logText
      .slice(at + RESULT_MARKER.length)
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
    return { tail: result ? stripTrailingResult(tail, result) : tail, result: result || undefined }
  }
  // Fallback for a log written before the marker existed. The renderer wrote every tool
  // call as a "⏺ …" line, so the closing prose after the LAST tool line is the final
  // message. The old write appended that message right after its identical streamed copy,
  // so collapse an exact "X … X" doubling back to a single X.
  const lines = logText.split('\n')
  let lastTool = -1
  for (let i = 0; i < lines.length; i++) if (lines[i]!.startsWith('⏺ ')) lastTool = i
  if (lastTool === -1) return { tail: logText } // no tool calls — can't tell events from message
  const tail = lines
    .slice(0, lastTool + 1)
    .join('\n')
    .replace(/\n+$/, '')
  const closing = lines
    .slice(lastTool + 1)
    .join('\n')
    .trim()
  if (!closing) return { tail: logText.replace(/\n+$/, '') } // ended on a tool call
  const paras = closing
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const half = paras.length / 2
  let doubled = Number.isInteger(half) && half > 0
  for (let i = 0; i < half && doubled; i++) if (paras[i] !== paras[i + half]) doubled = false
  const result = (doubled ? paras.slice(0, half) : paras).join('\n\n')
  return { tail, result: result || undefined }
}
