"use client";

// Triage (#453, #499, #559, #560) — anything that might become work, in `docs/kanban/triage/`.
//
// The page is a board, not a document: a few hundred items, grouped by the source they came
// from, three light cards to a row. A source's name and mark are drawn once, on the group
// heading, so a card carries only what is its own — its title, and up to three of the values
// its source sent with it. Everything longer is behind the card.
//
// The whole main area is the list. There is no standing heading, lead paragraph or compose
// box above it: **Add** opens a small popover under its own button, and that is where a link,
// some words or a file goes in.
//
// **Ignored** is the same board, read only: what you or an agent judged, over the last 30
// days. A card there draws the judgement in place of the values a waiting one draws — the
// agent's own reason, or "you ignored it" — and there is no way back from it. Pasting the
// link in again is the way back, which is why **Add** stays on that tab too (#559).
//
// Nothing here is a card: nothing on this page creates one, ranks one, or touches the board's
// counts. Turning one into a card is #454's.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FiChevronDown,
  FiChevronRight,
  FiExternalLink,
  FiInbox,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { addToInboxAction, dismissSignalAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { useLanguage } from "@/components/language";
import {
  LANGUAGE_TAGS,
  type AgentInfo,
  type Language,
  type MemoryModule,
  type Signal,
  type SignalInbox,
} from "@/lib/types";
import { Button } from "./button";
import { CHROME, HAIRLINE } from "./chrome";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import { useOverRail } from "@/lib/over-rail";
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

type Tab = "pending" | "dismissed";

// Radix will not take an empty string as a value, and the empty string is already the key of
// the group nothing named a source for — so the picker carries two words of its own.
const EVERY = "*";
const NONE = "-";

/** How much of a group is drawn before **More**, and how much each press brings in. */
const FIRST = 6;
const MORE = 12;

// A collected stamp is `YYYY-MM-DD HH:MM` in the board's own local time, so it is read back
// as local time and drawn in the language the app is set to — an English date under a Chinese
// heading is the one thing on the row that didn't follow the setting.
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

/** A stamp as a number to sort on. One that will not read is the smallest there is, so an
 *  item with a broken or missing time sits at the end of its group rather than the top. */
function order(stamp: string): number {
  const at = new Date(stamp.replace(" ", "T")).getTime();
  return Number.isNaN(at) ? -Infinity : at;
}

/** Everything the search looks at: what it says, where it came from, the values its source
 *  sent, and — on the ignored side — why it was ignored. Never the keys: they are not drawn,
 *  so they are not searched. A record whose own words were never kept has only its source id
 *  to find it by, and that is what the id in the title position is. */
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
  type: string;
  items: Signal[];
}

/** The items in source groups: the board's own list in its own order first, then whatever
 *  keys came in from elsewhere by key, then the one group nothing named a source for. */
function groupBySource(signals: Signal[], listed: string[]): Group[] {
  const by = new Map<string, Signal[]>();
  for (const signal of signals) {
    const held = by.get(signal.sourceType);
    if (held) held.push(signal);
    else by.set(signal.sourceType, [signal]);
  }
  const known = new Set(listed);
  const rest = [...by.keys()].filter((type) => type && !known.has(type)).sort();
  const order = [
    ...listed.filter((type) => by.has(type)),
    ...rest,
    ...(by.has("") ? [""] : []),
  ];
  return order.map((type) => ({ type, items: by.get(type)! }));
}

// --- the page ---------------------------------------------------------------

/** What the page is drawn in. It keeps up on the two triggers the archive page uses — a run
 *  finishing, and the window being focused again — because the recurring pull is a run like
 *  any other, and it writes the files this page lists. */
function SignalsFrame({
  projectRoot,
  openIds,
  agent,
  goalWritten,
  memoryModules,
  desktop,
  children,
}: {
  projectRoot: string;
  openIds: number[];
  agent: AgentInfo;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const noRunsOfOurOwn = useCallback(() => {}, []);
  const { sessions } = useAgentSessions(noRunsOfOurOwn);
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

  return (
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentSignals
        memoryModules={memoryModules}
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
  memoryModules,
  desktop,
}: {
  inbox: SignalInbox;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
}) {
  const c = useCopy().rail.signals;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(EVERY);
  // Folded by hand, this visit only: one page's browsing state, not a setting.
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  // Dismissing is a write, so the list is redrawn from the server rather than from what this
  // page had. Held here only so the card goes the instant it is pressed.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState("");
  const [lit, setLit] = useState("");

  // Add, as a draft that outlives the popover: closing it is not throwing it away.
  const addRef = useRef<HTMLSpanElement>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [addNote, setAddNote] = useState("");
  const [landed, setLanded] = useState("");
  const [hidden, setHidden] = useState("");

  // What each tab holds, less anything just ignored: the counts have to agree with the page
  // the instant a card goes, not one server round trip later.
  const live = useCallback((signals: Signal[]) => signals.filter((s) => !gone.has(s.sourceId)), [gone]);
  const waiting = live(inbox.signals);
  const ignored = live(inbox.dismissed);
  const held = tab === "pending" ? inbox.signals : inbox.dismissed;
  const all = useMemo(() => {
    const live = held.filter((signal) => !gone.has(signal.sourceId));
    const stamp = (signal: Signal) =>
      tab === "dismissed" ? signal.dismissedAt : signal.collectedAt;
    return [...live].sort(
      (a, b) =>
        order(stamp(b)) - order(stamp(a)) ||
        a.sourceId.localeCompare(b.sourceId),
    );
  }, [held, gone, tab]);

  const needle = query.trim().toLowerCase();
  const picked = source === NONE ? "" : source;
  const narrowed = useMemo(
    () =>
      all.filter(
        (signal) =>
          matches(signal, needle) &&
          (source === EVERY || signal.sourceType === picked),
      ),
    [all, needle, source, picked],
  );
  const groups = useMemo(
    () => groupBySource(narrowed, inbox.sourceTypes),
    [narrowed, inbox.sourceTypes],
  );
  // Every source the page could offer, in the same order the groups come in — read off
  // everything in this tab, not off what the search left, so narrowing never empties it.
  const sources = useMemo(
    () => groupBySource(all, inbox.sourceTypes).map((group) => group.type),
    [all, inbox.sourceTypes],
  );

  // A search unfolds what it found, and leaves the fold as it was for when it is cleared.
  const searching = needle.length > 0;
  const isFolded = (type: string) => !searching && folded.has(`${tab}:${type}`);
  const fold = (type: string) =>
    setFolded((was) => {
      const next = new Set(was);
      const key = `${tab}:${type}`;
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // A different tab, search or source is a different list — how far each group was loaded
  // said nothing about this one.
  useEffect(() => setShown({}), [tab, needle, source]);

  const narrowing = searching || source !== EVERY;
  const clear = () => {
    setQuery("");
    setSource(EVERY);
  };

  const dismiss = async (sourceId: string) => {
    // Where the focus goes once the card is gone: the next one on the page, or the one before
    // it at the end of the list.
    const flat = groups.flatMap((group) =>
      isFolded(group.type) ? [] : group.items.map((s) => s.sourceId),
    );
    const at = flat.indexOf(sourceId);
    const near = flat[at + 1] ?? flat[at - 1] ?? "";

    setGone((was) => new Set(was).add(sourceId));
    const done = await dismissSignalAction(sourceId);
    if (!done.ok) {
      setGone((was) => {
        const next = new Set(was);
        next.delete(sourceId);
        return next;
      });
      setFailed(done.error ?? c.dismissFailed);
      return;
    }
    setFailed("");
    setOpen(null);
    if (near)
      requestAnimationFrame(() =>
        document.getElementById(`signal-${near}`)?.focus(),
      );
    reloadSignalsRow();
    router.refresh();
  };

  /** Take one item back into view, whatever is currently hiding it. */
  const show = useCallback((sourceId: string, type: string) => {
    setTab("pending");
    setQuery("");
    setSource(EVERY);
    setFolded((was) => {
      const next = new Set(was);
      next.delete(`pending:${type}`);
      return next;
    });
    setShown((was) => ({
      ...was,
      [`pending:${type}`]: Number.MAX_SAFE_INTEGER,
    }));
    setHidden("");
    setLit(sourceId);
    requestAnimationFrame(() =>
      document
        .getElementById(`signal-${sourceId}`)
        ?.scrollIntoView({ block: "center" }),
    );
  }, []);

  // What was just added: lit where it is showing, and offered where it is not. It is looked
  // for only once the server has handed the page a list that holds it.
  useEffect(() => {
    if (!landed) return;
    const item = inbox.signals.find((signal) => signal.sourceId === landed);
    if (!item) return;
    setLanded("");
    if (
      narrowed.some((signal) => signal.sourceId === landed) &&
      tab === "pending" &&
      !isFolded(item.sourceType)
    ) {
      setLit(landed);
      return;
    }
    setHidden(landed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed, inbox.signals, narrowed, tab]);

  useEffect(() => {
    if (!lit) return;
    const stop = setTimeout(() => setLit(""), 2400);
    return () => clearTimeout(stop);
  }, [lit]);

  const add = async () => {
    if (adding) return;
    if (!draft.trim() && !file) return;
    setAdding(true);
    setAddNote("");
    const form = new FormData();
    if (draft.trim()) form.set("text", draft.trim());
    if (file) {
      form.set("file", file);
      form.set("name", file.name);
    }
    const done = await addToInboxAction(form).catch(() => ({
      ok: false,
      error: c.add.failed,
      sourceId: "",
    }));
    setAdding(false);
    if (!done.ok) {
      // The draft is kept: whatever was wrong with it, it is still the reader's to fix.
      setAddNote(done.error ?? c.add.failed);
      return;
    }
    setDraft("");
    setFile(null);
    setOpenAdd(false);
    setFailed("");
    setLanded(done.sourceId ?? "");
    reloadSignalsRow();
    router.refresh();
  };

  const closeAdd = useCallback(() => {
    setOpenAdd(false);
    requestAnimationFrame(() =>
      addRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
  }, []);

  /** One file staged, from the button or from anywhere on the page. A second one is refused
   *  where it landed, and what was already there is left alone. */
  const stage = (files: FileList | File[]) => {
    const picked = Array.from(files);
    setOpenAdd(true);
    if (picked.length === 0) return;
    if (picked.length > 1 || file) {
      setAddNote(c.add.oneFile);
      return;
    }
    setAddNote("");
    setFile(picked[0]!);
  };

  const opened = open
    ? all.find((signal) => signal.sourceId === open)
    : undefined;
  // No endpoint is not an empty inbox: one is a board nothing has been pulled into, the other
  // is a board that was never pointed anywhere. They read differently or the second one looks
  // like the first and nobody goes looking for the setting. A board with no endpoint still
  // takes what is added by hand (#499), so this is an offer and never a demand.
  const unconfigured = inbox.missing.length > 0 && inbox.signals.length === 0;

  return (
    <SignalsFrame
      projectRoot={projectRoot}
      openIds={openIds}
      agent={agent}
      goalWritten={goalWritten}
      memoryModules={memoryModules}
      desktop={desktop}
    >
      <div
        className="relative flex h-full min-h-0 flex-col"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          // Text dragged around the page is the caret's, and never an item.
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          stage(e.dataTransfer.files);
        }}
      >
        <RunningNotice desktop={desktop} />

        <div
          className="flex shrink-0 items-center gap-2 px-6 py-2.5 max-md:px-4"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <span
            className={`inline-flex h-7 shrink-0 overflow-hidden rounded-[8px] bg-nb-paper ${CHROME}`}
          >
            <TabButton
              label={c.pending}
              count={waiting.length}
              on={tab === "pending"}
              onClick={() => setTab("pending")}
            />
            <TabButton
              label={c.dismissed}
              count={ignored.length}
              on={tab === "dismissed"}
              onClick={() => setTab("dismissed")}
              divided
            />
          </span>
          {tab === "dismissed" && (
            <span className="shrink-0 text-[11.5px] text-nb-ink-soft">
              {c.window(inbox.dismissedDays)}
            </span>
          )}
          {narrowing && (
            <span className="shrink-0 text-[11.5px] tabular-nums text-nb-ink-soft">
              {c.hits(narrowed.length, all.length)}
            </span>
          )}
          <span className="flex-1" />

          <label className="relative inline-flex h-7 min-w-0 shrink items-center">
            <FiSearch
              size={13}
              className="absolute left-2.5 text-nb-ink-soft"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.search}
              aria-label={c.search}
              className="h-7 w-[220px] min-w-[92px] rounded-[8px] bg-nb-paper pl-7 pr-2.5 text-[12px] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_22%,transparent)] placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none max-md:w-[140px]"
            />
          </label>

          <Select value={source} onValueChange={setSource}>
            <SelectTrigger
              aria-label={c.allSources}
              className="h-7 w-auto max-w-[160px] shrink-0 gap-1.5 rounded-[8px] border-0 bg-nb-paper px-2.5 py-0 text-[12px] font-[600] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_22%,transparent)]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EVERY}>{c.allSources}</SelectItem>
              {sources.map((type) => (
                <SelectItem key={type || NONE} value={type || NONE}>
                  {sourceName(type, c.noSource)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span ref={addRef} className="relative inline-flex shrink-0">
            <Button
              size="xs"
              aria-expanded={openAdd}
              onClick={() => (openAdd ? closeAdd() : setOpenAdd(true))}
            >
              <FiPlus size={13} aria-hidden />
              {c.add.open}
            </Button>
            {openAdd && (
              <AddPopover
                draft={draft}
                file={file}
                note={addNote}
                busy={adding}
                onDraft={setDraft}
                onPick={stage}
                onDrop={() => setFile(null)}
                onClose={closeAdd}
                onAdd={() => void add()}
              />
            )}
          </span>
        </div>

        {(failed || hidden) && (
          <div className="shrink-0 px-6 pt-2.5 max-md:px-4">
            {failed && (
              <p className="rounded-[9px] bg-nb-peach-soft px-3.5 py-2 text-[12px] leading-[16px] text-nb-ink">
                {failed}
              </p>
            )}
            {hidden && (
              <p className="flex items-center gap-2 rounded-[9px] bg-nb-peach-soft px-3.5 py-2 text-[12px] leading-[16px] text-nb-ink">
                {c.add.hidden}
                <button
                  type="button"
                  onClick={() =>
                    show(
                      hidden,
                      inbox.signals.find((s) => s.sourceId === hidden)
                        ?.sourceType ?? "",
                    )
                  }
                  className="cursor-pointer font-[700] text-nb-accent-deep underline underline-offset-2"
                >
                  {c.add.show}
                </button>
              </p>
            )}
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <div className="flex h-full flex-col overflow-y-auto px-6 py-4 max-md:px-4">
            {groups.length === 0 ? (
              <Empty
                title={
                  narrowing
                    ? c.noHits
                    : tab === "dismissed"
                      ? c.emptyDismissed
                      : c.empty
                }
                hint={
                  narrowing
                    ? ""
                    : tab === "dismissed"
                      ? c.emptyDismissedHint
                      : c.emptyHint
                }
                searched={narrowing}
              >
                {narrowing ? (
                  <button
                    type="button"
                    onClick={clear}
                    className="cursor-pointer text-[12px] font-[700] text-nb-accent-deep underline underline-offset-2"
                  >
                    {c.clear}
                  </button>
                ) : (
                  unconfigured && <EndpointLink label={c.connect} />
                )}
              </Empty>
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map((group) => (
                  <SourceSection
                    key={group.type || "none"}
                    group={group}
                    dismissed={tab === "dismissed"}
                    folded={isFolded(group.type)}
                    shown={shown[`${tab}:${group.type}`] ?? FIRST}
                    lit={lit}
                    onFold={() => fold(group.type)}
                    onMore={() =>
                      setShown((was) => ({
                        ...was,
                        [`${tab}:${group.type}`]:
                          (was[`${tab}:${group.type}`] ?? FIRST) + MORE,
                      }))
                    }
                    onOpen={setOpen}
                  />
                ))}
              </div>
            )}

            {unconfigured && groups.length > 0 && (
              <p className="mt-4">
                <EndpointLink label={c.connect} />
              </p>
            )}
          </div>

          {opened && (
            <SignalDetail
              signal={opened}
              readOnly={tab === "dismissed"}
              onClose={() => {
                const back = opened.sourceId;
                setOpen(null);
                requestAnimationFrame(() =>
                  document.getElementById(`signal-${back}`)?.focus(),
                );
              }}
              onDismiss={() => void dismiss(opened.sourceId)}
            />
          )}
        </div>
      </div>
    </SignalsFrame>
  );
}

/** Where to read about serving and pointing at an endpoint. */
const ENDPOINT_DOCS = "https://ai4kanban.dev/docs/triage-endpoint";

/** A page with nothing on it: one centered block, no frame. A panel drawn across the pane
 *  reads as content that failed to load rather than as a page waiting to be filled. */
function Empty({
  title,
  hint,
  searched,
  children,
}: {
  title: string;
  hint?: string;
  /** A search that found nothing, drawn with the search's own mark. */
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
      {hint && (
        <p className="mt-1 text-[12.5px] leading-relaxed text-nb-ink-soft">
          {hint}
        </p>
      )}
      {children && <span className="mt-3 inline-flex">{children}</span>}
    </div>
  );
}

/** The offer to pull from an endpoint: the docs, and nothing about which setting is missing
 *  — the page they open says what to serve and where the two settings go. */
function EndpointLink({ label }: { label: string }) {
  return (
    <a
      href={ENDPOINT_DOCS}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[12px] font-[700] text-nb-accent-deep underline underline-offset-2"
    >
      {label}
      <FiExternalLink size={11} aria-hidden />
    </a>
  );
}

/** One of the two tabs, with what it holds. */
function TabButton({
  label,
  count,
  on,
  divided,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  divided?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex h-full cursor-pointer items-center gap-1.5 px-3 text-[12px] font-[700] transition-colors"
      style={{
        background: on ? "var(--color-nb-peach-soft)" : undefined,
        color: on ? "var(--color-nb-accent-deep)" : "var(--color-nb-ink-soft)",
        boxShadow: divided ? `inset 1px 0 0 ${HAIRLINE}` : undefined,
      }}
    >
      {label}
      <span className="tabular-nums opacity-75">{count}</span>
    </button>
  );
}

/** One source: its mark and name once, then its items three to a row.
 *
 *  The count on the heading is everything the current search and source found in this group,
 *  whatever part of it is drawn — folding a group or leaving the rest of it unloaded is not
 *  the same as it holding less. */
function SourceSection({
  group,
  dismissed,
  folded,
  shown,
  lit,
  onFold,
  onMore,
  onOpen,
}: {
  group: Group;
  dismissed: boolean;
  folded: boolean;
  shown: number;
  lit: string;
  onFold: () => void;
  onMore: () => void;
  onOpen: (sourceId: string) => void;
}) {
  const c = useCopy().rail.signals;
  const name = sourceName(group.type, c.noSource);
  const drawn = folded ? [] : group.items.slice(0, shown);

  return (
    <section>
      <button
        type="button"
        onClick={onFold}
        aria-expanded={!folded}
        // The source is what tells one heading from the next, so it stays in the name the
        // button is read out by; the word for the press follows it.
        aria-label={`${name} ${folded ? c.unfold : c.fold}`}
        className="mb-2 flex h-6 w-full cursor-pointer items-center gap-2 text-[12px] font-[700]"
      >
        {folded ? (
          <FiChevronRight size={13} className="text-nb-ink-soft" aria-hidden />
        ) : (
          <FiChevronDown size={13} className="text-nb-ink-soft" aria-hidden />
        )}
        <SourceMark type={group.type} size={14} />
        <span className="truncate">{name}</span>
        <span className="font-[400] tabular-nums text-nb-ink-soft">
          {group.items.length}
        </span>
        <span className="ml-1 h-px flex-1" style={{ background: HAIRLINE }} />
      </button>
      {!folded && (
        <>
          <ul
            aria-label={name}
            className="grid grid-cols-3 gap-3 max-[1200px]:grid-cols-2 max-md:grid-cols-1"
          >
            {drawn.map((signal) => (
              <SignalCard
                key={signal.sourceId}
                signal={signal}
                dismissed={dismissed}
                lit={lit === signal.sourceId}
                onOpen={onOpen}
              />
            ))}
          </ul>
          {group.items.length > drawn.length && (
            <button
              type="button"
              onClick={onMore}
              className="mt-2 inline-flex h-7 cursor-pointer items-center text-[12px] font-[700] text-nb-accent-deep"
            >
              {c.more}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** One item, as small as it can be and still be worth reading: two lines of title, and one
 *  line under it. Waiting, that line is up to three of the values its source sent — the keys
 *  are not drawn, because `r/productivity` says what it is and `subreddit:` says it twice.
 *  Ignored, it is the judgement instead: the agent's own reason, or that you ignored it.
 *
 *  A record carried over from a board that kept only source ids has neither a title nor its
 *  own words, so the id stands in the title position — monospaced, because that is what it
 *  is — and a chip says its content was not kept and when it was judged. */
function SignalCard({
  signal,
  dismissed,
  lit,
  onOpen,
}: {
  signal: Signal;
  dismissed: boolean;
  lit: boolean;
  onOpen: (sourceId: string) => void;
}) {
  const c = useCopy().rail.signals;
  const language = useLanguage();
  const said = dismissed
    ? signal.dismissedReason || (signal.dismissedBy === "user" ? c.byYou : "")
    : signal.meta
        .slice(0, 3)
        .map((pair) => pair.value)
        .join(" · ");
  return (
    <li>
      <button
        type="button"
        id={`signal-${signal.sourceId}`}
        onClick={() => onOpen(signal.sourceId)}
        className="flex h-[80px] w-full cursor-pointer flex-col rounded-[9px] bg-nb-wash px-3 py-2.5 text-left transition-shadow hover:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]"
        style={
          lit
            ? { boxShadow: "inset 0 0 0 1.5px var(--color-nb-accent)" }
            : undefined
        }
      >
        {signal.contentKept ? (
          <p className="line-clamp-2 text-[13px] font-[600] leading-[19px]">
            {signal.title}
          </p>
        ) : (
          <p className="truncate font-mono text-[12px] font-[600] leading-[19px] text-nb-ink-soft">
            {signal.sourceId}
          </p>
        )}
        {signal.contentKept ? (
          said && (
            <p className="mt-auto truncate text-[11.5px] leading-[17px] text-nb-ink-soft">
              {said}
            </p>
          )
        ) : (
          <span className="mt-auto inline-flex max-w-full items-center truncate rounded-[6px] bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] px-1.5 py-0.5 text-[11px] leading-[15px] text-nb-ink-soft">
            {c.contentGone}
            {signal.dismissedAt && ` · ${when(signal.dismissedAt, language)}`}
          </span>
        )}
      </button>
    </li>
  );
}

/** One item in full, in a panel over the right of the page: everything the card had to cut,
 *  and the two things you may do with it. What has already been ignored is read only, and
 *  says when and why it was. */
function SignalDetail({
  signal,
  readOnly,
  onClose,
  onDismiss,
}: {
  signal: Signal;
  readOnly: boolean;
  onClose: () => void;
  onDismiss: () => void;
}) {
  const copy = useCopy();
  const c = copy.rail.signals;
  const language = useLanguage();
  useOverRail();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const line = (label: string, said: string) =>
    said ? (
      <p className="text-[12px] leading-[18px] text-nb-ink-soft">
        <span className="font-[700]">{label}</span> {said}
      </p>
    ) : null;

  return (
    <aside
      role="dialog"
      aria-label={c.detail}
      className="absolute inset-y-0 right-0 z-30 flex w-[420px] max-w-full flex-col bg-nb-paper max-md:w-full"
      style={{ borderLeft: `1px solid ${HAIRLINE}` }}
    >
      <div
        className="flex shrink-0 items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
      >
        {/* Nothing said a source: the panel says nothing either. "No source given" is the
            name of a group and never of an item. */}
        <SourceMark type={signal.sourceType} size={14} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-[700]">
          {sourceName(signal.sourceType, "")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.shared.close}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]"
        >
          <FiX size={14} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        {/* A record whose own words were never kept has nothing to head it but its id, and
            saying so once is better than an empty heading over an empty body. */}
        {signal.contentKept ? (
          <h2 className="text-[14px] font-[700] leading-[20px]">
            {signal.title}
          </h2>
        ) : (
          <>
            <h2 className="break-all font-mono text-[13px] font-[700] leading-[20px]">
              {signal.sourceId}
            </h2>
            <p className="mt-2 text-[12px] leading-[18px] text-nb-ink-soft">
              {c.contentGone}
            </p>
          </>
        )}
        {signal.summary && (
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-[19px]">
            {signal.summary}
          </p>
        )}
        {signal.meta.length > 0 && (
          <p className="mt-3 text-[12px] leading-[18px] text-nb-ink-soft">
            {signal.meta.map((pair) => pair.value).join(" · ")}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-1">
          {line(c.collected, when(signal.collectedAt, language))}
          {line(
            c.dismissedAt,
            signal.dismissedAt ? when(signal.dismissedAt, language) : "",
          )}
          {line(
            c.dismissedWhy,
            signal.dismissedReason ||
              (signal.dismissedBy === "user" ? c.byYou : ""),
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1 px-4 py-2.5"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      >
        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-accent-deep transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] max-md:h-11 max-md:px-3"
          >
            <FiExternalLink size={12} aria-hidden />
            {c.viewOriginal}
          </a>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-ink-soft transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] hover:text-nb-ink max-md:h-11 max-md:px-3"
          >
            <FiTrash2 size={12} aria-hidden />
            {c.dismiss}
          </button>
        )}
      </div>
    </aside>
  );
}

/** Add to triage (#499, #560): a small panel under the button that opened it.
 *
 *  One box takes all three ways in — a link, some words, or a note alongside a file — and
 *  nothing is written until **Add** is pressed. A file dropped anywhere on the page is held
 *  here by name until then: a drop is an intention, not a decision, and an item written the
 *  moment something landed could not be taken back. */
function AddPopover({
  draft,
  file,
  note,
  busy,
  onDraft,
  onPick,
  onDrop,
  onClose,
  onAdd,
}: {
  draft: string;
  file: File | null;
  note: string;
  busy: boolean;
  onDraft: (text: string) => void;
  onPick: (files: FileList | File[]) => void;
  onDrop: () => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const copy = useCopy();
  const c = copy.rail.signals;
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);
  useOverRail();

  useEffect(() => {
    text.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      const at = e.target as Node;
      if (
        !box.current?.contains(at) &&
        !box.current?.parentElement?.contains(at)
      )
        onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const ready = Boolean(draft.trim() || file);

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={c.add.title}
      className="nb-panel-sm absolute right-0 top-[calc(100%+8px)] z-40 w-[min(328px,calc(100vw-32px))] bg-nb-paper p-4 text-left"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-[700]">{c.add.title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.shared.close}
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-[7px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]"
        >
          <FiX size={13} aria-hidden />
        </button>
      </div>

      <textarea
        ref={text}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        // Enter is a new line. Only the modifier sends it — and never while an input method
        // still has the keystroke, where Enter is choosing a word.
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
          if (composing || e.nativeEvent.isComposing) return;
          e.preventDefault();
          if (ready && !busy) onAdd();
        }}
        rows={4}
        disabled={busy}
        placeholder={c.add.placeholder}
        aria-label={c.add.title}
        className="w-full resize-none rounded-[8px] bg-nb-paper px-3 py-2.5 text-[13px] leading-[20px] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_22%,transparent)] placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none disabled:opacity-60"
      />

      {file && (
        <div className="mt-2.5 flex">
          <span className="inline-flex h-7 max-w-full items-center gap-2 rounded-[7px] bg-nb-wash px-2 text-[11.5px] text-nb-ink-soft">
            <FiPaperclip size={12} aria-hidden />
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={onDrop}
              aria-label={c.add.remove}
              disabled={busy}
              className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] disabled:cursor-not-allowed"
            >
              <FiX size={11} aria-hidden />
            </button>
          </span>
        </div>
      )}

      {note && (
        <p className="mt-2 text-[11.5px] leading-[16px] text-nb-ink">{note}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <input
          ref={picker}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={busy}
          className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-[600] text-nb-ink-soft transition-colors hover:text-nb-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiPaperclip size={13} aria-hidden />
          {c.add.attach}
        </button>
        <Button size="xs" disabled={busy || !ready} onClick={onAdd}>
          {c.add.button}
        </Button>
      </div>
    </div>
  );
}
