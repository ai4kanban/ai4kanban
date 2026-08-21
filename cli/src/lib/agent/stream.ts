// Turns the agent's NDJSON event stream into a readable log (task #14).
// `claude -p` in its default text mode prints nothing until the session ends, so
// there is no live tail to show. The spawn asks for `--output-format
// stream-json` instead (see the Claude Code entry in harnesses.ts) and this renders each event — the
// agent's turn text and its tool calls — into log lines as they happen. The
// final `result` event is captured separately: the UI leads with it once the
// session completes and folds the event lines away.
//
// Non-JSON lines pass through untouched, so a custom (non-claude) agent
// command that prints plain text, or a stray CLI warning, still lands in the
// log as-is.

import type { TokenUsage } from "./types";

export interface StreamRenderer {
  /** Feed a chunk of stdout; returns the log text it renders to (may be ""). */
  push(chunk: string): string;
  /** Render a trailing partial line at close; returns the remaining text. */
  flush(): string;
  /** The agent's final message, once the `result` event has arrived. */
  result(): string | undefined;
  /** What this run cost in US dollars, once the `result` event has reported one.
   *  An ESTIMATE the agent works out on its own machine from token counts at list
   *  prices — not a bill (task #90). Only harnesses whose output reports a cost
   *  implement this; the rest leave it out and the UI shows no number. */
  costUsd?(): number | undefined;
  /** The tokens the run consumed, once the `result` event has reported them —
   *  fresh input, cache writes, cache reads, and output, the same counts the
   *  cost above is worked out from. Only harnesses whose output reports usage
   *  implement this; the rest leave it out and the UI shows no numbers. */
  usage?(): TokenUsage | undefined;
  /** The model id this run is working with, as the agent itself named it (task
   *  #98) — never the model setting, which most people leave empty. The FIRST id
   *  the output names wins: that is the model the run started on, and a run that
   *  hands some work to a smaller model along the way is still one run by one
   *  model. Only harnesses whose output names a model implement this; the rest
   *  leave it out and the UI shows nothing rather than inventing a name. */
  model?(): string | undefined;
  /** The id this harness's own CLI resumes by, once its output has reported one.
   *  Only harnesses that mint their own id mid-run implement this — one that
   *  adopts the id we generate (Claude Code, via `--session-id`) knows it before
   *  the run starts and leaves this out. The registry polls it while the stream
   *  runs and saves the id with the session the moment it arrives. */
  resumeId?(): string | undefined;
}

// One short hint per tool call: the argument a human would recognize the call
// by (the command, the file, the search), first line only, bounded.
function toolHint(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const o = input as Record<string, unknown>;
  const raw = [o.command, o.file_path, o.path, o.pattern, o.description, o.prompt, o.query, o.url].find(
    (v) => typeof v === "string" && v,
  ) as string | undefined;
  if (!raw) return "";
  const line = raw.split("\n")[0];
  return `(${line.length > 96 ? line.slice(0, 93) + "…" : line})`;
}

// The model id an event names, if it names one. Claude Code says it twice over:
// the `system`/`init` banner it opens with carries `model`, and every assistant
// turn repeats it under `message.model`. The banner comes first — which is what
// makes the model showable from the run's first second — and the turn is the
// fallback for output that opens with no banner.
function eventModel(ev: Record<string, unknown>): string | undefined {
  if (ev.type === "system" && ev.subtype === "init" && typeof ev.model === "string") {
    return ev.model.trim() || undefined;
  }
  if (ev.type === "assistant") {
    const msg = ev.message as { model?: unknown } | undefined;
    if (typeof msg?.model === "string") return msg.model.trim() || undefined;
  }
  return undefined;
}

/** Drop a harness's own housekeeping lines from its stderr as they arrive (see
 *  `quietStderr` in agent/harnesses.ts). stderr comes in chunks, not lines, so the tail of
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

export function createStreamRenderer(): StreamRenderer {
  let buf = "";
  let final: string | undefined;
  let cost: number | undefined;
  let model: string | undefined;
  let usage: TokenUsage | undefined;

  const renderLine = (line: string): string => {
    if (!line.trim()) return "";
    let ev: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return line + "\n";
      ev = parsed as Record<string, unknown>;
    } catch {
      return line + "\n";
    }
    // Which model is doing the work, taken from the run's own output as it goes.
    // First one wins, so this settles on the opening banner's id and never drifts
    // to whatever a later turn happens to say.
    if (model === undefined) model = eventModel(ev);
    switch (ev.type) {
      case "assistant": {
        const msg = ev.message as { content?: unknown } | undefined;
        const blocks: unknown[] = Array.isArray(msg?.content) ? msg.content : [];
        const out: string[] = [];
        for (const raw of blocks) {
          const b = raw as Record<string, unknown>;
          if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
            out.push(b.text.trim() + "\n\n");
          } else if (b?.type === "tool_use" && typeof b.name === "string") {
            out.push(`⏺ ${b.name}${toolHint(b.input)}\n`);
          }
        }
        return out.join("");
      }
      case "result":
        if (typeof ev.result === "string") final = ev.result;
        // `total_cost_usd` is claude's own arithmetic — the run's tokens at list
        // prices, worked out locally. A run on a subscription plan still reports
        // one even though nothing was charged for it, which is exactly why the UI
        // calls it an estimate. Only a positive, finite number counts; anything
        // else means the run has no cost to show (task #90).
        if (typeof ev.total_cost_usd === "number" && Number.isFinite(ev.total_cost_usd) && ev.total_cost_usd > 0) {
          cost = ev.total_cost_usd;
        }
        // The same event carries the token counts the cost was worked out from:
        // `usage.input_tokens` and friends, totals for the whole run. All-zero
        // counts read as "reported nothing" — no numbers over four zeros.
        {
          const u = ev.usage as Record<string, unknown> | undefined;
          const n = (v: unknown) =>
            typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
          if (u && typeof u === "object") {
            const parsed: TokenUsage = {
              input: n(u.input_tokens),
              cacheCreation: n(u.cache_creation_input_tokens),
              cacheRead: n(u.cache_read_input_tokens),
              output: n(u.output_tokens),
            };
            if (parsed.input + parsed.cacheCreation + parsed.cacheRead + parsed.output > 0) {
              usage = parsed;
            }
          }
        }
        return "";
      default:
        // system/init banners and tool results are noise in a tail.
        return "";
    }
  };

  return {
    push(chunk: string): string {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      return lines.map(renderLine).join("");
    },
    flush(): string {
      const rest = buf;
      buf = "";
      return rest ? renderLine(rest) : "";
    },
    result: () => final,
    costUsd: () => cost,
    usage: () => usage,
    model: () => model,
  };
}
