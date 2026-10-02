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
// the reason is asked for afterwards. **History** (#1256) is what became a card or was ignored
// over the last 30 days, in the same rows, newest judged first; its detail restores an ignored
// item and takes the user's reason for one they ignored.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  FiAlertCircle,
  FiExternalLink,
  FiEyeOff,
  FiInbox,
  FiLoader,
  FiLock,
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
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { goPro, proLock, useProAccess } from "./pro";
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
import { PhoneFoot } from "./Phone";
import { usePhone } from "@/lib/media";
import { sayFailure, type Refused } from "@/lib/start-failure";

type Tab = "pending" | "history";

/** What a run on an item is doing: making its card, or starting it (#1193). */
type Taking = "make" | "start";

// Radix will not take an empty string as a value, and the empty string is already the key of
// the group nothing named a source for — so the picker carries two words of its own.
const EVERY = "*";
const NONE = "-";

/** How long an item that became a card takes to fade out of the queue. */
const FADE_MS = 400;

/** How long the undo toast stays with nothing done to it. */
const TOAST_MS = 10_000;

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

type SignalsCopy = ReturnType<typeof useCopy>["rail"]["signals"];

/** Held for the user by a Pro sort (#1221). */
const heldForYou = (signal: Signal): boolean => signal.verdict === "human-review";

/** Held as unsure before the two confidences were kept (#1356): the next sort judges it again. */
const unsureUnmeasured = (signal: Signal): boolean =>
  heldForYou(signal) &&
  signal.verdictReason === "unsure" &&
  (signal.dropConfidence === null || signal.doConfidence === null);

/** What a sort still has to do something with: never judged, or judged worth a card not yet made. */
const sortable = (signal: Signal): boolean =>
  !signal.verdict || signal.verdict === "plan" || signal.verdict === "plan-without-refine" || unsureUnmeasured(signal);

/** A verdict's reason, in the page's language. An unsure one says which way Jev leans and how
 *  sure it is, or nothing when the two confidences were never kept. */
function verdictReason(signal: Signal, c: SignalsCopy): string {
  if (!signal.verdictReason) return "";
  if (signal.verdictReason === "duplicate" && signal.verdictCard !== null) return c.duplicateOf(signal.verdictCard);
  if (signal.verdictReason === "unsure") {
    const { dropConfidence: drop, doConfidence: worth } = signal;
    if (drop === null || worth === null) return "";
    return worth >= drop ? c.likelyDo(Math.round(worth * 100)) : c.likelyIgnore(Math.round(drop * 100));
  }
  return c.reasons[signal.verdictReason];
}

/** Why an item was ignored: the verdict's own label when a sort ignored it on one. */
const whyIgnored = (signal: Signal, c: SignalsCopy): string =>
  signal.dismissedBy === "agent" && signal.verdict === "skip" ? verdictReason(signal, c) : signal.dismissedReason;

/** "Needs you", leading a held item's reason in the text flow. */
function HeldPill() {
  const c = useCopy().rail.signals;
  return (
    <span className="nb-chip mr-1.5 -translate-y-px rounded-full bg-nb-peach-soft px-2 align-middle text-nb-peach-ink">
      {c.review}
    </span>
  );
}

/** The kind of card a sort made of an item. Its reason is its tip. */
function VerdictChip({ signal }: { signal: Signal }) {
  const c = useCopy().rail.signals;
  if (signal.verdict !== "plan" && signal.verdict !== "plan-without-refine") return null;
  const direct = signal.verdict === "plan-without-refine";
  return (
    <span
      data-tip={verdictReason(signal, c)}
      className={`nb-chip nb-tip shrink-0 whitespace-nowrap ${
        direct ? "bg-nb-mint-soft text-nb-mint-ink" : "bg-nb-sky-soft text-nb-sky-ink"
      }`}
    >
      {direct ? c.direct : c.plan}
    </span>
  );
}

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

/** The native tip carries the full text only while the element is cut off at its current width. */
function tipWhenCut(event: MouseEvent<HTMLElement>) {
  const el = event.currentTarget;
  if (el.scrollWidth > el.clientWidth) el.title = el.textContent ?? "";
  else el.removeAttribute("title");
}

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
  memoryOwners,
  desktop,
  sessions,
  children,
}: {
  projectRoot: string;
  openIds: number[];
  agent: AgentInfo;
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
        running={runningCardIds(sessions)}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
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
  memoryOwners,
  desktop,
}: {
  inbox: SignalInbox;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
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
  const phone = usePhone();
  const [finding, setFinding] = useState(false);
  const openFind = () => {
    setFinding(true);
    requestAnimationFrame(() => searchBox.current?.focus());
  };
  const closeFind = () => {
    setQuery("");
    setFinding(false);
  };
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
  // Items held for the user come first, whatever their source.
  const rows = useMemo(() => {
    if (tab !== "pending") return [];
    const flat = groups.flatMap((group) => group.items);
    return [...flat.filter(heldForYou), ...flat.filter((signal) => !heldForYou(signal))];
  }, [tab, groups]);
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

  useEffect(() => setTicked(new Set()), [tab, needle, source]);
  useEffect(() => setSortNote(null), [tab]);

  const narrowing = needle.length > 0 || source !== EVERY;
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
      signal.sourceId,
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

  /** A reason written in History's detail, onto an item the user ignored (#1256). */
  const reasonOne = async (signal: Signal, reason: string): Promise<boolean> => {
    const ids = [signal.sourceId];
    const done = await reasonSignalsAction(ids, reason).catch(() => ({ failed: ids }));
    if (done.failed.length > 0) return false;
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
  const flat = useMemo(
    () => (tab === "history" ? narrowed : groups.flatMap((g) => g.items)).map((s) => s.sourceId),
    [tab, narrowed, groups],
  );
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
        onReason={(reason) => reasonOne(opened, reason)}
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
          {/* On a phone the search folds into a 🔍 at the end of the tab row (#1198). */}
          {!finding && (
            <button
              type="button"
              onClick={openFind}
              title={c.search}
              aria-label={c.search}
              className="-mr-2 ml-auto grid size-11 shrink-0 cursor-pointer place-items-center rounded-[8px] text-nb-ink-soft md:hidden"
            >
              <FiSearch size={17} aria-hidden />
            </button>
          )}
          <label
            className={`relative ml-auto inline-flex h-7 min-w-0 shrink items-center max-md:h-9 ${
              finding ? "max-md:flex-1" : "max-md:hidden"
            }`}
          >
            <FiSearch size={13} className="absolute left-2.5 text-nb-ink-soft" aria-hidden />
            <input
              ref={searchBox}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.search}
              aria-label={c.search}
              className="h-7 w-[180px] min-w-[92px] rounded-[8px] bg-nb-wash pl-7 pr-2.5 text-[12px] text-nb-ink placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none max-md:h-9 max-md:w-full max-md:pr-10 max-md:text-[13px]"
            />
            <button
              type="button"
              onClick={closeFind}
              title={c.closeSearch}
              aria-label={c.closeSearch}
              className="absolute -right-1 grid size-11 cursor-pointer place-items-center text-nb-ink-soft md:hidden"
            >
              <FiX size={16} aria-hidden />
            </button>
          </label>
          {/* The source filter and Auto-sort take the next line on a phone. */}
          <span aria-hidden className="basis-full md:hidden" />

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
              idle={!waiting.some(sortable)}
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
          <div className="@container flex h-full flex-col overflow-y-auto px-3 pb-6 pt-1 max-md:px-2">
            {narrowed.length === 0 ? (
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
                    const prev = rows[i - 1];
                    return (
                      <QueueRow
                        key={signal.sourceId}
                        signal={signal}
                        first={!prev || heldForYou(prev) !== heldForYou(signal) || groupOf(prev) !== key}
                        showSource={!prev || heldForYou(signal) || heldForYou(prev) || groupOf(prev) !== key}
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
              <ul aria-label={c.history} className="flex flex-col">
                {narrowed.map((signal, i) => {
                  const key = groupOf(signal);
                  const card = cardOfGroup(key);
                  const prev = narrowed[i - 1];
                  return (
                    <HistoryRow
                      key={signal.sourceId}
                      signal={signal}
                      first={!prev || groupOf(prev) !== key}
                      source={
                        <RowSource
                          group={key}
                          name={groupName(key)}
                          card={card}
                          cardRef={card === null ? undefined : inbox.cards[card]}
                        />
                      }
                      selected={open === signal.sourceId}
                      card={signal.cardId !== null ? inbox.cards[signal.cardId] : undefined}
                      onOpen={() => setOpen(signal.sourceId)}
                    />
                  );
                })}
              </ul>
              )
            )}
          </div>
          {chosen.length > 0 && phone && <PhoneFoot>{pickBar(true)}</PhoneFoot>}
          {toast && (
            <IgnoredToast
              key={toast.key}
              ignored={toast}
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

/** **Auto-sort**, and — under it — why a sort would not start. An account known to lack the
 *  plan gets a lock after the label, and the press goes to the upgrade or the sign-in (#1299). */
function SortAll({
  idle,
  sorting,
  note,
  onSort,
  onDismissNote,
}: {
  /** Nothing left the sort would take: every waiting item is the user's. */
  idle: boolean;
  sorting: boolean;
  note: "closed" | "refused" | null;
  onSort: () => void;
  onDismissNote: () => void;
}) {
  const c = useCopy().rail.signals;
  const lock = proLock(useProAccess(true));
  // Off but still focusable, so the reason is reachable by keyboard and screen reader; the
  // wrapper carries the tip because the button's own opacity would fade it.
  const off = idle && !lock && !sorting;
  const link = useRef<HTMLButtonElement>(null);
  // The note takes no focus and is portaled out of the tab order: the next Tab goes to its link.
  useEffect(() => {
    if (note !== "refused") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.shiftKey || !link.current || link.current === document.activeElement) return;
      e.preventDefault();
      link.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [note]);

  return (
    <Popover open={!!note} onOpenChange={(open) => !open && onDismissNote()}>
      <PopoverAnchor asChild>
        <span
          data-tip={off ? c.sortIdle : undefined}
          className={`relative inline-flex shrink-0 max-md:ml-auto ${
            off ? "nb-tip nb-tip-below nb-tip-end cursor-not-allowed" : ""
          }`}
        >
          <Button
            size="xs"
            variant="ghost"
            disabled={!lock && sorting}
            aria-disabled={off || undefined}
            aria-description={off ? c.sortIdle : undefined}
            onClick={lock ? () => goPro(lock) : off ? undefined : onSort}
            title={lock === "upgrade" ? c.sortNeedsUpgrade : lock === "signIn" ? c.sortNeedsSignIn : undefined}
            className={off ? "pointer-events-none opacity-50" : "disabled:opacity-70"}
          >
            {(lock || !sorting) && (
              <FiZap size={13} aria-hidden className={off ? "text-nb-ink-soft" : "text-nb-accent"} />
            )}
            {sorting && !lock ? c.sorting : c.sortAll}
            {lock && <FiLock size={11} aria-hidden className="text-nb-ink-soft" />}
          </Button>
        </span>
      </PopoverAnchor>
      {note && (
        <PopoverContent
          role="status"
          align="end"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="flex w-[min(260px,calc(100vw-16px))] flex-col items-start gap-1.5 px-3 py-2.5 text-[12px] leading-[17px]"
        >
          {note === "closed" ? c.sortClosed : c.sortRefused}
          {note === "refused" && (
            <button
              ref={link}
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
        </PopoverContent>
      )}
    </Popover>
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
  "nb-tip grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

/** One waiting item, one row: a checkbox, its source on the first row of a run, the title with
 *  its summary on the same line, and the date — traded for four icon buttons on the row under
 *  the pointer, or on a ticked one. The title stays on one line there, or the narrower text
 *  would rewrap and the row would change height under the pointer. */
function QueueRow({
  signal,
  first,
  showSource,
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
  /** Whether the source column is drawn: the first row of a run, and every held row. */
  showSource: boolean;
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
  const held = heldForYou(signal);
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
    { label: c.makeCard, icon: <FiPlus size={16} />, onClick: onMake, off: sorting },
    { label: c.startNow, icon: <FiPlay size={14} />, onClick: () => onGuard(!guard), off: sorting },
    { label: c.discuss, icon: <FiMessageSquare size={14} />, onClick: onDiscuss, off: false },
    { label: c.ignore, icon: <FiEyeOff size={14} />, onClick: onIgnore, off: false },
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
        <span className="flex h-[18px] w-[84px] shrink-0 items-center max-md:w-[46px]">{showSource && source}</span>
        {held ? (
          <button
            type="button"
            id={`signal-${signal.sourceId}`}
            aria-current={selected || undefined}
            onClick={onOpen}
            className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left focus-visible:outline-none max-md:gap-1"
          >
            <span
              onMouseEnter={tipWhenCut}
              className="min-w-0 max-w-full text-[13px] font-[600] text-nb-ink [overflow-wrap:anywhere] md:truncate"
            >
              {titleOf(signal)}
            </span>
            <span className="line-clamp-1 text-[12px] text-nb-ink-soft max-md:line-clamp-2">
              <HeldPill />
              {verdictReason(signal, c)}
            </span>
          </button>
        ) : (
        <button
          type="button"
          id={`signal-${signal.sourceId}`}
          aria-current={selected || undefined}
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-x-1.5 text-left focus-visible:outline-none"
        >
          <span
            onMouseEnter={tipWhenCut}
            className={`min-w-0 [overflow-wrap:anywhere] md:truncate ${
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
        )}
        <span
          className={`shrink-0 text-[11.5px] tabular-nums text-nb-ink-soft max-md:hidden ${
            pinned ? "hidden" : still ? "" : "group-hover:hidden group-focus-within:hidden"
          }`}
        >
          {dayOf(signal.collectedAt, language)}
        </span>
        {!still && (
          <span
            ref={actsRef}
            className={`relative -my-1 -mr-1 hidden shrink-0 items-center gap-0.5 self-center ${
              pinned ? "md:flex" : "md:group-hover:flex md:group-focus-within:flex"
            }`}
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
        phone
          ? "h-[59.5px] gap-2 border-t-[1.5px] border-nb-ink bg-nb-paper px-3"
          : "mb-2 h-9 gap-3 rounded-[9px] bg-nb-accent-wash px-3"
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
        <Button size="xs" onClick={onIgnore} className={phone ? "h-11 px-4 text-[13px]" : ""}>
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
  onUndo,
  onClose,
  onSave,
}: {
  ignored: Ignored;
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
      className={`nb-panel-sm absolute bottom-5 left-1/2 z-30 flex w-[460px] max-w-[calc(100%-24px)] -translate-x-1/2 flex-col gap-2 bg-nb-paper px-3.5 py-2.5 max-md:bottom-3`}
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

/** One judged item, one row: its source on the first row of a run, the title with what came of
 *  it on the same line — the card, linked, or why it was ignored — then the outcome in a word
 *  and the date. Nothing acts on the row; Restore is in the detail. */
function HistoryRow({
  signal,
  first,
  source,
  selected,
  card,
  onOpen,
}: {
  signal: Signal;
  /** The first row of a run from one source: the source is written and a hairline drawn. */
  first: boolean;
  source: ReactNode;
  selected: boolean;
  card?: { title: string; archived: boolean };
  onOpen: () => void;
}) {
  const c = useCopy().rail.signals;
  const language = useLanguage();
  const became = signal.cardId !== null;
  const why = became ? "" : whyIgnored(signal, c);
  const note = "min-w-0 flex-1 basis-0 truncate text-[12px] max-md:hidden";
  const tone = selected
    ? "bg-nb-accent-soft shadow-[inset_2px_0_0_0_var(--color-nb-accent-deep)]"
    : "group-hover:bg-nb-wash group-focus-within:bg-nb-wash";

  return (
    <li className={`group ${first ? "border-t first:border-t-0" : ""}`} style={first ? { borderColor: HAIRLINE } : undefined}>
      <div
        className={`flex min-h-[28px] items-start gap-3 px-3 py-[5px] leading-[18px] max-md:min-h-11 max-md:gap-2.5 max-md:px-2 max-md:py-[13px] ${tone}`}
      >
        <span className="flex h-[18px] w-[84px] shrink-0 items-center max-md:w-[46px]">{first && source}</span>
        <span className="flex min-w-0 flex-1 items-baseline gap-x-1.5">
          <button
            type="button"
            id={`signal-${signal.sourceId}`}
            aria-current={selected || undefined}
            onClick={onOpen}
            className={`flex min-w-0 cursor-pointer items-baseline gap-x-1.5 text-left focus-visible:outline-none ${
              became && card ? "max-md:flex-1" : "flex-1"
            }`}
          >
            <span
              className={`min-w-0 [overflow-wrap:anywhere] ${
                signal.contentKept ? "text-[13px] font-[600] text-nb-ink" : "font-mono text-[12px] font-[600] text-nb-ink-soft"
              }`}
            >
              {titleOf(signal)}
            </span>
            {became && !card ? (
              <span className={`${note} font-[700] text-nb-ink-soft`}>→ #{signal.cardId}</span>
            ) : why ? (
              <span className={`${note} text-nb-ink`}>
                <span className="font-[700] text-nb-ink-soft">{c.dismissedWhy}</span> {why}
              </span>
            ) : (
              !became && signal.summary && <span className={`${note} text-nb-ink-soft`}>— {signal.summary}</span>
            )}
          </button>
          {became && card && (
            <span className="flex min-w-0 flex-1 basis-0 max-md:hidden">
              <Link
                href={cardHref(signal.cardId!, card.archived)}
                className="truncate text-[12px] font-[700] text-nb-accent-deep hover:underline focus-visible:underline focus-visible:outline-none"
              >
                → #{signal.cardId} {card.title}
              </Link>
            </span>
          )}
        </span>
        <span
          className={`shrink-0 whitespace-nowrap text-[11.5px] font-[700] ${became ? "text-nb-accent-deep" : "text-nb-ink-soft"}`}
        >
          {became ? c.made : c.ignored}
        </span>
        <span className="w-[52px] shrink-0 whitespace-nowrap text-right text-[11.5px] tabular-nums text-nb-ink-soft max-md:hidden">
          {dayOf(judgedAt(signal), language)}
        </span>
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
  onReason,
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
  /** Saves the user's reason for an item they ignored; false when it did not save. */
  onReason: (reason: string) => Promise<boolean>;
}) {
  const copy = useCopy();
  const c = copy.rail.signals;
  const language = useLanguage();
  const closer = useRef<HTMLButtonElement>(null);
  const actsRef = useRef<HTMLSpanElement>(null);
  const [guard, setGuard] = useState(false);
  const dropGuard = useCallback(() => setGuard(false), []);
  // The reason box (#1256), and the reason just saved until the list catches up with it.
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    closer.current?.focus({ preventScroll: true });
    setGuard(false);
    setDraft(null);
    setSaved(null);
    setSaveFailed(false);
  }, [signal.sourceId]);
  useEffect(() => setSaved(null), [signal.dismissedReason]);

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
  const yours = history && signal.dismissedBy === "user" && signal.cardId === null && !!signal.dismissedAt;
  const reason = saved ?? signal.dismissedReason;
  const typed = draft?.trim() ?? "";
  const savable = !saving && typed !== "" && typed !== reason;
  const saveReason = async () => {
    if (!savable) return;
    setSaving(true);
    setSaveFailed(false);
    const done = await onReason(typed);
    setSaving(false);
    if (!done) return setSaveFailed(true);
    setSaved(typed);
    setDraft(null);
  };
  const editReason = () => {
    setSaveFailed(false);
    setDraft(reason);
  };
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

      <div className="shrink-0 px-6 pb-2 max-md:px-4">
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
        {!history && heldForYou(signal) && (
          <p className="mt-2 text-[13px] leading-[20px] text-nb-ink-soft">
            <HeldPill />
            {verdictReason(signal, c)}
          </p>
        )}
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
            {signal.cardId !== null &&
              (signal.verdict === "plan" || signal.verdict === "plan-without-refine") &&
              line(c.verdict, <VerdictChip signal={signal} />)}
            {!yours ? (
              line(c.dismissedWhy, signal.dismissedAt ? whyIgnored(signal, c) : verdictReason(signal, c))
            ) : draft === null ? (
              line(
                c.dismissedWhy,
                <>
                  {reason && <span className="text-nb-ink">{reason} </span>}
                  <button type="button" onClick={editReason} className={LINK}>
                    {reason ? c.edit : c.addReason}
                  </button>
                </>,
              )
            ) : (
              <div className="mt-1 flex flex-col gap-2">
                <span className="text-[12px] font-[700] leading-[18px] text-nb-ink-soft">{c.dismissedWhy}</span>
                <input
                  autoFocus
                  value={draft}
                  disabled={saving}
                  onChange={(e) => setDraft(e.target.value)}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
                  onKeyDown={(e) => {
                    if (composing || e.nativeEvent.isComposing) return;
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setDraft(null);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      void saveReason();
                    }
                  }}
                  placeholder={c.reasonHint}
                  aria-label={c.dismissedWhy}
                  className="h-8 w-full rounded-[8px] bg-nb-paper px-3 text-[13px] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none disabled:opacity-60 max-md:h-11"
                />
                {saveFailed && (
                  <p role="alert" className="text-[12px] leading-[16px] text-nb-accent-deep">
                    {c.reasonFailed}
                  </p>
                )}
                <span className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="xs" className={tap} disabled={saving} onClick={() => setDraft(null)}>
                    {copy.shared.cancel}
                  </Button>
                  <Button size="xs" className={tap} disabled={!savable} onClick={() => void saveReason()}>
                    {c.save}
                  </Button>
                </span>
              </div>
            )}
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
