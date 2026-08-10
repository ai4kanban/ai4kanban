"use client";

// Shared client plumbing for the session registry (task #12). Both the board and
// the card page use it to: poll the server-side registry, know which cards have a
// live agent, start a session without blocking, and get told when a session they
// started finishes (to show its result and refresh). It also hosts the global
// sessions panel (task #21) — the header's activity button and its two-pane
// history dialog.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FiActivity, FiX } from "react-icons/fi";
import { getSessionAction, listSessionsAction, startAgentAction } from "@/app/actions";
import type { SessionView } from "@/lib/types";
import { type AgentReq, ResumeButton, SessionLog } from "./agent-shared";

const POLL_MS = 1500; // while a session is live
const IDLE_POLL_MS = 5000; // while nothing is running — see the effect below
const LOG_POLL_MS = 1200; // how often the live log tail refreshes

// A session this tab started, remembered until it finishes so onFinish can fire once.
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
  // A kick() the effect installs, so start() and tab-focus can force an immediate
  // poll and wake the loop when it's dormant. See the effect below.
  const kickRef = useRef<() => void>(() => {});

  // A quiet board CAN go stale on its own: the auto-refine dispatcher (#43)
  // starts sessions from a server-side timer, with no user action in any tab. So
  // an idle tab must keep polling — an idle loop that goes dormant would never
  // witness a background refine start, finish, or rewrite the card, and the
  // running-set diffs in Board/CardPage would have no transition to fire on.
  // What we vary is the cadence, not whether we poll: fast while something is
  // live, slow while idle. A hidden tab still stops entirely and wakes on focus
  // (useOnTabFocus re-reads unconditionally), so a backgrounded board costs
  // nothing.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const tick = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const next = await listSessionsAction();
        if (!alive) return;
        // Fire onFinish for any session this tab started that just went terminal.
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
  }, []);

  // Start a session. Returns the server's answer: ok with a sessionId, or a lock
  // message.
  const start = useCallback(
    async (req: AgentReq, label: string, removes = false) => {
      const res = await startAgentAction(req);
      if (res.ok && res.sessionId) {
        mine.current.set(res.sessionId, { sessionId: res.sessionId, label, removes });
        kickRef.current(); // watch it immediately instead of waiting for a tick
      }
      return res;
    },
    [],
  );

  // Take on a session this tab caused but didn't start through `start` above.
  // A plan-release run is the case (#165): the server starts it as part of
  // writing the release, so the session id comes back from that action rather
  // than from here. Same effect either way — onFinish fires for it, and the poll
  // wakes at once, so the run joins the runs panel in the same moment the
  // release does rather than up to a slow tick later.
  const watch = useCallback((sessionId: string, label: string, removes = false) => {
    mine.current.set(sessionId, { sessionId, label, removes });
    kickRef.current();
  }, []);

  // Force an immediate poll. `start` does this itself; a caller that made the
  // registry move some other way (resuming a failed run) uses this so the new
  // session shows up now instead of on the next idle tick.
  const kick = useCallback(() => kickRef.current(), []);

  return { sessions, start, watch, kick };
}

// Run `fn` each time the tab becomes visible again. A hidden tab stops polling,
// and the running-set diff a view uses to catch finishes only fires on a
// running→finished change the view actually witnessed while polling. A session
// that both starts and finishes while the tab is hidden is never witnessed, so
// on focus that diff finds nothing and the view stays stale. An unconditional
// re-read on focus is always correct and doesn't depend on witnessing the
// transition — it also covers a finished session evicted from the kept-30 window
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

// The newest session (live or finished) that touched this card, so the card page
// can tail the live one and re-open the last finished one from the same slot.
export function latestSessionForCard(sessions: SessionView[], cardId: number): SessionView | undefined {
  let best: SessionView | undefined;
  for (const r of sessions) {
    if (r.cardId === cardId && (!best || r.startedAt > best.startedAt)) best = r;
  }
  return best;
}

// The live session on this card, if any (used to open its log from a board badge).
export function runningSessionForCard(sessions: SessionView[], cardId: number): SessionView | undefined {
  return sessions.find((r) => r.status === "running" && r.cardId === cardId);
}

// Tail one session's log. Polls getSessionAction while the session is live (task
// #14 reuses the poll channel — no SSE, matching the session badges), then
// fetches once more when it ends and stops. Pass null to watch nothing. Returns
// the session with its log tail, or null while it hasn't loaded / the session is
// unknown.
export function useSessionLog(sessionId: string | null): SessionView | null {
  const [log, setLog] = useState<SessionView | null>(null);
  useEffect(() => {
    if (!sessionId) {
      setLog(null);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await getSessionAction(sessionId);
        if (!alive) return;
        setLog(r);
        // Keep polling only while the session is live; a terminal tail is final.
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

// --- the global sessions panel (task #21) -----------------------------------

// A tiny shared store so the header's Create button (a sibling component) can pop
// the sessions panel open on the session it just started — without threading
// state through the server-rendered Header. One store per browser tab; the
// panel's open/selected state lives here so any header control can drive it.
type PanelState = { open: boolean; selected: string | null };
let panelState: PanelState = { open: false, selected: null };
const panelSubs = new Set<() => void>();
function setPanel(next: PanelState) {
  panelState = next;
  for (const fn of panelSubs) fn();
}
export const sessionsPanel = {
  // Open the panel; optionally select a session (e.g. the create just started). A
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

// A relative "2m ago" for the session list; an absolute stamp for the detail
// header. Both read the clock at render — fine, the poll re-renders while
// sessions are live.
function relTime(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
function fullTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The status dot shown against each session in the list: a pulsing ember while
// live, mint when it passed, sky when the user stopped it, peach otherwise. Peach
// covers both a failed run and an interrupted one (a session that outlived a UI
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

// The header entry point to the session history (task #21): one activity-icon
// button. While any session is live it wears an iOS-style badge — a small ember
// circle with the count of running sessions and a ping pulse. Clicking opens the
// two-pane dialog. The panel is GLOBAL: every session, every card and every
// action, newest first — the one place to browse across sessions (a per-card
// page still shows only its own most recent session; see redesign.md).
export function Sessions() {
  // Poll the shared registry for the picture every tab sees. This instance never
  // starts a session, so its onFinish never fires — pass a no-op.
  const { sessions, kick } = useAgentSessions(() => {});
  const panel = usePanelState();
  const runningCount = sessions.reduce((n, r) => n + (r.status === "running" ? 1 : 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => sessionsPanel.toggle()}
        title="session history"
        aria-label="Session history"
        // Ghost sticker button (design.md .nb-cta-ghost): paper fill, solid ink
        // border, hard offset shadow, press-down. Matched pair with the agent
        // badge; both are the quiet siblings of the accent Create-task CTA.
        className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)] transition-[transform,box-shadow] duration-[120ms] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--color-nb-ink)] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_0_var(--color-nb-ink)]"
      >
        <FiActivity className="text-[17px]" aria-hidden />
        {runningCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: "var(--color-nb-accent)" }}
              aria-hidden
            />
            <span
              className="relative inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-[800] leading-none text-white"
              style={{ background: "var(--color-nb-accent)" }}
            >
              {runningCount}
            </span>
          </span>
        )}
      </button>
      {panel.open && <SessionsDialog sessions={sessions} onStarted={kick} />}
    </>
  );
}

// The two-pane dialog: session list on the left, the selected session's input +
// log tail on the right. Portaled to <body> like Dialog/SessionLogOverlay so the
// blurred, backdrop-filtered header can't become the scrim's containing block and
// trap it. Mounts only while open, so the selected session's log is tailed only
// when visible.
function SessionsDialog({
  sessions,
  onStarted,
}: {
  sessions: SessionView[];
  // Called when the dialog itself put a session into the registry (Resume), so
  // the poll wakes at once and the new run joins the list without a wait.
  onStarted: () => void;
}) {
  const panel = usePanelState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") sessionsPanel.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Newest first. Default the selection to the newest session when none is set,
  // so the panel always opens on something.
  const ordered = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  const selectedId = panel.selected ?? ordered[0]?.sessionId ?? null;
  // Tail the selected session's log from the file — live while running, one fetch
  // when done. The list entry carries the input and (for finished sessions) the
  // tail, so the pane fills in before the tail loads.
  const log = useSessionLog(selectedId);
  // The list is a poll behind: a session this dialog just started by resuming a
  // failed run isn't in `sessions` yet. Its own fetch already has it, so that
  // stands in until the next tick rather than flashing the empty pane.
  const selected =
    ordered.find((r) => r.sessionId === selectedId) ??
    (log?.sessionId === selectedId ? log : null);
  const input = (log?.input ?? selected?.input ?? "").trim();

  if (!mounted) return null;

  return createPortal(
    <div className="nb-scrim" style={{ alignItems: "center" }} onClick={() => sessionsPanel.close()}>
      <div
        // overflow-hidden clips the list column's edge-to-edge cream fill to the
        // panel radius — without it the square fill pokes past the rounded corner.
        className="nb-panel flex flex-col overflow-hidden"
        style={{ width: 880, maxWidth: "100%", height: "min(640px, calc(100vh - 5rem))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b-[1.5px] border-nb-ink px-5 py-3">
          <h2 className="text-[15px] font-[800] tracking-[-0.02em]">Sessions</h2>
          <button
            onClick={() => sessionsPanel.close()}
            aria-label="Close"
            className="-mr-1 grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90 active:bg-nb-ink/10"
          >
            <FiX className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* left: the session list. A faint cream canvas behind the rows so the
              selected session — paper fill + ember edge, the vertical cousin of
              the tab strip's "bold ink + short ember underline" — reads as the one
              raised sheet. The divider is a soft ink hairline, not a full ink
              rule: 1.5px ink borders stay reserved for structural frames. */}
          <div className="w-[240px] shrink-0 overflow-y-auto border-r border-nb-ink/10 bg-nb-cream/70">
            {ordered.length === 0 ? (
              <p className="p-4 text-[12.5px] text-nb-ink-soft">No sessions yet.</p>
            ) : (
              ordered.map((r) => {
                const active = r.sessionId === selectedId;
                return (
                  <button
                    key={r.sessionId}
                    type="button"
                    onClick={() => sessionsPanel.select(r.sessionId)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-nb-ink/8 px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-nb-paper shadow-[inset_2.5px_0_0_0_var(--color-nb-accent)]"
                        : "hover:bg-nb-wash/70"
                    }`}
                  >
                    <SessionDot session={r} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span
                          className={`text-[12.5px] font-[700] capitalize ${active ? "text-nb-ink" : "text-nb-ink-soft"}`}
                        >
                          {r.action}
                        </span>
                        <span className="text-[11px] text-nb-ink-soft">
                          {r.cardId !== null ? `#${r.cardId}` : "—"}
                        </span>
                      </span>
                      <span className="block truncate text-[10.5px] text-nb-ink-soft">
                        {relTime(r.startedAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* right: the selected session's input + log */}
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {selected ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[14px] font-[800] capitalize tracking-[-0.02em]">
                    {selected.action}
                  </span>
                  {/* The card this run worked on, as a link to it — the same
                      `#id` → `/id` jump the markdown bodies make, so an id reads
                      the same wherever it appears. Not gated on the card still
                      being open, the way a mention in prose is: this id is what
                      the run WAS, and a card the run archived is exactly the one
                      you'd click. The board's not-found page says so and takes
                      you back. Navigating closes the dialog, or it would sit on
                      top of the card you just opened. */}
                  {selected.cardId !== null && (
                    <Link
                      href={`/${selected.cardId}`}
                      className="nb-idlink text-[12px]"
                      onClick={() => sessionsPanel.close()}
                    >
                      #{selected.cardId}
                    </Link>
                  )}
                  <span className="text-[11px] text-nb-ink-soft">{fullTime(selected.startedAt)}</span>
                  {/* A run started by Resume says so — otherwise it reads as a
                      second identical run of the same action out of nowhere. */}
                  {selected.resumedFrom && <span className="nb-tag">resumed</span>}
                  {/* Only a run that stopped short — failed or interrupted —
                      offers Resume, and the freshly polled `log` wins over the
                      list entry: the poll that drew this row may be a second and
                      a half old. Selecting the new session moves the panel onto
                      it, so the log tail plays on. */}
                  {(log?.canResume ?? selected.canResume) && (
                    <span className="ml-auto">
                      <ResumeButton
                        sessionId={selected.sessionId}
                        onResumed={(id) => {
                          sessionsPanel.select(id);
                          onStarted();
                        }}
                      />
                    </span>
                  )}
                </div>
                {/* The note is the optional free text the user typed when
                    starting the session (a create's description, a reject's
                    reason, else the notes field). Most sessions are started
                    without one — so only show the section when there's actually a
                    note, rather than a "no note" placeholder on every session. */}
                {input && (
                  <div className="mb-3">
                    <div className="nb-tag mb-1.5">note</div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-nb-ink">{input}</p>
                  </div>
                )}
                <SessionLog session={log ?? selected} flush />
              </>
            ) : (
              <p className="text-[13px] text-nb-ink-soft">Select a session to see its input and log.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
