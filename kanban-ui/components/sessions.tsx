"use client";

// Shared client plumbing for the run registry (task #12). Both the board and
// the card page use it to: poll the server-side registry, know which cards have a
// live agent, start a run without blocking, and get told when a run they
// started finishes (to show its result and refresh). It also hosts the global
// runs panel (task #21) — the header's activity button and its two-pane
// history dialog.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiPlay,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { useLanguage } from "@/components/language";
import type { RunsCopy } from "@/i18n/runs/types";
import { useCopy } from "@/i18n/use-copy";
import { useAgentName } from "@/lib/agent-name";
import { useOverRail } from "@/lib/over-rail";
import { useSwipeBack } from "@/lib/swipe-back";
import { useActions, type ScreenActions, type StartAnswer } from "@/lib/screen";
import {
  flowLabel,
  flowOf,
  flowSaid,
  runFlows,
  stepLabel,
  triggerLabel,
  unfinishedFlows,
  unhandledByCard,
  unhandledFlows,
  type RunFlow,
  type RunLabels,
} from "@/lib/run-flows";
import {
  deskSpot,
  finishedAt,
  placeWorkers,
  restingIds,
  SOFA_SPOTS,
  type Placement,
  type SceneBot,
} from "@/lib/run-scene";
import { LANGUAGE_TAGS, type Language, type SessionView } from "@/lib/types";
import {
  cardlessTitle,
  EmptyRunBar,
  RunBar,
  SessionLog,
  type AgentReq,
  type RunHead,
} from "./agent-shared";
import { Button } from "./button";
import { TOOL_BTN } from "./chrome";
import { Copied, useCopyText } from "./copy";
import { botTargetId, RunScene } from "./RunScene";

const POLL_MS = 1500; // while a run is live
const IDLE_POLL_MS = 5000; // while nothing is running — see the effect below
const LOG_POLL_MS = 1200; // how often the live log tail refreshes

// A run this tab started, remembered until it finishes so onFinish can fire once.
export interface StartedSession {
  sessionId: string;
  label: string;
  // reject/archive take the card off the board — on success we navigate home, not refresh.
  removes: boolean;
}

export function useAgentSessions(onFinish: (session: SessionView, started: StartedSession) => void) {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const mine = useRef<Map<string, StartedSession>>(new Map());
  // Keep onFinish in a ref so the poll effect doesn't restart when the page
  // passes a fresh closure each render.
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  // The actions this screen was handed (#374). Held in a ref for the same reason: the poll
  // below is installed once. A screen handed none never polls — there are no runs to read
  // where there is nothing to run them.
  const actions = useActions();
  const actionsRef = useRef<ScreenActions | null>(actions);
  actionsRef.current = actions;
  const canRun = !!actions;
  // A kick() the effect installs, so start() and tab-focus can force an immediate
  // poll and wake the loop when it's dormant. See the effect below.
  const kickRef = useRef<() => void>(() => {});

  // A quiet board CAN go stale on its own: the dispatcher (#43) starts recurring
  // runs from a server-side timer, and a run that ends starts the refine of each
  // card it touched (#211) — neither needs a user action in any tab. So an idle
  // tab must keep polling: an idle loop that goes dormant would never witness one
  // of those start, finish, or rewrite the card, and the running-set diffs in
  // Board/CardPage would have no transition to fire on.
  // What we vary is the cadence, not whether we poll: fast while something is
  // live, slow while idle. A hidden tab still stops entirely and wakes on focus
  // (useOnTabFocus re-reads unconditionally), so a backgrounded board costs
  // nothing.
  useEffect(() => {
    if (!canRun) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const tick = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const next = (await actionsRef.current?.listSessions()) ?? [];
        if (!alive) return;
        // Fire onFinish for any run this tab started that just went terminal.
        for (const r of next) {
          const started = mine.current.get(r.sessionId);
          if (started && r.status !== "running") {
            mine.current.delete(r.sessionId);
            finishRef.current(r, started);
          }
        }
        setSessions(next);
        // Live (or awaiting one of ours) → tight loop for the badges and log
        // tail. Idle → slow loop, so the next background refine is picked up
        // within seconds of starting.
        const live = next.some((r) => r.status === "running") || mine.current.size > 0;
        clearTimeout(timer);
        if (document.visibilityState === "visible") {
          timer = setTimeout(tick, live ? POLL_MS : IDLE_POLL_MS);
        }
      } catch {
        // transient — back off to the idle cadence and keep the loop alive
        if (alive && document.visibilityState === "visible") {
          clearTimeout(timer);
          timer = setTimeout(tick, IDLE_POLL_MS);
        }
      } finally {
        inFlight = false;
      }
    };

    kickRef.current = () => {
      if (!alive) return;
      clearTimeout(timer);
      tick();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") kickRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    tick();

    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [canRun]);

  // Start a session. Returns the server's answer: ok with a sessionId, or a lock
  // message. A screen with no actions draws nothing that calls this, so a bare
  // refusal is enough — the caller's own line says a run could not be started.
  const start = useCallback(
    async (req: AgentReq, label: string, removes = false): Promise<StartAnswer> => {
      const run = actionsRef.current;
      if (!run) return { ok: false };
      const res = await run.startAgent(req);
      if (res.ok && res.sessionId) {
        mine.current.set(res.sessionId, { sessionId: res.sessionId, label, removes });
        kickRef.current(); // watch it immediately instead of waiting for a tick
      }
      return res;
    },
    [],
  );

  // Take on a run this tab caused but didn't start through `start` above.
  // A plan-release run is the case (#165): the server starts it as part of
  // writing the release, so the run id comes back from that action rather
  // than from here. Same effect either way — onFinish fires for it, and the poll
  // wakes at once, so the run joins the runs panel in the same moment the
  // release does rather than up to a slow tick later.
  const watch = useCallback((sessionId: string, label: string, removes = false) => {
    mine.current.set(sessionId, { sessionId, label, removes });
    kickRef.current();
  }, []);

  // Force an immediate poll. `start` does this itself; a caller that made the
  // registry move some other way (resuming a failed run) uses this so the new
  // run shows up now instead of on the next idle tick.
  const kick = useCallback(() => kickRef.current(), []);

  return { sessions, start, watch, kick };
}

// Run `fn` each time the tab becomes visible again. A hidden tab stops polling,
// and the running-set diff a view uses to catch finishes only fires on a
// running→finished change the view actually witnessed while polling. A run
// that both starts and finishes while the tab is hidden is never witnessed, so
// on focus that diff finds nothing and the view stays stale. An unconditional
// re-read on focus is always correct and doesn't depend on witnessing the
// transition — it also covers a finished run evicted from the kept-30 window
// before the tab woke. Board and CardPage both use this to re-read on focus.
export function useOnTabFocus(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}

// Card ids that currently have a running agent (from any tab).
export function runningCardIds(sessions: SessionView[]): Set<number> {
  const ids = new Set<number>();
  for (const r of sessions) {
    if (r.status === "running" && r.cardId !== null) ids.add(r.cardId);
  }
  return ids;
}

// The newest run (live or finished) that touched this card, so the card page
// can tail the live one and re-open the last finished one from the same slot.
export function latestSessionForCard(sessions: SessionView[], cardId: number): SessionView | undefined {
  let best: SessionView | undefined;
  for (const r of sessions) {
    if (r.cardId === cardId && (!best || r.startedAt > best.startedAt)) best = r;
  }
  return best;
}

// The live run on this card, if any (used to open its log from a board badge).
export function runningSessionForCard(sessions: SessionView[], cardId: number): SessionView | undefined {
  return sessions.find((r) => r.status === "running" && r.cardId === cardId);
}

/** The run this card's failure mark opens (#809), or nothing where the card has none.
 *
 *  The answer is about every run on the board, not this card's — a later success anywhere
 *  clears an earlier failure — so it is worked out once for the whole list and held against
 *  the array it was read from. A column asks this once per card, and the poll hands every
 *  card in a render the same array. */
export function unhandledSessionForCard(sessions: SessionView[], cardId: number): SessionView | undefined {
  if (sessions !== unhandledFor) {
    unhandledFor = sessions;
    unhandled = new Map(
      [...unhandledByCard(runFlows(sessions))].map(([id, flow]) => [id, flow.latest]),
    );
  }
  return unhandled.get(cardId);
}
let unhandledFor: SessionView[] | null = null;
let unhandled = new Map<number, SessionView>();

// Tail one session's log. Polls getSessionAction while the session is live (task
// #14 reuses the poll channel — no SSE, matching the run badges), then
// fetches once more when it ends and stops. Pass null to watch nothing. Returns
// the run with its log tail, or null while it hasn't loaded / the run is
// unknown.
export function useSessionLog(sessionId: string | null): SessionView | null {
  const [log, setLog] = useState<SessionView | null>(null);
  const actions = useActions();
  const actionsRef = useRef<ScreenActions | null>(actions);
  actionsRef.current = actions;
  useEffect(() => {
    if (!sessionId) {
      setLog(null);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = (await actionsRef.current?.getSession(sessionId)) ?? null;
        if (!alive) return;
        setLog(r);
        // Keep polling only while the run is live; a terminal tail is final.
        if (r && r.status === "running") timer = setTimeout(tick, LOG_POLL_MS);
      } catch {
        if (alive) timer = setTimeout(tick, LOG_POLL_MS);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sessionId]);
  return log;
}

// --- the global runs panel (task #21) ---------------------------------------

// A tiny shared store so the header's Create button (a sibling component) can pop
// the runs panel open on the run it just started — without threading
// state through the server-rendered Header. One store per browser tab; the
// panel's open/selected state lives here so any header control can drive it.
type PanelState = {
  open: boolean;
  selected: string | null;
  /** Show the selected run's LOG, not just the room it is in (#809) — what a caller that is
   *  pointing at one run rather than at the panel asks for. Taken by the dialog the moment it
   *  draws, so closing the log afterwards sticks. */
  log?: boolean;
};
let panelState: PanelState = { open: false, selected: null };
const panelSubs = new Set<() => void>();
function setPanel(next: PanelState) {
  panelState = next;
  for (const fn of panelSubs) fn();
}
export const sessionsPanel = {
  // Open the panel; optionally select a run (e.g. the create just started). A
  // missing selection keeps whatever was selected, so the panel defaults to the
  // newest session (see SessionsDialog).
  open(selected?: string | null) {
    setPanel({ open: true, selected: selected ?? panelState.selected });
  },
  close() {
    setPanel({ open: false, selected: panelState.selected });
  },
  toggle() {
    setPanel({ open: !panelState.open, selected: panelState.selected });
  },
  select(sessionId: string) {
    setPanel({ open: true, selected: sessionId });
  },
  /** Open on one run's log. The notification rail's own rows use it: a row about a run that
   *  stopped short leads to the reason it did, and nothing else says that. */
  openLog(sessionId: string) {
    setPanel({ open: true, selected: sessionId, log: true });
  },
  /** The dialog has the log up — the ask is spent. */
  logShown() {
    if (panelState.log) setPanel({ ...panelState, log: false });
  },
};
function usePanelState(): PanelState {
  return useSyncExternalStore(
    (fn) => {
      panelSubs.add(fn);
      return () => panelSubs.delete(fn);
    },
    () => panelState,
    () => panelState,
  );
}

// A relative "2m ago" for the run list; an absolute stamp for the detail
// header. Both read the clock at render — fine, the poll re-renders while
// runs are live.
function relTime(ts: number, c: RunsCopy["panel"]): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return c.justNow;
  const m = Math.round(s / 60);
  if (m < 60) return c.minutesAgo(m);
  const h = Math.round(m / 60);
  if (h < 24) return c.hoursAgo(h);
  return c.daysAgo(Math.round(h / 24));
}
// Dated in the language the app is set to, not in the browser's own: an English date
// under a Chinese heading is the one word on the row that didn't follow the setting.
function fullTime(ts: number, language: Language): string {
  return new Date(ts).toLocaleString(LANGUAGE_TAGS[language], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The status dot shown against each run in the list: a pulsing ember while
// live, mint when it passed, sky when the user stopped it, peach otherwise. Peach
// covers both a failed run and an interrupted one (a run that outlived a UI
// restart — see registry): the dot only says whether the run got there, and
// neither of those did. Which one it was, and what to do about it, is the log
// pane's word. A stopped run (#49) is the one that reached no end and yet is not
// a problem — someone ended it on purpose — so it takes the board's neutral blue
// rather than the peach of something that went wrong.
function SessionDot({ session }: { session: SessionView }) {
  if (session.status === "running") {
    return (
      <span
        className="size-[8px] shrink-0 rounded-full bg-nb-accent-deep animate-[nbPulse_1.1s_ease-in-out_infinite]"
        aria-hidden
      />
    );
  }
  const tone =
    session.status === "stopped" ? "bg-nb-sky" : session.ok ? "bg-nb-mint" : "bg-nb-peach";
  return <span className={`size-[8px] shrink-0 rounded-full ${tone}`} aria-hidden />;
}

// One row of the run list — one job, however many sessions it took (lib/run-flows.ts).
//
// A job of one session is that one row and nothing else: a timeline of a single step says
// nothing the row hasn't already said. A job of several always shows them, with no control
// to hide them — the sessions are the only place to reach one, and there is nothing to save
// by folding two or three lines away.
function FlowRow({
  flow,
  selectedId,
  onOpen,
}: {
  flow: RunFlow;
  selectedId: string | null;
  /** Where the row is a drawer's, the press that selects also opens the log beside it. */
  onOpen?: () => void;
}) {
  const t = useCopy();
  const c = t.runs.panel;
  const language = useLanguage();
  const steps = flow.sessions.length > 1 ? flow.sessions : [];
  const holds = flow.sessions.some((s) => s.sessionId === selectedId);
  const said = flow.cardId === null ? flowSaid(flow) : "";
  // The row stands for the job, so it selects the session the job is ON: the live one, or
  // the one it ended with.
  const head = flow.latest;

  return (
    <div className="border-b border-nb-ink/8">
      <button
        type="button"
        onClick={() => {
          sessionsPanel.select(head.sessionId);
          onOpen?.();
        }}
        className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
          holds ? "bg-nb-paper shadow-[inset_2.5px_0_0_0_var(--color-nb-accent)]" : "hover:bg-nb-wash/70"
        }`}
      >
        <SessionDot session={head} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className={`shrink-0 text-[12.5px] font-[700] ${holds ? "text-nb-ink" : "text-nb-ink-soft"}`}>
              {flowLabel(flow, t.runs)}
            </span>
            {/* The card, or — with none — the sentence the job was started with (#428),
                truncated to the row. A build with no card has nothing else that says what
                it was for, and a create's description reads better there than a dash. */}
            <span className="min-w-0 truncate text-[11px] text-nb-ink-soft">
              {flow.cardId !== null ? `#${flow.cardId}` : said || t.shared.none}
            </span>
            {/* A cancelled delivery, said on the row itself: its run reads
                "stopped", which describes the run and not what happened to the
                job it was part of. */}
            {head.delivery?.status === "cancelled" && (
              <span className="text-[10.5px] text-nb-ink-soft">{c.cancelled}</span>
            )}
          </span>
          <span className="block truncate text-[10.5px] text-nb-ink-soft">
            {steps.length > 0 && `${c.steps(steps.length)} · `}
            {relTime(flow.startedAt, c)}
          </span>
        </span>
      </button>
      {/* The sessions, threaded on a rail through their own dots: the job ran them in this
          order, and a timeline says so at a glance. The rail stops at the last dot rather
          than running past it, so where the job has got to is the line's end. */}
      {steps.length > 0 && (
        <div className="pb-1">
          {steps.map((s, i) => {
            const active = s.sessionId === selectedId;
            const last = i === steps.length - 1;
            const why = triggerLabel(s.trigger, t.runs);
            return (
              <button
                key={s.sessionId}
                type="button"
                onClick={() => {
                  sessionsPanel.select(s.sessionId);
                  onOpen?.();
                }}
                title={fullTime(s.startedAt, language)}
                className={`relative flex w-full cursor-pointer items-center gap-2 py-1.5 pl-7 pr-3 text-left transition-colors ${
                  active ? "bg-nb-paper" : "hover:bg-nb-wash/70"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute left-[31.5px] w-px bg-nb-ink/15 ${last ? "top-0 h-1/2" : "inset-y-0"}`}
                />
                {/* Lifted over the rail, or the hairline draws straight across the dot. */}
                <span className="relative z-[1] flex shrink-0">
                  <SessionDot session={s} />
                </span>
                <span className={`text-[11.5px] ${active ? "font-[700] text-nb-ink" : "text-nb-ink-soft"}`}>
                  {stepLabel(s.action, t.runs)}
                </span>
                {/* Why this review is happening, when it isn't the first after a build
                    (#417). The step keeps its own label and this sits beside it, so the row
                    reads as one sentence instead of saying "review" twice. */}
                {!!why && <span className="text-[10.5px] text-nb-ink-soft">· {why}</span>}
                {/* A job can range over several cards — a create writes three and refines
                    each. The step says which one, when it isn't the job's own. */}
                {s.cardId !== null && s.cardId !== flow.cardId && (
                  <span className="text-[10.5px] text-nb-ink-soft">#{s.cardId}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// The board's last word on a job that ended with its card still unsettled
// (agent/refine.ts). It rides on the final session's record, where it reads as that one
// run's footnote — here it is what it actually is, how the JOB ended, and so it is shown
// whichever step is open. The session that carries it prints it itself, under its log.
function FlowEnding({ flow, selectedId }: { flow: RunFlow; selectedId: string | null }) {
  const last = flow.latest;
  if (selectedId === last.sessionId || !last.note) return null;
  return (
    <p className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2 text-[12.5px] leading-relaxed text-nb-peach-ink">
      {last.note}
    </p>
  );
}

// Where a card-less delivery stands, drawn on the flow that belongs to it (#428).
//
// A carded delivery says this in its card page's title band, and the board sends the reader
// there. A build with no card has no page, so the pause rides on the run
// (lib/registry.ts) and is read here — the reason, and the commands that answer it, which
// the delivery's own state already words.
//
// Only a pause is drawn. A delivery that is simply working says so by running, and a second
// line repeating it is a line the reader learns to skip.
function DeliveryStop({ session }: { session: SessionView }) {
  const c = useCopy().runs.panel;
  const state = session.delivery?.state;
  if (!session.delivery?.cardless || !state?.paused) return null;
  return (
    <div className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2.5 text-nb-peach-ink">
      <p className="nb-tag mb-1.5 text-nb-peach-ink">{c.stopped(state.label)}</p>
      <p className="text-[12.5px] leading-relaxed text-nb-ink">
        {/* Each command in the line is one press away from the clipboard: the way out of
            this stop is a command, and there is no card page with a button on it. */}
        {state.line.split(/`([^`]+)`/).map((part, i) =>
          i % 2 === 0 ? <Fragment key={i}>{part}</Fragment> : <CopyCommand key={i} text={part} />,
        )}
      </p>
    </div>
  );
}

// What a card-less build left behind, when the board kept it (#720).
//
// Every other ending clears its own checkout up. This one is kept because the job can still
// be carried on — and with no card page to offer that on, the run's own window is where the
// work is named and the two things to do with it sit.
function DeliveryKept({
  session,
  onMoved,
}: {
  session: SessionView;
  onMoved: () => void;
}) {
  // Read off the POLLED row, never the one-shot log fetch: `useSessionLog` stops polling the
  // moment a run is terminal, so a band drawn from it would still be here after the press
  // that cleared it.
  const c = useCopy().runs.panel.kept;
  const actions = useActions();
  const [busy, setBusy] = useState<"resume" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kept = session.delivery?.cardless ? session.delivery.kept : undefined;
  const id = session.delivery?.id;

  const move = async (which: "resume" | "discard") => {
    if (!actions || !id) return;
    setBusy(which);
    setError(null);
    const res = which === "resume" ? await actions.resumeDelivery(id) : await actions.discardDelivery(id);
    setBusy(null);
    if (res.ok) onMoved();
    else setError(res.error || (which === "resume" ? c.carryOnFailed : c.discardFailed));
  };

  if (!kept || !actions) return null;
  return (
    <div className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2.5 text-nb-peach-ink">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="nb-tag text-nb-peach-ink">{c.tag}</p>
        {/* Both moves are real, so both are quiet ghosts, and the one that throws the work
            away says what it deletes in the line below. */}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 rounded-[7px] px-2 py-1 text-[11px] font-[700]"
            disabled={!!busy}
            onClick={() => void move("resume")}
          >
            <FiPlay className="text-[12px]" aria-hidden />
            {busy === "resume" ? c.carryingOn : c.carryOn}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 rounded-[7px] px-2 py-1 text-[11px] font-[700]"
            disabled={!!busy}
            onClick={() => void move("discard")}
          >
            <FiTrash2 className="text-[12px]" aria-hidden />
            {busy === "discard" ? c.discarding : c.discard}
          </Button>
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-nb-ink">
        {c.blurb}{" "}
        <span className="mx-[1px] inline-flex items-center rounded-[5px] bg-nb-paper px-1.5 py-[1px] align-baseline font-mono text-[12px] font-[700] text-nb-ink">
          {kept.worktree}
        </span>
      </p>
      {error && <p className="mt-1.5 text-[12px] text-nb-peach-ink">{error}</p>}
    </div>
  );
}

// One command in that line, and the press that copies it.
function CopyCommand({ text }: { text: string }) {
  const t = useCopy().shared;
  const { copied, copy } = useCopyText();
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      title={t.copy}
      aria-label={`${t.copy}: ${text}`}
      className="mx-[1px] inline-flex cursor-pointer items-center gap-1 rounded-[5px] bg-nb-paper px-1.5 py-[1px] align-baseline font-mono text-[12px] font-[700] text-nb-ink transition-colors hover:bg-nb-wash"
    >
      {text}
      {copied ? (
        <FiCheck className="text-[11px] text-nb-peach-ink" aria-hidden />
      ) : (
        <FiCopy className="text-[11px] text-nb-peach-ink" aria-hidden />
      )}
      <Copied on={copied} />
    </button>
  );
}

// The header entry point to the run history (task #21): one activity-icon
// button. While any run is live it wears an iOS-style badge — a small ember
// circle with the count of running runs and a ping pulse. Clicking opens the
// two-pane dialog. The panel is GLOBAL: every run, every card and every
// action, newest first — the one place to browse across runs (a per-card
// page still shows only its own most recent run; see redesign.md).
export function Sessions() {
  const c = useCopy().runs.panel;
  // Poll the shared registry for the picture every tab sees. This instance never
  // starts a run, so its onFinish never fires — pass a no-op.
  const { sessions, kick } = useAgentSessions(() => {});
  const panel = usePanelState();
  const runningCount = sessions.reduce((n, r) => n + (r.status === "running" ? 1 : 0), 0);
  // Jobs that stopped short on a card nobody has dealt with (#809) — the one standing state
  // this button has to carry, and the reason its corner mark is no longer about live work
  // alone.
  const stuck = useMemo(() => unhandledFlows(runFlows(sessions)).length, [sessions]);

  return (
    <>
      <button
        type="button"
        onClick={() => sessionsPanel.toggle()}
        data-tip={
          stuck > 0 ? c.openUnhandled(stuck) : runningCount > 0 ? c.openRunning(runningCount) : c.open
        }
        aria-label={c.open}
        // The middle tool in the header's cluster (components/chrome.tsx): no
        // frame of its own, a hairline on each side of it.
        className={TOOL_BTN}
      >
        <FiActivity size={15} aria-hidden />
        {/* One dot in the corner of the icon, never a counted badge on the button's
            shoulder — that would hang off a tool's edge and break the frame the cluster
            draws around all four. Its COLOUR is what it says: ember and breathing while a
            run is going, the warning peach and still while a job that stopped short is
            waiting on somebody (#809). Peach wins when both are true — live work looks after
            itself, and a thing to fix does not. The numbers are in the tooltip and on every
            row of the panel this opens. */}
        {stuck > 0 ? (
          // Peach is a pale colour on a white tool, so this one is ringed in ink — the same
          // line every filled thing on the board is drawn with, and what keeps a still dot
          // as loud as the breathing one it replaces.
          <span
            aria-hidden
            className="absolute right-[4px] top-[4px] size-[8px] rounded-full border border-nb-ink bg-nb-peach"
          />
        ) : (
          runningCount > 0 && (
            <span className="absolute right-[5px] top-[5px] flex size-[7px] items-center justify-center">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: "var(--color-nb-accent)" }}
                aria-hidden
              />
              <span
                className="relative inline-flex h-full w-full rounded-full"
                style={{ background: "var(--color-nb-accent)" }}
                aria-hidden
              />
            </span>
          )
        )}
      </button>
      {panel.open && <SessionsDialog sessions={sessions} onStarted={kick} />}
    </>
  );
}

// The Runs dialog (#399). It opens on the office: a full-bleed pixel room with one bot per
// job, floating controls over it, and the records and the log in drawers that float in from
// the sides. Portaled to <body> like Dialog so the blurred,
// backdrop-filtered header can't become the scrim's containing block and trap it. Mounts
// only while open, so the selected run's log is tailed only when visible.
//
// A window too small for the room, or a machine the renderer won't start on, gets the
// dialog's older two-pane form instead — the same rows and the same log, side by side.
function SessionsDialog({
  sessions,
  onStarted,
}: {
  sessions: SessionView[];
  // Called when the dialog itself put a run into the registry (Resume), so
  // the poll wakes at once and the new run joins the list without a wait.
  onStarted: () => void;
}) {
  const panel = usePanelState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Over the chat rail while it is up, so Esc closes the panel and leaves a reply alone.
  useOverRail();
  // …and over the page, so the swipe back takes the panel off before the page moves (#526).
  useSwipeBack(true, () => sessionsPanel.close());

  // Newest activity first, and a refinement is ONE row however many passes it took
  // (lib/run-flows.ts). Memoised because the office is built from it: a fresh array every
  // render would restage the room on every keystroke. Default the selection to the newest
  // run when none is set, so the dialog always opens on something.
  const flows = useMemo(() => runFlows(sessions), [sessions]);
  const selectedId = panel.selected ?? flows[0]?.latest.sessionId ?? null;
  // Tail the selected run's log from the file — live while running, one fetch
  // when done. The list entry carries the input and (for finished runs) the
  // tail, so the pane fills in before the tail loads.
  const log = useSessionLog(selectedId);
  // The list is a poll behind: a run this dialog just started by resuming a
  // failed run isn't in `sessions` yet. Its own fetch already has it, so that
  // stands in until the next tick rather than flashing the empty pane.
  const selected =
    sessions.find((r) => r.sessionId === selectedId) ??
    (log?.sessionId === selectedId ? log : null);
  const flow = flowOf(flows, selectedId);

  // Whether the room fits at all, and whether it drew. Either answer sends the dialog back
  // to the two-pane form with everything still reachable.
  const roomy = useRoomy();
  const [sceneFailed, setSceneFailed] = useState(false);

  if (!mounted) return null;

  const parts = { flows, selectedId, selected, log, flow, onStarted };
  return createPortal(
    roomy && !sceneFailed ? (
      <RunsOffice {...parts} onSceneFailed={() => setSceneFailed(true)} />
    ) : (
      <RunsPanes {...parts} note={sceneFailed} />
    ),
    document.body,
  );
}

/** What both forms of the dialog are drawn from. */
interface RunsParts {
  flows: RunFlow[];
  selectedId: string | null;
  selected: SessionView | null;
  log: SessionView | null;
  flow: RunFlow | null;
  onStarted: () => void;
}

// --- the office ---------------------------------------------------------------

// How wide and tall the window has to be before the room is worth drawing. Under it the
// dialog cannot hold its 1040 × 760 frame, and a cropped office says less than a list.
const ROOMY = "(min-width: 1040px) and (min-height: 640px)";

function RunsOffice({
  flows,
  selectedId,
  selected,
  log,
  flow,
  onStarted,
  onSceneFailed,
}: RunsParts & { onSceneFailed: () => void }) {
  const t = useCopy();
  const c = t.runs.panel;
  const s = t.runs.scene;
  const roleName = useRoleName();
  // Which records the left drawer is listing, and whether the log is open on the right.
  const [records, setRecords] = useState<RecordsDrawer | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [page, setPage] = useState(0);
  // Which drawer was touched last: Escape puts that one away first.
  const drawer = useRef<"left" | "right" | null>(null);
  // Which job the log drawer was opened from, so focus can go back to its bot — or, once
  // that bot has walked out, to the entrance the job's record is now behind.
  const opener = useRef<string | null>(null);
  // Opened on one run's LOG rather than on the room (#809) — what the notification rail's
  // own rows ask for. Taken once, so putting the log away afterwards sticks.
  const askedLog = usePanelState().log;
  useEffect(() => {
    if (!askedLog) return;
    setLogOpen(true);
    drawer.current = "right";
    sessionsPanel.logShown();
  }, [askedLog]);

  const head = useRunHead(selected, flow);
  const office = useOffice(flows, roleName, t.runs);
  const rooms = office.rooms;
  const room = Math.min(page, rooms - 1);

  const done = flows.filter((f) => f.latest.status === "done" && f.latest.ok);
  const unfinished = unfinishedFlows(flows);
  const live = flows.filter(isLive);
  const shown = records === "running" ? live : records === "unfinished" ? unfinished : done;
  // What each entrance's drawer is titled. The running one is not the count on its button:
  // the button says how many, the drawer says what it holds.
  const titles = { running: s.runningTitle, done: s.completed, unfinished: s.unfinished };

  const closeRecords = useCallback(() => {
    drawer.current = logOpen ? "right" : null;
    // Focus goes back to the entrance it came in by, not to the page behind the dialog.
    if (records) document.getElementById(RECORDS_BTN[records])?.focus();
    setRecords(null);
  }, [logOpen, records]);
  const openRecords = (which: RecordsDrawer) => {
    // The entrance the open drawer came in by puts it away again.
    if (records === which) {
      closeRecords();
      return;
    }
    setRecords(which);
    drawer.current = "left";
  };
  const closeLog = useCallback(() => {
    setLogOpen(false);
    drawer.current = records ? "left" : null;
    const back = opener.current;
    opener.current = null;
    // Opened from a record row: that row goes with its drawer, so focus lands on the
    // entrance the drawer is behind rather than on the page under the dialog.
    if (!back) {
      if (records) document.getElementById(RECORDS_BTN[records])?.focus();
      return;
    }
    const bot = document.getElementById(botTargetId(back));
    if (bot) {
      bot.focus();
      return;
    }
    const gone = flows.find((f) => f.id === back);
    document.getElementById(RECORDS_BTN[whereToFind(gone)])?.focus();
  }, [records, flows]);

  // Picking a record's session opens its log beside the records, which stay where they are.
  // `from` is the bot the log was opened from, and nothing when a record row opened it —
  // the focus that press came from is the drawer's own, not a bot's.
  const openLog = useCallback((from: string | null) => {
    opener.current = from;
    setLogOpen(true);
    drawer.current = "right";
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawer.current === "right" && logOpen) closeLog();
      else if (drawer.current === "left" && records) closeRecords();
      else if (logOpen) closeLog();
      else if (records) closeRecords();
      else sessionsPanel.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logOpen, records, closeLog, closeRecords]);

  const pick = useCallback(
    (bot: SceneBot) => {
      sessionsPanel.select(bot.sessionId);
      openLog(bot.id);
    },
    [openLog],
  );
  const floor = useCallback(() => {
    setRecords(null);
    setLogOpen(false);
    drawer.current = null;
  }, []);

  return (
    <div className="nb-scrim" style={{ alignItems: "center" }} onClick={() => sessionsPanel.close()}>
      <div
        className="nb-panel relative overflow-hidden"
        // The same frame as Configuration: both are the board's big dialogs. Here every
        // pixel of its interior is the room — no header, no padding, nothing to switch.
        style={{ width: 1040, maxWidth: "100%", height: "min(760px, calc(100dvh - 2rem))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <RunScene
          bots={office.bots}
          room={room}
          selected={logOpen ? office.jobOf(selectedId) : null}
          onPick={pick}
          onFloor={floor}
          onUnavailable={onSceneFailed}
        />

        {/* Nothing has ever run here: an empty room and one line over it. */}
        {flows.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 z-10 text-center text-[13px] font-[700] text-nb-ink">
            <span className="nb-chip-px inline-block px-3 py-1.5">{c.empty}</span>
          </p>
        )}

        <button
          type="button"
          onClick={() => sessionsPanel.close()}
          aria-label={t.shared.close}
          className="nb-chip-px absolute right-3 top-3 z-30 grid h-7 w-7 cursor-pointer place-items-center text-nb-ink transition-[transform,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_var(--color-nb-ink)] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_0_var(--color-nb-ink)]"
        >
          <FiX className="h-[18px] w-[18px]" />
        </button>

        {/* The bottom strip: the three ways into the records, the count being the first of
            them. The drawers stop above it, so every entrance stays reachable with one up. */}
        <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
          {/* Always pressable: with nothing running it raises an empty list, so the way to
              the running work is in the same place whether any is going or not. */}
          <Button
            id={RUNNING_BTN}
            type="button"
            variant="ghost"
            size="xs"
            aria-expanded={records === "running"}
            className={`${PX_BUTTON} ${records === "running" ? PX_BUTTON_ON : ""}`}
            onClick={() => openRecords("running")}
          >
            {office.live > 0 ? s.running(office.live) : s.idle}
          </Button>
          <Button
            id={DONE_BTN}
            type="button"
            variant="ghost"
            size="xs"
            aria-expanded={records === "done"}
            className={`${PX_BUTTON} ${records === "done" ? PX_BUTTON_ON : ""}`}
            onClick={() => openRecords("done")}
          >
            {s.completed}
          </Button>
          {/* Only where there is something unfinished to reach. It carries the number of
              jobs still waiting on somebody and wears the warning colour with them (#809),
              so it can no longer be read as a second Completed. A list holding nothing but
              runs the user stopped, or runs on no card, keeps the plain word: nothing there
              is owed to anyone. */}
          {unfinished.length > 0 && (
            <Button
              id={UNFINISHED_BTN}
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={records === "unfinished"}
              className={`${PX_BUTTON} ${office.stuck > 0 ? PX_BUTTON_WARN : ""} ${records === "unfinished" ? PX_BUTTON_ON : ""}`}
              onClick={() => openRecords("unfinished")}
            >
              {office.stuck > 0 && <FiAlertTriangle className="text-[11px]" aria-hidden />}
              {office.stuck > 0 ? s.unfinishedCount(office.stuck) : s.unfinished}
            </Button>
          )}
        </div>

        {/* More than one room's worth of work: the rest are the same office, one page on.
            Paging moves nothing and stops nothing — the count beside it is every room's. */}
        {rooms > 1 && (
          <div className="nb-chip-px absolute bottom-4 right-4 z-30 flex items-center gap-1.5 px-1.5 py-1">
            <button
              type="button"
              aria-label={s.prevRoom}
              disabled={room === 0}
              onClick={() => setPage(room - 1)}
              className={PAGER_ARROW}
            >
              <FiChevronLeft aria-hidden />
            </button>
            <span className="text-[12px] font-[700] text-nb-ink">{s.page(room + 1, rooms)}</span>
            <button
              type="button"
              aria-label={s.nextRoom}
              disabled={room === rooms - 1}
              onClick={() => setPage(room + 1)}
              className={PAGER_ARROW}
            >
              <FiChevronRight aria-hidden />
            </button>
          </div>
        )}

        {/* The records, floating over the room rather than taking a column off it. */}
        {records && (
          <aside
            className="nb-panel-px nb-panel-px-left absolute bottom-14 left-0 top-14 z-20 flex w-[240px] flex-col overflow-hidden"
            aria-label={titles[records]}
            onClick={(e) => e.stopPropagation()}
            onFocusCapture={() => (drawer.current = "left")}
          >
            <DrawerBar title={titles[records]} onCollapse={closeRecords} />
            <div className="min-h-0 flex-1 overflow-y-auto bg-nb-cream/70">
              <RunList
                flows={shown}
                selectedId={selectedId}
                onOpen={() => openLog(null)}
                // Empty here means nothing is working right now, not that nothing ever has.
                empty={records === "running" ? s.idle : undefined}
              />
            </div>
          </aside>
        )}

        {/* The work log, at the width the log has always had. */}
        {logOpen && (
          <aside
            className="nb-panel-px nb-panel-px-right absolute bottom-14 right-0 top-14 z-20 flex w-[740px] max-w-[calc(100%-2rem)] flex-col overflow-hidden"
            aria-label={t.runs.log.title}
            onClick={(e) => e.stopPropagation()}
            onFocusCapture={() => (drawer.current = "right")}
          >
            {/* One bar over the log: the task, the run, and the way to put the drawer
                away. What the log is, the drawer's own aria-label says. */}
            {head && selected ? (
              <RunBar
                session={log ?? selected}
                head={head}
                canResume={(log?.canResume ?? selected.canResume) && !selected.delivery?.kept}
                onResumed={(id) => {
                  sessionsPanel.select(id);
                  onStarted();
                }}
                onFollow={() => sessionsPanel.close()}
                control={<CollapseButton onClick={closeLog} ink />}
                ink
              />
            ) : (
              <EmptyRunBar
                title={t.runs.log.title}
                control={<CollapseButton onClick={closeLog} ink />}
                ink
              />
            )}
            <div className={LOG_WELL}>
              <RunDetail
                flow={flow}
                selected={selected}
                log={log}
                selectedId={selectedId}
                onStarted={onStarted}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** The three entrances on the bottom strip, and the records each one raises. */
type RecordsDrawer = "running" | "done" | "unfinished";

const RUNNING_BTN = "run-records-running";
const DONE_BTN = "run-records-done";
const UNFINISHED_BTN = "run-records-unfinished";

const RECORDS_BTN: Record<RecordsDrawer, string> = {
  running: RUNNING_BTN,
  done: DONE_BTN,
  unfinished: UNFINISHED_BTN,
};

/** Which entrance a job is reached through now — where focus goes when the bot it was
 *  opened from has left the room. A job no flow answers for any more is looked for with the
 *  ones that did not finish. */
const whereToFind = (flow: RunFlow | undefined): RecordsDrawer => {
  if (flow && isLive(flow)) return "running";
  return flow?.latest.status === "done" && flow.latest.ok ? "done" : "unfinished";
};

/** The shared Button, squared off to the room's own line weight (#760). The component is
 *  left alone — only its corners, its border and its shadow are overridden here. */
const PX_BUTTON =
  "rounded-[2px] border-2 shadow-[3px_3px_0_0_var(--color-nb-ink)] enabled:hover:shadow-[4px_4px_0_0_var(--color-nb-ink)] enabled:active:shadow-[1px_1px_0_0_var(--color-nb-ink)]";
/** The entrance whose drawer is up. `aria-expanded` alone said it to a screen reader and to
 *  nobody looking at the screen. */
const PX_BUTTON_ON = "bg-nb-ink text-nb-cream hover:bg-nb-ink";
/** …and the one holding work that is still owed (#809). Written before `PX_BUTTON_ON` in the
 *  class list, so an open drawer still reads as the pressed one. */
const PX_BUTTON_WARN = "gap-1 bg-nb-peach hover:bg-nb-peach";

/** An arrow inside the pager's box: a square well that fills with ink on hover. */
const PAGER_ARROW =
  "grid size-6 cursor-pointer place-items-center rounded-[2px] text-nb-ink hover:bg-nb-ink hover:text-nb-cream disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-nb-ink";

// --- what the open log is OF --------------------------------------------------

/** Everything the one bar over the log says about the run on screen (#753): the card it is
 *  on and what that task is called, which step of the job this run is, and when the job
 *  started.
 *
 *  The name is the first of these there is — a card's own title; the sentence a job with no
 *  card was started with; what that job is doing instead; and, for a card whose title
 *  nothing can answer for any more, the action itself. So the bar is never blank. */
function useRunHead(session: SessionView | null, flow: RunFlow | null): RunHead | null {
  const t = useCopy();
  const language = useLanguage();
  if (!session) return null;
  // A session is titled by the JOB, not by its own action: "Resolve" alone says nothing
  // about the job it is a step of.
  const action = flow ? flowLabel(flow, t.runs) : stepLabel(session.action, t.runs);
  // A job is dated by when IT started, not by the session you happen to be reading.
  const startedAt = fullTime(flow?.startedAt ?? session.startedAt, language);
  const name =
    session.cardId === null
      ? (flow && flowSaid(flow)) || cardlessTitle(session, t.runs.cardless)
      : session.cardTitle?.trim() || action;
  // Where the name IS the action — a card whose title nothing can answer for any more —
  // the step is not printed a second time beside it.
  return { id: session.cardId, name, step: name === action ? "" : action, startedAt };
}

/** The scrolling well under the bar: everything the run has to say, one rung down from the
 *  chrome over it. */
const LOG_WELL =
  "min-h-0 flex-1 overflow-y-auto bg-nb-wash px-4 pb-6 pt-3 shadow-[inset_0_1px_3px_color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]";

/** The records drawer's own title bar, with the one control it needs. */
function DrawerBar({ title, onCollapse }: { title: string; onCollapse: () => void }) {
  return (
    <div className="nb-bar-px flex shrink-0 items-center justify-between gap-2 px-3 py-2">
      <h3 className="min-w-0 truncate text-[12.5px] font-[800] tracking-[-0.02em]">{title}</h3>
      {/* The log bar's 22px floor, so the two title bars sit on one line across the room. */}
      <span className="flex min-h-[22px] shrink-0 items-center">
        <CollapseButton onClick={onCollapse} ink />
      </span>
    </div>
  );
}

/** The word that puts the log drawer away, in the shape every drawer here uses. */
function CollapseButton({ onClick, ink }: { onClick: () => void; ink?: boolean }) {
  const s = useCopy().runs.scene;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 cursor-pointer px-1.5 py-0.5 text-[11.5px] font-[700] transition-colors ${
        ink ? "nb-px-btn" : "rounded-[6px] text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink"
      }`}
    >
      {s.collapse}
    </button>
  );
}

/** The dialog's own way out, in both forms. */
function CloseDialog() {
  const t = useCopy();
  return (
    <button
      type="button"
      onClick={() => sessionsPanel.close()}
      aria-label={t.shared.close}
      className="-mr-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90 active:bg-nb-ink/10"
    >
      <FiX className="h-[18px] w-[18px]" />
    </button>
  );
}

/** Said once, quietly, when the room could not be drawn on this machine. It sits at the
 *  foot of the list that stands in for the room — nothing waits on it. */
function OfficeUnavailable() {
  const t = useCopy();
  return (
    <p className="shrink-0 border-t border-nb-ink/10 px-3 py-2 text-[11px] leading-snug text-nb-ink-soft">
      {t.runs.scene.unavailable}
    </p>
  );
}

// --- the two-pane form --------------------------------------------------------

// What the dialog was before the office, and what it still is on a window too small for a
// room or a machine whose renderer would not start. Nothing here is a reduced version: it is
// the same rows and the same log, side by side.
function RunsPanes({
  flows,
  selectedId,
  selected,
  log,
  flow,
  onStarted,
  note,
}: RunsParts & { note: boolean }) {
  const t = useCopy();
  const c = t.runs.panel;
  const head = useRunHead(selected, flow);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") sessionsPanel.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="nb-scrim" style={{ alignItems: "center" }} onClick={() => sessionsPanel.close()}>
      <div
        // overflow-hidden clips the list column's edge-to-edge cream fill to the
        // panel radius — without it the square fill pokes past the rounded corner.
        className="nb-panel flex flex-col overflow-hidden"
        style={{ width: 1040, maxWidth: "100%", height: "min(760px, calc(100dvh - 2rem))" }}
        aria-label={c.heading}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nothing to head the log with: the bar falls back to the dialog's own name and
            keeps the ✕, so the window is still named and still closable. */}
        {!(head && selected) && <EmptyRunBar title={c.heading} control={<CloseDialog />} />}

        <div className="flex min-h-0 flex-1">
          {/* left: the run list. A faint cream canvas behind the rows so the
              selected run — paper fill + ember edge, the vertical cousin of
              the tab strip's "bold ink + short ember underline" — reads as the one
              raised sheet. The divider is a soft ink hairline, not a full ink
              rule: 1.5px ink borders stay reserved for structural frames. */}
          <div className="flex w-[240px] shrink-0 flex-col border-r border-nb-ink/10 bg-nb-cream/70">
            {/* An empty list says nothing here: the right pane already carries the one
                sentence about a board that has never run, and saying it twice side by side
                reads as two different empties. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {flows.length > 0 && <RunList flows={flows} selectedId={selectedId} />}
            </div>
            {/* This column IS what stands in for the room, so the refusal is answered on
                the substitute rather than floated over the run the user came to read. */}
            {note && <OfficeUnavailable />}
          </div>

          {/* right: the one bar over the selected run, and its log under it. */}
          <div className="flex min-w-0 flex-1 flex-col">
            {head && selected ? (
              <>
                <RunBar
                  session={log ?? selected}
                  head={head}
                  canResume={(log?.canResume ?? selected.canResume) && !selected.delivery?.kept}
                  onResumed={(id) => {
                    sessionsPanel.select(id);
                    onStarted();
                  }}
                  onFollow={() => sessionsPanel.close()}
                  control={<CloseDialog />}
                />
                <div className={LOG_WELL}>
                  <RunDetail
                    flow={flow}
                    selected={selected}
                    log={log}
                    selectedId={selectedId}
                    onStarted={onStarted}
                  />
                </div>
              </>
            ) : (
              // "Pick a run" only where there is one to pick — on a board that has never
              // run it is an instruction that cannot be followed.
              <p className="grid min-w-0 flex-1 place-items-center p-4 text-[13px] text-nb-ink-soft">
                {flows.length === 0 ? c.empty : c.pick}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- the two halves both forms share ------------------------------------------

/** The runs, as rows. One list, drawn the same in a column and in a drawer. */
function RunList({
  flows,
  selectedId,
  onOpen,
  empty,
}: {
  flows: RunFlow[];
  selectedId: string | null;
  onOpen?: () => void;
  /** What an empty list says, where "nothing has ever run" is not what it means. */
  empty?: string;
}) {
  const c = useCopy().runs.panel;
  if (flows.length === 0)
    return <p className="p-4 text-[12.5px] text-nb-ink-soft">{empty ?? c.empty}</p>;
  return (
    <>
      {flows.map((f) => (
        <FlowRow key={f.id} flow={f} selectedId={selectedId} onOpen={onOpen} />
      ))}
    </>
  );
}

/** Everything the selected run has to say under the bar: where its delivery stands, what it
 *  was started with, and its log. What the run IS — the task, the step, the numbers and the
 *  controls — the bar above already said (#753). */
function RunDetail({
  flow,
  selected,
  log,
  selectedId,
  onStarted,
}: {
  flow: RunFlow | null;
  selected: SessionView | null;
  log: SessionView | null;
  selectedId: string | null;
  onStarted: () => void;
}) {
  const c = useCopy().runs.panel;
  if (!selected) return <p className="text-[13px] text-nb-ink-soft">{c.pick}</p>;
  const input = (log?.input ?? selected.input ?? "").trim();

  return (
    <>
      {/* Where its delivery stands, when the delivery has no card page to say it
          on (#428): the stop that will not land, the refusal that clears itself,
          and the commands that put either back in motion. */}
      <DeliveryStop session={log ?? selected} />
      {/* And what it left behind when the board kept it (#720) — the work, and the two
          things to do with it. */}
      <DeliveryKept session={selected} onMoved={onStarted} />
      {/* How the job ended — its steps are the left list's job. */}
      {flow && flow.sessions.length > 1 && <FlowEnding flow={flow} selectedId={selectedId} />}
      {/* The note is the optional free text the user typed when
          starting the run (a create's description, a reject's
          reason, else the notes field). Most runs are started
          without one — so only show the section when there's actually a
          note, rather than a "no note" placeholder on every run. */}
      {input && (
        <div className="mb-3">
          <div className="nb-tag mb-1.5">{c.note}</div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-nb-ink">{input}</p>
        </div>
      )}
      <SessionLog session={log ?? selected} flush />
    </>
  );
}

// --- the office, worked out from the runs -------------------------------------

const isLive = (flow: RunFlow) => flow.latest.status === "running";

/** One bot per job, and the rooms they are in.
 *
 *  Placements are remembered for as long as the dialog is open, so a job that finishes at
 *  desk three does not shuffle everyone after it along. The room count only ever grows
 *  here — an office that empties keeps its pages until the dialog is opened again. */
function useOffice(flows: RunFlow[], roleName: (agent?: string) => string, copy: RunLabels) {
  const held = useRef<Map<string, Placement>>(new Map());
  const roomsHeld = useRef(1);
  return useMemo(() => {
    const working = flows.filter(isLive);
    // A job that stopped short on a card nobody has dealt with keeps a desk too (#809): it
    // is the room's way of saying the work is still owed. Working jobs are offered a desk
    // first, so the front of the office is where the live work is.
    const stuck = unhandledFlows(flows);
    const seated = [...working, ...stuck];
    const { places, rooms } = placeWorkers(
      held.current,
      seated.map((f) => f.id),
      roomsHeld.current,
    );
    held.current = places;
    roomsHeld.current = rooms;

    const read = (flow: RunFlow) => ({
      id: flow.id,
      sessionId: flow.latest.sessionId,
      cardId: flow.cardId,
      label: flowLabel(flow, copy),
      role: roleName(flow.latest.agent),
      harness: flow.latest.harness ?? "",
      status: flow.latest.status,
    });

    const atDesk = (flow: RunFlow, working: boolean): SceneBot => {
      const place = places.get(flow.id)!;
      return {
        ...read(flow),
        working,
        stuck: !working,
        room: place.room,
        desk: place.desk,
        spot: deskSpot(place),
      };
    };
    const bots: SceneBot[] = working.map((flow) => atDesk(flow, true));
    for (const flow of stuck) bots.push(atDesk(flow, false));

    // The sofa: the two latest jobs that actually passed. Everyone else who finished has
    // already walked out, and is reached through the records.
    const passed = flows.filter((f) => f.latest.status === "done" && f.latest.ok);
    const resting = restingIds(passed.map((f) => ({ id: f.id, at: finishedAt(f.latest) })));
    resting.forEach((id, seat) => {
      const flow = passed.find((f) => f.id === id);
      if (flow)
        bots.push({ ...read(flow), working: false, stuck: false, room: 0, desk: null, spot: SOFA_SPOTS[seat] });
    });

    const jobOf = (sessionId: string | null) =>
      bots.find((b) => flows.some((f) => f.id === b.id && f.sessions.some((s) => s.sessionId === sessionId)))?.id ??
      null;

    return { bots, rooms, live: working.length, stuck: stuck.length, jobOf };
  }, [flows, roleName, copy]);
}

/** What the agent that ran a job is called, in the language this app draws in — the one
 *  lookup every screen names an agent by (`@/lib/agent-name`). A job with no agent behind it
 *  is the only thing answered here. */
function useRoleName(): (agent?: string) => string {
  const nameOf = useAgentName();
  const none = useCopy().runs.scene.noRole;
  return useCallback((agent?: string) => (agent && nameOf(agent)) || none, [nameOf, none]);
}

/** Whether the window has room for the office at all. Read on the first render rather than
 *  corrected by the effect, or a narrow window would build a renderer it is about to throw
 *  away. */
function useRoomy(): boolean {
  const [roomy, setRoomy] = useState(
    () => typeof window === "undefined" || window.matchMedia(ROOMY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(ROOMY);
    const read = () => setRoomy(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return roomy;
}
