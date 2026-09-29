"use client";

// Triage (#453, #559, #560, #894, #1193) — a queue you empty. Every item waiting in
// `docs/kanban/triage/` leaves it by **Make card** (a create run pointed at the item), **Start
// now** (a build that writes the card first), or **Ignore** (the user's reason). **Discuss**
// takes it into a fresh discussion and leaves it waiting. Items arrive on their own — follow-ups
// from finished cards, and connected sources; a person asking for work uses **New task**.
//
// Waiting is a compact list (#1196), one row per item, ordered by source: a source type when one
// was given, otherwise the card an item names as its source (`meta.source: "#706"`). The source
// is written once per run of rows. An ignore takes effect at once and leaves an undo toast, where
// the reason is asked for afterwards. **History** is what became a card or was ignored over the
// last 30 days, drawn as grouped cards, and an ignored item there can be restored.

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
  FiEyeOff,
  FiInbox,
  FiLoader,
  FiMessageSquare,
  FiPlay,
  FiPlus,
  FiRotateCcw,
  FiSearch,
  FiX,
  FiZap,
} from "react-icons/fi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  dismissSignalsAction,
  makeCardAction,
  reasonSignalsAction,
  restoreSignalAction,
  restoreSignalsAction,
  sortTriageAction,
  startTriageItemAction,
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
import { ConfirmationPopover } from "./confirm-popover";
import { configDialog } from "./Configuration";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import { createSheet, useSheetUp } from "@/lib/create-open";
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
import { sayFailure, type Refused } from "@/lib/start-failure";

type Tab = "pending" | "history";

/** What a run on an item is doing: making its card, or starting it (#1193). */
type Taking = "make" | "start";

// Radix will not take an empty string as a value, and the empty string is already the key of
// the group nothing named a source for — so the picker carries two words of its own.
const EVERY = "*";
const NONE = "-";

/** How much of a group is drawn before **More**, and how much each press brings in. */
const FIRST = 6;
const MORE = 12;

/** How long an item that became a card takes to fade out of the queue. */
const FADE_MS = 400;

/** How long the undo toast stays with nothing done to it. */
const TOAST_MS = 10_000;

const GHOST_ACT =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-accent-deep transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11 max-md:px-3";
const GHOST_INK =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-ink-soft transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] hover:text-nb-ink focus-visible:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11 max-md:px-3";
const WIDE_TAP = "max-md:px-4 max-md:text-[13px]";
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

/** A stamp as a short date, for a list row. */
function dayOf(stamp: string, language: Language): string {
  const at = new Date(stamp.replace(" ", "T"));
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString(LANGUAGE_TAGS[language], { month: "short", day: "numeric" });
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

const titleOf = (signal: Signal): string => (signal.contentKept ? signal.title : signal.sourceId);

function without(set: Set<string>, ids: string[]): Set<string> {
  if (!ids.some((id) => set.has(id))) return set;
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

/** What one ignore took out of the list — the one thing Undo puts back. */
interface Ignored {
  key: number;
  ids: string[];
  title: string;
  /** The ids that really went, once the ignore is answered. Undo and a reason wait on it. */
  settled: Promise<string[]>;
}

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
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [guardFor, setGuardFor] = useState<string | null>(null);
  const [toast, setToast] = useState<Ignored | null>(null);
  const toastKey = useRef(0);

  // Make card or Start now: pressed and not yet answered, then started and not yet in the poll.
  const [starting, setStarting] = useState<Record<string, Taking>>({});
  const [started, setStarted] = useState<Record<string, { sessionId: string; taking: Taking }>>({});
  const [sortStarting, setSortStarting] = useState(false);
  const [sortNote, setSortNote] = useState<"closed" | "refused" | null>(null);

  const making = useMemo(() => {
    const ids = new Map<string, Taking>(Object.entries(starting));
    for (const run of sessions) {
      if (run.status === "running" && run.triage)
        ids.set(run.triage, run.action === "implement" ? "start" : "make");
    }
    for (const [sourceId, { sessionId, taking }] of Object.entries(started)) {
      if (!sessions.some((run) => run.sessionId === sessionId)) ids.set(sourceId, taking);
    }
    return ids;
  }, [sessions, starting, started]);
  const sorting =
    sortStarting || sessions.some((run) => run.action === "triage" && run.status === "running");

  // A started run the poll has seen answers for itself from here on.
  useEffect(() => {
    setStarted((was) => {
      const kept = Object.fromEntries(
        Object.entries(was).filter(([, { sessionId }]) => !sessions.some((run) => run.sessionId === sessionId)),
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
  const rows = useMemo(
    () => (tab === "pending" ? groups.flatMap((group) => group.items) : []),
    [tab, groups],
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
  useEffect(() => setTicked(new Set()), [tab, needle, source]);
  useEffect(() => setSortNote(null), [tab]);

  const narrowing = searching || source !== EVERY;
  const clear = () => {
    setQuery("");
    setSource(EVERY);
  };

  /** Make card, or Start now (#1193) — which only the detail offers, and whose refusal says
   *  why. */
  const take = async (signal: Signal, taking: Taking, fromDetail = false) => {
    const { sourceId } = signal;
    if (making.has(sourceId) || sorting) return;
    setFailed("");
    setDetailFailed("");
    setStarting((was) => ({ ...was, [sourceId]: taking }));
    const done: Refused & { ok: boolean; sessionId?: string } = await (taking === "start" ? startTriageItemAction : makeCardAction)(
      sourceId,
    ).catch(() => ({ ok: false }));
    setStarting((was) => {
      const next = { ...was };
      delete next[sourceId];
      return next;
    });
    if (!done.ok || !done.sessionId) {
      const why = taking === "start" ? sayFailure(done, c.startFailed) : c.makeFailed;
      if (fromDetail) setDetailFailed(why);
      else setFailed(why);
      return;
    }
    setStarted((was) => ({ ...was, [sourceId]: { sessionId: done.sessionId!, taking } }));
    kick();
    if (fromDetail && openNow.current === sourceId) advance(sourceId);
  };

  /** Discuss (#1193): a fresh discussion, the item named after its draft, nothing sent. */
  const discuss = (signal: Signal) => {
    const card = cardOfGroup(groupOf(signal));
    createSheet.open(
      null,
      `discuss triage ${card === null ? "" : `#${card} `}(${signal.relPath}):\n\n`,
    );
  };

  /** Ignore at once, and leave the toast that undoes it. What fails comes back. */
  const ignore = (signals: Signal[], fromDetail = false) => {
    const ids = signals.map((signal) => signal.sourceId);
    if (ids.length === 0) return;
    if (fromDetail) advance(ids[0]!);
    for (const id of ids) hide(`p:${id}`);
    setTicked((was) => without(was, ids));
    setFailed("");
    const key = ++toastKey.current;
    const settled = dismissSignalsAction(ids)
      .catch(() => ({ failed: ids, error: c.dismissFailed }))
      .then((done) => {
        for (const id of done.failed) unhide(`p:${id}`);
        if (done.failed.length > 0) setFailed(done.error ?? c.dismissFailed);
        const went = ids.filter((id) => !done.failed.includes(id));
        setToast((was) => (was?.key !== key ? was : went.length > 0 ? { ...was, ids: went } : null));
        reloadSignalsRow();
        refresh();
        return went;
      });
    setToast({ key, ids, title: signals.length === 1 ? titleOf(signals[0]!) : "", settled });
  };

  const undo = async (was: Ignored) => {
    setToast(null);
    const ids = await was.settled;
    if (ids.length === 0) return;
    const done = await restoreSignalsAction(ids).catch(() => ({ failed: ids, error: c.undoFailed }));
    for (const id of ids) if (!done.failed.includes(id)) unhide(`p:${id}`);
    const lost = done.failed.length;
    setFailed(lost === 0 ? "" : lost === ids.length ? (done.error ?? c.undoFailed) : c.undoPartial(lost));
    reloadSignalsRow();
    refresh();
  };

  /** The reason asked for after the ignore, onto every record it made. */
  const saveReason = async (was: Ignored, reason: string): Promise<boolean> => {
    const ids = await was.settled;
    const done = await reasonSignalsAction(ids, reason).catch(() => ({ failed: ids }));
    if (done.failed.length > 0) return false;
    setToast((now) => (now?.key === was.key ? null : now));
    refresh();
    return true;
  };
  const closeToast = useCallback(() => setToast(null), []);

  const restore = async (signal: Signal) => {
    hide(`h:${signal.sourceId}`);
    const done = await restoreSignalAction(signal.sourceId).catch(() => ({
      ok: false,
      error: c.restoreFailed,
    }));
    if (!done.ok) {
      unhide(`h:${signal.sourceId}`);
      setFailed(sayFailure(done, c.restoreFailed));
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

  /** After acting in the detail: the next item down that is not being taken, else the next
   *  up, else nothing. */
  const advance = (from: string) => {
    const at = rows.findIndex((signal) => signal.sourceId === from);
    const free = (signal: Signal) => signal.sourceId !== from && !making.has(signal.sourceId);
    const next = rows.slice(at + 1).find(free) ?? rows.slice(0, Math.max(at, 0)).reverse().find(free);
    setOpen(next?.sourceId ?? null);
  };

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
        making={making.get(opened.sourceId)}
        sorting={sorting}
        failed={detailFailed}
        onClose={closeDetail}
        onMake={() => void take(opened, "make", true)}
        onStart={() => void take(opened, "start", true)}
        onDiscuss={() => discuss(opened)}
        onIgnore={() => ignore([opened], true)}
        onRestore={() => void restore(opened)}
      />
    ) : null;
  const pickable = rows.filter((signal) => !making.has(signal.sourceId) && !leavingIds.has(signal.sourceId));
  const chosen = pickable.filter((signal) => ticked.has(signal.sourceId));
  const pickBar = (phone: boolean) => (
    <PickBar
      phone={phone}
      count={chosen.length}
      total={pickable.length}
      onAll={() => setTicked(new Set(pickable.map((signal) => signal.sourceId)))}
      onClear={() => setTicked(new Set())}
      onIgnore={() => ignore(chosen)}
    />
  );
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
          <div
            className={`@container flex h-full flex-col overflow-y-auto ${
              tab === "pending" ? "px-3 pb-6 pt-1 max-md:px-2 max-md:pb-20" : "px-6 pb-6 pt-3 max-md:px-4"
            }`}
          >
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
              tab === "pending" ? (
              <>
                {chosen.length > 0 && <div className="sticky top-0 z-20 max-md:hidden">{pickBar(false)}</div>}
                <ul aria-label={c.pending} className="flex flex-col">
                  {rows.map((signal, i) => {
                    const key = groupOf(signal);
                    const card = cardOfGroup(key);
                    return (
                      <QueueRow
                        key={signal.sourceId}
                        signal={signal}
                        first={i === 0 || groupOf(rows[i - 1]!) !== key}
                        top={i === 0}
                        source={
                          <RowSource
                            group={key}
                            name={groupName(key)}
                            card={card}
                            cardRef={card === null ? undefined : inbox.cards[card]}
                          />
                        }
                        selected={open === signal.sourceId}
                        checked={ticked.has(signal.sourceId)}
                        making={making.get(signal.sourceId)}
                        leaving={leavingIds.has(signal.sourceId)}
                        sorting={sorting}
                        guard={guardFor === signal.sourceId}
                        onGuard={(on) => setGuardFor(on ? signal.sourceId : null)}
                        onCheck={() =>
                          setTicked((was) => {
                            const next = new Set(was);
                            if (!next.delete(signal.sourceId)) next.add(signal.sourceId);
                            return next;
                          })
                        }
                        onOpen={() => setOpen(signal.sourceId)}
                        onMake={() => void take(signal, "make")}
                        onStart={() => void take(signal, "start")}
                        onDiscuss={() => discuss(signal)}
                        onIgnore={() => ignore([signal])}
                      />
                    );
                  })}
                </ul>
              </>
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
                    {(signal) => (
                      <HistoryCard
                        key={signal.sourceId}
                        signal={signal}
                        selected={open === signal.sourceId}
                        card={signal.cardId !== null ? inbox.cards[signal.cardId] : undefined}
                        onOpen={() => setOpen(signal.sourceId)}
                        onRestore={() => void restore(signal)}
                      />
                    )}
                  </SourceSection>
                ))}
              </div>
              )
            )}
          </div>
          {chosen.length > 0 && <div className="absolute inset-x-3 bottom-3 z-30 md:hidden">{pickBar(true)}</div>}
          {toast && (
            <IgnoredToast
              key={toast.key}
              ignored={toast}
              underPick={chosen.length > 0}
              onUndo={() => void undo(toast)}
              onClose={closeToast}
              onSave={(reason) => saveReason(toast, reason)}
            />
          )}
        </div>
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

/** The source column: the card an item came from, linked, or a source type's mark and name. */
function RowSource({
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
  const number = "font-mono text-[11.5px] tabular-nums text-nb-ink-soft";
  if (card !== null && cardRef) {
    return (
      <Link href={cardHref(card, cardRef.archived)} title={cardRef.title} className={`${number} hover:text-nb-ink hover:underline`}>
        #{card}
      </Link>
    );
  }
  if (card !== null) return <span className={number}>#{card}</span>;
  return (
    <span title={name} className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-[700] text-nb-ink">
      <SourceMark type={group} size={13} />
      <span className="truncate max-md:hidden">{name}</span>
    </span>
  );
}

const CHECK = "size-[14px] shrink-0 cursor-pointer accent-nb-accent-deep max-md:size-[18px]";
const ICON_BTN =
  "nb-tip grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

/** One waiting item, one row: a checkbox, its source on the first row of a run, the title with
 *  its summary on the same line, and the date — traded for four icon buttons on the row under
 *  the pointer, or on a ticked one. */
function QueueRow({
  signal,
  first,
  top,
  source,
  selected,
  checked,
  making,
  leaving,
  sorting,
  guard,
  onGuard,
  onCheck,
  onOpen,
  onMake,
  onStart,
  onDiscuss,
  onIgnore,
}: {
  signal: Signal;
  first: boolean;
  /** The list's first row: tips open downwards, or the list's edge cuts them. */
  top: boolean;
  source: ReactNode;
  selected: boolean;
  checked: boolean;
  making?: Taking;
  leaving: boolean;
  sorting: boolean;
  guard: boolean;
  onGuard: (open: boolean) => void;
  onCheck: () => void;
  onOpen: () => void;
  onMake: () => void;
  onStart: () => void;
  onDiscuss: () => void;
  onIgnore: () => void;
}) {
  const c = useCopy().rail.signals;
  const language = useLanguage();
  const actsRef = useRef<HTMLSpanElement>(null);
  const still = !!making || leaving;
  const pinned = !still && (checked || guard);
  const tone = selected
    ? "bg-nb-accent-soft shadow-[inset_2px_0_0_0_var(--color-nb-accent-deep)]"
    : making
      ? "bg-nb-accent-wash"
      : checked
        ? "bg-[color-mix(in_srgb,var(--color-nb-accent-soft)_55%,transparent)]"
        : still
          ? ""
          : "group-hover:bg-nb-wash group-focus-within:bg-nb-wash";
  const tip = `nb-tip ${top ? "nb-tip-below" : ""}`;
  const busy = making === "start" ? c.starting : c.making;
  const acts = [
    { label: c.makeCard, icon: <FiPlus size={14} />, onClick: onMake, off: sorting },
    { label: c.startNow, icon: <FiPlay size={12} />, onClick: () => onGuard(!guard), off: sorting },
    { label: c.discuss, icon: <FiMessageSquare size={12} />, onClick: onDiscuss, off: false },
    { label: c.ignore, icon: <FiEyeOff size={12} />, onClick: onIgnore, off: false },
  ];

  return (
    <li
      className={`${still ? "" : "group"} ${first ? "border-t first:border-t-0" : ""} ${leaving ? "a4k-triage-leaving" : ""}`}
      style={first ? { borderColor: HAIRLINE } : undefined}
    >
      <div
        className={`flex min-h-[28px] items-start gap-3 px-3 py-[5px] leading-[18px] max-md:min-h-11 max-md:gap-2.5 max-md:px-2 max-md:py-[13px] ${tone}`}
      >
        {making ? (
          <span
            data-tip={busy}
            className={`${tip} grid size-[14px] shrink-0 translate-y-[2px] place-items-center text-nb-accent-deep max-md:size-[18px]`}
          >
            <FiLoader size={13} className="animate-spin" aria-label={busy} />
          </span>
        ) : (
          <input
            type="checkbox"
            checked={checked}
            disabled={leaving}
            onChange={onCheck}
            aria-label={titleOf(signal)}
            className={`${CHECK} mt-[2px]`}
          />
        )}
        <span className="flex h-[18px] w-[84px] shrink-0 items-center max-md:w-[46px]">{first && source}</span>
        <button
          type="button"
          id={`signal-${signal.sourceId}`}
          aria-current={selected || undefined}
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-x-1.5 text-left focus-visible:outline-none"
        >
          <span
            className={`min-w-0 [overflow-wrap:anywhere] ${
              signal.contentKept ? "text-[13px] font-[600] text-nb-ink" : "font-mono text-[12px] font-[600] text-nb-ink-soft"
            }`}
          >
            {titleOf(signal)}
          </span>
          {signal.summary && (
            <span className="min-w-0 flex-1 basis-0 truncate text-[12px] text-nb-ink-soft max-md:hidden">
              — {signal.summary}
            </span>
          )}
        </button>
        <span className="relative -my-[3px] flex h-6 w-[108px] shrink-0 items-center justify-end max-md:hidden">
          <span
            className={`text-[11.5px] tabular-nums text-nb-ink-soft ${
              pinned ? "hidden" : still ? "" : "group-hover:hidden group-focus-within:hidden"
            }`}
          >
            {dayOf(signal.collectedAt, language)}
          </span>
          {!still && (
            <span
              ref={actsRef}
              className={`${pinned ? "flex" : "hidden group-hover:flex group-focus-within:flex"} items-center gap-0.5`}
            >
              {acts.map((act) => (
                <button
                  key={act.label}
                  type="button"
                  data-tip={act.label}
                  aria-label={act.label}
                  aria-expanded={act.label === c.startNow ? guard : undefined}
                  disabled={act.off}
                  onClick={act.onClick}
                  className={`${ICON_BTN} ${tip}`}
                >
                  {act.icon}
                </button>
              ))}
              <StartGuard
                open={guard}
                anchorRef={actsRef}
                align="right"
                onDismiss={() => onGuard(false)}
                onConfirm={() => {
                  onGuard(false);
                  onStart();
                }}
              />
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

/** While any row is ticked: how many, all of what the filters show, and ignoring them. */
function PickBar({
  phone,
  count,
  total,
  onAll,
  onClear,
  onIgnore,
}: {
  phone: boolean;
  count: number;
  total: number;
  onAll: () => void;
  onClear: () => void;
  onIgnore: () => void;
}) {
  const c = useCopy().rail.signals;
  return (
    <div
      className={`flex items-center ${
        phone ? "nb-panel-sm h-[52px] gap-2 bg-nb-paper px-3" : "mb-2 h-9 gap-3 rounded-[9px] bg-nb-accent-wash px-3"
      }`}
    >
      {!phone && <input type="checkbox" checked onChange={onClear} aria-label={c.clearPick} className={CHECK} />}
      <span className={`min-w-0 truncate font-[700] tabular-nums ${phone ? "flex-1 text-[13px]" : "text-[12.5px]"}`}>
        {c.selected(count)}
      </span>
      {count < total && (
        <button type="button" onClick={onAll} className={`${LINK} shrink-0`}>
          {c.selectAll(total)}
        </button>
      )}
      <span className={`inline-flex shrink-0 items-center gap-2 ${phone ? "" : "ml-auto"}`}>
        <button type="button" onClick={onClear} className={GHOST_INK}>
          {c.clearPick}
        </button>
        <Button size="xs" onClick={onIgnore} className={phone ? "h-9 px-3.5 text-[13px]" : ""}>
          {c.ignoreN(count)}
        </Button>
      </span>
    </div>
  );
}

/** What was just ignored: Undo, and — asked for — a box for why. Leaves on its own after a
 *  while untouched, never while the box is open. */
function IgnoredToast({
  ignored,
  underPick,
  onUndo,
  onClose,
  onSave,
}: {
  ignored: Ignored;
  /** On a phone the pick bar takes the toast's place. */
  underPick: boolean;
  onUndo: () => void;
  onClose: () => void;
  onSave: (reason: string) => Promise<boolean>;
}) {
  const copy = useCopy();
  const c = copy.rail.signals;
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [held, setHeld] = useState(false);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (asking || held) return;
    const timer = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(timer);
  }, [asking, held, onClose]);

  const save = async () => {
    if (busy || !reason.trim()) return;
    setBusy(true);
    setError(false);
    const done = await onSave(reason.trim());
    setBusy(false);
    if (!done) setError(true);
  };

  return (
    <div
      role="status"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      className={`nb-panel-sm absolute bottom-5 left-1/2 z-30 flex w-[460px] max-w-[calc(100%-24px)] -translate-x-1/2 flex-col gap-2 bg-nb-paper px-3.5 py-2.5 max-md:bottom-3 ${
        underPick ? "max-md:hidden" : ""
      }`}
    >
      <div className="flex h-7 items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-[600]">
          {ignored.title ? c.ignoredOne(ignored.title) : c.ignoredN(ignored.ids.length)}
        </span>
        <button type="button" onClick={onUndo} className={`${LINK} shrink-0`}>
          {c.undo}
        </button>
        {!asking && (
          <button type="button" onClick={() => setAsking(true)} className={`${LINK} shrink-0`}>
            {c.addReason}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.shared.close}
          className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] hover:text-nb-ink"
        >
          <FiX size={14} aria-hidden />
        </button>
      </div>
      {asking && (
        <>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || composing || e.nativeEvent.isComposing) return;
                e.preventDefault();
                void save();
              }}
              placeholder={c.reasonHint}
              aria-label={c.addReason}
              className="h-8 min-w-0 flex-1 rounded-[8px] bg-nb-paper px-3 text-[13px] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none disabled:opacity-60"
            />
            <Button size="xs" className="h-8" disabled={busy || !reason.trim()} onClick={() => void save()}>
              {c.save}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-[12px] leading-[16px] text-nb-accent-deep">
              {c.reasonFailed}
            </p>
          )}
        </>
      )}
    </div>
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
  failed,
  onClose,
  onMake,
  onStart,
  onDiscuss,
  onIgnore,
  onRestore,
}: {
  signal: Signal;
  history: boolean;
  source: ReactNode;
  card?: { title: string; archived: boolean };
  making?: Taking;
  sorting: boolean;
  failed: string;
  onClose: () => void;
  onMake: () => void;
  onStart: () => void;
  onDiscuss: () => void;
  onIgnore: () => void;
  onRestore: () => void;
}) {
  const copy = useCopy();
  const c = copy.rail.signals;
  const language = useLanguage();
  const closer = useRef<HTMLButtonElement>(null);
  const actsRef = useRef<HTMLSpanElement>(null);
  const [guard, setGuard] = useState(false);
  const dropGuard = useCallback(() => setGuard(false), []);

  useEffect(() => {
    closer.current?.focus({ preventScroll: true });
    setGuard(false);
  }, [signal.sourceId]);

  useEffect(() => {
    if (guard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, guard]);

  const line = (label: string, said: ReactNode) =>
    said ? (
      <p className="text-[12px] leading-[18px] text-nb-ink-soft">
        <span className="font-[700]">{label}</span> {said}
      </p>
    ) : null;
  const who =
    signal.dismissedBy === "agent" ? c.byAgent : signal.dismissedBy === "user" ? c.byYou : "";
  const restorable = history && signal.cardId === null && signal.contentKept;
  const acts = !history || restorable;
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
          {signal.url ? (
            <a
              href={signal.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-w-0 items-center gap-1 rounded-[6px] underline decoration-nb-ink-soft decoration-1 underline-offset-[3px] hover:decoration-nb-ink"
            >
              {source}
              <FiExternalLink size={11} className="shrink-0 text-nb-ink-soft" aria-hidden />
            </a>
          ) : (
            source
          )}
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
          <span ref={actsRef} className="relative mt-3 flex flex-wrap items-center gap-2">
            {history ? (
              <Button size="xs" className={tap} onClick={onRestore}>
                <FiRotateCcw size={12} aria-hidden />
                {c.restore}
              </Button>
            ) : making ? (
              <span className={`inline-flex items-center text-[12px] font-[600] text-nb-accent-deep ${tap}`}>
                {making === "start" ? c.starting : c.making}
              </span>
            ) : (
              <>
                <Button size="xs" className={`${tap} ${WIDE_TAP}`} disabled={sorting} onClick={onMake}>
                  {c.makeCard}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className={`${tap} ${WIDE_TAP}`}
                  disabled={sorting}
                  aria-expanded={guard}
                  onClick={() => setGuard((was) => !was)}
                >
                  {c.startNow}
                </Button>
                <Button variant="ghost" size="xs" className={`${tap} ${WIDE_TAP}`} onClick={onDiscuss}>
                  {c.discuss}
                </Button>
                <button type="button" className={`${GHOST_INK} ${tap} ml-auto`} onClick={onIgnore}>
                  <FiEyeOff size={12} aria-hidden />
                  {c.ignore}
                </button>
                <StartGuard
                  open={guard}
                  anchorRef={actsRef}
                  onDismiss={dropGuard}
                  onConfirm={() => {
                    setGuard(false);
                    onStart();
                  }}
                />
              </>
            )}
          </span>
        )}
        {failed && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 whitespace-pre-line rounded-[9px] bg-nb-peach-soft px-3 py-2 text-[12px] leading-[16px] text-nb-ink [overflow-wrap:anywhere]"
          >
            <FiAlertCircle size={13} className="mt-px shrink-0 text-nb-peach-ink" aria-hidden />
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

/** Start now's guard (#1193): the discussion page's, said of this item. Hung off the whole
 *  action row, since 320px from Start now's own edge runs past the pane. */
function StartGuard({
  open,
  anchorRef,
  align,
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  align?: "left" | "right";
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const copy = useCopy();
  const c = copy.board.create.sheet.guard;
  const t = copy.rail.signals;
  return (
    <ConfirmationPopover
      open={open}
      anchorRef={anchorRef}
      title={c.title}
      description={
        <span className="flex flex-col gap-1">
          <span>{t.startWrites}</span>
          {[t.startSkip, ...c.skips.slice(1)].map((line) => (
            <span key={line} className="flex items-start gap-1.5">
              <FiX className="mt-[3px] shrink-0 text-[11px] text-nb-peach-ink" aria-hidden />
              <span>{line}</span>
            </span>
          ))}
        </span>
      }
      cancelLabel={c.cancel}
      confirmLabel={c.confirm}
      busy={false}
      align={align}
      onDismiss={onDismiss}
      onConfirm={onConfirm}
    />
  );
}
