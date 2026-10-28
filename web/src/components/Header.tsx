// Copied from legacy kanban-ui/components/Header.tsx and desktop.tsx: the top bar's path,
// logo / workspace / project as on Vercel, each segment's menu switching in place. The
// avatar is review/'s TopBar: 24px, the account on hover; its menu holds the account,
// 账单, 语言 and 退出登录, all from what the page already has.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiCheck, FiChevronDown, FiCreditCard, FiFolder, FiGlobe, FiInbox, FiLogOut, FiPlus, FiSettings, FiWifiOff } from "react-icons/fi";
import { signOut } from "@review/auth";
import { Button } from "@review/components/button";
import { Avatar } from "@review/components/chat";
import { HAIRLINE } from "@review/components/chrome";
import { LangSelect } from "@review/components/lang-select";
import { POPUP_PANEL } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { useNeedsByProject } from "../alerts";
import { LANG, T } from "../i18n";
import { isOpen } from "../lib/card";
import { Link, navigate, useLocation } from "../router";
import { useStore } from "../store";
import { openSettings } from "./Settings";

export const meName = (me: api.Me) => me.email || (me.handle ? `@${me.handle}` : "");

const ITEM = "flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-[600] text-nb-ink hover:bg-nb-wash";
const Rule = () => <span aria-hidden className="mx-1 my-1 h-px" style={{ background: HAIRLINE }} />;

export function Me() {
  const { me } = useStore();
  const who = meName(me);
  const [open, setOpen] = useState(false);
  const box = useDismiss<HTMLSpanElement>(open, () => setOpen(false));
  const pick = (go: () => void) => () => {
    setOpen(false);
    go();
  };
  return (
    <span ref={box} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={who} title={who} className="inline-flex cursor-pointer items-center rounded-full max-md:min-h-[36px]">
        <Avatar who={who} size={24} />
      </button>
      {open && (
        <span role="menu" className={cn(POPUP_PANEL, "absolute right-0 top-[calc(100%+4px)] z-30 flex w-[260px] flex-col p-1")}>
          <span className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar who={who} size={32} />
            <span className="flex min-w-0 flex-col">
              {me.name && <span className="truncate text-[13.5px] font-[700]">{me.name}</span>}
              {me.email && <span className={cn("truncate", me.name ? "text-[12px] text-nb-ink-soft" : "text-[13.5px] font-[700]")}>{me.email}</span>}
            </span>
          </span>
          <Rule />
          <button type="button" role="menuitem" onClick={pick(() => openSettings("billing"))} className={ITEM}>
            <FiCreditCard size={13} aria-hidden className="text-nb-ink-soft" />
            {T.billing.section}
          </button>
          <span className={cn(ITEM, "cursor-default hover:bg-transparent")}>
            <FiGlobe size={13} aria-hidden className="text-nb-ink-soft" />
            <span className="flex-1">{T.language}</span>
            <LangSelect />
          </span>
          <Rule />
          <button type="button" role="menuitem" onClick={pick(signOut)} className={ITEM}>
            <FiLogOut size={13} aria-hidden className="text-nb-ink-soft" />
            {T.signOut}
          </button>
        </span>
      )}
    </span>
  );
}

/** Links to the workspace's Runners. At phone width only the icon shows. */
export function OfflineBadge({ phone }: { phone?: boolean }) {
  const name = useStore().runnerName;
  return (
    <Link
      href="/settings/workspace#runners"
      aria-label={T.offline(name)}
      className={cn(
        "nb-tip nb-tip-below inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-nb-peach-soft text-[12px] font-[700] text-nb-peach-ink no-underline",
        phone ? "w-8 justify-center" : "px-2.5",
      )}
      data-tip={T.offlineTip(name)}
    >
      <FiWifiOff size={phone ? 13 : 12} aria-hidden />
      {!phone && <span className="max-lg:hidden">{T.offline(name)}</span>}
    </Link>
  );
}

/** Closes what `open` showed on Esc or a click outside the returned box. */
export function useDismiss<E extends HTMLElement>(open: boolean, close: () => void) {
  const box = useRef<E>(null);
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

const MENU = "nb-panel-sm absolute left-0 top-[calc(100%+6px)] z-40 flex w-[260px] flex-col p-1.5";
const ROW = "flex h-9 w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 text-left text-[13px] hover:bg-nb-wash";
const SEGMENT = "flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-1.5 text-[13px] font-[700] text-nb-ink hover:bg-nb-wash";
const BADGE = "inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px]";

/** The top bar path's separator, a hairline stroke as on Vercel. */
export const Slash = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" className="shrink-0" style={{ color: "color-mix(in srgb, var(--color-nb-ink) 22%, transparent)" }}>
    <path d="M16.88 3.549L7.12 20.451" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const wsName = (w: api.Workspace) => (w.personal ? (LANG === "zh" ? "我的工作空间" : "My workspace") : w.name);
const wsInitial = (w: api.Workspace) => (w.personal && LANG === "zh" ? "我" : (wsName(w).match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase());

export function WsMark({ ws, size = 18 }: { ws: api.Workspace; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[5px] font-[800]", ws.personal ? "bg-nb-sky-soft text-nb-sky-ink" : "bg-nb-lilac-soft text-nb-lilac-ink")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
    >
      {wsInitial(ws)}
    </span>
  );
}

export function WorkspaceSwitch() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setNaming(false);
    setProblem(null);
  };
  const box = useDismiss<HTMLSpanElement>(open, close);
  const pick = (id: string) => {
    close();
    store.setWorkspace(id);
    navigate("/");
  };
  const create = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      const w = await api.createWorkspace(n);
      await store.reloadWorkspaces();
      setName("");
      pick(w.id);
    } catch (e) {
      setProblem(e instanceof api.ApiError && e.code === "offline" ? T.errors.offline : T.errors.generic);
    }
  };
  return (
    <span ref={box} className="relative flex min-w-0">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={cn(SEGMENT, open && "bg-nb-wash")}
      >
        <WsMark ws={store.ws} />
        <span className="max-w-[160px] truncate max-md:hidden">{wsName(store.ws)}</span>
        <FiChevronDown size={12} className="shrink-0 opacity-60" aria-hidden />
      </button>
      {open && (
        <div className={MENU} role="menu">
          {store.workspaces.map((w) => (
            <button key={w.id} type="button" role="menuitem" onClick={() => pick(w.id)} className={cn(ROW, "h-10 gap-2.5", w.id === store.ws.id && "bg-nb-wash font-[700]")}>
              <WsMark ws={w} size={20} />
              <span className="min-w-0 flex-1 truncate">{wsName(w)}</span>
              <span className="text-[11px] font-[500] text-nb-ink-soft">{T.ws.roles[w.role]}</span>
              {w.id === store.ws.id && <FiCheck size={13} aria-hidden />}
            </button>
          ))}
          <span aria-hidden className="mx-2.5 my-1 h-px" style={{ background: HAIRLINE }} />
          {naming ? (
            <div className="flex flex-col gap-1.5 p-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) void create();
                }}
                placeholder={T.ws.newName}
                aria-label={T.ws.newName}
                className="nb-field h-8 rounded-[8px] border-[1.5px] border-nb-ink/15 px-2.5 text-[13px] focus:outline-none max-md:text-[16px]"
              />
              {problem && <p className="text-[12px] text-nb-peach-ink">{problem}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setNaming(true)} className={cn(ROW, "text-nb-ink-soft")}>
              <FiPlus size={13} aria-hidden />
              {T.ws.newWs}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              close();
              navigate("/settings/workspace");
            }}
            className={cn(ROW, "text-nb-ink-soft")}
          >
            <FiSettings size={13} aria-hidden />
            {T.ws.settings}
          </button>
        </div>
      )}
    </span>
  );
}

/** A project's 等你处理 count, or else how many of its tasks are open. */
export function NeedsCount({ project, needs }: { project: string; needs: Map<string, number> }) {
  const store = useStore();
  const n = needs.get(project) ?? 0;
  if (n > 0) return <span className="text-[11px] font-[700] text-nb-accent-deep">{T.counts.needsShort(n)}</span>;
  const live = (store.tasks ?? []).filter((t) => t.project === project && isOpen(t)).length;
  return live > 0 ? <span className="text-[11px] text-nb-ink-soft">{T.counts.open(live)}</span> : null;
}

/** The path's last segment: the workspace's current project, or an empty slot when there is none. */
export function ProjectChip() {
  const store = useStore();
  const needs = useNeedsByProject();
  const [open, setOpen] = useState(false);
  const box = useDismiss<HTMLSpanElement>(open, () => setOpen(false));
  const current = store.current;
  const elsewhere = [...needs.keys()].some((id) => id !== current?.id && store.projects.some((p) => p.id === id));
  return (
    <span ref={box} className="relative flex min-w-0">
      {current ? (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn(SEGMENT, open && "bg-nb-wash")}>
          <span aria-hidden className={cn(BADGE, "bg-nb-wash text-nb-ink-soft")}>
            <FiFolder size={11} />
          </span>
          <span className="truncate">{current.name}</span>
          {elsewhere && <span role="img" aria-label={T.otherProjectsNeedYou} className="size-[6px] shrink-0 rounded-full bg-nb-accent" />}
          <FiChevronDown size={12} className="shrink-0 opacity-60" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn("flex h-7 min-w-0 cursor-pointer items-center gap-1 rounded-[8px] border border-dashed px-2 text-[12.5px] text-nb-ink-soft hover:bg-nb-wash", open && "bg-nb-wash")}
          style={{ borderColor: HAIRLINE }}
        >
          <span className="truncate">{T.pickProject}</span>
          <FiChevronDown size={12} className="shrink-0 opacity-60" aria-hidden />
        </button>
      )}
      {open && (
        <div className={MENU} role="menu">
          {store.projects.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  store.setCurrent(p.id);
                  navigate(`/projects/${p.id}`);
                }}
                className={cn(ROW, p.id === current?.id && "bg-nb-wash font-[700]")}
              >
                <FiFolder size={13} className="shrink-0 text-nb-ink-soft" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <NeedsCount project={p.id} needs={needs} />
                {p.id === current?.id && <FiCheck size={13} aria-hidden />}
              </button>
          ))}
          {!store.projects.length && <p className="px-2.5 py-2 text-[12.5px] text-nb-ink-soft">{T.noProjects}</p>}
        </div>
      )}
    </span>
  );
}

export function TopRight({ children }: { children: ReactNode }) {
  return <span className="flex shrink-0 items-center gap-3 max-md:gap-2">{children}</span>;
}

/** The current project's open triage items. */
export const openTriage = (store: { triage: api.TriageItem[] | null; current: api.Project | null }) => (store.triage ?? []).filter((i) => i.state === "open" && i.project === store.current?.id).length;
export const triageHref = (project: string) => `/projects/${encodeURIComponent(project)}/triage`;

// Where 待筛选 was opened from, to go back to on a second click.
let before = "/";

/** Legacy TriageButton.tsx: a ghost block while empty, crimson with the count while items wait. */
export function TriageButton() {
  const store = useStore();
  const { path } = useLocation();
  if (!store.current) return null;
  const href = triageHref(store.current.id);
  const here = path === href;
  if (!here) before = path + location.search;
  const count = openTriage(store);
  const lit = count > 0;
  const label = lit ? T.triage.waiting(count) : T.triage.title;
  return (
    <span className="nb-tip nb-tip-below inline-flex" data-tip={label}>
      <Button
        variant="ghost"
        size="xs"
        className={cn("min-w-7 shrink-0 gap-1", lit ? "px-2" : "px-0")}
        aria-label={label}
        aria-pressed={here}
        onClick={() => navigate(here ? before : href)}
        style={
          lit
            ? { background: here ? "color-mix(in srgb, var(--color-nb-crimson) 82%, black)" : "var(--color-nb-crimson)", color: "#fff" }
            : here
              ? { background: "color-mix(in srgb, var(--color-nb-crimson) 14%, white)" }
              : undefined
        }
      >
        <FiInbox className="text-[14px]" aria-hidden />
        {lit && <span className="tabular-nums">{count}</span>}
      </Button>
    </span>
  );
}
