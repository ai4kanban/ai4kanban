// Stands in for legacy app/poll/*: one held `GET /v1/events/stream`, read over fetch because an
// EventSource cannot carry the sign-in. It resumes after the last event seen (`Last-Event-ID`)
// and reconnects on its own.

import { freshSession } from "@review/auth";
import { API_URL } from "@review/config";

export type Event = { id: string; type: string; workspace: string; created_at: string; data: Record<string, unknown> };

const CURSOR = "wildcrane.web.events";

export function openStream(onEvent: (e: Event) => void, onState: (live: boolean) => void): () => void {
  let stopped = false;
  let abort: AbortController | null = null;
  let last = localStorage.getItem(CURSOR) ?? "";
  // A first connect replays up to 30 days; nothing older than this page is news to it.
  const since = new Date(Date.now() - 60_000).toISOString();

  const run = async () => {
    while (!stopped) {
      try {
        const session = await freshSession();
        if (!session) return;
        abort = new AbortController();
        const headers: Record<string, string> = { authorization: `Bearer ${session.access_token}`, accept: "text/event-stream" };
        if (last) headers["last-event-id"] = last;
        const r = await fetch(`${API_URL}/v1/events/stream`, { headers, signal: abort.signal });
        if (!r.ok || !r.body) throw new Error(String(r.status));
        onState(true);
        const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let cut: number;
          while ((cut = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, cut);
            buf = buf.slice(cut + 2);
            const data = block
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart())
              .join("\n");
            if (!data) continue;
            try {
              const e = JSON.parse(data) as Event;
              last = e.id;
              localStorage.setItem(CURSOR, last);
              if (!e.created_at || e.created_at >= since) onEvent(e);
            } catch {
              // a line that is not an event
            }
          }
        }
      } catch {
        // dropped or refused: wait and connect again
      }
      if (stopped) return;
      onState(false);
      await new Promise((ok) => setTimeout(ok, 3000));
    }
  };
  void run();
  return () => {
    stopped = true;
    abort?.abort();
  };
}
