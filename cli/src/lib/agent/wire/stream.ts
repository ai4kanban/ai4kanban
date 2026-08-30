// What a printing connector's output is turned into, and what a run learns from it.
//
// Four of the board's agents are started, handed the prompt on their command line, and read
// to the end: they print, we parse, the exit code is the verdict. Each one prints its own
// shape of NDJSON, so each has a renderer of its own beside this file — but all four answer
// this one interface, and the runner learns none of their formats.
//
// Non-JSON lines pass through untouched in every renderer, so a stray CLI warning still
// lands in the log as-is.

import type { TokenUsage } from '../types'

export interface StreamRenderer {
  /** Feed a chunk of stdout; returns the log text it renders to (may be ""). */
  push(chunk: string): string
  /** Render a trailing partial line at close; returns the remaining text. */
  flush(): string
  /** The agent's final message, once the `result` event has arrived. */
  result(): string | undefined
  /** What this run cost in US dollars, once the `result` event has reported one.
   *  An ESTIMATE the agent works out on its own machine from token counts at list
   *  prices — not a bill (task #90). Only harnesses whose output reports a cost
   *  implement this; the rest leave it out and the UI shows no number. */
  costUsd?(): number | undefined
  /** The tokens the run consumed, once the `result` event has reported them —
   *  fresh input, cache writes, cache reads, and output, the same counts the
   *  cost above is worked out from. Only harnesses whose output reports usage
   *  implement this; the rest leave it out and the UI shows no numbers. */
  usage?(): TokenUsage | undefined
  /** The model id this run is working with, as the agent itself named it (task
   *  #98) — never the model setting, which most people leave empty. The FIRST id
   *  the output names wins: that is the model the run started on, and a run that
   *  hands some work to a smaller model along the way is still one run by one
   *  model. Only harnesses whose output names a model implement this; the rest
   *  leave it out and the UI shows nothing rather than inventing a name. */
  model?(): string | undefined
  /** The id this harness's own CLI resumes by, once its output has reported one.
   *  Only harnesses that mint their own id mid-run implement this — one that
   *  adopts the id we generate (Claude Code, via `--session-id`) knows it before
   *  the run starts and leaves this out. The registry polls it while the stream
   *  runs and saves the id with the session the moment it arrives. */
  resumeId?(): string | undefined
}

/** Drop a harness's own housekeeping lines from its stderr as they arrive (see
 *  `quietStderr` in agent/harnesses/types.ts). stderr comes in chunks, not lines, so the tail of
 *  a chunk is held back until the newline that ends it — otherwise a line split across two
 *  reads would be judged on half of itself.
 *
 *  With no predicate this is the identity: a harness that declares nothing quiet keeps
 *  every byte, which is what every harness but Codex does today. */
export function createStderrFilter(quiet?: (line: string) => boolean): {
  push(chunk: string): string
  flush(): string
} {
  if (!quiet) return { push: (chunk) => chunk, flush: () => '' }
  let held = ''
  return {
    push(chunk) {
      held += chunk
      const cut = held.lastIndexOf('\n')
      if (cut === -1) return ''
      const whole = held.slice(0, cut + 1)
      held = held.slice(cut + 1)
      const kept = whole.split('\n').filter((line) => line === '' || !quiet(line))
      return kept.join('\n')
    },
    // Whatever never got its newline — the last line of a run that ended mid-write.
    flush() {
      const rest = held
      held = ''
      return rest && quiet(rest) ? '' : rest
    },
  }
}

/** The line loop every renderer runs: buffer stdout, cut it on newlines, render each whole
 *  line, and render whatever is left at close. Only `renderLine` differs between agents. */
export function createLineReader(renderLine: (line: string) => string): {
  push(chunk: string): string
  flush(): string
} {
  let buf = ''
  return {
    push(chunk: string): string {
      buf += chunk
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      return lines.map(renderLine).join('')
    },
    flush(): string {
      const rest = buf
      buf = ''
      return rest ? renderLine(rest) : ''
    },
  }
}

/** One line of a stream, as an object — or nothing when it isn't JSON at all, which every
 *  renderer passes through to the log untouched. */
export function frame(line: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(line)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    return parsed as Record<string, unknown>
  } catch {
    return undefined
  }
}
