// The owner's conversation with an agent on the review page (#2027), after legacy
// kanban-ui/components/Chat.tsx and composer.tsx. No title row: the page's corner bubble opens
// and closes it, and it grows with the conversation. The agent picker, the context ring and an
// icon-only clear sit on the message box's bottom row. At phone width it covers the page.
// Pictures go with a message, a reply stops part way, and each reply has its usage and a copy
// button (#2133).

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FiCheck, FiChevronDown, FiCopy, FiImage, FiSend, FiSettings, FiSquare, FiTrash2, FiX } from "react-icons/fi";
import { ApiError, clearChat, readChat, sendChat, stopChat, type Chat, type ChatImage, type ChatMessage, type ChatRuntime, type Connector } from "../api";
import type { Copy } from "../i18n";
import { cn } from "../lib/utils";
import { AgentMark, type Harness } from "./agent-mark";
import { Button } from "./button";
import { Copied, useCopyText } from "./copy";
import { ImagePreview } from "./image-preview";
import { Markdown } from "./Markdown";

type AiCopy = Copy["ai"];

const MARK: Record<Connector, Harness> = { "claude-code": "claude", codex: "codex", cursor: "cursor", opencode: "opencode", kimi: "kimi", dsh: "dsh", zcode: "zcode", grok: "grok" };
const LABEL: Record<Connector, string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor", opencode: "OpenCode", kimi: "Kimi Code", dsh: "DSH", zcode: "ZCode", grok: "Grok Build" };

const nameOf = (c: AiCopy, r: ChatRuntime) => (r.default ? c.globalDefault : (r.name ?? c.taskRuntime));
/** Connector · model, shown under the task's runtime when it is not the reader's own. */
const detailOf = (c: AiCopy, r: ChatRuntime) => (r.name === null ? `${LABEL[r.connector]} · ${r.model ?? c.defaultModel}` : null);
const noteOf = (c: AiCopy, r: ChatRuntime) => (r.status === "not_installed" ? c.notInstalled : r.status === "signed_out" ? c.signedOut : null);

const POLL_MS = 3000;

/** What the card holds, for the asks offered on an empty chat. */
export type CardState = { question: boolean; comments: boolean; previews: boolean };

const working = (chat: Chat | null) => chat?.status === "queued" || chat?.status === "replying";

/** Where the conversation is read and written; a share link's by default. */
export type ChatApi = {
  read: () => Promise<Chat>;
  send: (body: string, runtime: string, images: ChatImage[]) => Promise<Chat>;
  clear: () => Promise<Chat>;
  stop: () => Promise<Chat>;
};

const linkChat = (token: string): ChatApi => ({
  read: () => readChat(token),
  send: (body, runtime, images) => sendChat(token, body, runtime, images),
  clear: () => clearChat(token),
  stop: () => stopChat(token),
});

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 2000;
/** A picture larger than this, drawn again, goes as a JPEG: four must fit Cloud's 4 MB. */
const JPEG_OVER = 1024 * 1024;
const EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

type Staged = { id: string; image: ChatImage; url: string };

const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** A picture as it is sent: its long side at most MAX_SIDE, a large one as a JPEG. */
async function prepare(file: File): Promise<ChatImage> {
  const name = file.name || `image${EXT[file.type] ?? ".png"}`;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= JPEG_OVER) return { name, type: file.type, content: await base64(file) };
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d")!;
  const draw = (type: string, quality?: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), type, quality));
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let type = file.type === "image/gif" ? "image/png" : file.type;
  let blob = await draw(type);
  if (blob.size > JPEG_OVER && type !== "image/jpeg") {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    type = "image/jpeg";
  }
  if (blob.size > JPEG_OVER) blob = await draw(type, 0.85);
  const renamed = type === file.type ? name : name.replace(/\.[^.]*$/, "") + EXT[type];
  return { name: renamed, type, content: await base64(blob) };
}

/** `onManage` adds 管理运行时 to the pick; `gone`: runtimes whose Runner was removed. A change of `reload` reads the chat again. `page`: the
 *  chat is the whole page, its column centred, with no suggestions; `aboveBox` sits over the box
 *  in place of the suggestions, `ask` is the box's placeholder, and `over` covers the thread. */
export function AiChat({
  c,
  token,
  api,
  card,
  phone,
  onReplied,
  onManage,
  gone,
  reload,
  page,
  aboveBox,
  ask,
  over,
}: {
  c: AiCopy;
  token: string;
  api?: ChatApi;
  card: CardState;
  phone?: boolean;
  onReplied: () => void;
  onManage?: () => void;
  gone?: string[];
  reload?: number;
  page?: boolean;
  aboveBox?: ReactNode;
  ask?: string;
  over?: ReactNode;
}) {
  const io = api ?? linkChat(token);
  const [chat, setChat] = useState<Chat | null>(null);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<Staged | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  /** Pictures staged or on their way there: a second drop counts the first's. */
  const held = useRef(0);
  const log = useRef<HTMLDivElement>(null);
  const was = useRef(false);

  const take = useCallback(
    (next: Chat) => {
      setChat(next);
      if (was.current && !working(next)) onReplied();
      was.current = working(next);
    },
    [onReplied],
  );

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : "";
    if (code === "runtime_unavailable") {
      const { connector, reason } = (e as ApiError).info as { connector?: Connector; reason?: string };
      const name = (connector && LABEL[connector]) ?? connector ?? "";
      return setProblem(reason === "signed_out" ? c.signedOutHere(name) : c.notInstalledHere(name));
    }
    setProblem(code === "chat_busy" ? c.busy : code === "runner_offline" ? c.offline : code === "runner_removed" ? c.removed : code === "offline" ? c.network : c.failed);
  };

  useEffect(() => {
    let live = true;
    const read = () => io.read().then((next) => live && take(next), () => {});
    void read();
    const timer = working(chat) ? setInterval(read, POLL_MS) : undefined;
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [token, working(chat), reload]);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "";
    if (phone) el.style.height = `${el.scrollHeight}px`;
  }, [draft, phone, !!chat]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [chat?.messages.length, chat?.status]);

  if (!chat) return <section aria-label={c.label} aria-busy className={cn("bg-nb-paper", phone || page ? "h-full" : "nb-panel h-[160px] w-[420px]")} />;

  const runtime = chat.runtimes.find((r) => r.id === (picked ?? chat.runtime)) ?? chat.runtimes[0]!;
  const busy = working(chat) || sending;
  const blocked = !!gone?.includes(runtime.id);
  const empty = chat.messages.length === 0;

  const send = async () => {
    const body = draft.trim();
    if ((!body && !staged.length) || busy || blocked) return;
    setSending(true);
    setProblem(null);
    try {
      take(await io.send(body, runtime.id, staged.map((s) => s.image)));
      setDraft("");
      setStaged([]);
      held.current = 0;
      setPicked(null);
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };
  const clear = async () => {
    setProblem(null);
    try {
      take(await io.clear());
    } catch (e) {
      fail(e);
    }
  };
  const stop = async () => {
    setProblem(null);
    try {
      take(await io.stop());
    } catch (e) {
      fail(e);
    }
  };
  const add = async (files: File[]) => {
    setProblem(null);
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) {
        setProblem(c.notImage(file.name));
        continue;
      }
      if (file.size > MAX_BYTES) {
        setProblem(c.tooBig(file.name));
        continue;
      }
      if (held.current >= MAX_IMAGES) {
        setProblem(c.tooMany);
        break;
      }
      held.current++;
      const image = await prepare(file).catch(() => null);
      if (!image) {
        held.current--;
        setProblem(c.notImage(file.name));
        continue;
      }
      setStaged((s) => [...s, { id: crypto.randomUUID(), image, url: `data:${image.type};base64,${image.content}` }]);
    }
  };
  /** ↑ in an empty box brings back the last message you sent, the caret after it. */
  const recall = () => {
    const last = chat.messages.findLast((m) => m.role === "user" && m.body);
    if (!last) return false;
    setDraft(last.body);
    requestAnimationFrame(() => input.current?.setSelectionRange(last.body.length, last.body.length));
    return true;
  };

  const status = chat.status === "failed" ? c.failed : chat.status === "conflict" ? c.conflict : null;
  const notes = [!chat.runner.connected && c.offline, blocked && c.runnerGone, problem ?? status].filter((x): x is string => !!x);
  const asks = [card.question && c.asks.question, card.comments && c.asks.comments, card.previews && c.asks.previews, c.asks.skip].filter(
    (x): x is string => !!x,
  );

  const box = (
    <div
      className={cn(
        "nb-field relative rounded-[12px] bg-nb-paper p-1.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]",
        dragging && "shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]",
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        void add([...e.dataTransfer.files]);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-[1] grid place-items-center rounded-[12px] bg-nb-paper/90 text-[12.5px] text-nb-ink-soft">{c.dropImages}</div>
      )}
      {staged.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1 pt-1.5">
          {staged.map((s) => (
            <span key={s.id} className="relative block">
              <button type="button" onClick={() => setViewing(s)} aria-label={c.openImage} title={c.openImage} className="block cursor-pointer rounded-[8px]">
                <img src={s.url} alt={s.image.name} className="size-[44px] rounded-[8px] object-cover shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  held.current--;
                  setStaged((all) => all.filter((x) => x.id !== s.id));
                }}
                aria-label={c.removeImage}
                title={c.removeImage}
                className="absolute -right-[5px] -top-[5px] grid size-[16px] cursor-pointer place-items-center rounded-full border-[1.5px] border-nb-paper bg-nb-ink text-nb-cream"
              >
                <FiX size={9} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={input}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPaste={(e) => {
          const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
          if (!files.length) return;
          e.preventDefault();
          void add(files);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          } else if (e.key === "ArrowUp" && !draft && !(e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) && recall()) {
            e.preventDefault();
          }
        }}
        placeholder={ask ?? c.ask}
        aria-label={ask ?? c.ask}
        className={cn("w-full resize-none bg-transparent px-2.5 pb-2 pt-1 text-[13px] leading-[1.5] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-none max-md:text-[16px]", phone && "max-h-[40dvh] min-h-[108px] overflow-y-auto")}
      />
      <div className="flex h-7 items-center justify-between">
        <span className="flex h-full min-w-0 items-center gap-1.5">
          <Pick
            c={c}
            options={chat.runtimes}
            value={runtime}
            onPick={(id) => {
              setPicked(id);
              setProblem(null);
            }}
            onManage={onManage}
            gone={gone}
          />
          {chat.context && <ContextRing label={c.context(kilo(chat.context.used), kilo(chat.context.limit))} filled={chat.context.used / chat.context.limit} />}
        </span>
        <span className="flex h-full items-center gap-1">
          <button
            type="button"
            onClick={() => picker.current?.click()}
            aria-label={c.addImages}
            title={c.addImages}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-ink/[0.06] hover:text-nb-ink"
          >
            <FiImage className="text-[14px]" aria-hidden />
          </button>
          <input
            ref={picker}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            hidden
            onChange={(e) => {
              void add([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          {!empty && <Clear c={c} disabled={busy} onClear={clear} />}
          {working(chat) ? (
            <Button size="xs" onClick={() => void stop()} aria-label={c.stop} title={c.stop}>
              <FiSquare className="text-[13px]" aria-hidden />
            </Button>
          ) : (
            <Button size="xs" disabled={busy || blocked || (!draft.trim() && !staged.length)} onClick={() => void send()} aria-label={c.send} title={c.send}>
              <FiSend className="text-[13px]" aria-hidden />
            </Button>
          )}
        </span>
      </div>
      {viewing && <ImagePreview src={viewing.url} alt={viewing.image.name} onClose={() => setViewing(null)} />}
    </div>
  );

  return (
    <section
      aria-label={c.label}
      className={cn("flex flex-col bg-nb-paper", phone || page ? "h-full" : "nb-panel max-h-[620px] w-[420px] overflow-hidden", empty && "justify-end")}
      onKeyDown={(e) => {
        // Esc stops a reply, once any menu of the chat's own is closed.
        if (e.key !== "Escape" || e.defaultPrevented || !working(chat) || e.currentTarget.querySelector('[role="menu"],[role="dialog"]')) return;
        e.preventDefault();
        void stop();
      }}
    >
      {over ? (
        <div className="relative min-h-0 flex-1">{over}</div>
      ) : empty && !page && aboveBox ? null : empty && !page ? (
        <div className="flex flex-col items-start gap-1.5 px-3 pt-3">
          <p className="px-1 pb-0.5 text-[12px] text-nb-ink-soft">{c.tryAsking}</p>
          {asks.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setDraft(a);
                input.current?.focus();
              }}
              className="max-w-full cursor-pointer truncate rounded-full bg-nb-ink/[0.05] px-3 py-1.5 text-left text-[12.5px] text-nb-ink hover:bg-nb-ink/[0.09]"
            >
              {a}
            </button>
          ))}
        </div>
      ) : (
        <div ref={log} className={cn("min-h-0 flex-1 overflow-y-auto", page && !phone ? "px-8 py-8" : "px-5 py-5")}>
          <div className={cn("flex flex-col gap-2", page && "mx-auto max-w-[600px]")}>
            {chat.messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-16 mt-3 flex flex-col items-end first:mt-0">
                  <div className="max-w-full rounded-[10px] bg-nb-ink/5 p-2.5">
                    {!!m.image_names?.length && (
                      <div className="flex flex-wrap justify-end gap-[5px]">
                        {m.image_names.map((f, i) => (
                          <span key={i} className="inline-flex max-w-[180px] items-center gap-1 rounded-[6px] bg-nb-paper px-1.5 py-0.5 text-[11.5px] text-nb-ink-soft">
                            <FiImage className="shrink-0 text-[12px]" aria-hidden />
                            <span className="truncate">{f}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {m.body && <p className={cn("whitespace-pre-wrap break-words text-[13px] leading-[1.5]", !!m.image_names?.length && "mt-2")}>{m.body}</p>}
                  </div>
                </div>
              ) : (
                <Reply key={m.id} c={c} m={m} phone={phone} />
              ),
            )}
            {working(chat) && <p className="mt-3 animate-pulse text-[12.5px] text-nb-ink-soft">{chat.status === "queued" ? c.queued : c.replying}</p>}
          </div>
        </div>
      )}
      <div className={cn("shrink-0", page && !phone ? "px-8 pb-5" : "px-3 pb-3", empty ? "pt-3" : "pt-1")}>
        <div className={cn(page && "mx-auto max-w-[600px]")}>
          {aboveBox}
          {notes.map((n) => (
            <p key={n} role="status" className="mb-1.5 rounded-[8px] bg-nb-peach-soft px-2.5 py-1.5 text-[12px] leading-snug text-nb-peach-ink">
              {n}
            </p>
          ))}
          {box}
        </div>
      </div>
    </section>
  );
}

const kilo = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

const count = (n: number) => n.toLocaleString("en-US");

/** As the task's run record writes it: web/src/components/RunLog.tsx's formatDuration and formatCost. */
function duration(c: AiCopy, ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return c.seconds(total);
  const mins = Math.floor(total / 60);
  if (mins < 60) return c.minutes(mins, total % 60);
  return c.hours(Math.floor(mins / 60), mins % 60);
}

const ACTION = "inline-flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-nb-ink-soft hover:bg-nb-ink/[0.08] hover:text-nb-ink";
/** Shown while the reply is hovered or focused, and always on a touch screen. */
const ON_HOVER = "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100";

/** An agent's reply: its words, then one line of 已停止 · time · tokens · cost and its copy button. */
function Reply({ c, m, phone }: { c: AiCopy; m: ChatMessage; phone?: boolean }) {
  const { copied, copy } = useCopyText();
  const u = m.usage;
  const parts: ReactNode[] = [
    m.duration_ms != null && duration(c, m.duration_ms),
    u && (
      <span title={c.tokensHint(count(u.input), count(u.cacheCreation), count(u.cacheRead), count(u.output))}>
        {c.tokens(count(u.input + u.cacheCreation + u.cacheRead + u.output))}
      </span>
    ),
    m.cost_usd != null && <span title={c.costHint}>{m.cost_usd < 0.005 ? c.costTiny : c.cost(m.cost_usd.toFixed(2))}</span>,
  ].filter(Boolean);
  return (
    <div className="group mt-3">
      <Markdown body={m.body} className="nb-sessionlog-md" />
      <div className="mt-1 flex h-6 items-center gap-1">
        {(m.stopped || parts.length > 0) && (
          <span className="truncate text-[11px] tabular-nums text-nb-ink-soft">
            {m.stopped && <span className="font-[700] text-nb-peach-ink">{c.stopped}</span>}
            {parts.map((p, i) => (
              <span key={i}>
                {(i > 0 || m.stopped) && " · "}
                {p}
              </span>
            ))}
          </span>
        )}
        <button type="button" onClick={() => copy(m.body)} aria-label={c.copyReply} title={copied ? c.copied : c.copyReply} className={cn(ACTION, !phone && ON_HOVER)}>
          {copied ? <FiCheck size={12} aria-hidden /> : <FiCopy size={12} aria-hidden />}
        </button>
        <Copied on={copied} />
      </div>
    </div>
  );
}

/** Legacy kanban-ui context-ring.tsx: how full the session's context window is. */
const R = 5.25;
const CIRCUMFERENCE = 2 * Math.PI * R;
function ContextRing({ label, filled }: { label: string; filled: number }) {
  return (
    <span className="nb-tip inline-flex shrink-0 rounded-full p-0.5" data-tip={label} aria-label={label} role="img" tabIndex={0}>
      <svg viewBox="0 0 14 14" className="size-[14px] -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r={R} fill="none" className="stroke-nb-ink/12" strokeWidth="2.5" />
        <circle
          cx="7"
          cy="7"
          r={R}
          fill="none"
          className="stroke-nb-ink-soft"
          strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, filled)))}
        />
      </svg>
    </span>
  );
}

/** Which runtime answers: the task's first, then the reader's own, the way 新想法 picks one. */
function Pick({
  c,
  options,
  value,
  onPick,
  onManage,
  gone,
}: {
  c: AiCopy;
  options: ChatRuntime[];
  value: ChatRuntime;
  onPick: (id: string) => void;
  onManage?: () => void;
  gone?: string[];
}) {
  const [open, setOpen] = useState(false);
  const box = useDismiss(open, () => setOpen(false));
  return (
    <span ref={box} className="relative flex h-full min-w-0 items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={c.agentPick}
        title={c.agentPick}
        className="inline-flex h-full min-w-0 shrink cursor-pointer items-center gap-1.5 rounded-[8px] pl-2 pr-1.5 hover:brightness-[0.97]"
        style={{ background: "var(--color-nb-accent-wash)" }}
      >
        <AgentMark harness={MARK[value.connector]} size={16} />
        <span className="max-w-[128px] truncate text-[12px] text-nb-ink">{nameOf(c, value)}</span>
        <FiChevronDown size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="nb-panel absolute bottom-[calc(100%+6px)] left-0 z-10 w-[256px] max-w-[calc(100vw-24px)] bg-nb-paper p-1">
          {options.map((o) => {
            const detail = detailOf(c, o);
            const note = gone?.includes(o.id) ? c.runnerRemoved : noteOf(c, o);
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={o.id === value.id}
                onClick={() => {
                  onPick(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 text-left text-[13px] hover:bg-nb-ink/[0.05]",
                  detail ? "py-1.5" : "h-8",
                  o.id === value.id && "bg-nb-ink/[0.05]",
                )}
              >
                <AgentMark harness={MARK[o.connector]} size={15} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{nameOf(c, o)}</span>
                  {detail && <span className="truncate text-[11.5px] leading-[15px] text-nb-ink-soft">{detail}</span>}
                </span>
                {note && <span className="shrink-0 text-[11px] font-[700] text-nb-peach-ink">{note}</span>}
                <span className="w-[13px] shrink-0">{o.id === value.id && <FiCheck size={12} className="text-nb-accent" aria-hidden />}</span>
              </button>
            );
          })}
          {onManage && (
            <>
              <div className="mx-1 my-1 h-px bg-nb-ink/10" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onManage();
                }}
                className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 text-left text-[13px] text-nb-ink-soft hover:bg-nb-ink/[0.05]"
              >
                <FiSettings size={14} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{c.manageRuntimes}</span>
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}

/** Clear asks first and says what survives: the card the chat already changed. */
function Clear({ c, disabled, onClear }: { c: AiCopy; disabled: boolean; onClear: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const box = useDismiss(open, () => setOpen(false));
  return (
    <span ref={box} className="relative flex h-full items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={c.clear}
        title={c.clear}
        className={cn(
          "inline-flex size-7 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-ink/[0.06] hover:text-nb-ink disabled:cursor-not-allowed disabled:opacity-40",
          open && "bg-nb-ink/[0.06] text-nb-ink",
        )}
      >
        <FiTrash2 className="text-[13px]" aria-hidden />
      </button>
      {open && (
        <div role="dialog" className="nb-panel absolute bottom-[calc(100%+6px)] right-0 z-10 w-[260px] bg-nb-paper p-3">
          <p className="text-[13px] font-[700] text-nb-ink">{c.clearAsk}</p>
          <p className="mt-1 text-[12px] leading-snug text-nb-ink-soft">{c.clearBody}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>
              {c.cancel}
            </Button>
            <Button
              size="xs"
              onClick={() => {
                setOpen(false);
                void onClear();
              }}
            >
              {c.clearYes}
            </Button>
          </div>
        </div>
      )}
    </span>
  );
}

/** Closes what `open` showed on Esc or a click outside the returned box. */
function useDismiss(open: boolean, close: () => void) {
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && close();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return box;
}
