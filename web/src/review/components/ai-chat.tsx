// The owner's conversation with an agent on the review page (#2027), after legacy
// kanban-ui/components/Chat.tsx and composer.tsx. No title row: the page's corner bubble opens
// and closes it, and it grows with the conversation. The agent picker, the context ring and an
// icon-only clear sit on the message box's bottom row. At phone width it covers the page.
// Pictures go with a message, a reply stops part way, and each reply has its time, cost and a
// copy button (#2133).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FiCheck, FiChevronDown, FiChevronRight, FiCopy, FiImage, FiLoader, FiSend, FiSettings, FiSquare, FiTrash2 } from "react-icons/fi";
import { ApiError, clearChat, readChat, sendChat, stopChat, type Chat, type ChatImage, type ChatMessage, type ChatRuntime, type Connector } from "../api";
import type { Copy } from "../i18n";
import { useDraft } from "../lib/draft";
import { useGrowingBox } from "../lib/grow";
import { useArrived } from "../lib/motion";
import { cn } from "../lib/utils";
import { AgentMark, type Harness } from "./agent-mark";
import { Button } from "./button";
import { ContextRing } from "./context-ring";
import { Copied, useCopyText } from "./copy";
import { ImagePreview } from "./image-preview";
import { Markdown } from "./Markdown";
import { AddImages, StagedThumbs, useStagedImages } from "./staged-images";

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

/** The last chat read per token, so a reopened box draws at once and refreshes behind. */
const seen = new Map<string, Chat>();

/** Reads a chat ahead of its box opening; `read` is the `ChatApi.read` the box will be given. */
export const preloadChat = (token: string, read: () => Promise<Chat> = () => readChat(token)) =>
  read().then((chat) => void seen.set(token, chat), () => {});

const working = (chat: Chat | null) => chat?.status === "queued" || chat?.status === "replying";

/** Where the conversation is read and written; a share link's by default. */
export type ChatApi = {
  read: () => Promise<Chat>;
  send: (body: string, runtime: string, images: ChatImage[]) => Promise<Chat>;
  /** Left out, the box offers no clear. */
  clear?: () => Promise<Chat>;
  stop: () => Promise<Chat>;
  /** A sent picture this browser kept; its name is shown in its place without one. */
  image?: (message: string, name: string) => Promise<Blob | undefined>;
  /** Shows what a replying job is doing now, null while it calls no tool; returns the stop. */
  watch?: (job: string, show: (doing: string | null) => void) => () => void;
};

const linkChat = (token: string): ChatApi => ({
  read: () => readChat(token),
  send: (body, runtime, images) => sendChat(token, body, runtime, images),
  clear: () => clearChat(token),
  stop: () => stopChat(token),
});

/** `onManage` adds 管理运行时 to the pick; `gone`: runtimes whose Runner was removed. A change of `reload` reads the chat again. `page`: the
 *  chat is the whole page, its column centred, with no suggestions; `aboveBox` sits over the box
 *  in place of the suggestions, `ask` is the box's placeholder, and `over` covers the thread.
 *  `ended`: the task is over, so the box is greyed out; a send Cloud refuses for that calls `onEnded`.
 *  `before` heads the log, above the first message. */
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
  draftKey,
  ended,
  onEnded,
  before,
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
  draftKey?: string;
  ended?: boolean;
  onEnded?: () => void;
  before?: ReactNode;
}) {
  const io = api ?? linkChat(token);
  const [chat, setChat] = useState<Chat | null>(() => seen.get(token) ?? null);
  const arrived = useArrived(chat && chat.messages.map((m) => m.id));
  const [draft, setDraft] = useDraft(draftKey);
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState(false);
  const closed = ended || refused;
  /** The job a stop was asked for, until the chat stops working or moves to another job. */
  const [stopping, setStopping] = useState<{ job: string | null } | null>(null);
  const pics = useStagedImages(c, setProblem);
  const { staged, dragging } = pics;
  const input = useRef<HTMLTextAreaElement>(null);
  const grow = useGrowingBox(draft, input);
  const log = useRef<HTMLDivElement>(null);
  const was = useRef(false);
  const [doing, setDoing] = useState<string | null>(null);
  const job = chat?.status === "replying" ? chat.job : null;

  const take = useCallback(
    (next: Chat) => {
      seen.set(token, next);
      setChat(next);
      setStopping((s) => (s && working(next) && next.job === s.job ? s : null));
      if (was.current && !working(next)) onReplied();
      was.current = working(next);
    },
    [token, onReplied],
  );

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : "";
    if (code === "conflict") {
      setRefused(true);
      setDraft("");
      pics.clear();
      return onEnded?.();
    }
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

  useEffect(() => {
    setDoing(null);
    if (job && io.watch) return io.watch(job, setDoing);
  }, [job]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [chat?.messages.length, chat?.status]);

  // Until the chat is read, the box is drawn and takes a draft; the thread unfolds above it.
  const runtime = chat && (chat.runtimes.find((r) => r.id === (picked ?? chat.runtime)) ?? chat.runtimes[0]!);
  const busy = working(chat) || sending;
  const blocked = !!runtime && !!gone?.includes(runtime.id);
  const empty = !chat || chat.messages.length === 0;
  const bare = !chat || (empty && !before);

  const send = async () => {
    const body = draft.trim();
    if ((!body && !staged.length) || !runtime || busy || blocked || closed) return;
    setSending(true);
    setProblem(null);
    try {
      take(await io.send(body, runtime.id, pics.images));
      setDraft("");
      pics.clear();
      setPicked(null);
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };
  const clear = async () => {
    if (!io.clear) return;
    setProblem(null);
    try {
      take(await io.clear());
    } catch (e) {
      fail(e);
    }
  };
  const stop = async () => {
    if (stopping || !chat) return;
    setProblem(null);
    setStopping({ job: chat.job });
    try {
      take(await io.stop());
    } catch (e) {
      setStopping(null);
      setProblem(e instanceof ApiError && e.code === "offline" ? c.network : c.stopFailed);
    }
  };
  /** A clicked send or stop button is swapped out, so focus goes back to the box for Esc; not on a phone, which would raise the keyboard. */
  const refocus = () => {
    if (!phone) input.current?.focus();
  };
  /** ↑ in an empty box brings back the last message you sent, the caret after it. */
  const recall = () => {
    const last = chat?.messages.findLast((m) => m.role === "user" && m.body);
    if (!last) return false;
    setDraft(last.body);
    requestAnimationFrame(() => input.current?.setSelectionRange(last.body.length, last.body.length));
    return true;
  };

  const status = chat?.status === "failed" ? c.failed : chat?.status === "conflict" ? c.conflict : null;
  const notes = closed ? [] : [chat && !chat.runner.connected && c.offline, blocked && c.runnerGone, problem ?? status].filter((x): x is string => !!x);
  const asks = [card.question && c.asks.question, card.comments && c.asks.comments, card.previews && c.asks.previews, c.asks.skip].filter(
    (x): x is string => !!x,
  );

  const box = closed ? (
    <div aria-disabled className="nb-field relative cursor-not-allowed rounded-[12px] bg-nb-ink/[0.04] p-1.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]">
      <textarea
        disabled
        rows={3}
        placeholder={c.ended}
        aria-label={c.ended}
        className="w-full cursor-not-allowed resize-none bg-transparent px-2.5 pb-2 pt-1 text-[13px] leading-[1.5] placeholder:text-nb-ink-soft/70 focus:outline-none max-md:text-[16px]"
      />
      <div className="flex h-7 items-center justify-end px-1 max-md:h-9">
        <Button size="xs" disabled aria-label={c.ended} title={c.ended}>
          <FiSend className="text-[13px]" aria-hidden />
        </Button>
      </div>
    </div>
  ) : (
    <div
      className={cn(
        "nb-field relative rounded-[12px] bg-nb-paper p-1.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]",
        dragging && "shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]",
      )}
      {...pics.drop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-[1] grid place-items-center rounded-[12px] bg-nb-paper/90 text-[12.5px] text-nb-ink-soft">{c.dropImages}</div>
      )}
      <StagedThumbs c={c} staged={staged} onRemove={pics.remove} className="flex flex-wrap items-center gap-2 px-1 pt-1.5" />
      <textarea
        ref={grow.ref}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPaste={pics.paste}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "ArrowUp" && !draft && !(e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) && recall()) {
            e.preventDefault();
          }
        }}
        onScroll={grow.onScroll}
        style={grow.style}
        placeholder={ask ?? c.ask}
        aria-label={ask ?? c.ask}
        className={cn(
          "w-full resize-none overflow-y-auto bg-transparent px-2.5 pb-2 pt-1 text-[13px] leading-[1.5] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-none max-md:text-[16px]",
          phone || page ? "max-h-[40dvh]" : "max-h-[240px]",
          phone && "min-h-[108px]",
        )}
      />
      <div className="flex h-7 items-center justify-between max-md:h-9">
        <span className="flex h-full min-w-0 items-center gap-1.5">
          {chat && runtime ? (
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
          ) : (
            <span aria-hidden className="h-full w-[104px] animate-pulse rounded-[8px] bg-nb-ink/[0.06]" />
          )}
          <ContextRing context={chat?.context} tip={c.context} />
        </span>
        <span className="flex h-full items-center gap-1">
          <AddImages
            c={c}
            onAdd={(files) => void pics.add(files)}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[8px] text-[14px] text-nb-ink-soft hover:bg-nb-ink/[0.06] hover:text-nb-ink max-md:size-9 max-md:text-[17px]"
          />
          {!empty && io.clear && <Clear c={c} disabled={busy} onClear={clear} />}
          {stopping ? (
            <Button size="xs" disabled aria-label={c.stopping} title={c.stopping}>
              <FiLoader className="animate-spin text-[13px]" aria-hidden />
            </Button>
          ) : working(chat) ? (
            <Button
              size="xs"
              onClick={() => {
                refocus();
                void stop();
              }}
              aria-label={c.stop}
              title={c.stop}
            >
              <FiSquare className="text-[13px]" aria-hidden />
            </Button>
          ) : (
            <Button
              size="xs"
              disabled={!runtime || busy || blocked || (!draft.trim() && !staged.length)}
              onClick={() => {
                refocus();
                void send();
              }}
              aria-label={c.send}
              title={c.send}
            >
              <FiSend className="text-[13px]" aria-hidden />
            </Button>
          )}
        </span>
      </div>
    </div>
  );

  return (
    <section
      aria-label={c.label}
      tabIndex={-1}
      className={cn("flex flex-col bg-nb-paper outline-none", phone || page ? "h-full" : "nb-panel min-h-0 w-full overflow-hidden", bare && "justify-end")}
      onKeyDown={(e) => {
        // Esc stops a reply, once any menu of the chat's own is closed.
        if (e.key !== "Escape" || e.defaultPrevented || !working(chat) || e.currentTarget.querySelector('[role="menu"],[role="dialog"]')) return;
        e.preventDefault();
        void stop();
      }}
    >
      {over ? (
        <div className="relative min-h-0 flex-1">{over}</div>
      ) : !chat ? (
        page && <div className="flex-1" />
      ) : bare && !page && (aboveBox || closed) ? null : bare && !page ? (
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
            {before}
            {chat.messages.map((m) => (
              <Said key={m.id} c={c} m={m} image={io.image} phone={phone} rise={arrived(m.id)} />
            ))}
            {working(chat) && <p className="mt-3 animate-pulse text-[12.5px] text-nb-ink-soft">{stopping ? c.stopping : chat.status === "queued" ? c.queued : (doing ?? c.replying)}</p>}
          </div>
        </div>
      )}
      <div className={cn("shrink-0", page && !phone ? "px-8 pb-5" : "px-3 pb-3", bare ? "pt-3" : "pt-1")}>
        <div className={cn(page && "mx-auto max-w-[600px]")}>
          {!closed && aboveBox}
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

/** One message: yours on the right with its pictures, or an agent's reply. */
function Said({ c, m, image, phone, rise }: { c: AiCopy; m: ChatMessage; image?: ChatApi["image"]; phone?: boolean; rise?: boolean }) {
  if (m.role !== "user") return <Reply c={c} m={m} phone={phone} rise={rise} />;
  return (
    <div className={cn("ml-16 mt-3 flex flex-col items-end first:mt-0", rise && "nb-rise")}>
      <div className="max-w-full rounded-[10px] bg-nb-ink/5 p-2.5">
        {!!m.image_names?.length && (
          <div className="flex flex-wrap justify-end gap-[6px]">
            {m.image_names.map((f, i) => (
              <Sent key={i} c={c} name={f} load={image && (() => image(m.id, f))} />
            ))}
          </div>
        )}
        {m.body && <p className={cn("whitespace-pre-wrap break-words text-[13px] leading-[1.5]", !!m.image_names?.length && "mt-2")}>{m.body}</p>}
      </div>
    </div>
  );
}

/** An earlier conversation, folded on one row; opened, it reads like the chat and ends on `end`. */
export function EarlierChat({
  c,
  label,
  end,
  messages,
  image,
  phone,
}: {
  c: AiCopy;
  label: string;
  end: string;
  messages: ChatMessage[];
  image?: ChatApi["image"];
  phone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = open ? FiChevronDown : FiChevronRight;
  return (
    <div className="flex flex-col pb-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[30px] w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] bg-nb-ink/5 px-2 text-left text-[12px] font-[600] text-nb-ink-soft hover:bg-nb-ink/10"
      >
        <Icon size={13} className="shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 pt-3">
          {messages.map((m) => (
            <Said key={m.id} c={c} m={m} image={image} phone={phone} />
          ))}
          <div className="mt-2 flex items-center gap-2 py-0.5">
            <span className="h-px flex-1 bg-nb-ink/[0.14]" />
            <span className="shrink-0 text-[11px] text-nb-ink-soft">{end}</span>
            <span className="h-px flex-1 bg-nb-ink/[0.14]" />
          </div>
        </div>
      )}
    </div>
  );
}

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

/** A sent picture, as a thumbnail that opens full size, or its name when this browser has none. */
function Sent({ c, name, load }: { c: AiCopy; name: string; load?: () => Promise<Blob | undefined> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!load) return;
    let made: string | null = null;
    let live = true;
    void load().then((blob) => {
      if (!blob || !live) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, []);
  if (!url)
    return (
      <span className="inline-flex max-w-[180px] items-center gap-1 rounded-[6px] bg-nb-paper px-1.5 py-0.5 text-[11.5px] text-nb-ink-soft">
        <FiImage className="shrink-0 text-[12px]" aria-hidden />
        <span className="truncate">{name}</span>
      </span>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setFull(true)}
        aria-label={c.openImage}
        title={name}
        className="block h-[88px] w-[132px] cursor-zoom-in overflow-hidden rounded-[8px] bg-nb-paper shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)]"
      >
        <img src={url} alt={name} className="size-full object-cover" />
      </button>
      {full && <ImagePreview src={url} alt={name} onClose={() => setFull(false)} />}
    </>
  );
}

/** An agent's reply: its words, then one line of 已停止 · time · cost and its copy button. */
function Reply({ c, m, phone, rise }: { c: AiCopy; m: ChatMessage; phone?: boolean; rise?: boolean }) {
  const { copied, copy } = useCopyText();
  const parts: ReactNode[] = [
    m.duration_ms != null && duration(c, m.duration_ms),
    m.cost_usd != null && <span title={c.costHint}>{m.cost_usd < 0.005 ? c.costTiny : c.cost(m.cost_usd.toFixed(2))}</span>,
  ].filter(Boolean);
  return (
    <div className={cn("group mt-3", rise && "nb-rise")}>
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
        <div role="menu" className="nb-panel nb-pop origin-bottom-left absolute bottom-[calc(100%+6px)] left-0 z-10 w-[256px] max-w-[calc(100vw-24px)] bg-nb-paper p-1">
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
        <div role="dialog" className="nb-panel nb-pop origin-bottom-right absolute bottom-[calc(100%+6px)] right-0 z-10 w-[260px] bg-nb-paper p-3">
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
