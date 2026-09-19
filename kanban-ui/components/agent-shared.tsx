"use client";

// Shared agent-run plumbing used by both the board (Create task) and the
// card page (per-card actions): the request/result shapes, the running + result
// overlays, and the input dialogs for each action.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiPlay } from "react-icons/fi";
import { FaPauseCircle } from "react-icons/fa";
import type { RunsCopy } from "@/i18n/runs/types";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { useDraft } from "@/lib/draft";
import { usePhone } from "@/lib/media";
import { useOverRail } from "@/lib/over-rail";
import { useActions, useMachine } from "@/lib/screen";
import { openOf, parseQuestion } from "@/lib/questions";
import type { CloudEventAnswer } from "@/lib/types";
import {
  type Card,
  type CommandAction,
  type DeliveryCommitMode,
  type DeliveryPlan,
  type RunRetry,
  type ScheduledAction,
  type SessionView,
  type TokenUsage,
} from "@/lib/types";
import { Button } from "./button";
import { ELASTIC_CHIP } from "./chips";
import { PULSE_DOT, PULSE_DOT_INK } from "./chrome";
import { ContextRing } from "./context-ring";
import { Dialog } from "./Dialog";
import { Markdown } from "./Markdown";

// Run-log chrome as Tailwind utilities, colocated with the markup that uses it.
// The pulse dot the running badge and the live title bar wear is the board's
// shared one (components/chrome.tsx) — the rail and the card page's subtasks say
// "running" with the same mark.

// The dialog textarea, styled per design.md's input rules: paper fill inside a
// 1.5px ink border (borders are reserved for structural elements), ember focus
// ring as the single accent.
const INPUT =
  "w-full resize-y rounded-[10px] border border-nb-ink/25 bg-nb-paper px-3 py-2.5 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent";

// Shared rhythm for the one-liner that explains what the agent will do — quiet
// ink-soft meta text under the bold ink title.
const INTRO = "mb-3 text-[13px] leading-relaxed text-nb-ink-soft";

// A branch name said inline, in the wash chip the board uses for a path (#307).
const BRANCH = "rounded-[5px] bg-nb-wash px-1.5 py-[1px] font-mono text-[12.5px] font-[700] text-nb-ink";

export interface AgentReq {
  action: CommandAction;
  id?: number;
  notes?: string;
  reason?: string;
  description?: string;
  title?: string;
  andImplement?: boolean;
  release?: string; // create: the version the new card ships in
  /** create and Build now: the pictures pasted into the create sheet (#517) — the box they
   *  were written to and their names, in the order they went in. The board renames that
   *  folder after the run and hands the run their paths. */
  box?: string;
  shots?: string[];
  /** The revision the user was looking at, so the same decision can be recorded against
   *  this card's live Cloud event (#319). Sent on every Implement and Resolve; the board's
   *  rules drop it on a card with no live event, which is most of them. */
  cloudRevision?: string;
  /** One answer per user-owned question, in the card's own order, blanks included — a
   *  ticked option or the user's own words, never both. Resolve only. */
  cloudAnswers?: CloudEventAnswer[];
  /** Where THIS build works (#346) — the Implement dialog's tick, and nothing else's.
   *  Absent everywhere it wasn't asked, and the board then reads the repository setting. */
  commitMode?: DeliveryCommitMode;
  /** The runtime THIS run spawns on (#518) — the create sheet's pick, for the one run.
   *  Absent everywhere it wasn't asked, and the run is then its agent's own. */
  runtime?: string;
}

export type DialogState =
  | { kind: "implement"; card: Card }
  | { kind: "run"; card: Card }
  | { kind: "refine"; card: Card }
  | { kind: "reject"; card: Card }
  | { kind: "archive"; card: Card }
  | null;

// A small inline "running" pill. Runs are non-blocking now (task #12):
// several agents can work at once and the user keeps using the UI, so instead of
// one full-screen overlay each running card shows this badge. Pass onClick to
// make it open the run's log (task #14) — e.g. from a card on the board.
export function RunningBadge({
  label,
  onClick,
}: {
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const c = useCopy().runs.badge;
  return (
    <span
      className="nb-chip gap-1.5"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      title={onClick ? c.watch : label ? c.doing(label) : c.idle}
      style={{
        ...ELASTIC_CHIP,
        background: "var(--color-nb-accent-soft)",
        color: "var(--color-nb-accent-deep)",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <span className={PULSE_DOT} aria-hidden />
      <span className="truncate">{label ? label : c.running}</span>
    </span>
  );
}

// The live tail is the agent's event stream — tool calls and turn text — so it
// reads mono. A finished run leads with the agent's final message (markdown)
// and folds the intermediate events away underneath.
const MONO_TEXT = {
  whiteSpace: "pre-wrap",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
} as const;

// How long a finished run took, in the coarsest unit that still tells you
// something: seconds under a minute, minutes and seconds under an hour, hours and
// minutes above. Agent runs are minutes-long, so this is nearly always "4m 12s".
export function formatDuration(ms: number, c: RunsCopy["log"]): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return c.seconds(total);
  const mins = Math.floor(total / 60);
  if (mins < 60) return c.minutes(mins, total % 60);
  return c.hours(Math.floor(mins / 60), mins % 60);
}

// What a finished run cost, in US dollars (task #90). Two decimals is the unit
// people read money in; a run too cheap to reach a cent says so as "<$0.01"
// rather than "$0.00", which would read as free. The word "est." carries the
// rest: the agent worked the number out from tokens at list prices, and on a
// subscription plan nothing was charged for the run at all.
export function formatCost(usd: number, c: RunsCopy["log"]): string {
  return usd < 0.005 ? c.costTiny : c.cost(usd.toFixed(2));
}

// The run's token counts as one readable line, closing out the intermediate
// events: what the agent read fresh, wrote to and read back from the prompt
// cache, and wrote out. Full numbers with separators, not "1.2M" — the counts
// are the point here, and the line only appears in an opened fold.
export function formatTokens(u: TokenUsage, c: RunsCopy["log"]): string {
  const n = (v: number) => v.toLocaleString("en-US");
  return c.tokens(n(u.input), n(u.cacheCreation), n(u.cacheRead), n(u.output));
}

// A run that ended without finishing: it failed, or it was cut off when the UI
// died mid-run. Both leave the work half-done and both can be picked up again,
// so every screen that reports one asks this rather than testing the two states
// itself. A run the user stopped is NOT one of these: nothing went wrong with it.
export function stoppedShort(session: SessionView | null | undefined): boolean {
  return session?.status === "error" || session?.status === "interrupted";
}

/** The newest setup run, when it stopped short (#230). `nothing` counts the setup runs in a
 *  row, newest first, that exited cleanly with no box ticked (#909); 0 is any other failure. */
export type SetupFailure = { runId: string; nothing: number };

export function setupFailure(sessions: SessionView[]): SetupFailure | null {
  const runs = sessions.filter((r) => r.action === "setup").sort((a, b) => b.startedAt - a.startedAt);
  if (!stoppedShort(runs[0])) return null;
  const streak = runs.findIndex((r) => !r.tickedNothing);
  return { runId: runs[0]!.sessionId, nothing: streak < 0 ? runs.length : streak };
}

// A run waiting out a provider that failed for a moment (#525).
//
// It is drawn only while the next attempt is still ahead, which is the only moment a LIVE
// run has anything to say beyond that it is going. The run still holds its card through the
// wait, so the three things to know are why it stopped, how long is left, and how many
// attempts remain — and Stop, in the title bar above, is what ends it for good.
function RetryWait({ retry }: { retry: RunRetry }) {
  const c = useCopy().runs.retry;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const left = Math.max(0, Math.round((retry.at - now) / 1000));
  return (
    <div role="status" className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2.5 text-nb-peach-ink">
      <p className="nb-tag mb-1.5 text-nb-peach-ink">
        {left > 0 ? c.waiting(left, retry.attempt, retry.of) : c.starting(retry.attempt, retry.of)}
      </p>
      <p className="text-[12.5px] leading-relaxed text-nb-ink">{retry.reason}</p>
    </div>
  );
}

/** A run's one state (#930). The log window's word and mark, and the history's dot, all
 *  read it, so the same run never says two things in two places. */
export type RunState = "running" | "done" | "failed" | "interrupted" | "stopped";

export function runState(session: SessionView): RunState {
  if (session.status === "running" || session.status === "stopped" || session.status === "interrupted") {
    return session.status;
  }
  return session.ok ? "done" : "failed";
}

/** The state in words. A blocked run and a setup that ticked nothing keep their own word:
 *  it says why, where "failed" would not. */
function stateWord(session: SessionView, c: RunsCopy["log"]): string {
  const state = runState(session);
  if (state === "running") return "";
  if (state !== "stopped" && session.blocker) return c.blocked;
  if (state === "failed" && session.tickedNothing) return c.nothingDone;
  return c[state];
}

/** One thing a run's facts row says, and the caveat it carries in a tooltip. */
type RunFact = { key: string; text: string; dim?: boolean; title?: string };

// The run's facts, in the order they read: what came of it, how long it took, what it cost,
// and which model did the work. A live run has only the model — the pulse dot says the
// rest, and the numbers aren't in yet. The card page's title bar and the run bar over a log
// window both read them from here, so the two can't drift apart.
function runFacts(session: SessionView, c: RunsCopy["log"]): RunFact[] {
  const running = session.status === "running";
  const state = stateWord(session, c);
  // The exit code means nothing to a reader, so it is only the failure's tooltip.
  const exit =
    runState(session) === "failed" && session.code != null ? c.exitCode(String(session.code)) : undefined;
  // How long it took, next to the outcome: "done · 4m 12s". An interrupted run was only
  // noticed on the next pid poll — an upper bound, not a measurement, so it's marked "~".
  const took =
    running || session.durationMs === undefined
      ? ""
      : `${session.status === "interrupted" ? "~" : ""}${formatDuration(session.durationMs, c)}`;
  // And what it cost: "done · 4m 12s · est. $0.42". One run, one number — this run's own,
  // never a total. A run that reported no cost shows nothing here at all.
  const cost = running || session.costUsd === undefined ? "" : formatCost(session.costUsd, c);
  const facts: RunFact[] = [];
  if (state) facts.push({ key: "state", text: state, title: exit });
  if (took) facts.push({ key: "took", text: took, dim: true });
  if (cost) facts.push({ key: "cost", text: cost, dim: true, title: c.costHint });
  // The model the agent itself said it was running, shown exactly as it said it (task #98)
  // — not the model setting, which is empty for most people and says nothing about a run
  // that started before it was last changed.
  if (session.model) {
    facts.push({ key: "model", text: session.model, dim: true, title: c.modelHint });
  }
  return facts;
}

/** The facts as one middot-separated row. Any caveat lives in a fact's tooltip — the row
 *  itself stays short. */
function RunFacts({ facts }: { facts: RunFact[] }) {
  if (facts.length === 0) return null;
  return (
    <span className="text-[11px] text-nb-ink-soft">
      {facts.map((f, i) => (
        <span key={f.key} className={f.dim ? "tabular-nums opacity-80" : undefined} title={f.title}>
          {i > 0 && <span className="mx-1.5" aria-hidden>·</span>}
          {f.text}
        </span>
      ))}
    </span>
  );
}

// The run's state as one mark: ✓, ✕, ⦸ for a run cut off, ■ for one somebody stopped.
// Every form sits in the same 22px box as the Stop button beside it, so a bar is one height
// whether the run is live or over.
function RunIndicator({ session, ink }: { session: SessionView; ink?: boolean }) {
  const state = runState(session);
  return (
    <span className="grid size-[22px] shrink-0 place-items-center leading-none">
      {state === "running" ? (
        // The deep ember sinks into the ink ground; the plain one does not (#760).
        <span className={ink ? PULSE_DOT_INK : PULSE_DOT} aria-hidden />
      ) : state === "stopped" ? (
        <span aria-hidden className={ink ? "text-nb-sky" : undefined} style={ink ? undefined : { color: "var(--color-nb-sky-ink)" }}>■</span>
      ) : state === "interrupted" ? (
        <span aria-hidden className={ink ? "text-nb-peach" : undefined} style={ink ? undefined : { color: "var(--color-nb-peach-ink)" }}>⦸</span>
      ) : (
        <span
          aria-hidden
          className={ink ? (state === "done" ? "text-nb-mint" : "text-nb-peach") : undefined}
          style={ink ? undefined : { color: "var(--color-nb-accent-deep)" }}
        >
          {state === "done" ? "✓" : "✕"}
        </span>
      )}
    </span>
  );
}

// A tailing view of one run's captured output (task #14). Shows the last few
// KB; auto-scrolls to the newest line unless the user has scrolled up to read
// back. Once the run ends with a parsed final message, the view leads with
// that message and the intermediate events fold into a collapsed row above it.
// `session` is the polled SessionView (see useSessionLog); null renders nothing.
export function SessionLog({
  session,
  collapsed = false,
  onToggle,
  flush = false,
  warnUnfinished = false,
  onResumed,
  bare = false,
  cap = "max-h-[50vh]",
}: {
  session: SessionView | null;
  collapsed?: boolean;
  onToggle?: () => void;
  // How tall the body well may grow before it scrolls. Half the viewport suits a page that
  // scrolls as a whole; a caller whose page does not scroll passes its own.
  cap?: string;
  // Drop the frame and title bar: the delivery block owns the frame, and folds the useful
  // run status into its tab strip so an embedded log does not grow a second toolbar.
  bare?: boolean;
  // The card page turns these two on for a run that stopped short (#179): the
  // window says in words that the card is part-built, and carries Resume in its
  // title bar. The runs panel words and offers the same thing its own way, so it
  // leaves both off.
  warnUnfinished?: boolean;
  onResumed?: (sessionId: string) => void;
  // `flush` is the log alone — no frame, no title bar, no height cap. The window it is
  // dropped into (the runs dialog's log drawer) carries the one bar and owns the
  // scrolling. The collapsible form is for the inline card-page log.
  flush?: boolean;
}) {
  const t = useCopy();
  const c = t.runs.log;
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const tail = (session?.tail || "").trim();
  const result = (session?.result || "").trim();
  const note = (session?.note || "").trim();
  const blocker = session?.blocker;
  // The wait between retry attempts (#525): a live run whose next attempt is still ahead.
  // A run already ON its next attempt carries the same record and draws nothing — it is
  // simply running.
  const waiting =
    session?.status === "running" && session.retry && session.retry.at > Date.now() ? session.retry : null;

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [tail]);

  if (!session) return null;
  const running = session.status === "running";
  // This run ended without finishing — the warning and the Resume below hang off it.
  const unfinished = stoppedShort(session);
  // Whether this run can actually be picked up. The warning line stays either way, so a run
  // too old to continue still says what it left.
  const resumable = Boolean(unfinished && session.canResume);
  // Resume shows in the title bar only when the view that owns the log wants it there. The
  // delivery block drops the bar and carries Resume in its own strip instead, so the line
  // below speaks for the control wherever it is drawn.
  const carryOn = Boolean(onResumed && resumable);
  const facts = runFacts(session, c);

  // The log body, shared by both layouts.
  const message = running ? (
    // A live tail is streaming events, not markdown — keep the raw terminal look
    // so partial lines don't get mangled mid-render.
    <pre className="m-0 text-nb-ink-soft" style={MONO_TEXT}>
      {tail || c.waiting}
    </pre>
  ) : result ? (
    // The final message leads; the event lines it streamed on the way fold into
    // one collapsed row above it. The tail's own trailing copy of the message
    // was already cut server-side, so the fold never repeats what leads. A run
    // that finished clean closes the fold with its token counts — the numbers
    // behind the cost in the title bar.
    <>
      {(tail || (session.ok && session.usage)) && (
        <details className="mb-2">
          <summary className="cursor-pointer select-none text-[10px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft hover:text-nb-ink">
            {c.events}
          </summary>
          {tail && (
            <pre className="m-0 mt-2 text-nb-ink-soft" style={MONO_TEXT}>
              {tail}
            </pre>
          )}
          {session.ok && session.usage && (
            <p
              className="m-0 mt-2 tabular-nums text-nb-ink-soft opacity-80"
              style={MONO_TEXT}
              title={c.tokensHint}
            >
              {formatTokens(session.usage, c)}
            </p>
          )}
        </details>
      )}
      <Markdown body={result} className="nb-sessionlog-md" />
    </>
  ) : tail ? (
    // No parsed final message (custom agent command, or a run re-adopted
    // after a restart) — the tail is all there is.
    <Markdown body={tail} className="nb-sessionlog-md" />
  ) : (
    <pre className="m-0 text-nb-ink-soft" style={MONO_TEXT}>
      {c.noOutput}
    </pre>
  );

  // What a run that stopped short left behind (#179), said first because it is the
  // thing to know before reading anything the agent managed to write. It lives in
  // the run's own window rather than on the card: it is one run's outcome, and it
  // goes when a newer run replaces it.
  // A setup run that ticked nothing says why everywhere, the runs panel included (#909).
  const unfinishedLine = (warnUnfinished || session.tickedNothing) && unfinished && !blocker && (
    <p className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2 text-[12.5px] leading-relaxed text-nb-peach-ink">
      <span className="mr-1" aria-hidden>
        ⚠
      </span>
      {session.tickedNothing ? c.tickedNothing : <>{c.stoppedShort}{resumable ? c.stoppedShortResume : ""}</>}
    </p>
  );

  const blockerPanel = blocker && (
    <div role="alert" className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2.5 text-nb-peach-ink">
      <p className="mb-2 text-[11px] font-[800] uppercase tracking-[0.08em]">{c.blocker.heading}</p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1 text-[12.5px] leading-relaxed">
        <dt className="font-[700]">{c.blocker.step}</dt>
        <dd className="text-nb-ink">{blocker.step}</dd>
        <dt className="font-[700]">{c.blocker.cause}</dt>
        <dd className="text-nb-ink">{blocker.cause}</dd>
        <dt className="font-[700]">{c.blocker.unblock}</dt>
        <dd className="font-[700] text-nb-ink">{blocker.unblock}</dd>
      </dl>
    </div>
  );

  // The board's own line about how the run ended, under the agent's message and plainly
  // not part of it. The one thing a finished run can't say for itself is that nothing is
  // coming after it.
  const body = (
    <>
      {waiting && <RetryWait retry={waiting} />}
      {blockerPanel}
      {unfinishedLine}
      {message}
      {note && (
        <p className="mt-3 rounded-[8px] bg-nb-peach-soft px-3 py-2 text-[12.5px] leading-relaxed text-nb-peach-ink">
          {note}
        </p>
      )}
    </>
  );

  // The title bar — the "run log" kicker + the live/done indicator. Chrome over the well
  // below it, parted by a hairline, and the expand/collapse control the card page clicks.
  // A log dropped into a window of its own carries no bar: that window has the one bar,
  // and it names the task rather than the log (RunBar).
  const titleBar = (
    <div
      // This bar IS a band on the card page, so it takes the meta box's own ground and
      // padding: the two sit one above the other, so their kickers start on the same line.
      className={`flex items-center gap-2.5 rounded-t-[14px] px-4 py-2.5${collapsed ? " rounded-b-[14px]" : " border-b border-nb-ink/12"}${onToggle ? " cursor-pointer select-none" : ""}`}
      role={onToggle ? "button" : undefined}
      aria-expanded={onToggle ? !collapsed : undefined}
      aria-label={onToggle ? (collapsed ? c.expand : c.collapse) : undefined}
      onClick={onToggle}
    >
      <span className="nb-tag">{c.title}</span>
      {/* 22px floor: the tallest thing that can ride here (Stop, Resume, the
          outcome mark) sets the bar's height, and it stays that height when the
          run ends and they swap. */}
      <span className="ml-auto flex min-h-[22px] items-center gap-1.5">
        {running && <StopButton sessionId={session.sessionId} />}
        <RunIndicator session={session} />
        {/* How full the model's window is, as of this run's last finished request (#675).
            It climbs while the run works, and is left standing on a run that has ended. */}
        <ContextRing context={session.context} />
        <RunFacts facts={facts} />
        {/* Resume rides the title bar beside the outcome it answers (#179). The bar
            doubles as the collapse toggle on the card page, so the button swallows
            its own click rather than folding the log it just restarted. */}
        {carryOn && (
          <span onClick={(e) => e.stopPropagation()}>
            <ResumeButton sessionId={session.sessionId} onResumed={onResumed} />
          </span>
        )}
      </span>
    </div>
  );

  // The scrolling body well — inset shadow, capped height, and always one rung DOWN from
  // the chrome above it, which is what makes it read as recessed and gives the block a
  // bottom edge. A white well on a white page had no edge at all.
  const bodyWell = (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={`${cap} overflow-auto bg-nb-canvas px-4 py-3 shadow-[inset_0_1px_3px_color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]${bare ? " border-t border-nb-ink/12" : " rounded-b-[14px]"}`}
    >
      {body}
    </div>
  );

  // Flush: the log itself and nothing around it (#753). The window it is dropped into —
  // the runs dialog's log drawer — carries the one title bar and owns the scrolling, so a
  // frame here would be a second window inside the first.
  if (flush) return body;

  // Bare: the frame belongs to whatever this is dropped into — the delivery block.
  if (bare) {
    return bodyWell;
  }

  // The card page's own form. No frame: it is one of the page's bands, on the page's one
  // ground, with the log in a well a step below it.
  return (
    <div className="nb-section bg-nb-sheet">
      {titleBar}
      {!collapsed && bodyWell}
    </div>
  );
}

/** What the run bar says about the task a run is on: the card it belongs to and what that
 *  task is called, which step of the job this run is, and when the job started. */
export interface RunHead {
  id: number | null;
  name: string;
  /** Empty when the name already IS the step — the word is not printed twice. */
  step: string;
  startedAt: string;
}

const RUN_BAR =
  "flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 max-md:px-3";
/** The bar's ground. Paper everywhere, and reversed out onto ink in the run office (#760),
 *  where a white strip over a pixel room reads as a window from another program. */
const RUN_BAR_GROUND = "border-b border-nb-ink/12 bg-nb-paper";
const RUN_BAR_TITLE = "min-w-[5rem] flex-1 truncate text-[13.5px] font-[800] tracking-[-0.02em]";

// Everything a log window used to stack three titles to say, on one line (#753): the task
// and its `#id`, which step this is and when the job started, the run's controls and its
// numbers, and then — parted by a hairline — the window's own way off. The name takes all
// the slack and clips; nothing to its right ever moves.
//
// It is the window's bar, not the log's. SessionLog draws nothing without a run, so a bar
// hung off it would take the way out with it.
//
// On a phone the step and the numbers drop to a second line of their own, and the first
// keeps the three that cannot give way: what this run is, the move that acts on it, and the
// way off.
export function RunBar({
  session,
  head,
  canResume = false,
  onResumed,
  onFollow,
  control,
  ink,
}: {
  session: SessionView;
  head: RunHead;
  /** Whether Carry on belongs here. The runs panel hands the job to the delivery's own
   *  control wherever the board kept its checkout (#720), and passes false. */
  canResume?: boolean;
  onResumed?: (sessionId: string) => void;
  /** Following the `#id` leaves the surface the bar is on, so the dialog closes behind it. */
  onFollow?: () => void;
  /** The window's own way off: Collapse in a drawer, ✕ in a dialog. */
  control: React.ReactNode;
  /** The run office's form of the bar (#760): the whole row reversed out onto ink. */
  ink?: boolean;
}) {
  const c = useCopy().runs.log;
  const phone = usePhone();
  const facts = runFacts(session, c);
  // Stop and Carry on act on the RUN. On a phone they hold the first line with the name;
  // everywhere else they ride with the numbers they qualify.
  const moves = (
    <>
      {session.status === "running" && <StopButton sessionId={session.sessionId} ink={ink} />}
      {canResume && <ResumeButton sessionId={session.sessionId} onResumed={onResumed} />}
    </>
  );
  // Every tint on the bar has a second value for the ink ground: the meta text goes to
  // thinned paper, and so does the hairline that parts the window's own control.
  const meta = ink ? "text-nb-cream/70" : "text-nb-ink-soft";
  const rule = ink ? "border-nb-cream/25" : "border-nb-ink/12";

  return (
    <div className={`${RUN_BAR} ${ink ? "nb-bar-px" : RUN_BAR_GROUND}`}>
      {/* The task, leading — the id jumps to its card the way every `#id` in the UI does,
          and is not gated on the card still being open: a card the run archived is exactly
          the one you'd click. The full name is the bar's tooltip. */}
      <h2 className={RUN_BAR_TITLE} title={head.id === null ? head.name : `#${head.id} · ${head.name}`}>
        {head.id !== null && (
          <>
            <Link href={`/${head.id}`} className="nb-idlink" onClick={onFollow}>
              #{head.id}
            </Link>
            {" · "}
          </>
        )}
        {head.name}
      </h2>
      <span
        className={`flex min-w-0 items-center gap-y-1 ${
          phone ? "order-3 w-full shrink-0 basis-full flex-wrap gap-x-2.5" : "shrink gap-x-2"
        }`}
      >
        {head.step && (
          <span className={`shrink-0 text-[11.5px] font-[700] ${meta}`}>{head.step}</span>
        )}
        {/* A job is dated by when IT started, not by the session you happen to be reading. */}
        <span className={`shrink-0 text-[11px] ${meta}`}>{head.startedAt}</span>
        {/* 22px floor: the tallest thing that can ride here sets the bar's height, and it
            keeps that height when the run ends and the controls swap. */}
        <span className="flex min-h-[22px] shrink-0 items-center gap-1.5">
          {!phone && moves}
          <RunIndicator session={session} ink={ink} />
          {/* How full the model's window is, as of this run's last finished request (#675). */}
          <ContextRing context={session.context} ink={ink} />
        </span>
        {/* The numbers, each its own item so that on a phone they wrap rather than clip: a
            duration cut in half says less than nothing. The order is fixed, so what falls to
            the next line is always the tail. */}
        {facts.map((f, i) => (
          <span
            key={f.key}
            className={`shrink-0 whitespace-nowrap text-[11px] ${meta} ${
              f.dim ? "tabular-nums opacity-80" : ""
            }`}
            title={f.title}
          >
            {/* Middots only where the row cannot wrap. On a phone the line breaks between
                these items, and a separator at either end of a broken line reads as a render
                that failed — the gap does the separating instead. */}
            {!phone && i > 0 && (
              <span className="-ml-1 mr-2" aria-hidden>
                ·
              </span>
            )}
            {f.text}
          </span>
        ))}
      </span>
      {/* The window's own control, parted from the run's by a hairline: it acts on the
          window, not on the run. These never give way. */}
      <span className={`ml-auto flex min-h-[22px] shrink-0 items-center gap-1.5 ${phone ? "order-2" : ""}`}>
        {phone && moves}
        <span className={`ml-1 flex items-center border-l ${rule} pl-2`}>{control}</span>
      </span>
    </div>
  );
}

/** The same bar with no run behind it: a dialog opened where nothing has ever run. The
 *  window still has to be named and still has to be closable, and nothing else on the bar
 *  has anything to say. */
export function EmptyRunBar({
  title,
  control,
  ink,
}: {
  title: string;
  control: React.ReactNode;
  /** The run office's form of the bar (#760) — the log drawer lands here for the moment
   *  before the poll catches up. */
  ink?: boolean;
}) {
  return (
    <div className={`${RUN_BAR} ${ink ? "nb-bar-px" : RUN_BAR_GROUND}`}>
      <h2 className={RUN_BAR_TITLE}>{title}</h2>
      <span className="ml-auto flex min-h-[22px] shrink-0 items-center pl-2">{control}</span>
    </div>
  );
}

// The recovery control on a run that stopped short: send one more turn into the
// very conversation that died — the agent picks up where it stopped instead of
// starting the task over. It is the same thing you would do in a terminal with
// `claude --resume <id>`, done here, so nothing is copied and no id is ever
// shown: the server knows which agent ran and how that agent resumes.
//
// Rendered only when the server says `canResume` — the run failed, was
// interrupted or was stopped, its id is known, and the agent that ran it is
// still the configured one. A passing run has nothing to continue, so it shows
// no button at all.
export function ResumeButton({
  sessionId,
  onResumed,
}: {
  sessionId: string;
  // Told the new run's id, so the view that owns the selection can follow the
  // resumed run instead of staying on the dead one.
  onResumed?: (sessionId: string) => void;
}) {
  const c = useCopy().runs.resume;
  const actions = useActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resume = async () => {
    if (busy || !actions) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.resumeSession(sessionId);
      // A refusal is the registry's own words — the card is locked by another
      // run, or this one aged out of the kept-30 window. Say it and leave the
      // button alive to try again.
      if (res.ok && res.sessionId) onResumed?.(res.sessionId);
      else setError(res.error || c.failed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  // Nothing to resume with (#374): a screen handed no actions draws the log and no control
  // over the run behind it.
  if (!actions) return null;
  return (
    <span className="flex shrink-0 items-center gap-2">
      {error && <span className="text-[11px] text-nb-peach-ink">{error}</span>}
      <Button
        variant="ghost"
        size="sm"
        onClick={resume}
        disabled={busy}
        title={c.hint}
        // The same ghost sticker as the other quiet controls (header buttons,
        // dialog cancels), shrunk to meta-row scale — it sits inside full nb
        // panels, so it wears the ink frame + press shadow like everything else.
        // Quiet, not the ember CTA: it starts an agent, but on a run that already
        // went wrong, so it invites rather than urges.
        className="gap-1 rounded-[7px] px-2 py-1 text-[11px] font-[700]"
      >
        <FiPlay className="text-[12px]" aria-hidden />
        {busy ? c.resuming : c.label}
      </Button>
    </span>
  );
}

// The control that ends a live run (#49): a small ✕ in the log's title bar. It
// never stops anything on its own — pressing it opens a confirmation popover
// beside it, so a stray click on a busy board can't kill an agent mid-edit.
//
// What the popover has to say is the one thing Stop does NOT do: the run ends
// where it stands and whatever it half-wrote stays in the working tree. The board
// never undoes work — that's `git` in your own terminal.
//
// After the confirm the button says "stopping…" and stays that way until the poll
// brings the run back as stopped. That wait is real: the agent is asked to end
// first and only killed if it doesn't, so a few seconds pass, and pretending
// otherwise would be a lie the next poll undoes.
function StopButton({ sessionId, ink }: { sessionId: string; ink?: boolean }) {
  const t = useCopy();
  const c = t.runs.stop;
  const actions = useActions();
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  // Over the chat rail while it is open, so Esc dismisses the popover and leaves a reply
  // alone.
  useOverRail(open);

  // Escape, or a click anywhere else, dismisses the popover — the same way out
  // the dialogs give. Only bound while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const stop = async () => {
    if (!actions) return;
    setOpen(false);
    setAsked(true);
    setError(null);
    try {
      const res = await actions.stopSession(sessionId);
      // A refusal is the registry's own words — the run aged out of the kept-30
      // window. Say it and let the button be pressed again.
      if (!res.ok) {
        setAsked(false);
        setError(res.error || c.failed);
      }
    } catch (e) {
      setAsked(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!actions) return null;
  if (asked) {
    return <span className={`text-[11px] ${ink ? "text-nb-cream/70" : "text-nb-ink-soft"}`}>{c.stopping}</span>;
  }

  return (
    // The title bar is a click target of its own on the card page (it collapses
    // the log), so every press in here stops at this element.
    <span ref={ref} className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {error && (
        <span className={`text-[11px] ${ink ? "text-nb-peach" : "text-nb-peach-ink"}`}>{error}</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={c.title}
        aria-expanded={open}
        title={c.title}
        className={`grid size-[22px] cursor-pointer place-items-center transition-[background-color,color,transform] duration-100 active:scale-90 ${
          ink ? "nb-px-btn" : "rounded-[6px] text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink"
        }`}
      >
        {/* The same glyph the delivery block's Stop run wears — one verb, one mark, wherever
            a run can be stopped. */}
        <FaPauseCircle className="text-[13px]" aria-hidden />
      </button>
      {open && (
        // A full nb panel, small: ink frame and hard shadow like every other
        // surface, hung off the button and right-aligned so it can't run off the
        // edge of the log window.
        <span className="nb-panel-sm absolute right-0 top-full z-30 mt-2 block w-[248px] p-3 text-left">
          <span className="block text-[13px] font-[700] leading-snug text-nb-ink">
            {c.confirm}
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-nb-ink-soft">
            {c.body}
          </span>
          <span className="mt-2.5 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-[7px] px-2 py-1 text-[11px] font-[700]"
              onClick={() => setOpen(false)}
            >
              {t.shared.cancel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-[7px] border-nb-peach-ink px-2 py-1 text-[11px] font-[700] text-nb-peach-ink"
              onClick={stop}
            >
              {c.label}
            </Button>
          </span>
        </span>
      )}
    </span>
  );
}

// What to call a run that names no card: what it is doing while it runs,
// what it did once it's over. A plan-release carries its version id as its
// input, so the title says which release it planned.
export function cardlessTitle(session: SessionView, c: RunsCopy["cardless"]): string {
  const running = session.status === "running";
  const of = session.input ? ` ${session.input}` : "";
  if (session.action === "plan-release") return running ? c.planning(of) : c.plan(of);
  if (session.action === "changelog") return running ? c.writingChangelog(of) : c.changelog(of);
  if (session.action === "propose") return running ? c.proposing : c.propose;
  if (session.action === "setup") return running ? c.finishingSetup : c.finishSetup;
  return running ? c.creating : c.create;
}

// A warning the user has to answer before the action can run: the reason, then a
// checkbox that says it back in their own voice. The whole box is the label, so
// the click target is the paragraph-sized box, not a 15px square. Tones are the
// two the board already speaks — `peach` for a blocker (something else must land
// first), `accent` for a softer "this may not be ready".
function WarningBox({
  tone,
  ack,
  onAck,
  ackLabel,
  children,
}: {
  tone: "peach" | "accent";
  ack: boolean;
  onAck: (v: boolean) => void;
  ackLabel: string;
  children: React.ReactNode;
}) {
  const skin =
    tone === "peach"
      ? "bg-nb-peach-soft text-nb-peach-ink accent-nb-peach-ink"
      : "bg-nb-accent-soft text-nb-accent-deep accent-nb-accent-deep";
  return (
    <label className={`mb-3 block cursor-pointer rounded-[8px] px-3 py-2 text-[12.5px] leading-relaxed ${skin}`}>
      <span className="block">{children}</span>
      <span className="mt-2 flex items-start gap-2 font-[700]">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => onAck(e.target.checked)}
          className="mt-[2px] size-[14px] shrink-0 cursor-pointer"
        />
        {ackLabel}
      </span>
    </label>
  );
}

// The one choice on the Implement dialog: whether THIS build gets a worktree and a branch of
// its own (#346). Not a warning, so it sits on the quiet wash rung rather than in peach or
// accent, and nothing is gated on it. The hint follows the tick, because what it costs is
// exactly what the tick changes.
function ChoiceBox({ on, onFlip, label, hint }: { on: boolean; onFlip: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="mb-3 block cursor-pointer rounded-[8px] bg-nb-wash px-3 py-2 text-[12.5px] leading-relaxed">
      <span className="flex items-start gap-2 font-[700] text-nb-ink">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onFlip(e.target.checked)}
          className="mt-[2px] size-[14px] shrink-0 cursor-pointer accent-nb-accent-deep"
        />
        {label}
      </span>
      <span className="mt-1 block pl-[22px] text-nb-ink-soft">{hint}</span>
    </label>
  );
}

// --- the input dialogs for each action --------------------------------------

export function ActionDialog({
  dialog,
  onClose,
  onRun,
  onSchedule,
  onResolveFirst,
  plan = { commitMode: "auto" },
}: {
  dialog: Exclude<DialogState, null>;
  onClose: () => void;
  onRun: (req: AgentReq, label: string) => void;
  // Answer the card's open questions before building it (#307) — the Implement dialog's
  // way out of its third warning. The card page closes this dialog and opens the questions
  // panel behind it; a view with no questions panel simply doesn't offer it.
  onResolveFirst?: () => void;
  // What the click would do (#307): the branch it lands on, and whether it lands at all.
  // Implement only. Defaults to the plain auto-commit answer with no branch named, which
  // is what a board whose rules predate the one-click flow can say.
  plan?: DeliveryPlan;
  // Queue this action instead of starting it (#140) — offered only on a card
  // with an open blocker, and only where the owner passed a handler. A view that
  // doesn't schedule simply doesn't offer it.
  onSchedule?: (action: ScheduledAction, notes: string) => void;
}) {
  // Persist the draft per action + card so an accidental close keeps the text
  // (resolve keeps its own list-shaped draft in ResolveDialog below). `run`
  // clears the draft once the run has actually started.
  const t = useCopy();
  const d = t.runs.dialog;
  // The machine holding the board, or none — a caller serving these screens from somewhere
  // else (#322). Read here rather than in the branch below: hooks are not called under one.
  const runsHere = !!useMachine();
  const [text, setText, clearDraft] = useDraft(`${dialog.kind}:${dialog.card.id}`);
  // "Yes, I know" for a warned action (see the implement branch). Deliberately NOT
  // persisted like the note draft is: closing the dialog drops it, so every open
  // asks again. The dialog unmounts on close, so this resets on its own. There is
  // one per warning, because a card can wear both at once and each tick answers
  // its own box.
  const [ack, setAck] = useState(false);
  const [ackRough, setAckRough] = useState(false);
  const [ackAsked, setAckAsked] = useState(false);
  // Where THIS build works (#346) — the Implement dialog's own box. It starts on the side
  // its repository setting picks and never writes back to it, so the setting is still the
  // default every Implement opens with. Like the acks, it isn't persisted: closing the
  // dialog drops it and the next open asks the board again.
  const [ownBranch, setOwnBranch] = useState(plan.commitMode === "auto");
  const run = (req: AgentReq, label: string) => {
    clearDraft();
    onRun(req, label);
  };
  const schedule = (action: ScheduledAction) => {
    clearDraft();
    onSchedule?.(action, text.trim());
  };

  if (dialog.kind === "implement") {
    // Three warnings, and they stand together when the card earns more than one.
    // `blocked_by` is the hard one: another open card has to land first, so building
    // this now means building on something that isn't there. It only ever names live
    // cards — archiving or rejecting a card drops its id from every other card's
    // blocked_by (kanban.mjs), so a leftover blocker can't linger here. `ready`
    // is the soft one: the plan may still be rough. An open question (#307) is the
    // third: the card is built and reviewed all the same, and holds at landing until
    // the question is answered.
    //
    // The user can still go ahead — they know things the board doesn't — but
    // going ahead is never the easy path. Each warning box carries its own "I
    // know" checkbox, and until every one shown is ticked the confirm button is
    // dead: no single click reaches an agent run the board said not to start.
    // Ticking them wakes a quiet outlined button, not the ember CTA.
    //
    // Each warning has a plain way out that needs no tick, and one alternate button
    // carries it: Resolve first opens the questions panel, and Schedule (#140)
    // waits for the blocker. Questions win the slot when a card wears both — it is the
    // one the user can settle now, and the blocker box still names Schedule in words.
    const blockers = dialog.card.blocked_by;
    const notReady = dialog.card.status !== "ready";
    const asked = openOf(dialog.card.questions).length;
    const answerable = openOf(dialog.card.questions).some((q) => parseQuestion(q.text).tag === "user");
    const warned = blockers.length > 0 || notReady || asked > 0;
    const canSchedule = onSchedule && dialog.card.openBlockers.length > 0;
    const ids = blockers.map((n) => `#${n}`).join(", ");
    const one = blockers.length === 1;
    const c = d.implement;
    // The box is offered only where a worktree is possible at all (#346); with no git, no
    // commit to fork from or a detached HEAD there is nothing to ask, and on rules older
    // than the choice the answer doesn't say, so the dialog keeps the one sentence it has
    // always had. Where it is offered, the tick is what the paragraph reads from.
    const canChoose = plan.canChooseWorktree === true;
    // Whether this click starts a run HERE. The hosted card page has no machine holding the
    // board (#322), so pressing Implement records the decision and one of the workspace's own
    // machines builds it later (#364) — none of the five sentences below is true of that, and
    // the plan a reader is handed says `manual` only because a browser has no checkout to
    // read one from.
    const recorded = !runsHere;
    // A workflow that makes files (#874): no branch to pick and nothing to commit.
    const files = plan.commitMode === "files";
    const auto = canChoose ? ownBranch : plan.commitMode === "auto";
    // Whether a second agent reviews this build is the board's own **AI review** setting
    // (#416) and nothing this dialog asks; rules older than it say nothing, and every build
    // they start is reviewed. The paragraph reads from it.
    const reviewed = plan.aiReview !== false;
    // The opening sentence, in the shape the two ticks and the checkout put it in.
    const autoIntro = plan.branch
      ? reviewed
        ? c.autoBranch(plan.branch)
        : c.autoBranchNoReview(plan.branch)
      : reviewed
        ? c.autoHere
        : c.autoHereNoReview;
    const manualIntro = plan.manualWhy
      ? reviewed
        ? c.manualWhy(plan.manualWhy)
        : c.manualWhyNoReview(plan.manualWhy)
      : reviewed
        ? c.manual
        : c.manualNoReview;
    return (
      <Dialog title={c.title(dialog.card.id)} onClose={onClose}>
        <p className={INTRO}>
          {recorded ? (
            <Rich>{c.recorded}</Rich>
          ) : files ? (
            reviewed ? c.files : c.filesNoReview
          ) : auto ? (
            <>
              <Rich code={BRANCH}>{autoIntro}</Rich>
              {/* The one place the click does NOT carry the card all the way (#308). */}
              {plan.needsApproval ? c.needsApproval : ""}
              {c.thenArchives}
            </>
          ) : canChoose ? (
            <Rich>{reviewed ? c.manualFolder : c.manualFolderNoReview}</Rich>
          ) : (
            <Rich>{manualIntro}</Rich>
          )}
        </p>
        {canChoose && (
          <ChoiceBox
            on={ownBranch}
            onFlip={setOwnBranch}
            label={c.ownBranch}
            hint={ownBranch ? c.ownBranchOn : c.ownBranchOff}
          />
        )}
        {asked > 0 && (
          <WarningBox
            tone="accent"
            ack={ackAsked}
            onAck={setAckAsked}
            ackLabel={asked === 1 ? c.ackQuestionsOne : c.ackQuestionsMany(asked)}
          >
            <Rich>{asked === 1 ? c.questionsOne : c.questionsMany(asked)}</Rich>
          </WarningBox>
        )}
        {blockers.length > 0 && (
          <WarningBox
            tone="peach"
            ack={ack}
            onAck={setAck}
            ackLabel={one ? c.ackBlockedOne(ids) : c.ackBlockedMany(ids)}
          >
            <Rich>
              {canSchedule
                ? one
                  ? c.blockedOneSchedule(ids)
                  : c.blockedManySchedule(ids)
                : one
                  ? c.blockedOne(ids)
                  : c.blockedMany(ids)}
            </Rich>
          </WarningBox>
        )}
        {notReady && (
          <WarningBox
            tone="accent"
            ack={ackRough}
            onAck={setAckRough}
            ackLabel={c.ackNotReady}
          >
            <Rich>{c.notReady}</Rich>
          </WarningBox>
        )}
        {/* Notes ride the prompt of the run this click starts, and a recorded press starts
            none — the event carries the decision and nothing else. So the box is gone rather
            than there and dropped (#364). */}
        {!recorded && (
          <textarea className={INPUT} rows={4} placeholder={c.notes} value={text} onChange={(e) => setText(e.target.value)} />
        )}
        <DialogButtons
          onClose={onClose}
          confirmLabel={warned ? c.confirmAnyway : c.confirm}
          risky={warned}
          disabled={(blockers.length > 0 && !ack) || (notReady && !ackRough) || (asked > 0 && !ackAsked)}
          onConfirm={() =>
            run(
              {
                action: "implement",
                id: dialog.card.id,
                title: dialog.card.title,
                notes: text.trim() || undefined,
                // The revision the user approved. It records the same durable action
                // against this card's live Cloud event (#319), and is dropped on a card
                // that has none — which is most of them.
                cloudRevision: dialog.card.revision,
                // This build's own answer (#346), sent only where the box was there to
                // answer it. Left off, the board falls back to the repository setting —
                // which is what every other way in does.
                commitMode: canChoose ? (ownBranch ? "auto" : "manual") : undefined,
              },
              `Implement #${dialog.card.id}`,
            )
          }
          alternate={
            answerable && onResolveFirst
              ? {
                  label: c.resolveFirst,
                  title: c.resolveFirstHint,
                  onClick: onResolveFirst,
                }
              : canSchedule
                ? {
                    label: c.schedule,
                    title: c.scheduleHint,
                    disabled: notReady && !ackRough,
                    onClick: () => schedule("implement"),
                  }
                : undefined
          }
        />
      </Dialog>
    );
  }

  // One pass of a recurring card (#64) — the button that stands in for Implement
  // on a card under todo/recurring/. No warning box here, unlike Implement:
  // neither of its two warnings can apply. A recurring card never reaches
  // `ready` (it is never finished, so there is nothing to be ready for) and it
  // can't be blocked by anything the board would let you see — a run is the
  // normal thing to do to it, not a leap.
  if (dialog.kind === "run") {
    const { last_run: lastRun } = dialog.card;
    const c = d.run;
    return (
      <Dialog title={c.title(dialog.card.id)} onClose={onClose}>
        <p className={INTRO}>
          <Rich>{c.blurb}</Rich>
        </p>
        <p className={INTRO}>
          {c.unattended} {lastRun ? c.lastRun(lastRun) : c.neverRun}
        </p>
        <textarea
          className={INPUT}
          rows={3}
          placeholder={c.notes}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogButtons
          onClose={onClose}
          confirmLabel={c.confirm}
          onConfirm={() =>
            run(
              {
                action: "run",
                id: dialog.card.id,
                title: dialog.card.title,
                notes: text.trim() || undefined,
              },
              `Run #${dialog.card.id}`,
            )
          }
        />
      </Dialog>
    );
  }

  if (dialog.kind === "refine") {
    // The one action with nothing to type (#99). It runs exactly what the
    // background dispatcher runs, on the card the user is looking at, so the
    // dialog only has to say what that is and get a yes — no note box, and no
    // "I know" checkbox either: a refine writes a plan, never code, so there is
    // nothing here to warn about.
    const blockers = dialog.card.openBlockers;
    const canSchedule = onSchedule && blockers.length > 0;
    const ids = blockers.map((b) => `#${b.id}`).join(", ");
    const one = blockers.length === 1;
    const c = d.refine;
    return (
      <Dialog title={c.title(dialog.card.id)} onClose={onClose}>
        <p className={INTRO}>{c.blurb}</p>
        {/* A blocked card is refined all the same — the board's rule for blocked
            is warn, don't stop — so this is one plain line saying what's still
            open, with nothing to tick. Scheduling (#140) is the answer it now
            offers: refining a card whose foundation could still change shape is
            the wasted work the dispatcher already skips, and waiting for the
            blocker is exactly the fix. */}
        {blockers.length > 0 && (
          <p className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2 text-[12.5px] leading-relaxed text-nb-peach-ink">
            <Rich>
              {canSchedule
                ? one
                  ? c.blockedOneSchedule(ids)
                  : c.blockedManySchedule(ids)
                : one
                  ? c.blockedOne(ids)
                  : c.blockedMany(ids)}
            </Rich>
          </p>
        )}
        <DialogButtons
          onClose={onClose}
          confirmLabel={blockers.length > 0 ? c.confirmAnyway : c.confirm}
          risky={blockers.length > 0}
          onConfirm={() =>
            run(
              { action: "refine", id: dialog.card.id, title: dialog.card.title },
              `Refine #${dialog.card.id}`,
            )
          }
          alternate={
            canSchedule
              ? {
                  label: c.schedule,
                  title: c.scheduleHint,
                  onClick: () => schedule("refine"),
                }
              : undefined
          }
        />
      </Dialog>
    );
  }

  if (dialog.kind === "reject") {
    // One dialog, two moves, and the reason picks which (#729). An empty box is a discard —
    // the card goes and nothing is written to memory; a reason rejects it. The button says
    // which one this click does, so what it reads is always what happens.
    const c = d.reject;
    const reason = text.trim();
    return (
      <Dialog title={c.title(dialog.card.id)} onClose={onClose}>
        <p className={INTRO}>{c.blurb}</p>
        <textarea
          className={INPUT}
          rows={3}
          placeholder={c.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">{c.hint}</p>
        <DialogButtons
          onClose={onClose}
          confirmLabel={reason ? c.confirm : c.confirmDiscard}
          onConfirm={() =>
            run(
              {
                action: "reject",
                id: dialog.card.id,
                title: dialog.card.title,
                reason: reason || undefined,
                ...(reason ? {} : { discard: true }),
              },
              `${reason ? "Reject" : "Discard"} #${dialog.card.id}`,
            )
          }
        />
      </Dialog>
    );
  }

  const c = d.archive;
  return (
    <Dialog title={c.title(dialog.card.id)} onClose={onClose}>
      <p className={INTRO}>{c.blurb}</p>
      <textarea className={INPUT} rows={3} placeholder={c.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      <DialogButtons
        onClose={onClose}
        confirmLabel={c.confirm}
        onConfirm={() => run({ action: "archive", id: dialog.card.id, title: dialog.card.title, notes: text.trim() || undefined }, `Archive #${dialog.card.id}`)}
      />
    </Dialog>
  );
}

export function DialogButtons({
  onClose,
  onConfirm,
  confirmLabel,
  disabled,
  risky,
  alternate,
}: {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
  // The confirm goes against what the board just told the user (implementing a
  // blocked card, say). It drops the ember fill for a quiet outlined button in
  // blocker ink, so the row's only CTA-weight mark is Cancel — the safe way out
  // is the one the eye lands on. Pair it with `disabled` until the user ticks
  // the warning's checkbox, so the button is never a single stray click away.
  risky?: boolean;
  // The way out the board would rather the user took (#140): scheduling the
  // action instead of forcing it past a blocker. It sits last, wearing the ember
  // fill the risky confirm just gave up, so the plain path is the one the eye
  // lands on and "anyway" stays the deliberate choice it is.
  alternate?: { label: string; title?: string; disabled?: boolean; onClick: () => void };
}) {
  const c = useCopy().shared;
  const phone = usePhone();

  // At phone width the dialog is a page (components/Dialog.tsx) and this is its foot: the
  // buttons stack full width and stay pinned to the bottom of the screen however long the
  // page is, so the thing you came to press is never scrolled off. The one the reader is
  // most likely to press leads — the alternate where there is one, else the confirm — and
  // Cancel is gone, because on that shape the title bar's ✕ IS Cancel and two ways out
  // stacked on top of each other is one of them saying the other is different.
  //
  // `sticky` rather than a sibling of the scroller: the buttons come from the dialog's own
  // markup, wherever in it they sit, and a foot the caller has to hand over separately is a
  // foot half the dialogs would forget.
  if (phone) {
    return (
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-auto flex shrink-0 flex-col gap-2 border-t border-nb-ink/12 bg-nb-paper px-4 pb-4 pt-3">
        {alternate && (
          <Button
            className="h-12 w-full"
            title={alternate.title}
            disabled={alternate.disabled}
            onClick={alternate.onClick}
          >
            {alternate.label}
          </Button>
        )}
        <Button
          variant={risky || alternate ? "ghost" : "accent"}
          className={`h-12 w-full ${risky ? "border-nb-peach-ink text-nb-peach-ink" : ""}`}
          disabled={disabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex justify-end gap-2.5">
      <Button variant="ghost" onClick={onClose}>{c.cancel}</Button>
      <Button
        variant={risky || alternate ? "ghost" : "accent"}
        className={risky ? "border-nb-peach-ink text-nb-peach-ink" : undefined}
        disabled={disabled}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
      {alternate && (
        <Button
          variant="accent"
          title={alternate.title}
          disabled={alternate.disabled}
          onClick={alternate.onClick}
        >
          {alternate.label}
        </Button>
      )}
    </div>
  );
}
