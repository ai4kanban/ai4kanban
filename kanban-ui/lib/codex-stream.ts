// Turns `codex exec --json`'s JSONL stream into the same readable log the Claude
// renderer writes (#69). Codex prints only its final message by default, so the
// harness asks for the event stream (see the Codex entry in lib/agent.ts) and
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
// to-do list, the turn markers) is dropped. Non-JSON lines pass through
// untouched, so a stray CLI warning still lands in the log as-is.
//
// No cost and no model: Codex reports neither — it prices nothing, and it never
// names the model in this stream. Both are left off rather than invented, and
// the UI shows nothing where Claude Code shows a number.

import type { StreamRenderer } from "./stream";
import type { TokenUsage } from "./types";

type Event = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// One short hint beside a call — the first line of the argument a human would
// recognise it by, bounded. Same shape the Claude renderer uses, so both agents'
// logs read alike.
function hint(raw: string): string {
  const line = raw.split("\n")[0].trim();
  if (!line) return "";
  return `(${line.length > 96 ? line.slice(0, 93) + "…" : line})`;
}

// A thing the agent started doing. Only the ones worth a line while they run: a
// command can take minutes, and a log that waits for it to finish looks stalled.
function renderStarted(item: Event): string {
  switch (item.type) {
    case "command_execution":
      return `⏺ Command${hint(text(item.command))}\n`;
    case "mcp_tool_call":
      return `⏺ ${text(item.server)}.${text(item.tool)}\n`;
    case "web_search":
      return `⏺ WebSearch${hint(text(item.query))}\n`;
    default:
      return "";
  }
}

// A thing the agent finished. The ones whose content only exists once they are
// done — what it said, which files it wrote, an error it hit. The calls above
// are not repeated here.
function renderCompleted(item: Event): string {
  switch (item.type) {
    case "agent_message": {
      const said = text(item.text).trim();
      return said ? `${said}\n\n` : "";
    }
    case "file_change": {
      const changes = Array.isArray(item.changes) ? item.changes : [];
      return changes
        .map((raw) => {
          const change = raw as Event;
          const path = text(change.path);
          return path ? `⏺ ${text(change.kind) || "change"}(${path})\n` : "";
        })
        .join("");
    }
    case "error":
      return `[error] ${text(item.message)}\n`;
    default:
      return "";
  }
}

// The token counts a completed turn carries. Codex's four names map onto the
// board's four, with one left out on purpose: `reasoning_output_tokens` is
// already part of `output_tokens`, so adding it would count the same tokens
// twice. All-zero counts read as "reported nothing", like the Claude renderer.
function parseUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Event;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const usage: TokenUsage = {
    input: n(u.input_tokens),
    cacheCreation: n(u.cache_write_input_tokens),
    cacheRead: n(u.cached_input_tokens),
    output: n(u.output_tokens),
  };
  const total = usage.input + usage.cacheCreation + usage.cacheRead + usage.output;
  return total > 0 ? usage : undefined;
}

export function createCodexStreamRenderer(): StreamRenderer {
  let buf = "";
  let final: string | undefined;
  let usage: TokenUsage | undefined;
  let threadId: string | undefined;

  const renderLine = (line: string): string => {
    if (!line.trim()) return "";
    let ev: Event;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return line + "\n";
      ev = parsed as Event;
    } catch {
      return line + "\n";
    }
    switch (ev.type) {
      case "thread.started":
        // The id to resume by, on the run's first event. First one wins — a
        // resumed run reports the thread it continued, which is the same thread.
        if (!threadId) threadId = text(ev.thread_id).trim() || undefined;
        return "";
      case "item.started":
        return renderStarted((ev.item ?? {}) as Event);
      case "item.completed": {
        const item = (ev.item ?? {}) as Event;
        // The last thing the agent said is the run's result. The UI leads with
        // it and folds the events away; the streamed copy above is trimmed off
        // the tail by the registry.
        if (item.type === "agent_message") {
          const said = text(item.text).trim();
          if (said) final = said;
        }
        return renderCompleted(item);
      }
      case "turn.completed":
        // Last turn wins. `codex exec` sends one prompt, so there is normally
        // one — and if a run ever takes more, the numbers the board shows are
        // the ones the run ended on rather than a total it can't verify.
        usage = parseUsage(ev.usage) ?? usage;
        return "";
      case "turn.failed": {
        const err = (ev.error ?? {}) as Event;
        return `[error] ${text(err.message)}\n`;
      }
      case "error":
        return `[error] ${text(ev.message)}\n`;
      default:
        // turn.started and anything a newer Codex adds: noise in a tail.
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
    usage: () => usage,
    // No costUsd and no model on purpose — see the note at the top.
    resumeId: () => threadId,
  };
}
