// The review page's half of a component's Bridge (#2006): JSON-RPC 2.0 over postMessage, the
// message names of artifact-sdk/src/index.ts. Only the frame's own window at its own origin is
// heard, and only three methods; everything else is dropped unanswered.

import type { Lang } from "../i18n";

export type BridgeArtifact = {
  type: string;
  name: string;
  version: number;
  content?: unknown;
  file?: { data: ArrayBuffer; contentType: string };
};

export type BridgeContext = { artifact: BridgeArtifact; readOnly: boolean; locale: Lang; theme: "light" | "dark" };

type Message = { jsonrpc?: string; id?: unknown; method?: unknown; params?: { height?: unknown; content?: unknown } };

export function hostBridge(
  frame: HTMLIFrameElement,
  origin: string,
  o: {
    context: BridgeContext;
    /** Resolves with the new version; rejects with the reason to show, in the page's language. */
    save: ((content: unknown) => Promise<{ version: number }>) | null;
    refused: string;
    busy: string;
    resize: (height: number) => void;
    ready: () => void;
  },
): () => void {
  let saving = false;
  const onMessage = async (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || e.origin !== origin) return;
    const m = e.data as Message;
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return;
    const reply = (body: { result: unknown } | { error: { code: number; message: string } }) =>
      frame.contentWindow?.postMessage({ jsonrpc: "2.0", id: m.id, ...body }, origin);
    switch (m.method) {
      case "ui/initialize":
        if (typeof m.id !== "number") return;
        o.ready();
        reply({ result: o.context });
        return;
      case "ui/notifications/size-changed": {
        const h = Number(m.params?.height);
        if (Number.isFinite(h) && h > 0) o.resize(h);
        return;
      }
      case "wildcrane/save":
        if (typeof m.id !== "number") return;
        if (!o.save) return reply({ error: { code: -32001, message: o.refused } });
        if (saving) return reply({ error: { code: -32002, message: o.busy } });
        saving = true;
        try {
          reply({ result: await o.save(m.params?.content) });
        } catch (err) {
          reply({ error: { code: -32000, message: err instanceof Error ? err.message : String(err) } });
        } finally {
          saving = false;
        }
    }
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
