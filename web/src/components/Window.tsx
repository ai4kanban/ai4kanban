// Copied from legacy kanban-ui/components/Window.tsx and Phone.tsx: the top row and the rail on
// the cream, the page on a paper sheet rounded where it turns from them. The top row leaves no
// room for window controls. At phone width there is no rail: the top row holds find and 新想法,
// and a bottom bar switches 看板 / 对话 / 更多.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FaRegLightbulb } from "react-icons/fa";
import { FiArchive, FiBarChart2, FiCheck, FiChevronRight, FiCreditCard, FiFolder, FiGlobe, FiGrid, FiInbox, FiLogOut, FiMessageSquare, FiMoreHorizontal, FiSettings, FiUsers } from "react-icons/fi";
import { LuSquareKanban } from "react-icons/lu";
import { signOut } from "@review/auth";
import { Button } from "@review/components/button";
import { HAIRLINE } from "@review/components/chrome";
import { Avatar } from "@review/components/chat";
import { LangSelect } from "@review/components/lang-select";
import { LogoMark } from "@review/components/Logo";
import { cn } from "@review/lib/utils";
import type { Project } from "../api";
import { useNeedsByProject } from "../alerts";
import { T } from "../i18n";
import { useNarrow } from "../lib/narrow";
import { Link, navigate, useLocation } from "../router";
import { useStore } from "../store";
import { Me, meName, NeedsCount, OfflineBadge, openTriage, ProjectChip, Slash, TopRight, triageHref, TriageButton, WorkspaceSwitch, wsName } from "./Header";
import { ChatList, chatsHere, FindBox, matchTasks, Rail } from "./Rail";
import { projectSettingsHref } from "../lib/settings";
import { openSettings, SettingsButton } from "./Settings";

const RAIL_KEY = "wildcrane.web.rail";

export function Window({
  project,
  side,
  activeChat,
  phoneLead,
  phoneTop,
  noPhoneBar,
  children,
}: {
  /** The page's project, made the current one; null is a page in no project. */
  project?: Project | null;
  /** A rail on the right, beside the page: the card page's comments. */
  side?: ReactNode;
  /** The task or idea conversation whose chat is open, lit in the rail. */
  activeChat?: string;
  /** At phone width, the page's own control ahead of find in the top row. */
  phoneLead?: ReactNode;
  /** At phone width, after 新想法 in the top row. */
  phoneTop?: ReactNode;
  noPhoneBar?: boolean;
  children: ReactNode;
}) {
  const store = useStore();
  const needs = useNeedsByProject();
  const phone = useNarrow();
  const [rail, setRail] = useState(() => localStorage.getItem(RAIL_KEY) !== "0");
  const [tab, setTab] = useState<"board" | "chats" | "more">("board");
  const [tabbed, setTabbed] = useState(false);
  // The side rail slides in when it opens on this page, not when a page opens with it.
  const [hadSide, setHadSide] = useState(!!side);
  const [sideMoved, setSideMoved] = useState(false);
  if (hadSide !== !!side) {
    setHadSide(!!side);
    setSideMoved(true);
  }
  const { path } = useLocation();
  useEffect(() => {
    setTab("board");
    setTabbed(false);
  }, [path]);

  useEffect(() => {
    if (project) store.setCurrent(project.id);
  }, [project?.id]);
  const current = store.current;
  const archiveHref = current ? `/archive?project=${encodeURIComponent(current.id)}` : "/archive";

  // `N` opens 新想法.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]")) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        navigate("/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleRail = () => {
    localStorage.setItem(RAIL_KEY, rail ? "0" : "1");
    setRail(!rail);
  };
  const offline = store.runnerOnline === false;
  const newIdea = (
    <Button variant="accent" size="xs" className="shrink-0" aria-label={T.newIdea} onClick={() => navigate("/new")}>
      <FaRegLightbulb aria-hidden />
      {T.newIdea}
      {!phone && <kbd className="ml-0.5 inline-flex size-[18px] items-center justify-center rounded-full bg-white/25 font-sans text-[10.5px]">N</kbd>}
    </Button>
  );

  if (phone) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-paper font-sans">
        <div className="box-content flex h-12 shrink-0 items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)]" style={{ borderColor: HAIRLINE }}>
          {phoneLead}
          <PhoneFind />
          {offline && <OfflineBadge phone />}
          {newIdea}
          {phoneTop}
        </div>
        <div key={tab} className={cn("relative min-h-0 flex-1 overflow-hidden", tabbed && "a4k-reveal")}>
          {tab === "chats" ? (
            <div className="flex h-full flex-col overflow-y-auto py-1">
              <ChatList chats={store.chats} active={activeChat} big />
            </div>
          ) : tab === "more" ? (
            <PhoneMore current={current?.id} archiveHref={archiveHref} needs={needs} />
          ) : (
            children
          )}
        </div>
        {!noPhoneBar && (
          <nav className="box-content flex h-[60px] shrink-0 items-center justify-around border-t pb-[env(safe-area-inset-bottom)] text-[11px] font-[700]" style={{ borderColor: HAIRLINE }}>
            {(
              [
                ["board", <LuSquareKanban key="i" size={17} aria-hidden />, T.tabs.board],
                ["chats", <FiMessageSquare key="i" size={17} aria-hidden />, T.tabs.chats],
                ["more", <FiMoreHorizontal key="i" size={17} aria-hidden />, T.tabs.more],
              ] as const
            ).map(([k, icon, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k === "board" && tab === "board" && !project && path !== "/") navigate("/");
                  setTabbed(k !== tab);
                  setTab(k);
                }}
                aria-current={tab === k ? "page" : undefined}
                className={cn("relative flex min-w-[64px] cursor-pointer flex-col items-center gap-1", tab !== k && "text-nb-ink-soft")}
              >
                {icon}
                {k === "chats" && chatsHere(store).some((c) => c.state === "waiting_you") && <span aria-hidden className="absolute -top-0.5 right-4 size-1.5 rounded-full bg-nb-accent" />}
                {k === "board" && tab !== "board" && needs.size > 0 && <span aria-hidden className="absolute -top-0.5 right-4 size-1.5 rounded-full bg-nb-accent" />}
                {k === "more" && openTriage(store) > 0 && <span aria-hidden className="absolute -top-0.5 right-4 size-1.5 rounded-full bg-nb-crimson" />}
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-cream font-sans">
      <header className="relative flex h-12 shrink-0 items-center gap-2 px-5">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <Link href="/" aria-label="WildCrane" className="mr-0.5 shrink-0">
            <LogoMark />
          </Link>
          <Slash />
          <WorkspaceSwitch />
          <Slash />
          <ProjectChip />
        </span>
        <TopRight>
          {offline && <OfflineBadge />}
          <TriageButton />
          <SettingsButton />
          {newIdea}
          <Me />
        </TopRight>
      </header>
      <div className="flex min-h-0 flex-1">
        <Rail open={rail} onToggle={toggleRail} archiveHref={archiveHref} activeChat={activeChat} />
        <div className={cn("relative min-w-0 flex-1 overflow-hidden bg-nb-paper", side ? "rounded-t-[14px]" : "rounded-tl-[14px]")}>{children}</div>
        {side && <div className={cn("w-[360px] shrink-0 px-3", sideMoved && "animate-[nbSlideInRight_220ms_cubic-bezier(0.32,0.72,0,1)]")}>{side}</div>}
      </div>
    </div>
  );
}

function PhoneFind() {
  const store = useStore();
  const [q, setQ] = useState("");
  const matches = useMemo(() => matchTasks(store.tasks ?? [], q), [store.tasks, q]);
  return (
    <div className="relative min-w-0 flex-1">
      <FindBox phone value={q} onChange={setQ} onMove={() => {}} onOpen={() => matches[0] && navigate(`/tasks/${encodeURIComponent(matches[0].key)}`)} />
      {q.trim() && (
        <div className="nb-panel-sm nb-pop origin-top absolute inset-x-0 top-[calc(100%+6px)] z-40 flex max-h-[60vh] flex-col overflow-y-auto p-1">
          {matches.map((t) => (
            <Link key={t.id} href={`/tasks/${encodeURIComponent(t.key)}`} onClick={() => setQ("")} className="flex h-10 items-center gap-2 rounded-[7px] px-2.5 text-[14px] text-nb-ink no-underline">
              <span className="shrink-0 text-[12px] font-[800] text-nb-accent-deep">#{t.key.replace(/^.*-/, "")}</span>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
            </Link>
          ))}
          {!matches.length && <p className="px-2.5 py-2 text-[13px] text-nb-ink-soft">{T.noMatches}</p>}
        </div>
      )}
    </div>
  );
}

/** Phone.tsx's 更多: the account, the projects and the current one's settings, 工作流, 待筛选, 统计, the archive, the workspace's settings, and signing out. */
function PhoneMore({ current, archiveHref, needs }: { current?: string; archiveHref: string; needs: Map<string, number> }) {
  const store = useStore();
  const row = "flex h-11 w-full cursor-pointer items-center gap-2.5 px-4 text-left text-[14px] text-nb-ink no-underline";
  const who = meName(store.me);
  const group = "px-4 pb-1 pt-2 text-[11px] font-[700] text-nb-ink-soft";
  const rule = <span aria-hidden className="mx-4 my-1 h-px" style={{ background: HAIRLINE }} />;
  return (
    <div className="flex h-full flex-col overflow-y-auto py-2">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <Avatar who={who} size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-[700] text-nb-ink">{store.me.name || who}</span>
          {store.me.name && store.me.email && <span className="truncate text-[12px] text-nb-ink-soft">{store.me.email}</span>}
        </span>
      </div>
      {rule}
      <span className={group}>{T.projects}</span>
      {store.projects.map((p) => (
        <Link key={p.id} href={`/projects/${p.id}`} className={cn(row, p.id === current && "font-[700]")}>
          <FiFolder size={15} className="text-nb-ink-soft" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          <NeedsCount project={p.id} needs={needs} />
          {p.id === current && <FiCheck size={14} aria-hidden />}
        </Link>
      ))}
      {current && (
        <Link href={projectSettingsHref(current)} className={row}>
          <FiSettings size={15} className="text-nb-ink-soft" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{T.projectSettings}</span>
          <FiChevronRight size={14} className="text-nb-ink-soft" aria-hidden />
        </Link>
      )}
      {rule}
      <Link href="/workflows" className={row}>
        <FiGrid size={15} className="text-nb-ink-soft" aria-hidden />
        {T.flows.title}
      </Link>
      {current && (
        <Link href={triageHref(current)} className={row}>
          <FiInbox size={15} className="text-nb-ink-soft" aria-hidden />
          <span className="flex-1">{T.triage.title}</span>
          {openTriage(store) > 0 && <span className="text-[12px] font-[700] tabular-nums text-nb-crimson">{openTriage(store)}</span>}
        </Link>
      )}
      <Link href="/stats" className={row}>
        <FiBarChart2 size={15} className="text-nb-ink-soft" aria-hidden />
        {T.stats.title}
      </Link>
      <Link href={archiveHref} className={row}>
        <FiArchive size={15} className="text-nb-ink-soft" aria-hidden />
        {T.archive}
      </Link>
      <Link href="/settings/workspace" className={row}>
        <FiUsers size={15} className="text-nb-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{T.ws.settings}</span>
        <span className="truncate text-[12px] text-nb-ink-soft">{wsName(store.ws)}</span>
        <FiChevronRight size={14} className="text-nb-ink-soft" aria-hidden />
      </Link>
      {rule}
      <span className={group}>{T.account}</span>
      <button type="button" onClick={() => openSettings()} className={row}>
        <FiSettings size={15} className="text-nb-ink-soft" aria-hidden />
        {T.settings}
      </button>
      <button type="button" onClick={() => openSettings("billing")} className={row}>
        <FiCreditCard size={15} className="text-nb-ink-soft" aria-hidden />
        {T.billing.section}
      </button>
      <span className={cn(row, "cursor-default")}>
        <FiGlobe size={15} className="text-nb-ink-soft" aria-hidden />
        <span className="flex-1">{T.language}</span>
        <LangSelect phone />
      </span>
      {rule}
      <button type="button" onClick={signOut} className={row}>
        <FiLogOut size={15} className="text-nb-ink-soft" aria-hidden />
        {T.signOut}
      </button>
    </div>
  );
}
