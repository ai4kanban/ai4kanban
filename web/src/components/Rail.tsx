// Copied from legacy kanban-ui/components/Rail.tsx: the find box (`/` focuses it, ↑↓ pick,
// Enter opens), then 看板 (the current project's board), 工作流, 统计 and the current project's conversations newest first: 对话 (idea
// conversations), then 任务 (task chats, numbered); one in no project counts as general's, the archive at the foot. The rail has no surface: it sits on the window's cream.
// 收起左栏 sits beside the archive; collapsed, a narrow bar of icons keeps 展开左栏 in that spot.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FiArchive, FiBarChart2, FiGrid, FiLoader, FiSearch, FiSidebar, FiTerminal, FiX } from "react-icons/fi";
import { LuSquareKanban } from "react-icons/lu";
import { Button } from "@review/components/button";
import { HAIRLINE } from "@review/components/chrome";
import { useArrived } from "@review/lib/motion";
import { cn } from "@review/lib/utils";
import { closeChat, HOST_NAMES, type ChatRow, type Task } from "../api";
import { T } from "../i18n";
import { numberOf } from "../lib/card";
import { forgetChat } from "../lib/chat-images";
import { Link, navigate, useLocation } from "../router";
import { useStore } from "../store";
import { useDismiss } from "./Header";

const ROW = "flex h-[34px] items-center gap-2 rounded-[8px] px-2.5 text-[13px] text-nb-ink no-underline hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]";
const ACTIVE = "border-[1.5px] border-nb-ink bg-nb-paper font-[700] hover:bg-nb-paper";
const ICON = "nb-tip inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink";

export function matchTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return [];
  return tasks.filter((t) => t.title.toLowerCase().includes(q) || t.key.toLowerCase() === q || numberOf(t.key).slice(1) === q).slice(0, 30);
}

export function Rail({ open, onToggle, archiveHref, activeChat }: { open: boolean; onToggle: () => void; archiveHref: string; activeChat?: string }) {
  const store = useStore();
  const { path } = useLocation();
  const [query, setQuery] = useState("");
  const [findNow, setFindNow] = useState(false);
  const matches = useMemo(() => matchTasks(store.tasks ?? [], query), [store.tasks, query]);
  const [lit, setLit] = useState(-1);
  useEffect(() => setLit(-1), [query]);
  const boardHref = store.current && `/projects/${encodeURIComponent(store.current.id)}`;
  const onBoard = !!boardHref && path === boardHref;
  // Only a fold or unfold plays; a page opening draws the rail as it was.
  const [moved, setMoved] = useState(false);
  const toggle = () => {
    setMoved(true);
    onToggle();
  };
  if (!open) {
    return (
      <aside className={cn("nb-glide flex h-full w-[52px] shrink-0 flex-col items-center gap-1 pb-[13px] pt-1", moved && "animate-[nbFadeIn_180ms_ease-out]")}>
        <button
          type="button"
          onClick={() => {
            setFindNow(true);
            toggle();
          }}
          aria-label={T.find}
          data-tip={T.find}
          className={cn(ICON, "nb-tip-start")}
        >
          <FiSearch size={14} aria-hidden />
        </button>
        {boardHref && (
          <Link href={boardHref} aria-label={T.tabs.board} data-tip={T.tabs.board} className={cn(ICON, "nb-tip-start", onBoard && "bg-nb-paper text-nb-ink")}>
            <LuSquareKanban size={14} aria-hidden />
          </Link>
        )}
        <Link href={archiveHref} aria-label={T.archive} data-tip={T.archive} className={cn(ICON, "nb-tip-start mt-auto", path === "/archive" && "bg-nb-paper text-nb-ink")}>
          <FiArchive size={14} aria-hidden />
        </Link>
        <button type="button" onClick={toggle} aria-label={T.expandRail} data-tip={T.expandRail} className={cn(ICON, "nb-tip-start")}>
          <FiSidebar size={15} aria-hidden />
        </button>
      </aside>
    );
  }
  return (
    <aside className={cn("nb-glide flex h-full w-[244px] shrink-0 flex-col gap-0.5 px-3 pb-3 pt-1", moved && "animate-[nbEnter_220ms_ease-out]")}>
      <FindBox
        autoFocus={findNow}
        value={query}
        onChange={setQuery}
        onMove={(by) => {
          const n = matches.length;
          if (n) setLit((at) => (at < 0 ? (by > 0 ? 0 : n - 1) : (at + by + n) % n));
        }}
        onOpen={() => {
          const t = matches[lit < 0 ? 0 : lit];
          if (!t) return;
          setQuery("");
          navigate(`/tasks/${encodeURIComponent(t.key)}`);
        }}
      />
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {boardHref && (
          <Link href={boardHref} className={cn(ROW, "h-[30px]", onBoard && ACTIVE)}>
            <LuSquareKanban size={13} aria-hidden />
            <span className="flex-1 truncate">{T.tabs.board}</span>
          </Link>
        )}
        <Link href="/workflows" className={cn(ROW, "h-[30px]", path === "/workflows" && ACTIVE)}>
          <FiGrid size={13} aria-hidden />
          <span className="flex-1 truncate">{T.flows.title}</span>
        </Link>
        <Link href="/stats" className={cn(ROW, "mb-2 h-[30px]", path === "/stats" && ACTIVE)}>
          <FiBarChart2 size={13} aria-hidden />
          <span className="flex-1 truncate">{T.stats.title}</span>
        </Link>
        {query.trim() ? (
          <>
            <span className="px-2.5 pb-1 text-[11px] font-[700] text-nb-ink-soft">{T.matches}</span>
            {matches.map((t, i) => (
              <Link key={t.id} href={`/tasks/${encodeURIComponent(t.key)}`} onClick={() => setQuery("")} className={cn(ROW, i === lit && "bg-nb-wash")}>
                <span className="shrink-0 text-[11.5px] font-[800] text-nb-accent-deep">{numberOf(t.key)}</span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
              </Link>
            ))}
            {!matches.length && <p className="px-2.5 pt-1 text-[12px] text-nb-ink-soft">{T.noMatches}</p>}
          </>
        ) : (
          <ChatList chats={store.chats} active={activeChat} />
        )}
      </nav>
      <div className="mt-auto flex items-center gap-1">
        <Link href={archiveHref} className={cn(ROW, "h-[30px] min-w-0 flex-1", path === "/archive" && ACTIVE)}>
          <FiArchive size={13} aria-hidden />
          {T.archive}
        </Link>
        <button
          type="button"
          onClick={() => {
            setFindNow(false);
            toggle();
          }}
          aria-label={T.collapseRail} data-tip={T.collapseRail} className={ICON}>
          <FiSidebar size={15} aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** The chats in the current project, less done tasks' (still on the task page); one in no project is general's. */
export function chatsHere(store: ReturnType<typeof useStore>, chats = store.chats): ChatRow[] {
  const done = new Set(store.tasks?.flatMap((t) => (t.status === "done" ? t.id : [])));
  return chats.filter((c) => (c.project || store.general?.id) === store.current?.id && !(c.task && done.has(c.task)));
}

export function ChatList({ chats, active, big }: { chats: ChatRow[]; active?: string; big?: boolean }) {
  const store = useStore();
  const mine = chatsHere(store, chats);
  const [asking, setAsking] = useState<string | null>(null);
  const arrived = useArrived(mine.length ? mine.map((c) => c.discussion ?? c.task) : null);
  if (!mine.length) return big ? <p className="px-4 py-3 text-[13px] text-nb-ink-soft">{T.noChats}</p> : null;
  const group = "px-2.5 pb-1 text-[11px] font-[700] text-nb-ink-soft";
  const talks = mine.filter((c) => c.discussion);
  const tasks = mine.filter((c) => !c.discussion);
  const row = (c: ChatRow) => {
    const id = c.discussion ?? c.task;
    const on = !big && active === id;
    return (
      <div key={id} className={cn("group relative shrink-0", arrived(id) && "a4k-reveal")}>
        <Link
          href={"key" in c ? `/tasks/${encodeURIComponent(c.key)}?chat=1` : `/discussions/${encodeURIComponent(c.discussion)}`}
          className={cn(ROW, on && ACTIVE, big ? "h-11 rounded-none px-4 pr-12 text-[14px]" : "group-hover:pr-9", !big && asking === id && "pr-9", !on && asking === id && "bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]")}
        >
          {"key" in c && (
            <span className={cn("shrink-0 font-[800] tabular-nums text-nb-accent-deep", big ? "min-w-[30px] text-[12.5px]" : "min-w-[26px] text-[11.5px]")}>{numberOf(c.key)}</span>
          )}
          <span className={cn("min-w-0 flex-1 truncate", c.state === "waiting_you" && !on && "font-[700]")}>{c.title}</span>
          {c.host && (
            <span className="nb-tip shrink-0 text-nb-ink-soft" data-tip={T.idea.from(HOST_NAMES[c.host])} aria-label={T.idea.from(HOST_NAMES[c.host])}>
              <FiTerminal size={12} aria-hidden />
            </span>
          )}
          {c.state === "replying" && (
            <span className="nb-tip shrink-0 text-nb-ink-soft" data-tip={T.chatReplying} aria-label={T.chatReplying}>
              <FiLoader size={12} className="animate-spin" aria-hidden />
            </span>
          )}
          {c.state === "waiting_you" && <span className="nb-tip size-1.5 shrink-0 rounded-full bg-nb-accent" data-tip={T.chatYou} aria-label={T.chatYou} />}
        </Link>
        <CloseChat
          chat={c}
          big={big}
          open={asking === id}
          onOpen={(open) => setAsking(open ? id : null)}
          onClosed={() => {
            store.dropChat(id);
            if (active === id) navigate("/new");
          }}
        />
      </div>
    );
  };
  return (
    <>
      {talks.length > 0 && (
        <>
          <span className={cn(group, big && "px-4 pt-2")}>{T.chats}</span>
          {talks.map(row)}
        </>
      )}
      {tasks.length > 0 && (
        <>
          <span className={cn(group, big && "px-4 pt-2", talks.length > 0 && "mt-3")}>{T.taskChats}</span>
          {tasks.map(row)}
        </>
      )}
    </>
  );
}

/** 关闭对话 (×) beside a row: shown on hover, always on a phone; it asks first and says what goes. */
function CloseChat({ chat, big, open, onOpen, onClosed }: { chat: ChatRow; big?: boolean; open: boolean; onOpen: (open: boolean) => void; onClosed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const dismiss = useCallback(() => !busy && onOpen(false), [busy, onOpen]);
  const panel = useRef<HTMLDivElement>(null);
  const box = useDismiss<HTMLSpanElement>(open, dismiss, panel);
  const at = useAnchored(open, box, panel, failed);
  useEffect(() => setFailed(false), [open]);
  const close = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await closeChat(chat);
      if (chat.discussion) void forgetChat(chat.discussion);
      onOpen(false);
      onClosed();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <span ref={box} className={cn("absolute inset-y-0 right-1 flex items-center", big && "right-2", !big && !open && "hidden group-hover:flex")}>
        <button
          type="button"
          onClick={() => onOpen(!open)}
          aria-label={T.closeChat}
          data-tip={T.closeChat}
          className={cn(ICON, "nb-tip-end", big ? "size-8" : "size-6", open && "bg-nb-wash text-nb-ink")}
        >
          <FiX size={big ? 15 : 13} aria-hidden />
        </button>
      </span>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            style={at ? { top: at.top, left: at.left } : { visibility: "hidden" }}
            className={cn("nb-panel nb-pop fixed left-0 top-0 z-50 w-[260px] bg-nb-paper p-3", at?.up ? "origin-bottom-right" : "origin-top-right")}
          >
            <p className="text-[13px] font-[700] text-nb-ink">{T.closeAsk}</p>
            <p className="mt-1 text-[12px] leading-snug text-nb-ink-soft">{chat.discussion ? T.closeIdeaBody : T.closeTaskBody}</p>
            {failed && <p className="mt-1 text-[12px] leading-snug text-nb-peach-ink">{T.closeFailed}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="xs" disabled={busy} onClick={() => onOpen(false)}>
                {T.cancel}
              </Button>
              <Button size="xs" disabled={busy} onClick={() => void close()}>
                {T.closeYes}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Where a fixed popup sits: under its trigger's right edge, above it when the window's foot is too near, always inside the window. */
function useAnchored(open: boolean, trigger: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>, resized: unknown) {
  const [at, setAt] = useState<{ top: number; left: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) return setAt(null);
    const place = () => {
      const b = trigger.current?.getBoundingClientRect();
      const p = panel.current;
      if (!b || !p) return;
      const { offsetWidth: w, offsetHeight: h } = p;
      const up = b.bottom + 6 + h > innerHeight - 8 && b.top - 6 - h >= 8;
      setAt({ top: up ? b.top - 6 - h : b.bottom + 6, left: Math.max(8, Math.min(b.right - w, innerWidth - w - 8)), up });
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [open, trigger, panel, resized]);
  return at;
}

/** A rail row you type in; `/` from anywhere not taking text focuses it, Esc clears it. */
export function FindBox({
  value,
  onChange,
  onMove,
  onOpen,
  phone,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onMove: (by: number) => void;
  onOpen: () => void;
  phone?: boolean;
  autoFocus?: boolean;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      const input = box.current;
      if (!input || input.offsetParent === null) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <label className={cn("flex h-[30px] items-center gap-2 rounded-[8px] border bg-nb-paper px-2.5 text-[13px] text-nb-ink-soft", !phone && "mb-2")} style={{ borderColor: HAIRLINE }}>
      <FiSearch size={13} aria-hidden className="shrink-0" />
      <input
        ref={box}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            onMove(e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onOpen();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onChange("");
            box.current?.blur();
          }
        }}
        placeholder={T.find}
        aria-label={T.find}
        className="min-w-0 flex-1 bg-transparent text-nb-ink placeholder:text-nb-ink-soft focus:outline-none max-md:text-[16px]"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label={T.clear} className="cursor-pointer text-nb-ink-soft hover:text-nb-ink">
          <FiX size={13} aria-hidden />
        </button>
      ) : (
        !phone && (
          <kbd className="rounded-[4px] border px-1 font-sans text-[10px] leading-[14px]" style={{ borderColor: HAIRLINE }}>
            /
          </kbd>
        )
      )}
    </label>
  );
}
