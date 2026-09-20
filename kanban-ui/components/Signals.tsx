"use client";

// Triage (#453, #559, #560, #894) — a queue you empty. Every item waiting in
// `docs/kanban/triage/` leaves it one of two ways: **Make card** starts a create run pointed at
// the item, and **Ignore** records the user's reason. Items arrive on their own — follow-ups
// from finished cards, and connected sources; a person asking for work uses **New task**.
//
// Items are grouped by source: a source type when one was given, otherwise the card an item
// names as its source (`meta.source: "#706"`), linked. The two actions show on the one item in
// focus, so the list reads as titles. **History** is what became a card or was ignored over the
// last 30 days, and an ignored item there can be restored.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FiAlertCircle,
  FiChevronDown,
  FiChevronRight,
  FiCornerDownRight,
  FiExternalLink,
  FiInbox,
  FiRotateCcw,
  FiSearch,
  FiX,
  FiZap,
} from "react-icons/fi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  dismissSignalAction,
  makeCardAction,
  restoreSignalAction,
  sortTriageAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { useLanguage } from "@/components/language";
import {
  LANGUAGE_TAGS,
  type AgentInfo,
  type Language,
  type MemoryOwner,
  type SessionView,
  type Signal,
  type SignalInbox,
} from "@/lib/types";
import { Button } from "./button";
import { CHROME, HAIRLINE } from "./chrome";
import { configDialog } from "./Configuration";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import { useOverRail } from "@/lib/over-rail";
import { useSheetUp } from "@/lib/create-open";
import { SidePane } from "@/lib/side-pane";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";
import { reloadSignalsRow } from "./signals-row";
import { SourceMark, sourceName } from "./signal-sources";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Window } from "./Window";

type Tab = "pending" | "history";

// Radix will not take an empty string as a value, and the empty string is already the key of
// the group nothing named a source for — so the picker carries two words of its own.
const EVERY = "*";
const NONE = "-";

/** How much of a group is drawn before **More**, and how much each press brings in. */
const FIRST = 6;
const MORE = 12;

/** How long an item that became a card takes to fade out of the queue. */
const FADE_MS = 400;

const GHOST_ACT =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-accent-deep transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11 max-md:px-3";
const GHOST_INK =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-ink-soft transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] hover:text-nb-ink focus-visible:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11 max-md:px-3";
const LINK =
  "cursor-pointer text-[12px] font-[700] text-nb-accent-deep underline underline-offset-2";

// A stamp is `YYYY-MM-DD HH:MM` in the board's own local time, drawn in the app's language.
function when(stamp: string, language: Language): string {
  const at = new Date(stamp.replace(" ", "T"));
  if (Number.isNaN(at.getTime())) return stamp;
  return at.toLocaleString(LANGUAGE_TAGS[language], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A stamp as a number to sort on. One that will not read sorts last. */
function order(stamp: string): number {
  const at = new Date(stamp.replace(" ", "T")).getTime();
  return Number.isNaN(at) ? -Infinity : at;
}

/** When an item was judged: made into a card, or ignored. */
const judgedAt = (signal: Signal): string => signal.archivedAt || signal.dismissedAt;

/** The card an item names as its source — `meta.source: "#706"` — or null. */
function sourceCard(signal: Signal): number | null {
  const said = signal.meta.find((pair) => pair.key === "source")?.value.trim() ?? "";
  const m = said.match(/^#(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** The group an item sits in: its source type, the card it came from, or none. */
function groupOf(signal: Signal): string {
  if (signal.sourceType) return signal.sourceType;
  const card = sourceCard(signal);
  return card === null ? "" : `#${card}`;
}

const cardOfGroup = (key: string): number | null =>
  key.startsWith("#") ? Number(key.slice(1)) : null;

function matches(signal: Signal, query: string): boolean {
  if (!query) return true;
  const parts = [
    signal.title,
    signal.summary,
    signal.sourceType,
    signal.dismissedReason,
    ...(signal.contentKept ? [] : [signal.sourceId]),
    ...signal.meta.map((pair) => pair.value),
  ];
  return parts.some((part) => part.toLowerCase().includes(query));
}

interface Group {
  key: string;
  items: Signal[];
}

/** Source types in the board's own order, then other types by key, then card groups newest
 *  card first, then the one group nothing named a source for. */
function groupBySource(signals: Signal[], listed: string[]): Group[] {
  const by = new Map<string, Signal[]>();
  for (const signal of signals) {
    const key = groupOf(signal);
    const held = by.get(key);
    if (held) held.push(signal);
    else by.set(key, [signal]);
  }
  const known = new Set(listed);
  const keys = [...by.keys()];
  const order = [
    ...listed.filter((type) => by.has(type)),
    ...keys.filter((key) => key && !key.startsWith("#") && !known.has(key)).sort(),
    ...keys
      .filter((key) => key.startsWith("#"))
      .sort((a, b) => cardOfGroup(b)! - cardOfGroup(a)!),
    ...(by.has("") ? [""] : []),
  ];
  return order.map((key) => ({ key, items: by.get(key)! }));
}

const cardHref = (id: number, archived: boolean) => (archived ? `/archive/${id}` : `/${id}`);

// --- the page ---------------------------------------------------------------

function SignalsFrame({
  projectRoot,
  openIds,
  agent,
  goalWritten,
  memoryOwners,
  desktop,
  sessions,
  children,
}: {
  projectRoot: string;
  openIds: number[];
  agent: AgentInfo;
  goalWritten: boolean;
  memoryOwners: MemoryOwner[];
  desktop: boolean;
  sessions: SessionView[];
  children: React.ReactNode;
}) {
  return (
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentSignals
        memoryOwners={memoryOwners}
        goalWritten={goalWritten}
        running={runningCardIds(sessions)}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            goalWritten={goalWritten}
            desktop={desktop}
          />
        }
      >
        {children}
      </Window>
    </OpenIdsProvider>
  );
}

export function SignalsPage({
  inbox,
  openIds,
  agent,
  projectRoot,
  goalWritten,
  memoryOwners,
  desktop,
}: {
  inbox: SignalInbox;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  goalWritten: boolean;
  memoryOwners: MemoryOwner[];
  desktop: boolean;
}) {
  const c = useCopy().rail.signals;
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  // The page keeps up with runs: a card being made, a sort, and the pull all write the files
  // this page lists.
  const noRunsOfOurOwn = useCallback(() => {}, []);
  const { sessions, kick } = useAgentSessions(noRunsOfOurOwn);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(
      sessions.filter((r) => r.status === "running").map((r) => r.sessionId),
    );
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);
  useOnTabFocus(refresh);

  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(EVERY);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const switchTab = (next: Tab) => {
    setTab(next);
    setOpen(null);
  };
  const [focused, setFocused] = useState<string | null>(null);
  // Held only so a card leaves its tab the instant it is judged or restored — `p:<id>` off
  // Waiting, `h:<id>` off History — and dropped once the server's list agrees.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const hide = (mark: string) => setGone((was) => new Set(was).add(mark));
  const unhide = (mark: string) =>
    setGone((was) => {
      const next = new Set(was);
      next.delete(mark);
      return next;
    });
  const [failed, setFailed] = useState("");
  // Make card pressed in the detail and refused: said there, under its button.
  const [detailFailed, setDetailFailed] = useState("");
  const searchBox = useRef<HTMLInputElement>(null);
  const [ignoring, setIgnoring] = useState<Signal | null>(null);
  const ignoreBack = useRef<HTMLElement | null>(null);

  // Make card: pressed and not yet answered, then started and not yet in the poll.
  const [starting, setStarting] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState<Record<string, string>>({});
  const [sortStarting, setSortStarting] = useState(false);
  const [sortNote, setSortNote] = useState<"closed" | "refused" | null>(null);

  const making = useMemo(() => {
    const ids = new Set(starting);
    for (const run of sessions) {
      if (run.status === "running" && run.triage) ids.add(run.triage);
    }
    for (const [sourceId, sessionId] of Object.entries(started)) {
      if (!sessions.some((run) => run.sessionId === sessionId)) ids.add(sourceId);
    }
    return ids;
  }, [sessions, starting, started]);
  const sorting =
    sortStarting || sessions.some((run) => run.action === "triage" && run.status === "running");

  // A started run the poll has seen answers for itself from here on.
  useEffect(() => {
    setStarted((was) => {
      const kept = Object.fromEntries(
        Object.entries(was).filter(([, id]) => !sessions.some((run) => run.sessionId === id)),
      );
      return Object.keys(kept).length === Object.keys(was).length ? was : kept;
    });
  }, [sessions]);

  // An item that was being made into a card and has left the queue fades out rather than
  // vanishing — never for less motion.
  const [leaving, setLeaving] = useState<Signal[]>([]);
  const before = useRef<Signal[]>(inbox.signals);
  const everMaking = useRef<Set<string>>(new Set());
  useEffect(() => {
    making.forEach((id) => everMaking.current.add(id));
  }, [making]);
  useEffect(() => {
    const was = before.current;
    before.current = inbox.signals;
    const still = new Set(inbox.signals.map((s) => s.sourceId));
    const left = was.filter((s) => !still.has(s.sourceId) && everMaking.current.has(s.sourceId));
    left.forEach((s) => everMaking.current.delete(s.sourceId));
    if (left.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLeaving((cur) => [...cur, ...left]);
    setTimeout(() => setLeaving((cur) => cur.filter((s) => !left.includes(s))), FADE_MS);
  }, [inbox.signals]);

  const leavingIds = useMemo(() => new Set(leaving.map((s) => s.sourceId)), [leaving]);
  const waiting = useMemo(
    () => [...inbox.signals, ...leaving].filter((s) => !gone.has(`p:${s.sourceId}`)),
    [inbox.signals, leaving, gone],
  );
  const judged = useMemo(
    () => [...inbox.archived, ...inbox.dismissed].filter((s) => !gone.has(`h:${s.sourceId}`)),
    [inbox.archived, inbox.dismissed, gone],
  );
  useEffect(() => {
    const listed = new Set([
      ...inbox.signals.map((s) => `p:${s.sourceId}`),
      ...[...inbox.archived, ...inbox.dismissed].map((s) => `h:${s.sourceId}`),
    ]);
    setGone((was) => {
      const kept = new Set([...was].filter((mark) => listed.has(mark)));
      return kept.size === was.size ? was : kept;
    });
  }, [inbox.signals, inbox.archived, inbox.dismissed]);
  const all = useMemo(() => {
    const held = tab === "pending" ? waiting : judged;
    const stamp = tab === "history" ? judgedAt : (s: Signal) => s.collectedAt;
    return [...held].sort(
      (a, b) => order(stamp(b)) - order(stamp(a)) || a.sourceId.localeCompare(b.sourceId),
    );
  }, [tab, waiting, judged]);

  const needle = query.trim().toLowerCase();
  const picked = source === NONE ? "" : source;
  const narrowed = useMemo(
    () =>
      all.filter(
        (signal) =>
          matches(signal, needle) && (source === EVERY || groupOf(signal) === picked),
      ),
    [all, needle, source, picked],
  );
  const groups = useMemo(
    () => groupBySource(narrowed, inbox.sourceTypes),
    [narrowed, inbox.sourceTypes],
  );
  const sources = useMemo(
    () => groupBySource(all, inbox.sourceTypes).map((group) => group.key),
    [all, inbox.sourceTypes],
  );
  const groupName = (key: string) => {
    const card = cardOfGroup(key);
    if (card === null) return sourceName(key, c.noSource);
    const title = inbox.cards[card]?.title;
    return title ? `#${card} ${title}` : `#${card}`;
  };

  const searching = needle.length > 0;
  const isFolded = (key: string) => !searching && folded.has(`${tab}:${key}`);
  const fold = (key: string) =>
    setFolded((was) => {
      const next = new Set(was);
      const at = `${tab}:${key}`;
      if (!next.delete(at)) next.add(at);
      return next;
    });

  useEffect(() => setShown({}), [tab, needle, source]);
  useEffect(() => setSortNote(null), [tab]);

  const narrowing = searching || source !== EVERY;
  const clear = () => {
    setQuery("");
    setSource(EVERY);
  };

  const makeCard = async (signal: Signal, fromDetail = false) => {
    const { sourceId } = signal;
    if (making.has(sourceId) || sorting) return;
    setFailed("");
    setDetailFailed("");
    setStarting((was) => new Set(was).add(sourceId));
    const done = await makeCardAction(sourceId).catch(() => ({
      ok: false,
      sessionId: undefined,
    }));
    setStarting((was) => {
      const next = new Set(was);
      next.delete(sourceId);
      return next;
    });
    if (!done.ok || !done.sessionId) {
      if (fromDetail) setDetailFailed(c.makeFailed);
      else setFailed(c.makeFailed);
      return;
    }
    setStarted((was) => ({ ...was, [sourceId]: done.sessionId! }));
    kick();
    if (fromDetail && openNow.current === sourceId) closeDetail();
  };

  const askIgnore = (signal: Signal) => {
    ignoreBack.current = document.activeElement as HTMLElement | null;
    setIgnoring(signal);
  };

  const closeIgnore = () => {
    setIgnoring(null);
    const back = ignoreBack.current;
    requestAnimationFrame(() => back?.focus());
  };

  /** Ignore with the reason typed; false keeps the dialog and what was typed. */
  const ignore = async (signal: Signal, reason: string): Promise<boolean> => {
    const flat = groups.flatMap((group) =>
      isFolded(group.key) ? [] : group.items.map((s) => s.sourceId),
    );
    const at = flat.indexOf(signal.sourceId);
    const near = flat[at + 1] ?? flat[at - 1] ?? "";

    const done = await dismissSignalAction(signal.sourceId, reason).catch(() => ({
      ok: false,
    }));
    if (!done.ok) return false;
    hide(`p:${signal.sourceId}`);
    setIgnoring(null);
    setOpen(null);
    setFailed("");
    requestAnimationFrame(() => document.getElementById(`signal-${near}`)?.focus());
    reloadSignalsRow();
    refresh();
    return true;
  };

  const restore = async (signal: Signal) => {
    hide(`h:${signal.sourceId}`);
    const done = await restoreSignalAction(signal.sourceId).catch(() => ({
      ok: false,
      error: c.restoreFailed,
    }));
    if (!done.ok) {
      unhide(`h:${signal.sourceId}`);
      setFailed(done.error ?? c.restoreFailed);
      return;
    }
    setFailed("");
    reloadSignalsRow();
    refresh();
  };

  const sortAll = async () => {
    if (sorting) return;
    setSortNote(null);
    setSortStarting(true);
    const done = await sortTriageAction().catch(() => ({ ok: false, closed: false }));
    setSortStarting(false);
    if (!done.ok) {
      setSortNote("closed" in done && done.closed ? "closed" : "refused");
      return;
    }
    kick();
  };

  const opened = open ? all.find((signal) => signal.sourceId === open) : undefined;
  const openNow = useRef(open);
  openNow.current = open;

  /** Close the detail and hand focus back to its item, or to the search box when a search
   *  has hidden it. */
  const closeDetail = useCallback(() => {
    const back = openNow.current;
    setOpen(null);
    requestAnimationFrame(() => {
      const row = back ? document.getElementById(`signal-${back}`) : null;
      (row ?? searchBox.current)?.focus();
    });
  }, []);
  const dropDetail = useCallback(() => setOpen(null), []);

  useEffect(() => setDetailFailed(""), [open]);
  // Anything that takes the reader elsewhere lets go of the item, and it does not come back.
  const sheetUp = useSheetUp();
  useEffect(() => {
    if (sheetUp) setOpen(null);
  }, [sheetUp]);

  // The open item left the list — made into a card, ignored, sorted away, restored: close it
  // and move focus to its neighbour.
  const flat = useMemo(() => groups.flatMap((g) => g.items.map((s) => s.sourceId)), [groups]);
  const flatBefore = useRef(flat);
  useEffect(() => {
    const was = flatBefore.current;
    flatBefore.current = flat;
    if (!open || all.some((signal) => signal.sourceId === open)) return;
    const still = new Set(flat);
    const at = was.indexOf(open);
    const near =
      at < 0
        ? flat[0]
        : [...was.slice(at + 1), ...was.slice(0, at).reverse()].find((id) => still.has(id));
    setOpen(null);
    requestAnimationFrame(() =>
      ((near && document.getElementById(`signal-${near}`)) || searchBox.current)?.focus(),
    );
  }, [flat, all, open]);

  // The list reflows as the rail opens and closes: keep the item in view.
  const lastOpen = useRef<string | null>(null);
  useEffect(() => {
    const id = open ?? lastOpen.current;
    lastOpen.current = open;
    if (!id) return;
    let next = 0;
    const first = requestAnimationFrame(() => {
      next = requestAnimationFrame(() =>
        document.getElementById(`signal-${id}`)?.scrollIntoView({ block: "nearest" }),
      );
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(next);
    };
  }, [open]);

  const detailSource = (signal: Signal) => {
    const key = groupOf(signal);
    const card = cardOfGroup(key);
    return (
      <SourceLabel
        group={key}
        name={groupName(key)}
        card={card}
        cardRef={card === null ? undefined : inbox.cards[card]}
      />
    );
  };
  const detail = opened ? (
      <SignalDetail
        signal={opened}
        history={tab === "history"}
        source={detailSource(opened)}
        card={opened.cardId !== null ? inbox.cards[opened.cardId] : undefined}
        making={making.has(opened.sourceId)}
        sorting={sorting}
        paused={!!ignoring}
        failed={detailFailed}
        onClose={closeDetail}
        onMake={() => void makeCard(opened, true)}
        onIgnore={() => askIgnore(opened)}
        onRestore={() => void restore(opened)}
      />
    ) : null;
  const unconfigured = inbox.missing.length > 0;
  const hasHistory = inbox.archived.length + inbox.dismissed.length > 0;

  return (
    <SignalsFrame
      projectRoot={projectRoot}
      openIds={openIds}
      agent={agent}
      goalWritten={goalWritten}
      memoryOwners={memoryOwners}
      desktop={desktop}
      sessions={sessions}
    >
      <div className="relative flex h-full min-h-0 flex-col">
        <RunningNotice desktop={desktop} />
        <SidePane onClose={dropDetail} onCovered={dropDetail}>
          {detail}
        </SidePane>

        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-2.5 max-md:px-4">
          <span className="inline-flex h-8 shrink-0 items-center gap-5">
            <TabButton
              label={c.pending}
              count={waiting.length - leaving.length}
              on={tab === "pending"}
              onClick={() => switchTab("pending")}
            />
            <TabButton
              label={c.history}
              on={tab === "history"}
              onClick={() => switchTab("history")}
            />
          </span>
          {tab === "history" && (
            <span className="shrink-0 text-[11.5px] text-nb-ink-soft max-md:hidden">
              {c.window(inbox.dismissedDays)}
            </span>
          )}
          {narrowing && (
            <span className="shrink-0 text-[11.5px] tabular-nums text-nb-ink-soft">
              {c.hits(narrowed.length, all.length)}
            </span>
          )}
          <label className="relative ml-auto inline-flex h-7 min-w-0 shrink items-center">
            <FiSearch size={13} className="absolute left-2.5 text-nb-ink-soft" aria-hidden />
            <input
              ref={searchBox}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.search}
              aria-label={c.search}
              className="h-7 w-[180px] min-w-[92px] rounded-[8px] bg-nb-wash pl-7 pr-2.5 text-[12px] text-nb-ink placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none max-md:w-[120px]"
            />
          </label>

          <Select value={source} onValueChange={setSource}>
            <SelectTrigger
              aria-label={c.allSources}
              className="h-7 w-auto max-w-[180px] shrink-0 gap-1.5 rounded-[8px] border-0 bg-transparent px-1 py-0 text-[12px] font-[600] text-nb-ink-soft shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EVERY}>{c.allSources}</SelectItem>
              {sources.map((key) => (
                <SelectItem key={key || NONE} value={key || NONE}>
                  <span className="block max-w-[260px] truncate">{groupName(key)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tab === "pending" && waiting.length > 0 && (
            <SortAll
              sorting={sorting}
              note={sortNote}
              onSort={() => void sortAll()}
              onDismissNote={() => setSortNote(null)}
            />
          )}
        </div>

        {failed && (
          <div className="shrink-0 px-6 pt-2.5 max-md:px-4">
            <p className="rounded-[9px] bg-nb-peach-soft px-3.5 py-2 text-[12px] leading-[16px] text-nb-ink">
              {failed}
            </p>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          {/* The list measures itself, so the rail opening or widening reflows the columns. */}
          <div className="@container flex h-full flex-col overflow-y-auto px-6 pb-6 pt-3 max-md:px-4">
            {groups.length === 0 ? (
              narrowing ? (
                <Empty title={c.noHits} searched>
                  <button type="button" onClick={clear} className={LINK}>
                    {c.clear}
                  </button>
                </Empty>
              ) : tab === "history" ? (
                <Empty title={c.emptyHistory} hint={c.emptyHistoryHint} />
              ) : (
                <Empty title={c.empty} hint={c.emptyHint}>
                  {(unconfigured || hasHistory) && (
                    <span className="inline-flex items-center gap-4">
                      {unconfigured && <EndpointLink label={c.connect} />}
                      {hasHistory && (
                        <button type="button" onClick={() => switchTab("history")} className={LINK}>
                          {c.seeHistory}
                        </button>
                      )}
                    </span>
                  )}
                </Empty>
              )
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map((group) => (
                  <SourceSection
                    key={group.key || "none"}
                    group={group}
                    name={groupName(group.key)}
                    card={cardOfGroup(group.key)}
                    cardRef={inbox.cards[cardOfGroup(group.key) ?? -1]}
                    folded={isFolded(group.key)}
                    shown={shown[`${tab}:${group.key}`] ?? FIRST}
                    onFold={() => fold(group.key)}
                    onMore={() =>
                      setShown((was) => ({
                        ...was,
                        [`${tab}:${group.key}`]: (was[`${tab}:${group.key}`] ?? FIRST) + MORE,
                      }))
                    }
                  >
                    {(signal) =>
                      tab === "history" ? (
                        <HistoryCard
                          key={signal.sourceId}
                          signal={signal}
                          selected={open === signal.sourceId}
                          card={signal.cardId !== null ? inbox.cards[signal.cardId] : undefined}
                          onOpen={() => setOpen(signal.sourceId)}
                          onRestore={() => void restore(signal)}
                        />
                      ) : (
                        <QueueCard
                          key={signal.sourceId}
                          signal={signal}
                          selected={open === signal.sourceId}
                          focused={focused === signal.sourceId}
                          making={making.has(signal.sourceId)}
                          leaving={leavingIds.has(signal.sourceId)}
                          sorting={sorting}
                          onFocus={() => setFocused(signal.sourceId)}
                          onBlur={() =>
                            setFocused((was) => (was === signal.sourceId ? null : was))
                          }
                          onOpen={() => setOpen(signal.sourceId)}
                          onMake={() => void makeCard(signal)}
                          onIgnore={() => askIgnore(signal)}
                        />
                      )
                    }
                  </SourceSection>
                ))}
              </div>
            )}
          </div>
        </div>

        {ignoring && (
          <IgnoreDialog
            signal={ignoring}
            onCancel={closeIgnore}
            onIgnore={(reason) => ignore(ignoring, reason)}
          />
        )}
      </div>
    </SignalsFrame>
  );
}

/** Where to read about serving and pointing at an endpoint. */
const ENDPOINT_DOCS = "https://ai4kanban.dev/docs/triage-endpoint";

/** A page with nothing on it: one centered block, no frame. */
function Empty({
  title,
  hint,
  searched,
  children,
}: {
  title: string;
  hint?: string;
  searched?: boolean;
  children?: ReactNode;
}) {
  const Mark = searched ? FiSearch : FiInbox;
  return (
    <div className="m-auto flex max-w-[420px] flex-col items-center px-4 py-10 text-center">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-[12px] bg-nb-peach-soft ${CHROME}`}
      >
        <Mark size={18} aria-hidden />
      </span>
      <p className="mt-3 text-[14px] font-[800] tracking-[-0.01em]">{title}</p>
      {hint && <p className="mt-1 text-[12.5px] leading-relaxed text-nb-ink-soft">{hint}</p>}
      {children && <span className="mt-3 inline-flex">{children}</span>}
    </div>
  );
}

function EndpointLink({ label }: { label: string }) {
  return (
    <a
      href={ENDPOINT_DOCS}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 ${LINK}`}
    >
      {label}
      <FiExternalLink size={11} aria-hidden />
    </a>
  );
}

/** One of the two tabs: an underline, not a pill. */
function TabButton({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count?: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-full cursor-pointer items-center gap-1.5 border-b-2 text-[13px] font-[700] transition-colors ${
        on ? "border-nb-accent text-nb-ink" : "border-transparent text-nb-ink-soft hover:text-nb-ink"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="text-[12px] font-[400] tabular-nums text-nb-ink-soft">{count}</span>
      )}
    </button>
  );
}

/** **Sort all**, and — under it — why a sort would not start. */
function SortAll({
  sorting,
  note,
  onSort,
  onDismissNote,
}: {
  sorting: boolean;
  note: "closed" | "refused" | null;
  onSort: () => void;
  onDismissNote: () => void;
}) {
  const c = useCopy().rail.signals;
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!note) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismissNote();
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onDismissNote();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [note, onDismissNote]);

  return (
    <span ref={box} className="relative inline-flex shrink-0">
      <Button
        size="xs"
        variant="ghost"
        disabled={sorting}
        onClick={onSort}
        className="disabled:opacity-70"
      >
        {!sorting && <FiZap size={13} aria-hidden />}
        {sorting ? c.sorting : c.sortAll}
      </Button>
      {note && (
        <span
          role="status"
          className="nb-panel-sm absolute right-0 top-[calc(100%+8px)] z-40 flex w-[260px] flex-col items-start gap-1.5 bg-nb-paper px-3 py-2.5 text-[12px] leading-[17px]"
        >
          {note === "closed" ? c.sortClosed : c.sortRefused}
          {note === "refused" && (
            <button
              type="button"
              className={LINK}
              onClick={() => {
                onDismissNote();
                configDialog.open("workflows");
              }}
            >
              {c.openConfig}
            </button>
          )}
        </span>
      )}
    </span>
  );
}

/** One group: its source — or the card it came from, linked — once, then its items. */
function SourceSection({
  group,
  name,
  card,
  cardRef,
  folded,
  shown,
  onFold,
  onMore,
  children,
}: {
  group: Group;
  name: string;
  card: number | null;
  /** The card's title and where it is — absent when the board no longer holds it. */
  cardRef?: { title: string; archived: boolean };
  folded: boolean;
  shown: number;
  onFold: () => void;
  onMore: () => void;
  children: (signal: Signal) => ReactNode;
}) {
  const c = useCopy().rail.signals;
  const drawn = folded ? [] : group.items.slice(0, shown);

  return (
    <section>
      <div className="mb-2 flex h-6 w-full items-center gap-2 text-[12px] font-[700] text-nb-ink-soft">
        <button
          type="button"
          onClick={onFold}
          aria-expanded={!folded}
          aria-label={`${name} ${folded ? c.unfold : c.fold}`}
          className="-ml-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]"
        >
          {folded ? <FiChevronRight size={13} aria-hidden /> : <FiChevronDown size={13} aria-hidden />}
        </button>
        <SourceLabel group={group.key} name={name} card={card} cardRef={cardRef} />
        {folded && (
          <span className="shrink-0 font-[400] tabular-nums">{group.items.length}</span>
        )}
        <span className="ml-1 h-px min-w-6 flex-1" style={{ background: HAIRLINE }} />
      </div>
      {!folded && (
        <>
          <ul
            aria-label={name}
            className="grid grid-cols-1 gap-3 @min-[520px]:grid-cols-2 @min-[900px]:grid-cols-3"
          >
            {drawn.map((signal) => children(signal))}
          </ul>
          {group.items.length > drawn.length && (
            <button
              type="button"
              onClick={onMore}
              className="mt-1.5 inline-flex h-7 cursor-pointer items-center text-[12px] font-[700] text-nb-accent-deep"
            >
              {c.more}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Where an item came from, drawn the way its group is: the card, linked, or the source. */
function SourceLabel({
  group,
  name,
  card,
  cardRef,
}: {
  group: string;
  name: string;
  card: number | null;
  cardRef?: { title: string; archived: boolean };
}) {
  if (card !== null && cardRef) {
    return (
      <Link
        href={cardHref(card, cardRef.archived)}
        className="inline-flex min-w-0 items-center gap-1.5 font-[700] text-nb-ink hover:underline hover:underline-offset-2"
      >
        <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-nb-ink-soft">#{card}</span>
        <span className="truncate">{cardRef.title}</span>
      </Link>
    );
  }
  if (card !== null) {
    return <span className="font-mono text-[11.5px] tabular-nums text-nb-ink-soft">#{card}</span>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-[700] text-nb-ink">
      <SourceMark type={group} size={14} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The title an item is read by: its own, or — for a record whose words were never kept —
 *  its source id. Two lines at most, and a long unbroken string wraps. */
function ItemTitle({ signal }: { signal: Signal }) {
  return signal.contentKept ? (
    <span className="line-clamp-2 text-[13px] font-[600] leading-[19px] [overflow-wrap:anywhere]">
      {signal.title}
    </span>
  ) : (
    <span className="line-clamp-2 font-mono text-[12px] font-[600] leading-[19px] text-nb-ink-soft [overflow-wrap:anywhere]">
      {signal.sourceId}
    </span>
  );
}

// One size for every card, and the foot row is always there, so hover, focus, selection and
// making never move the grid.
const CARD =
  "flex h-[108px] w-full flex-col rounded-[10px] border-[1.5px] transition-colors max-md:h-[128px]";
const CARD_BODY = "flex min-h-0 flex-1 flex-col px-3 pt-2.5";
const CARD_FOOT = "flex h-8 shrink-0 items-center gap-1 px-1.5 pb-1.5 max-md:h-[52px]";
const INK_SHADOW = "shadow-[2px_2px_0_0_var(--color-nb-ink)]";

function cardTone(selected: boolean, hot: boolean): string {
  if (selected)
    return "border-nb-accent-deep bg-nb-accent-soft shadow-[2px_2px_0_0_var(--color-nb-accent-deep)]";
  return `${hot ? "border-nb-accent" : "border-nb-ink"} bg-nb-paper ${INK_SHADOW}`;
}

/** Hover and keyboard focus both light a card; it goes dark only once neither holds it. */
function useHot(onFocus: () => void, onBlur: () => void) {
  const hovered = useRef(false);
  return {
    onMouseEnter: () => {
      hovered.current = true;
      onFocus();
    },
    onMouseLeave: (e: React.MouseEvent<HTMLLIElement>) => {
      hovered.current = false;
      if (!e.currentTarget.contains(document.activeElement)) onBlur();
    },
    onFocus,
    onBlur: (e: React.FocusEvent<HTMLLIElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !hovered.current) onBlur();
    },
  };
}

/** One waiting item: its title and summary, and — only while it is in focus and not the
 *  one open in the detail — its two ways out. */
function QueueCard({
  signal,
  selected,
  focused,
  making,
  leaving,
  sorting,
  onFocus,
  onBlur,
  onOpen,
  onMake,
  onIgnore,
}: {
  signal: Signal;
  selected: boolean;
  focused: boolean;
  making: boolean;
  leaving: boolean;
  sorting: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onOpen: () => void;
  onMake: () => void;
  onIgnore: () => void;
}) {
  const c = useCopy().rail.signals;
  const hot = useHot(onFocus, onBlur);
  // A tap on a touch screen selects the item first, the way a hover does; the next opens it.
  const tapped = useRef(false);
  const act = focused && !selected && !making && !leaving;

  return (
    <li className="min-w-0" {...hot}>
      <div
        data-focused={act || undefined}
        className={`${CARD} ${
          making && !leaving
            ? `a4k-triage-making border-nb-ink bg-nb-accent-wash ${INK_SHADOW}`
            : cardTone(selected, focused && !leaving)
        } ${leaving ? "a4k-triage-leaving" : ""}`}
      >
        <button
          type="button"
          id={`signal-${signal.sourceId}`}
          aria-current={selected || undefined}
          onPointerDown={(e) => {
            tapped.current = e.pointerType === "touch" && !focused;
          }}
          onClick={() => {
            if (tapped.current) {
              tapped.current = false;
              onFocus();
              return;
            }
            onOpen();
          }}
          className={`${CARD_BODY} cursor-pointer text-left focus-visible:outline-none`}
        >
          <ItemTitle signal={signal} />
          {signal.summary && (
            <span className="mt-0.5 block w-full truncate text-[12px] leading-[18px] text-nb-ink-soft">
              {signal.summary}
            </span>
          )}
        </button>
        <div className={CARD_FOOT}>
          {making ? (
            <span className="truncate px-1.5 text-[12px] font-[600] text-nb-accent-deep">
              {c.making}
            </span>
          ) : act ? (
            <>
              <button type="button" className={GHOST_ACT} disabled={sorting} onClick={onMake}>
                {c.makeCard}
              </button>
              <button type="button" className={GHOST_INK} onClick={onIgnore}>
                {c.ignore}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** One judged item: what it became — a linked card, or the reason it was ignored — and, for
 *  an ignored one no card was made of, the way back while it is in focus. */
function HistoryCard({
  signal,
  selected,
  card,
  onOpen,
  onRestore,
}: {
  signal: Signal;
  selected: boolean;
  card?: { title: string; archived: boolean };
  onOpen: () => void;
  onRestore: () => void;
}) {
  const c = useCopy().rail.signals;
  const language = useLanguage();
  const [focused, setFocused] = useState(false);
  const hot = useHot(
    () => setFocused(true),
    () => setFocused(false),
  );
  const tapped = useRef(false);
  const at = judgedAt(signal) ? when(judgedAt(signal), language) : "";
  const who = signal.dismissedBy === "agent" ? c.byAgent : signal.dismissedBy === "user" ? c.byYou : "";
  const became = signal.cardId !== null;
  const restorable = !became && signal.contentKept;

  return (
    <li className="min-w-0" {...hot}>
      <div className={`${CARD} ${cardTone(selected, focused)}`}>
        <div className={CARD_BODY}>
          <button
            type="button"
            id={`signal-${signal.sourceId}`}
            aria-current={selected || undefined}
            onPointerDown={(e) => {
              tapped.current = e.pointerType === "touch" && !focused && restorable;
            }}
            onClick={() => {
              if (tapped.current) {
                tapped.current = false;
                setFocused(true);
                return;
              }
              onOpen();
            }}
            className="cursor-pointer text-left focus-visible:outline-none"
          >
            <ItemTitle signal={signal} />
          </button>
          {became && card ? (
            <Link
              href={cardHref(signal.cardId!, card.archived)}
              className="mt-0.5 inline-flex min-w-0 items-center gap-1 text-[12px] font-[700] leading-[18px] text-nb-accent-deep hover:underline focus-visible:underline focus-visible:outline-none"
            >
              <FiCornerDownRight size={12} className="shrink-0" aria-hidden />
              <span className="truncate">
                #{signal.cardId} {card.title}
              </span>
            </Link>
          ) : became ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-[700] leading-[18px] text-nb-ink-soft">
              <FiCornerDownRight size={12} className="shrink-0" aria-hidden />#{signal.cardId}
            </p>
          ) : (
            signal.dismissedReason && (
              <p className="mt-0.5 truncate text-[12px] leading-[18px] text-nb-ink">
                {signal.dismissedReason}
              </p>
            )
          )}
        </div>
        <div className={CARD_FOOT}>
          <span className="min-w-0 truncate pl-1.5 text-[11px] tabular-nums text-nb-ink-soft">
            {[became ? "" : who, at].filter(Boolean).join(" · ")}
          </span>
          {restorable && focused && !selected && (
            <button type="button" className={`${GHOST_ACT} ml-auto shrink-0`} onClick={onRestore}>
              <FiRotateCcw size={12} aria-hidden />
              {c.restore}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/** One item in full, in the window's right rail — and, while it is open, where its actions
 *  are. The title and the actions stay put; only what is under them scrolls. */
function SignalDetail({
  signal,
  history,
  source,
  card,
  making,
  sorting,
  paused,
  failed,
  onClose,
  onMake,
  onIgnore,
  onRestore,
}: {
  signal: Signal;
  history: boolean;
  source: ReactNode;
  card?: { title: string; archived: boolean };
  making: boolean;
  sorting: boolean;
  /** The Ignore dialog is over it and takes Escape. */
  paused: boolean;
  failed: string;
  onClose: () => void;
  onMake: () => void;
  onIgnore: () => void;
  onRestore: () => void;
}) {
  const copy = useCopy();
  const c = copy.rail.signals;
  const language = useLanguage();
  const closer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closer.current?.focus({ preventScroll: true });
  }, [signal.sourceId]);

  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, paused]);

  const line = (label: string, said: ReactNode) =>
    said ? (
      <p className="text-[12px] leading-[18px] text-nb-ink-soft">
        <span className="font-[700]">{label}</span> {said}
      </p>
    ) : null;
  const who =
    signal.dismissedBy === "agent" ? c.byAgent : signal.dismissedBy === "user" ? c.byYou : "";
  const restorable = history && signal.cardId === null && signal.contentKept;
  const acts = !history || restorable || !!signal.url;
  const title = signal.contentKept ? signal.title : signal.sourceId;
  const tap = "h-8 max-md:h-11";
  // The source is in the header already.
  const meta = signal.meta
    .filter((pair) => pair.key !== "source")
    .map((pair) => pair.value)
    .join(" · ");

  return (
    <aside aria-label={c.detail} className="flex h-full flex-col bg-nb-cream">
      <div className="flex shrink-0 items-center gap-2 py-2.5 pl-6 pr-4 max-md:pl-4 max-md:pr-2">
        <span className="flex h-8 min-w-0 flex-1 items-center gap-1.5 text-[12px]">
          {source}
          {signal.collectedAt && (
            <span className="shrink-0 tabular-nums text-nb-ink-soft">
              · {when(signal.collectedAt, language)}
            </span>
          )}
        </span>
        <button
          ref={closer}
          type="button"
          onClick={onClose}
          aria-label={copy.shared.close}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] max-md:size-11"
        >
          <FiX size={16} aria-hidden />
        </button>
      </div>

      <div className="shrink-0 px-6 pb-2 pt-4 max-md:px-4">
        <h2
          title={title}
          className={`line-clamp-3 [overflow-wrap:anywhere] ${
            signal.contentKept
              ? "text-[17px] font-[700] leading-[26px]"
              : "font-mono text-[14px] font-[700] leading-[22px]"
          }`}
        >
          {title}
        </h2>
        {acts && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {history ? (
              restorable && (
                <Button size="xs" className={tap} onClick={onRestore}>
                  <FiRotateCcw size={12} aria-hidden />
                  {c.restore}
                </Button>
              )
            ) : making ? (
              <span className={`inline-flex items-center text-[12px] font-[600] text-nb-accent-deep ${tap}`}>
                {c.making}
              </span>
            ) : (
              <>
                <Button size="xs" className={`${tap} max-md:px-4 max-md:text-[13px]`} disabled={sorting} onClick={onMake}>
                  {c.makeCard}
                </Button>
                <button type="button" className={`${GHOST_INK} ${tap}`} onClick={onIgnore}>
                  {c.ignore}
                </button>
              </>
            )}
            {signal.url && (
              <a
                href={signal.url}
                target="_blank"
                rel="noreferrer noopener"
                className={`${GHOST_INK} ${tap}`}
              >
                <FiExternalLink size={12} aria-hidden />
                {c.viewOriginal}
              </a>
            )}
          </div>
        )}
        {failed && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-[9px] bg-nb-peach-soft px-3 py-2 text-[12px] leading-[16px] text-nb-ink"
          >
            <FiAlertCircle size={13} className="shrink-0 text-nb-peach-ink" aria-hidden />
            {failed}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-3 [overflow-wrap:anywhere] max-md:px-4">
        {!signal.contentKept && (
          <p className="text-[12px] leading-[18px] text-nb-ink-soft">{c.contentGone}</p>
        )}
        {signal.summary && (
          <p className="whitespace-pre-wrap text-[13px] leading-[20px]">{signal.summary}</p>
        )}
        {meta && <p className="mt-4 text-[12px] leading-[18px] text-nb-ink-soft">{meta}</p>}
        {history && (
          <div className="mt-4 flex flex-col gap-1">
            {line(c.madeAt, signal.archivedAt ? when(signal.archivedAt, language) : "")}
            {signal.cardId !== null &&
              line(
                c.madeInto,
                card ? (
                  <Link
                    href={cardHref(signal.cardId, card.archived)}
                    className="font-[700] text-nb-accent-deep hover:underline"
                  >
                    #{signal.cardId} {card.title}
                  </Link>
                ) : (
                  `#${signal.cardId}`
                ),
              )}
            {line(
              c.dismissedAt,
              signal.dismissedAt ? [when(signal.dismissedAt, language), who].filter(Boolean).join(" · ") : "",
            )}
            {line(c.dismissedWhy, signal.dismissedAt ? signal.dismissedReason : "")}
          </div>
        )}
      </div>
    </aside>
  );
}

/** Ignore, with an optional reason — its own small dialog, whether it was asked for from the list or
 *  from the detail. A failure keeps what was typed. */
function IgnoreDialog({
  signal,
  onCancel,
  onIgnore,
}: {
  signal: Signal;
  onCancel: () => void;
  onIgnore: (reason: string) => Promise<boolean>;
}) {
  const copy = useCopy();
  const c = copy.rail.signals;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const text = useRef<HTMLTextAreaElement>(null);
  const [composing, setComposing] = useState(false);
  useOverRail();

  useEffect(() => {
    text.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel, busy]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const done = await onIgnore(reason.trim());
    setBusy(false);
    if (!done) setError(c.dismissFailed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-nb-ink/20 px-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ignore-title"
        className="w-[420px] max-w-full rounded-[14px] border-[1.5px] border-nb-ink bg-nb-paper p-5 shadow-[3px_3px_0_0_var(--color-nb-ink)]"
      >
        <h2 id="ignore-title" className="text-[16px] font-[800]">
          {c.ignoreTitle}
        </h2>
        <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-nb-ink-soft">
          {signal.contentKept ? signal.title : signal.sourceId}
        </p>
        <label htmlFor="ignore-reason" className="mb-2 mt-5 block text-[12px] font-[700]">
          {c.why}
        </label>
        <textarea
          id="ignore-reason"
          ref={text}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
            if (composing || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void submit();
          }}
          disabled={busy}
          placeholder={c.reasonHint}
          className="h-24 w-full resize-none rounded-[8px] bg-nb-paper px-3 py-2 text-[13px] leading-[20px] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none disabled:opacity-60"
        />
        {error && (
          <p role="alert" className="mt-2 text-[12px] leading-[16px] text-nb-accent-deep">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button size="xs" variant="ghost" onClick={onCancel} disabled={busy}>
            {copy.shared.cancel}
          </Button>
          <Button size="xs" onClick={() => void submit()} disabled={busy}>
            {c.ignore}
          </Button>
        </div>
      </section>
    </div>
  );
}
