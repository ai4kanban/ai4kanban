// The component's half of the Bridge: JSON-RPC 2.0 over postMessage, with message names
// taken from MCP Apps (`ui/initialize`, `ui/notifications/size-changed`,
// `ui/notifications/host-context-changed`) plus `wildcrane/save`. The review page is the only
// frame allowed to embed a component, so the parent is the only peer listened to.

export type Locale = "zh" | "en";
export type Theme = "light" | "dark";

/** The artifact version under review: inline JSON, or a file's bytes. */
export interface Artifact {
  type: string;
  name: string;
  version: number;
  content?: unknown;
  file?: { data: ArrayBuffer; contentType: string };
}

export interface Context {
  artifact: Artifact;
  /** True for anyone who may not save: send changes back with a comment instead. */
  readOnly: boolean;
  locale: Locale;
  theme: Theme;
}

export interface Connection extends Context {
  /** Save `content` as the artifact's next version. Rejects with the reason, in `locale`. */
  save(content: unknown): Promise<{ version: number }>;
  /** Ask for this height, in CSS pixels. Done for you unless `autoResize` is false. */
  resize(height: number): void;
  /** Called when the page changes the theme, the language or the artifact. */
  onChange(listener: (context: Context) => void): () => void;
}

export interface ConnectOptions {
  /** Follow the document's height. Default true. */
  autoResize?: boolean;
  /** How long to wait for the review page, in ms. Default 10000. */
  timeout?: number;
}

type Message = { jsonrpc: "2.0"; id?: number; method?: string; params?: any; result?: any; error?: { message: string } };

export class SaveError extends Error {}

export function connect(options: ConnectOptions = {}): Promise<Connection> {
  const parent = window.parent;
  if (parent === window) return Promise.reject(new Error("Not inside the WildCrane review page."));
  let origin = "*";
  let next = 1;
  const waiting = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  const listeners = new Set<(c: Context) => void>();
  let context: Context;

  const post = (message: Omit<Message, "jsonrpc">) => parent.postMessage({ jsonrpc: "2.0", ...message }, origin);
  const request = (method: string, params?: unknown) =>
    new Promise<any>((resolve, reject) => {
      const id = next++;
      waiting.set(id, { resolve, reject });
      post({ id, method, params });
    });

  window.addEventListener("message", (event) => {
    if (event.source !== parent) return;
    const m = event.data as Message;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && waiting.has(m.id)) {
      if (origin === "*") origin = event.origin;
      const w = waiting.get(m.id)!;
      waiting.delete(m.id);
      if (m.error) w.reject(new SaveError(m.error.message));
      else w.resolve(m.result);
    } else if (m.method === "ui/notifications/host-context-changed" && origin === event.origin) {
      context = { ...context, ...m.params };
      for (const l of listeners) l(context);
    }
  });

  const resize = (height: number) => post({ method: "ui/notifications/size-changed", params: { height: Math.ceil(height) } });

  const ready = request("ui/initialize", { protocolVersion: 1 }).then((initial: Context): Connection => {
    context = initial;
    if (options.autoResize !== false) {
      // The content's own height: `scrollHeight` never drops below the frame's.
      const measure = () => resize(document.documentElement.getBoundingClientRect().height);
      const watch = new ResizeObserver(measure);
      watch.observe(document.documentElement);
      watch.observe(document.body);
      measure();
    }
    const connection: Connection = {
      get artifact() { return context.artifact; },
      get readOnly() { return context.readOnly; },
      get locale() { return context.locale; },
      get theme() { return context.theme; },
      save: (content) =>
        context.readOnly
          ? Promise.reject(new SaveError(context.locale === "zh" ? "你没有保存权限。" : "You can't save changes here."))
          : request("wildcrane/save", { content }),
      resize,
      onChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    return connection;
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("The review page did not answer.")), options.timeout ?? 10_000));
  return Promise.race([ready, timeout]);
}
