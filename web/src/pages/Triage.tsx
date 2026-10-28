// `/projects/<id>/triage`, after legacy kanban-ui/components/Signals.tsx: the project's follow-ups waiting
// to be sorted, grouped by the task that proposed them, with 转成任务, 直接构建 (#2139) and 忽略 on
// each row and in the side detail; 历史 holds the sorted ones, newest first, a page at a time. Ignoring acts at
// once: the toast undoes it or records why.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FiChevronDown, FiEyeOff, FiInbox, FiPlay, FiPlus, FiRotateCcw, FiSearch, FiX } from "react-icons/fi";
import { Button } from "@review/components/button";
import { HAIRLINE } from "@review/components/chrome";
import { Markdown } from "@review/components/Markdown";
import { Menu } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { LANG, T } from "../i18n";
import { numberOf } from "../lib/card";
import { useNarrow } from "../lib/narrow";
import { Link, navigate } from "../router";
import { useStore } from "../store";
import { Skeleton } from "../components/Skeleton";
import { Window } from "../components/Window";
import { Gone } from "./Gone";
import { refusal } from "./NewIdea";

const C = T.triage;
const LOCALE = LANG === "zh" ? "zh-CN" : "en-US";
const TOAST_MS = 10_000;
const CHROME = "border-[1.5px] border-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)]";

const LINK = "cursor-pointer text-[12px] font-[700] text-nb-accent-deep underline underline-offset-2";
const GHOST_INK = "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink";
const CHECK = "size-[14px] shrink-0 cursor-pointer accent-nb-accent-deep";
const ICON_BTN = "nb-tip grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]";
const ROW = "flex min-h-[28px] cursor-pointer items-start gap-3 px-3 py-[5px] leading-[18px] outline-none transition-colors duration-[120ms]";
const SELECTED = "bg-nb-accent-soft shadow-[inset_2px_0_0_0_var(--color-nb-accent-deep)]";
const BUSY = "disabled:cursor-default disabled:opacity-40";
const TICKED = "bg-[color-mix(in_srgb,var(--color-nb-accent-soft)_55%,transparent)]";
const FIELD = "nb-field rounded-[8px] bg-nb-paper px-3 text-[13px] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] placeholder:text-nb-ink-soft/70 max-md:text-[16px]";

const day = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
const stamp = (iso: string) => new Date(iso).toLocaleString(LOCALE, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const gist = (text: string) => text.split("\n").map((l) => l.replace(/^[\s#>*\-\d.]+/, "").trim()).find(Boolean) ?? "";
const handledAt = (i: api.TriageItem) => i.dismissed_at ?? i.updated_at;
const sourceKey = (i: api.TriageItem) => i.source_task ?? "";

type Tab = "pending" | "history";
/** What the toast holds: the items just ignored, as they were before. */
type Toast = { key: number; items: api.TriageItem[] };

export function TriagePage({ projectId }: { projectId: string }) {
  const store = useStore();
  const project = store.projects.find((p) => p.id === projectId);
  const phone = useNarrow();
  const [tab, setTab] = useState<Tab>("pending");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [history, setHistory] = useState<"idle" | "loading" | "failed" | "ok">("idle");
  const [more, setMore] = useState<"idle" | "loading" | "failed">("idle");
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLLIElement>(null);

  useEffect(() => {
    document.title = `${C.title} · WildCrane`;
  }, []);
  useEffect(() => {
    setHistory("idle");
    setMore("idle");
  }, [store.ws.id]);
  useEffect(() => {
    if (tab !== "history" || history !== "idle" || !project) return;
    setHistory("loading");
    store.loadTriageHistory(project.id).then(
      () => setHistory("ok"),
      () => setHistory("failed"),
    );
  }, [tab, history, project?.id]);

  const tasks = useMemo(() => new Map((store.tasks ?? []).map((t) => [t.id, t])), [store.tasks]);
  const all = useMemo(() => (store.triage ?? []).filter((i) => i.project === projectId), [store.triage, projectId]);
  const pending = useMemo(() => {
    const open = all.filter((i) => i.state === "open").sort((a, b) => b.created_at.localeCompare(a.created_at));
    const groups = new Map<string, api.TriageItem[]>();
    for (const i of open) groups.set(sourceKey(i), [...(groups.get(sourceKey(i)) ?? []), i]);
    return [...groups.values()].flat();
  }, [all]);
  const done = useMemo(() => all.filter((i) => i.state !== "open").sort((a, b) => handledAt(b).localeCompare(handledAt(a)) || b.id.localeCompare(a.id)), [all]);
  const list = tab === "pending" ? pending : done;
  const needle = q.trim().toLowerCase();
  const rows = list.filter((i) => (source === null || sourceKey(i) === source) && (!needle || [i.title, i.text, i.dismissed_reason ?? ""].some((s) => s.toLowerCase().includes(needle))));
  const filtered = !!needle || source !== null;
  const sources = [...new Set(list.map(sourceKey))];
  const detail = all.find((i) => i.id === selected) ?? null;

  const sourceOf = (i: api.TriageItem) => (i.source_task ? (tasks.get(i.source_task) ?? null) : null);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSelected(null);
    setTicked(new Set());
    setSource(null);
  };
  const clearFilters = () => {
    setQ("");
    setSource(null);
  };

  // Esc closes the detail.
  useEffect(() => {
    if (!detail) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || (e.target as HTMLElement | null)?.closest("input, textarea")) return;
      setSelected(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [detail]);

  const ignore = async (items: api.TriageItem[]) => {
    if (!items.length) return;
    setTrouble(null);
    const ids = new Set(items.map((i) => i.id));
    if (selected && ids.has(selected)) {
      const at = rows.findIndex((i) => i.id === selected);
      setSelected(rows.slice(at + 1).find((i) => !ids.has(i.id))?.id ?? rows.slice(0, at).reverse().find((i) => !ids.has(i.id))?.id ?? null);
    }
    setTicked((was) => new Set([...was].filter((id) => !ids.has(id))));
    const now = new Date().toISOString();
    for (const i of items) store.patchTriage({ ...i, state: "dismissed", dismissed_at: now, dismissed_reason: null });
    const key = Date.now();
    setToast({ key, items });
    const results = await Promise.allSettled(items.map((i) => api.dismissTriage(i.id)));
    const kept = items.filter((i, k) => {
      const r = results[k]!;
      store.patchTriage(r.status === "fulfilled" ? r.value : i);
      return r.status === "fulfilled";
    });
    if (kept.length < items.length) setTrouble(C.actFailed);
    setToast((t) => (t?.key !== key ? t : kept.length ? { key, items: kept } : null));
  };

  const undo = async (items: api.TriageItem[]) => {
    setToast(null);
    setTrouble(null);
    const back = items.map((i) => all.find((x) => x.id === i.id) ?? i);
    for (const i of items) store.patchTriage(i);
    const results = await Promise.allSettled(items.map((i) => api.restoreTriage(i.id)));
    results.forEach((r, k) => store.patchTriage(r.status === "fulfilled" ? r.value : back[k]!));
    if (results.some((r) => r.status === "rejected")) setTrouble(C.actFailed);
  };

  /** Dismissing again records the reason; true when every one took it. */
  const saveReason = async (items: api.TriageItem[], reason: string) => {
    const results = await Promise.allSettled(items.map((i) => api.dismissTriage(i.id, reason)));
    results.forEach((r) => r.status === "fulfilled" && store.patchTriage(r.value));
    return results.every((r) => r.status === "fulfilled");
  };

  const restore = async (i: api.TriageItem) => {
    setTrouble(null);
    store.patchTriage({ ...i, state: "open", dismissed_at: null, dismissed_reason: null });
    setSelected(null);
    try {
      store.patchTriage(await api.restoreTriage(i.id));
    } catch {
      store.patchTriage(i);
      setTrouble(C.actFailed);
    }
  };

  const makeTask = (i: api.TriageItem) => navigate(`/new?triage=${encodeURIComponent(i.id)}`);

  /** A task on the item's own workflow that skips planning. */
  const buildNow = async (i: api.TriageItem) => {
    if (!i.workflow || starting) return;
    setTrouble(null);
    setStarting(i.id);
    try {
      const task = await api.createTask({
        title: i.title.slice(0, 200),
        request: i.text.trim() ? `${i.title}\n\n${i.text.trim()}` : i.title,
        project: i.project,
        workspace: store.ws.id,
        workflow: i.workflow,
        triage: i.id,
        skip_plan: true,
      });
      store.patchTriage({ ...i, state: "carded", task: task.id, updated_at: new Date().toISOString() });
      store.patchTask(task);
      store.markSeen(task.id);
      navigate(`/tasks/${encodeURIComponent(task.key)}`);
    } catch (e) {
      setTrouble(refusal(e) ?? C.actFailed);
    } finally {
      setStarting(null);
    }
  };

  const tick = (id: string, on: boolean) =>
    setTicked((was) => {
      const next = new Set(was);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const pickedItems = rows.filter((i) => ticked.has(i.id));

  const loadMore = () => {
    setMore("loading");
    store.loadMoreTriageHistory().then(
      () => setMore("idle"),
      () => setMore("failed"),
    );
  };
  const paging = tab === "history" && history === "ok" && !store.triageHistoryDone;
  // Re-observed after every page, so a page that does not fill the screen reads the next one.
  useEffect(() => {
    if (!paging || more !== "idle" || !sentinel.current) return;
    const seen = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { root: scroller.current, rootMargin: "200px" });
    seen.observe(sentinel.current);
    return () => seen.disconnect();
  }, [paging, more, done.length]);

  const failed = store.triageFailed || (tab === "history" && history === "failed") ? C.loadFailed : trouble;
  const loading = store.triage === null || (tab === "history" && history !== "ok" && history !== "failed");

  const detailPane = detail && (
    <Detail
      item={detail}
      source={sourceOf(detail)}
      task={detail.task ? (tasks.get(detail.task) ?? null) : null}
      onClose={() => setSelected(null)}
      onMake={() => makeTask(detail)}
      onBuild={detail.workflow ? () => void buildNow(detail) : undefined}
      starting={starting === detail.id}
      onIgnore={() => void ignore([detail])}
      onRestore={() => void restore(detail)}
      onReason={(reason) => saveReason([detail], reason)}
    />
  );

  const sourceMenu = (
    <Menu
      align="end"
      trigger={({ open, onClick }) => (
        <button type="button" onClick={onClick} aria-expanded={open} className={cn("inline-flex h-7 max-w-[200px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-1 text-[12px] font-[600] text-nb-ink-soft hover:text-nb-ink", source !== null && "text-nb-ink")}>
          <span className="truncate">{source === null ? C.allSources : sourceLabel(source, tasks)}</span>
          <FiChevronDown size={13} aria-hidden className="shrink-0 opacity-70" />
        </button>
      )}
      items={[
        { key: "*", onSelect: () => setSource(null), body: <span className="truncate">{C.allSources}</span> },
        ...sources.map((s) => ({ key: s || "-", onSelect: () => setSource(s), body: <span className="max-w-[260px] truncate">{sourceLabel(s, tasks)}</span> })),
      ]}
    />
  );

  const tabs = (
    <span role="tablist" className="inline-flex h-8 shrink-0 items-center gap-5">
      <TabButton label={C.pending} count={pending.length} on={tab === "pending"} onClick={() => switchTab("pending")} />
      <TabButton label={C.history} on={tab === "history"} onClick={() => switchTab("history")} />
    </span>
  );
  const hits = filtered && <span className="shrink-0 text-[11.5px] tabular-nums text-nb-ink-soft">{`${rows.length} / ${list.length}`}</span>;
  const searchBox = (autoFocus?: boolean) => (
    <label className="relative inline-flex h-7 min-w-0 shrink items-center">
      <FiSearch size={13} className="absolute left-2.5 text-nb-ink-soft" aria-hidden />
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={C.search}
        aria-label={C.search}
        className="nb-field h-7 w-[180px] rounded-[8px] bg-nb-wash pl-7 pr-2.5 text-[12px] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-none max-md:h-9 max-md:w-full max-md:text-[16px]"
      />
    </label>
  );
  const toolbar = phone ? (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
      {tabs}
      <button type="button" onClick={() => setSearching((v) => !v)} aria-label={C.search} aria-expanded={searching} className="-mr-2 ml-auto grid size-11 shrink-0 cursor-pointer place-items-center rounded-[8px] text-nb-ink-soft">
        <FiSearch size={17} aria-hidden />
      </button>
      <span aria-hidden className="basis-full" />
      {(searching || q) && <div className="flex basis-full">{searchBox(true)}</div>}
      {sourceMenu}
      {hits}
    </div>
  ) : (
    <div className="flex shrink-0 items-center gap-x-3 px-6 py-2.5">
      {tabs}
      <span className="ml-auto" />
      {hits}
      {searchBox()}
      {sourceMenu}
    </div>
  );

  const pickBar = tab === "pending" && pickedItems.length > 0 && (
    <div className={cn("flex h-9 items-center gap-3 rounded-[9px] bg-nb-accent-wash px-3", phone ? "mx-2 mb-2 shrink-0" : "mb-2")}>
      <input type="checkbox" checked onChange={() => setTicked(new Set())} aria-label={C.clearPick} className={CHECK} />
      <span className="min-w-0 truncate text-[12.5px] font-[700] tabular-nums">{C.selected(pickedItems.length)}</span>
      {pickedItems.length < rows.length && (
        <button type="button" onClick={() => setTicked(new Set(rows.map((i) => i.id)))} className={cn(LINK, "shrink-0")}>
          {C.selectAll(rows.length)}
        </button>
      )}
      <span className="ml-auto inline-flex shrink-0 items-center gap-2">
        {!phone && (
          <button type="button" onClick={() => setTicked(new Set())} className={GHOST_INK}>
            {C.clearPick}
          </button>
        )}
        <Button size="xs" onClick={() => void ignore(pickedItems)}>
          {C.ignoreN(pickedItems.length)}
        </Button>
      </span>
    </div>
  );

  const body = loading ? <Skeleton className="max-w-[420px] p-4" /> : list.length === 0 ? (
    tab === "pending" ? <Empty title={C.empty} hint={C.emptyHint} /> : <Empty title={C.historyEmpty} hint={C.historyEmptyHint} />
  ) : rows.length === 0 ? (
    <div className="m-auto flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-[13px] font-[700]">{C.noHits}</p>
      <button type="button" onClick={clearFilters} className={LINK}>
        {C.clearFilters}
      </button>
    </div>
  ) : (
    <>
      {!phone && pickBar}
      <ul key={tab} className="a4k-reveal flex flex-col">
        {rows.map((it, k) => {
          const first = k === 0 || sourceKey(rows[k - 1]!) !== sourceKey(it);
          const common = { item: it, first, top: k === 0, source: sourceOf(it), selected: it.id === selected, onOpen: () => setSelected(it.id) };
          if (phone) return <PhoneRow key={it.id} {...common} checked={ticked.has(it.id)} onTick={tab === "pending" ? (on) => tick(it.id, on) : undefined} />;
          return tab === "pending" ? (
            <QueueRow key={it.id} {...common} checked={ticked.has(it.id)} onTick={(on) => tick(it.id, on)} onMake={() => makeTask(it)} onBuild={it.workflow ? () => void buildNow(it) : undefined} busy={starting !== null} onIgnore={() => void ignore([it])} />
          ) : (
            <HistoryRow key={it.id} {...common} task={it.task ? (tasks.get(it.task) ?? null) : null} />
          );
        })}
        {tab === "history" && paging && (
          <li ref={sentinel} role="status" className="flex min-h-[36px] items-center justify-center gap-2 text-[12px] text-nb-ink-soft">
            {more === "failed" ? (
              <>
                {C.moreFailed}
                <button type="button" onClick={loadMore} className={LINK}>
                  {C.retry}
                </button>
              </>
            ) : (
              C.loadingMore
            )}
          </li>
        )}
      </ul>
    </>
  );

  const page = (
    <div className="relative flex h-full min-h-0 flex-col">
      {toolbar}
      {failed && (
        <p role="alert" className="mx-6 mb-2 rounded-[8px] bg-nb-peach-soft px-2.5 py-2 text-[12px] text-nb-peach-ink max-md:mx-4">
          {failed}
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} className={cn("flex h-full flex-col overflow-y-auto pb-6 pt-1", phone ? "px-2" : "px-3")}>
          {body}
        </div>
        {toast && <IgnoredToast key={toast.key} items={toast.items} onUndo={() => void undo(toast.items)} onReason={(r) => saveReason(toast.items, r)} onClose={() => setToast(null)} />}
      </div>
      {phone && pickBar}
    </div>
  );

  if (store.tasks && !project) return <Gone text={T.notFoundProject} />;
  if (phone) return <Window project={project}>{detailPane ?? page}</Window>;
  return <Window project={project} side={detailPane ?? undefined}>{page}</Window>;
}

function sourceLabel(source: string, tasks: Map<string, api.Task>) {
  const t = tasks.get(source);
  return t ? `${numberOf(t.key)} ${t.title}` : C.noSource;
}

/** The source column: the task's number and title, linking to it; none is 未注明来源. */
function RowSource({ source, short }: { source: api.Task | null; short?: boolean }) {
  if (!source) return <span className="truncate text-[12px] font-[700] text-nb-ink-soft">{short ? "—" : C.noSource}</span>;
  return (
    <Link href={`/tasks/${encodeURIComponent(source.key)}`} onClick={(e) => e.stopPropagation()} title={source.title} className="flex min-w-0 items-baseline gap-1.5 text-[12px] text-nb-ink no-underline hover:underline">
      <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-nb-ink-soft">{numberOf(source.key)}</span>
      {!short && <span className="truncate font-[700]">{source.title}</span>}
    </Link>
  );
}

function TabButton({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick} className={cn("flex h-full cursor-pointer items-center gap-1.5 border-b-2 text-[13px] font-[700]", on ? "border-nb-accent text-nb-ink" : "border-transparent text-nb-ink-soft hover:text-nb-ink")}>
      {label}
      {count !== undefined && <span className="text-[12px] font-[400] tabular-nums text-nb-ink-soft">{count}</span>}
    </button>
  );
}

type RowProps = { item: api.TriageItem; first: boolean; top: boolean; source: api.Task | null; selected: boolean; onOpen: () => void };

function RowShell({ first, top, label, onOpen, className, children }: { first: boolean; top: boolean; label: string; onOpen: () => void; className: string; children: ReactNode }) {
  return (
    <li className={cn("group", first && !top && "border-t")} style={first && !top ? { borderColor: HAIRLINE } : undefined}>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={onOpen}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            onOpen();
          }
        }}
        className={className}
      >
        {children}
      </div>
    </li>
  );
}

function QueueRow({ item, first, top, source, selected, onOpen, checked, onTick, onMake, onBuild, busy, onIgnore }: RowProps & { checked: boolean; onTick: (on: boolean) => void; onMake: () => void; onBuild?: () => void; busy: boolean; onIgnore: () => void }) {
  const text = gist(item.text);
  const tip = top && "nb-tip-below";
  return (
    <RowShell first={first} top={top} label={item.title} onOpen={onOpen} className={cn(ROW, selected ? SELECTED : checked ? TICKED : "hover:bg-nb-wash focus-visible:bg-nb-wash")}>
      <input type="checkbox" checked={checked} onChange={(e) => onTick(e.target.checked)} onClick={(e) => e.stopPropagation()} aria-label={item.title} className={cn(CHECK, "mt-[2px]")} />
      <span className="flex h-[18px] w-[148px] shrink-0 items-center">{first && <RowSource source={source} />}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-x-1.5">
        <span className="min-w-0 truncate text-[13px] font-[600] text-nb-ink">{item.title}</span>
        {text && <span className="min-w-0 flex-1 basis-0 truncate text-[12px] text-nb-ink-soft">— {text}</span>}
      </span>
      <span className={cn("flex shrink-0 items-start gap-3", checked ? "hidden" : "group-hover:hidden group-has-[:focus-visible]:hidden")}>
        <span className="min-w-[52px] shrink-0 whitespace-nowrap text-right text-[11.5px] tabular-nums text-nb-ink-soft">{day(item.created_at)}</span>
      </span>
      <span className={cn("relative -my-1 -mr-1 shrink-0 items-center gap-0.5 self-center", checked ? "flex" : "hidden group-hover:flex group-has-[:focus-visible]:flex")}>
        <button type="button" data-tip={C.makeTask} aria-label={C.makeTask} disabled={busy} onClick={(e) => (e.stopPropagation(), onMake())} className={cn(ICON_BTN, tip, BUSY)}>
          <FiPlus size={16} aria-hidden />
        </button>
        {onBuild && (
          <button type="button" data-tip={C.buildNow} aria-label={C.buildNow} disabled={busy} onClick={(e) => (e.stopPropagation(), onBuild())} className={cn(ICON_BTN, tip, BUSY)}>
            <FiPlay size={14} aria-hidden />
          </button>
        )}
        <button type="button" data-tip={C.ignore} aria-label={C.ignore} onClick={(e) => (e.stopPropagation(), onIgnore())} className={cn(ICON_BTN, tip)}>
          <FiEyeOff size={14} aria-hidden />
        </button>
      </span>
    </RowShell>
  );
}

function HistoryRow({ item, first, top, source, selected, onOpen, task }: RowProps & { task: api.Task | null }) {
  const made = item.state === "carded";
  const note = "min-w-0 flex-1 basis-0 truncate text-[12px]";
  const text = gist(item.text);
  return (
    <RowShell first={first} top={top} label={item.title} onOpen={onOpen} className={cn(ROW, selected ? SELECTED : "hover:bg-nb-wash focus-visible:bg-nb-wash")}>
      <span className="flex h-[18px] w-[148px] shrink-0 items-center">{first && <RowSource source={source} />}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-x-1.5">
        <span className="min-w-0 truncate text-[13px] font-[600] text-nb-ink">{item.title}</span>
        {made ? (
          task && <span className={cn(note, "font-[700] text-nb-accent-deep")}>→ {numberOf(task.key)} {task.title}</span>
        ) : item.dismissed_reason ? (
          <span className={cn(note, "text-nb-ink")}>
            <span className="font-[700] text-nb-ink-soft">{C.why}</span> {item.dismissed_reason}
          </span>
        ) : (
          text && <span className={cn(note, "text-nb-ink-soft")}>— {text}</span>
        )}
      </span>
      <span className={cn("shrink-0 whitespace-nowrap text-[11.5px] font-[700]", made ? "text-nb-accent-deep" : "text-nb-ink-soft")}>{made ? C.made : C.ignored}</span>
      <span className="min-w-[52px] shrink-0 whitespace-nowrap text-right text-[11.5px] tabular-nums text-nb-ink-soft">{day(handledAt(item))}</span>
    </RowShell>
  );
}

/** Legacy's phone rows: the source as a short column, the title alone; the actions are in the detail. */
function PhoneRow({ item, first, top, source, onOpen, checked, onTick }: RowProps & { checked: boolean; onTick?: (on: boolean) => void }) {
  return (
    <RowShell first={first} top={top} label={item.title} onOpen={onOpen} className={cn("flex min-h-11 cursor-pointer items-start gap-2.5 px-2 py-[13px] leading-[18px] outline-none", checked && TICKED)}>
      {onTick && <input type="checkbox" checked={checked} onChange={(e) => onTick(e.target.checked)} onClick={(e) => e.stopPropagation()} aria-label={item.title} className="mt-[2px] size-[18px] shrink-0 accent-nb-accent-deep" />}
      <span className="flex h-[18px] w-[46px] shrink-0 items-center">{first && <RowSource source={source} short />}</span>
      <span className="min-w-0 flex-1 text-[13px] font-[600] text-nb-ink [overflow-wrap:anywhere]">{item.title}</span>
      {!onTick && <span className={cn("shrink-0 text-[11.5px] font-[700]", item.state === "carded" ? "text-nb-accent-deep" : "text-nb-ink-soft")}>{item.state === "carded" ? C.made : C.ignored}</span>}
    </RowShell>
  );
}

/** A reason box with 保存; resolves true once saved. */
function ReasonForm({ initial = "", onSave, onDone }: { initial?: string; onSave: (reason: string) => Promise<boolean>; onDone: () => void }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    const reason = text.trim();
    if (!reason || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onSave(reason);
    setBusy(false);
    if (ok) onDone();
    else setFailed(true);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void save();
          }}
          placeholder={C.reasonHint}
          aria-label={C.addReason}
          className={cn(FIELD, "h-8 min-w-0 flex-1 focus:outline-none")}
        />
        <Button size="xs" className="h-8" disabled={!text.trim() || busy} onClick={() => void save()}>
          {C.save}
        </Button>
      </div>
      {failed && <p className="text-[12px] text-nb-peach-ink">{C.saveFailed}</p>}
    </div>
  );
}

/** What was just ignored: 撤销, and — asked for — a box for why. Gone after 10 s unless asking. */
function IgnoredToast({ items, onUndo, onReason, onClose }: { items: api.TriageItem[]; onUndo: () => void; onReason: (reason: string) => Promise<boolean>; onClose: () => void }) {
  const [asking, setAsking] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (asking) return;
    const id = setTimeout(() => close.current(), TOAST_MS);
    return () => clearTimeout(id);
  }, [asking]);
  return (
    <div role="status" className="nb-panel-sm nb-rise absolute bottom-5 left-1/2 z-30 flex w-[460px] max-w-[calc(100%-24px)] -translate-x-1/2 flex-col gap-2 bg-nb-paper px-3.5 py-2.5">
      <div className="flex h-7 items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-[600]">{items.length === 1 ? C.ignoredOne(items[0]!.title) : C.ignoredN(items.length)}</span>
        <button type="button" onClick={onUndo} className={cn(LINK, "shrink-0")}>
          {C.undo}
        </button>
        {!asking && (
          <button type="button" onClick={() => setAsking(true)} className={cn(LINK, "shrink-0")}>
            {C.addReason}
          </button>
        )}
        <button type="button" onClick={onClose} aria-label={C.close} className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-wash">
          <FiX size={14} aria-hidden />
        </button>
      </div>
      {asking && <ReasonForm onSave={onReason} onDone={onClose} />}
    </div>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-[12px] leading-[18px] text-nb-ink-soft">
      <span className="font-[700]">{label}</span> {children}
    </div>
  );
}

/** One item in full, in the window's right rail (the whole screen on a phone). */
function Detail({
  item,
  source,
  task,
  onClose,
  onMake,
  onBuild,
  starting,
  onIgnore,
  onRestore,
  onReason,
}: {
  item: api.TriageItem;
  source: api.Task | null;
  task: api.Task | null;
  onClose: () => void;
  onMake: () => void;
  onBuild?: () => void;
  starting: boolean;
  onIgnore: () => void;
  onRestore: () => void;
  onReason: (reason: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [item.id]);
  const open = item.state === "open";
  return (
    <aside aria-label={item.title} className="flex h-full flex-col bg-nb-cream max-md:animate-[nbSlideInRight_220ms_cubic-bezier(0.32,0.72,0,1)] max-md:bg-nb-paper">
      <div className="flex shrink-0 items-center gap-2 py-2.5 pl-3 pr-1">
        <span className="flex h-8 min-w-0 flex-1 items-center gap-1.5 text-[12px]">
          <RowSource source={source} />
          <span className="shrink-0 tabular-nums text-nb-ink-soft">· {day(item.created_at)}</span>
        </span>
        <button type="button" onClick={onClose} aria-label={C.close} className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink hover:bg-nb-wash">
          <FiX size={16} aria-hidden />
        </button>
      </div>
      <div className="shrink-0 px-3 pb-2">
        <h2 className="line-clamp-3 text-[17px] font-[700] leading-[26px]">{item.title}</h2>
        <span className="relative mt-3 flex flex-wrap items-center gap-2">
          {open ? (
            <>
              <Button size="xs" className="h-8" disabled={starting} onClick={onMake}>
                {C.makeTask}
              </Button>
              {onBuild && (
                <Button variant="ghost" size="xs" className="h-8" disabled={starting} onClick={onBuild}>
                  {starting ? C.starting : C.buildNow}
                </Button>
              )}
              <button type="button" onClick={onIgnore} className={cn(GHOST_INK, "ml-auto h-8")}>
                <FiEyeOff size={12} aria-hidden />
                {C.ignore}
              </button>
            </>
          ) : item.state === "dismissed" ? (
            <Button size="xs" className="h-8" onClick={onRestore}>
              <FiRotateCcw size={12} aria-hidden />
              {C.restore}
            </Button>
          ) : null}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        {item.text.trim() && <Markdown body={item.text} className="text-[13px] leading-[20px]" />}
        <div className="mt-4 flex flex-col gap-1">
          {item.state === "carded" && (
            <Line label={C.madeAt}>
              {stamp(item.updated_at)}
              {task && (
                <>
                  {" · "}
                  <Link href={`/tasks/${encodeURIComponent(task.key)}`} className={LINK}>
                    {numberOf(task.key)} {task.title}
                  </Link>
                </>
              )}
            </Line>
          )}
          {item.state === "dismissed" && item.dismissed_at && <Line label={C.ignoredAt}>{stamp(item.dismissed_at)}</Line>}
          {item.state === "dismissed" &&
            (editing ? (
              <div className="mt-1">
                <ReasonForm initial={item.dismissed_reason ?? ""} onSave={onReason} onDone={() => setEditing(false)} />
              </div>
            ) : (
              <Line label={C.why}>
                {item.dismissed_reason && <span className="text-nb-ink">{item.dismissed_reason} </span>}
                <button type="button" onClick={() => setEditing(true)} className={LINK}>
                  {item.dismissed_reason ? C.edit : C.addReason}
                </button>
              </Line>
            ))}
        </div>
      </div>
    </aside>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="m-auto flex max-w-[420px] flex-col items-center px-4 py-10 text-center">
      <span className={`flex h-11 w-11 items-center justify-center rounded-[12px] bg-nb-peach-soft ${CHROME}`}>
        <FiInbox size={18} aria-hidden />
      </span>
      <p className="mt-3 text-[14px] font-[800] tracking-[-0.01em]">{title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-nb-ink-soft">{hint}</p>
    </div>
  );
}
