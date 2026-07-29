// Turns the agent's NDJSON event stream into a readable log (task #14).
// `claude -p` in its default text mode prints nothing until the session ends, so
// there is no live tail to show. The spawn asks for `--output-format
// stream-json` instead (see agentArgv) and this renders each event — the
// agent's turn text and its tool calls — into log lines as they happen. The
// final `result` event is captured separately: the UI leads with it once the
// session completes and folds the event lines away.
//
// Non-JSON lines pass through untouched, so a custom (non-claude) agent
// command that prints plain text, or a stray CLI warning, still lands in the
// log as-is.

export interface StreamRenderer {
  /** Feed a chunk of stdout; returns the log text it renders to (may be ""). */
  push(chunk: string): string;
  /** Render a trailing partial line at close; returns the remaining text. */
  flush(): string;
  /** The agent's final message, once the `result` event has arrived. */
  result(): string | undefined;
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

export function createStreamRenderer(): StreamRenderer {
  let buf = "";
  let final: string | undefined;

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
  };
}
