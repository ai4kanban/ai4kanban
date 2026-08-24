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

import type { StreamRenderer } from "./stream";

type Event = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// One short hint beside a call — the first line of the argument a human would
// recognise it by, bounded. Same shape the other renderers use, so every agent's
// log reads alike.
function hint(raw: string): string {
  const line = raw.split("\n")[0].trim();
  if (!line) return "";
  return `(${line.length > 96 ? line.slice(0, 93) + "…" : line})`;
}

// Cursor names a call by the KEY it puts inside `tool_call`, not by a `name`
// field: `{"tool_call":{"readToolCall":{"args":{"path":"a.ts"}}}}`. So the call
// is whatever single key is there, and its arguments are that key's `args`.
// `readToolCall` reads as `read` — the suffix is Cursor's wire naming, not
// something a log should repeat on every line.
function callOf(ev: Event): { name: string; args: Event } | null {
  const call = ev.tool_call;
  if (!call || typeof call !== "object") return null;
  const [key] = Object.keys(call as Event);
  if (!key) return null;
  const body = (call as Event)[key];
  const args = body && typeof body === "object" ? ((body as Event).args as Event) : undefined;
  return { name: key.replace(/ToolCall$/, ""), args: args && typeof args === "object" ? args : {} };
}

// The argument a human would recognise a call by, across the tools Cursor
// ships. Same list the Claude renderer keeps, plus Cursor's own `path`.
function argHint(args: Event): string {
  const raw = [args.command, args.path, args.file_path, args.pattern, args.query, args.url, args.prompt].find(
    (v) => typeof v === "string" && v,
  ) as string | undefined;
  return raw ? hint(raw) : "";
}

// The text an assistant event carries, joined from its content blocks.
function saidIn(ev: Event): string {
  const msg = ev.message as { content?: unknown } | undefined;
  const blocks: unknown[] = Array.isArray(msg?.content) ? msg.content : [];
  return blocks
    .map((raw) => {
      const b = raw as Event;
      return b?.type === "text" ? text(b.text) : "";
    })
    .join("");
}

export function createCursorStreamRenderer(): StreamRenderer {
  let buf = "";
  let final: string | undefined;
  let model: string | undefined;
  let sessionId: string | undefined;
  // The last thing logged, so a message Cursor flushes twice is written once.
  // Its stream aggregates deltas itself, and a flush at the end of a message can
  // repeat what the previous event already carried.
  let said = "";

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
    // The id to resume by rides on every event; the first one wins, and a
    // resumed run reports the same session it continued.
    if (!sessionId) sessionId = text(ev.session_id).trim() || undefined;
    switch (ev.type) {
      case "system":
        // The opening banner names the model, which is what lets a Cursor run
        // show one from its first second.
        if (ev.subtype === "init" && !model) model = text(ev.model).trim() || undefined;
        return "";
      case "assistant": {
        const whole = saidIn(ev).trim();
        if (!whole || whole === said) return "";
        said = whole;
        return `${whole}\n\n`;
      }
      case "tool_call": {
        // Logged when it STARTS: a shell command or a long search should show up
        // while it runs, not once it's over. The matching `completed` event
        // repeats the call and is dropped, so one call is one line.
        if (ev.subtype !== "started") return "";
        const call = callOf(ev);
        if (!call) return "";
        said = "";
        return `⏺ ${call.name}${argHint(call.args)}\n`;
      }
      case "result": {
        // The run's own summary of what it did. The UI leads with it and folds
        // the events away.
        const result = text(ev.result).trim();
        if (result) final = result;
        // An error the CLI reports as the result rather than as a message —
        // otherwise the log would end on the events and say nothing about why.
        if (ev.is_error === true) return `[error] ${result || "the session failed"}\n`;
        return "";
      }
      default:
        // `user` (the prompt echoed back) and anything a newer Cursor adds:
        // noise in a tail.
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
    model: () => model,
    // No costUsd and no usage on purpose — see the note at the top.
    resumeId: () => sessionId,
  };
}
