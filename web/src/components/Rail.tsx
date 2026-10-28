// Copied from legacy kanban-ui/components/Rail.tsx: the find box (`/` focuses it, ↑↓ pick,
// Enter opens), then 工作流, 统计 and the current project's conversations newest first (a task's
// chat or an idea conversation; one in no project counts as general's), the archive at the foot. The rail has no surface: it sits on the window's cream.
// 收起左栏 sits beside the archive; collapsed, a narrow bar of icons keeps 展开左栏 in that spot.

import { useEffect, useMemo, useRef, useState } from "react";
import { FiArchive, FiBarChart2, FiGrid, FiSearch, FiSidebar, FiTerminal, FiX } from "react-icons/fi";
import { HAIRLINE } from "@review/components/chrome";
import { cn } from "@review/lib/utils";
import { HOST_NAMES, type ChatRow, type Task } from "../api";
import { T } from "../i18n";
import { numberOf } from "../lib/card";
import { Link, navigate, useLocation } from "../router";
import { useStore } from "../store";

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
  if (!open) {
    return (
      <aside className="flex h-full w-[52px] shrink-0 flex-col items-center gap-1 pb-[13px] pt-1">
        <button
          type="button"
          onClick={() => {
            setFindNow(true);
            onToggle();
          }}
          aria-label={T.find}
          data-tip={T.find}
          className={cn(ICON, "nb-tip-start")}
        >
          <FiSearch size={14} aria-hidden />
        </button>
        <Link href={archiveHref} aria-label={T.archive} data-tip={T.archive} className={cn(ICON, "nb-tip-start mt-auto", path === "/archive" && "bg-nb-paper text-nb-ink")}>
          <FiArchive size={14} aria-hidden />
        </Link>
        <button type="button" onClick={onToggle} aria-label={T.expandRail} data-tip={T.expandRail} className={cn(ICON, "nb-tip-start")}>
          <FiSidebar size={15} aria-hidden />
        </button>
      </aside>
    );
  }
  return (
    <aside className="flex h-full w-[244px] shrink-0 flex-col gap-0.5 px-3 pb-3 pt-1">
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
            onToggle();
          }}
          aria-label={T.collapseRail} data-tip={T.collapseRail} className={ICON}>
          <FiSidebar size={15} aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** The chats in the current project; one in no project is general's. */
export function chatsHere(store: ReturnType<typeof useStore>, chats = store.chats): ChatRow[] {
  return chats.filter((c) => (c.project || store.general?.id) === store.current?.id);
}

export function ChatList({ chats, active, big }: { chats: ChatRow[]; active?: string; big?: boolean }) {
  const store = useStore();
  const mine = chatsHere(store, chats);
  if (!mine.length) return big ? <p className="px-4 py-3 text-[13px] text-nb-ink-soft">{T.noChats}</p> : null;
  return (
    <>
      <span className={cn("px-2.5 pb-1 text-[11px] font-[700] text-nb-ink-soft", big && "px-4 pt-2")}>{T.chats}</span>
      {mine.map((c) => {
        const id = c.discussion ?? c.task;
        const on = active === id;
        return (
          <Link key={id} href={"key" in c ? `/tasks/${encodeURIComponent(c.key)}?chat=1` : `/discussions/${encodeURIComponent(c.discussion)}`} className={cn(ROW, on && ACTIVE, big && "h-11 rounded-none px-4 text-[14px]")}>
            <span className={cn("min-w-0 flex-1 truncate", c.state === "waiting_you" && !on && "font-[700]")}>{c.title}</span>
            {c.host && (
              <span className="nb-tip shrink-0 text-nb-ink-soft" data-tip={T.idea.from(HOST_NAMES[c.host])} aria-label={T.idea.from(HOST_NAMES[c.host])}>
                <FiTerminal size={12} aria-hidden />
              </span>
            )}
            {c.state === "replying" && (
              <span className="nb-tip shrink-0 animate-pulse text-[13px] font-[800] leading-none tracking-[1px] text-nb-ink-soft" data-tip={T.chatReplying} aria-label={T.chatReplying}>
                ···
              </span>
            )}
            {c.state === "waiting_you" && <span className="nb-tip size-1.5 shrink-0 rounded-full bg-nb-accent" data-tip={T.chatYou} aria-label={T.chatYou} />}
          </Link>
        );
      })}
    </>
  );
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
