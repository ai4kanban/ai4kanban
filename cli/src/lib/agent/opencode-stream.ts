// Turns `opencode run --format json`'s JSONL stream into the same readable log
// the other renderers write (#160). OpenCode's default mode prints a formatted
// transcript meant for a terminal, so the harness asks for the raw events (see
// the OpenCode entry in harnesses.ts) and this renders them.
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

import type { StreamRenderer } from "./stream";
import type { TokenUsage } from "./types";

type Event = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function block(value: unknown): Event {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Event) : {};
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

// One short hint beside a call — the first line of the argument a human would
// recognise it by, bounded. Same shape the other renderers use, so every agent's
// log reads alike.
function hint(raw: string): string {
  const line = raw.split("\n")[0].trim();
  if (!line) return "";
  return `(${line.length > 96 ? line.slice(0, 93) + "…" : line})`;
}

// What a call was called on. OpenCode's own tools name their arguments
// `filePath`, `command`, `pattern` and so on, and an MCP tool brings whatever
// names its server chose — so the first recognisable string wins and a tool with
// none is logged by name alone.
function argHint(input: Event): string {
  const raw = [input.command, input.filePath, input.file_path, input.path, input.pattern, input.query, input.url].find(
    (v) => typeof v === "string" && v,
  ) as string | undefined;
  return raw ? hint(raw) : "";
}

export function createOpencodeStreamRenderer(): StreamRenderer {
  let buf = "";
  let final: string | undefined;
  let sessionId: string | undefined;
  let cost = 0;
  const total: TokenUsage = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 };

  const renderLine = (line: string): string => {
    if (!line.trim()) return "";
    let ev: Event;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return line + "\n";
      ev = parsed as Event;
    } catch {
      // A stray CLI warning, or the usage text OpenCode prints when it doesn't
      // know a flag — either way the user needs to read it.
      return line + "\n";
    }
    // The id to resume by rides on every event; the first one wins, and a
    // resumed run reports the same session it continued.
    if (!sessionId) sessionId = text(ev.sessionID).trim() || undefined;
    const part = block(ev.part);
    switch (ev.type) {
      case "text": {
        // The last thing the agent said is the run's result. The UI leads with
        // it and folds the events away.
        const said = text(part.text).trim();
        if (!said) return "";
        final = said;
        return `${said}\n\n`;
      }
      case "tool_use": {
        const state = block(part.state);
        const name = text(part.tool) || "tool";
        const failed = state.status === "error";
        const call = `⏺ ${name}${argHint(block(state.input))}\n`;
        return failed ? `${call}[error] ${text(state.error)}\n` : call;
      }
      case "step_finish":
        // One step is one model call, so a run that used tools reports several.
        // They are added up: what the run cost is what all of its calls cost.
        cost += typeof part.cost === "number" && Number.isFinite(part.cost) && part.cost > 0 ? part.cost : 0;
        {
          const tokens = block(part.tokens);
          const cache = block(tokens.cache);
          total.input += num(tokens.input);
          total.output += num(tokens.output);
          total.cacheRead += num(cache.read);
          total.cacheCreation += num(cache.write);
        }
        return "";
      case "error": {
        // The error is a structured object, and which key carries the sentence
        // depends on what failed — so the readable line is preferred and the
        // whole object is the fallback, never nothing.
        const err = block(ev.error);
        const data = block(err.data);
        const said = text(data.message) || text(err.name) || JSON.stringify(ev.error);
        return `[error] ${said}\n`;
      }
      default:
        // `step_start`, `reasoning`, and anything a newer OpenCode adds: noise
        // in a tail.
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
    // A free model reports a cost of 0, which is a real answer and not one worth
    // printing — the UI shows a price only when the run was charged for one.
    costUsd: () => (cost > 0 ? cost : undefined),
    usage: () => {
      const sum = total.input + total.cacheCreation + total.cacheRead + total.output;
      return sum > 0 ? { ...total } : undefined;
    },
    // No model on purpose — see the note at the top.
    resumeId: () => sessionId,
  };
}
