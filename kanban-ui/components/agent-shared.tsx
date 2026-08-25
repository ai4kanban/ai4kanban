"use client";

// Shared agent-run plumbing used by both the board (Create task) and the
// card page (per-card actions): the request/result shapes, the running + result
// overlays, and the input dialogs for each action.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiCheckCircle,
  FiCheckSquare,
  FiCircle,
  FiPlay,
  FiSquare,
  FiX,
  FiZap,
} from "react-icons/fi";
import { resumeSessionAction, stopSessionAction } from "@/app/actions";
import { useDraft, useDraftList, useDraftPicks } from "@/lib/draft";
import { hasOptions, parseQuestion, type CardQuestion } from "@/lib/questions";
import {
  PROPOSE_DEFAULT,
  PROPOSE_MAX,
  type AgentAction,
  type Boldness,
  type Card,
  type DeliveryPlan,
  type ScheduledAction,
  type SessionView,
  type TokenUsage,
} from "@/lib/types";
import { Button } from "./button";
import { QuestionTagBadge } from "./chips";
import { PULSE_DOT } from "./chrome";
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
  "w-full resize-y rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2.5 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent";

// Shared rhythm for the one-liner that explains what the agent will do — quiet
// ink-soft meta text under the bold ink title.
const INTRO = "mb-3 text-[13px] leading-relaxed text-nb-ink-soft";

// A branch name said inline, in the wash chip the board uses for a path (#307).
const BRANCH = "rounded-[5px] bg-nb-wash px-1.5 py-[1px] font-mono text-[12.5px] font-[700] text-nb-ink";

// The create dialog's picker chips — the focus module and the boldness: the
// nb-chip shape a step up from the board's 10px meta chips, because these are
// tap targets, not passive labels. ON is a row's single ember mark; OFF is the
// resting look; DIM is the disabled look the not-in-effect side of the module
// row wears (auto-pick ↔ the module names) — still clickable, hover wakes it.
const PICK_CHIP =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 py-[5px] text-[12px] font-[700] uppercase leading-none tracking-[0.04em] transition-[color,background-color,opacity]";
const PICK_CHIP_ON = "bg-nb-accent-soft text-nb-accent-deep";
const PICK_CHIP_OFF = "bg-nb-wash text-nb-ink-soft hover:text-nb-ink";
const PICK_CHIP_DIM = "bg-nb-wash text-nb-ink-soft opacity-45 hover:opacity-100 hover:text-nb-ink";

export interface AgentReq {
  action: AgentAction;
  id?: number;
  notes?: string;
  reason?: string;
  description?: string;
  module?: string;
  count?: number; // propose: how many tasks to write
  boldness?: Boldness;
  title?: string;
  andImplement?: boolean;
  release?: string; // create: the version the new card ships in
}

export type DialogState =
  | { kind: "implement"; card: Card }
  | { kind: "run"; card: Card }
  | { kind: "refine"; card: Card }
  | { kind: "reject"; card: Card }
  | { kind: "archive"; card: Card }
  | { kind: "edit"; card: Card }
  | { kind: "resolve"; card: Card }
  | { kind: "create" }
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
  return (
    <span
      className="nb-chip inline-flex items-center gap-1.5 whitespace-nowrap"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      title={onClick ? "watch the run log" : label ? `${label} — running` : "agent running"}
      style={{
        background: "var(--color-nb-accent-soft)",
        color: "var(--color-nb-accent-deep)",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <span className={PULSE_DOT} aria-hidden />
      {label ? label : "running"}
    </span>
  );
}

// Present-participle label for a live session, so the single mark a card shows while
// busy names WHICH action is in flight (implementing / refining / resolving / …)
// instead of a generic "running". The badge always replaces the saved-stage pill
// (one mark per card, never both), so this is the one place the running action is
// read — refine/resolve don't need their own saved status to be visible.
export const RUNNING_VERB: Record<AgentAction, string> = {
  implement: "implementing",
  // The two runs a delivery makes after its build (#302).
  review: "reviewing",
  correct: "correcting",
  // And the one a landing runs when its rebase meets a conflict (#304).
  conflict: "resolving a conflict",
  run: "running",
  edit: "editing",
  refine: "refining",
  resolve: "resolving",
  reject: "rejecting",
  archive: "archiving",
  create: "creating",
  propose: "proposing",
  "plan-release": "planning",
  // Writing one closed version's changelog (#232). It names a version, never a card.
  changelog: "writing the changelog",
  setup: "setting up",
  // A spec agent filling one part of the card's spec (#187). It writes one section and
  // never the plan, so the card is not "being planned" while it works.
  spec: "drafting a spec",
};

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
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  if (mins < 60) return `${mins}m ${total % 60}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// What a finished run cost, in US dollars (task #90). Two decimals is the unit
// people read money in; a run too cheap to reach a cent says so as "<$0.01"
// rather than "$0.00", which would read as free. The word "est." carries the
// rest: the agent worked the number out from tokens at list prices, and on a
// subscription plan nothing was charged for the run at all.
function formatCost(usd: number): string {
  return usd < 0.005 ? "est. <$0.01" : `est. $${usd.toFixed(2)}`;
}

// The run's token counts as one readable line, closing out the intermediate
// events: what the agent read fresh, wrote to and read back from the prompt
// cache, and wrote out. Full numbers with separators, not "1.2M" — the counts
// are the point here, and the line only appears in an opened fold.
function formatTokens(u: TokenUsage): string {
  const n = (v: number) => v.toLocaleString("en-US");
  return `tokens · ${n(u.input)} input · ${n(u.cacheCreation)} cache write · ${n(u.cacheRead)} cache read · ${n(u.output)} output`;
}

// A run that ended without finishing: it failed, or it was cut off when the UI
// died mid-run. Both leave the work half-done and both can be picked up again,
// so every screen that reports one asks this rather than testing the two states
// itself. A run the user stopped is NOT one of these: nothing went wrong with it.
export function stoppedShort(session: SessionView | null | undefined): boolean {
  return session?.status === "error" || session?.status === "interrupted";
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
}: {
  session: SessionView | null;
  collapsed?: boolean;
  onToggle?: () => void;
  // Drop the ink frame and the rounded corners: the delivery block (#307) owns them, and
  // the log is one tab inside it rather than a window of its own. Everything else — the
  // title bar with its state, cost, Stop and Resume — is the same log everywhere it shows.
  bare?: boolean;
  // The card page turns these two on for a run that stopped short (#179): the
  // window says in words that the card is part-built, and carries Resume in its
  // title bar. The runs panel words and offers the same thing its own way, so it
  // leaves both off.
  warnUnfinished?: boolean;
  onResumed?: (sessionId: string) => void;
  // `flush` drops the collapse toggle and the body's height cap (the panel it's
  // dropped into — the runs dialog, the board overlay — owns the scrolling)
  // but keeps the full ink-framed window with its title bar, so the log is the
  // same artifact everywhere it appears. The collapsible form is for the inline
  // card-page log.
  flush?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const tail = (session?.tail || "").trim();
  const result = (session?.result || "").trim();
  const note = (session?.note || "").trim();

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [tail]);

  if (!session) return null;
  const running = session.status === "running";
  // The run was cut off — the UI died mid-run and the agent ended out of our
  // sight. It never reached an end, so it is never worded as one: "interrupted",
  // not "finished", and Resume is offered as it is on a failure.
  const interrupted = session.status === "interrupted";
  // The user ended this run from the UI (#49). Nothing went wrong with it, so it
  // never reads as a failure — and the code it died with says nothing, because we
  // are the ones who killed it.
  const stopped = session.status === "stopped";
  // This run ended without finishing — the warning and the Resume below hang off it.
  const unfinished = stoppedShort(session);
  // Resume shows only when the board says the run can actually be picked up: the
  // line stays either way, so a run too old to continue still says what it left.
  const carryOn = Boolean(onResumed && unfinished && session.canResume);
  // No word while running — the pulse dot already signals progress.
  const state = running
    ? ""
    : stopped
      ? "stopped"
      : interrupted
        ? "interrupted"
        : session.ok
          ? "done"
          : `exited ${session.code ?? "?"}`;
  // How long it took, next to the outcome: "done · 4m 12s". An interrupted run
  // ended out of our sight and was only noticed on the next pid poll — that's an
  // upper bound, not a measurement, so it's marked "~".
  const took =
    running || session.durationMs === undefined
      ? ""
      : `${interrupted ? "~" : ""}${formatDuration(session.durationMs)}`;
  // And what it cost, after the duration: "done · 4m 12s · est. $0.42". One run,
  // one number — this run's own, never a total. A run that reported no cost (a
  // live one, one cut off early, an agent that says nothing about money) shows
  // nothing here at all.
  const cost =
    running || session.costUsd === undefined ? "" : formatCost(session.costUsd);

  // The run's facts, in one middot-separated row: what came of it, how long it
  // took, what it cost, and which model did the work. A live run shows only the
  // model — the pulse dot says the rest, and the numbers aren't in yet.
  const facts: { key: string; text: string; dim?: boolean; title?: string }[] = [];
  if (state) facts.push({ key: "state", text: state });
  if (took) facts.push({ key: "took", text: took, dim: true });
  if (cost) {
    facts.push({
      key: "cost",
      text: cost,
      dim: true,
      title:
        "Worked out from this run's tokens at list prices. It's what the run would cost to buy — not what you were billed; on a subscription plan a run isn't charged on its own.",
    });
  }
  // The model the agent itself said it was running, shown exactly as it said it
  // (task #98) — not the model setting, which is empty for most people and says
  // nothing about a run that started before it was last changed. An agent that
  // never names one leaves this out entirely rather than reading "default".
  if (session.model) {
    facts.push({
      key: "model",
      text: session.model,
      dim: true,
      title: "The model this run reported it was working with.",
    });
  }

  // Live/passed/failed/interrupted/stopped indicator, shared by both layouts.
  // Interrupted gets its own glyph in blocker ink: not the ✓ of a clean run, and
  // not the ✕ of a run that ended badly on its own — a run that was cut off. A
  // stopped run gets the square in the board's neutral blue: it neither passed
  // nor failed, someone ended it.
  const indicator = running ? (
    <span className={PULSE_DOT} aria-hidden />
  ) : stopped ? (
    <span aria-hidden style={{ color: "var(--color-nb-sky-ink)" }}>■</span>
  ) : interrupted ? (
    <span aria-hidden style={{ color: "var(--color-nb-peach-ink)" }}>⦸</span>
  ) : (
    <span aria-hidden style={{ color: "var(--color-nb-accent-deep)" }}>{session.ok ? "✓" : "✕"}</span>
  );

  // The log body, shared by both layouts.
  const message = running ? (
    // A live tail is streaming events, not markdown — keep the raw terminal look
    // so partial lines don't get mangled mid-render.
    <pre className="m-0 text-nb-ink-soft" style={MONO_TEXT}>
      {tail || "…"}
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
            intermediate events
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
              title="This run's token counts, as the agent reported them: fresh input, prompt-cache writes and reads, and output."
            >
              {formatTokens(session.usage)}
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
      (no output)
    </pre>
  );

  // What a run that stopped short left behind (#179), said first because it is the
  // thing to know before reading anything the agent managed to write. It lives in
  // the run's own window rather than on the card: it is one run's outcome, and it
  // goes when a newer run replaces it.
  const unfinishedLine = warnUnfinished && unfinished && (
    <p className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2 text-[12.5px] leading-relaxed text-nb-peach-ink">
      <span className="mr-1" aria-hidden>
        ⚠
      </span>
      This run stopped short, so the card may be part-built — whatever it wrote is sitting in
      your working tree.{carryOn ? " Resume carries it on from where it stopped." : ""}
    </p>
  );

  // The board's own line about how the run ended, under the agent's message and plainly
  // not part of it. The one thing a finished run can't say for itself is that nothing is
  // coming after it.
  const body = (
    <>
      {unfinishedLine}
      {message}
      {note && (
        <p className="mt-3 rounded-[8px] bg-nb-peach-soft px-3 py-2 text-[12.5px] leading-relaxed text-nb-peach-ink">
          {note}
        </p>
      )}
    </>
  );

  // The title bar — the "run log" kicker + the live/done indicator on a
  // gradient strip. Shared by both forms; only the card-page form passes
  // onToggle, which also makes it the expand/collapse control.
  const titleBar = (
    <div
      className={`flex items-center gap-2.5 px-3 py-1 bg-[linear-gradient(var(--color-nb-cream),color-mix(in_srgb,var(--color-nb-ink)_9%,var(--color-nb-cream)))]${bare ? "" : " rounded-t-[12.5px]"}${collapsed && !bare ? " rounded-b-[12.5px]" : " border-b-[1.5px] border-nb-ink"}${onToggle ? " cursor-pointer select-none" : ""}`}
      role={onToggle ? "button" : undefined}
      aria-expanded={onToggle ? !collapsed : undefined}
      aria-label={onToggle ? (collapsed ? "Expand run log" : "Collapse run log") : undefined}
      onClick={onToggle}
    >
      <span className="nb-tag">run log</span>
      <span className="ml-auto flex items-center gap-1.5">
        {/* Stop (#49) rides in the title bar, the one piece of chrome every place
            that shows a run already has — so the card page, the board's log
            overlay and the runs panel all get it from here. */}
        {running && <StopButton sessionId={session.sessionId} />}
        {indicator}
        {facts.length > 0 && (
          // Middots between the facts so two numbers in a row don't run together.
          // Any caveat lives in a fact's tooltip — the row itself stays short.
          <span className="text-[11px] text-nb-ink-soft">
            {facts.map((f, i) => (
              <span key={f.key} className={f.dim ? "tabular-nums opacity-80" : undefined} title={f.title}>
                {i > 0 && <span className="mx-1.5" aria-hidden>·</span>}
                {f.text}
              </span>
            ))}
          </span>
        )}
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

  // The scrolling body well — wash fill, inset shadow, capped height. Used by the
  // bordered card-page form; the flush form drops the cap and lets its panel scroll.
  const bodyWell = (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={`max-h-[50vh] overflow-auto px-4 py-3 bg-nb-wash shadow-[inset_0_1px_3px_color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]${bare ? "" : " rounded-b-[12.5px]"}`}
    >
      {body}
    </div>
  );

  // Bare: the frame belongs to whatever this is dropped into — the delivery block.
  if (bare) {
    return (
      <>
        {titleBar}
        {bodyWell}
      </>
    );
  }

  // Flush: the same ink-framed window, minus the collapse toggle and the body's
  // height cap — the panel it's dropped into (the runs dialog / board
  // overlay) owns the scrolling, so the log flows at full length inside the frame.
  if (flush) {
    return (
      // No `overflow-hidden` on the frame: the two children round their own outer
      // corners instead, so the Stop popover can hang below the title bar over a
      // log body too short to hold it.
      <div className="nb-outline bg-nb-paper">
        {titleBar}
        <div
          ref={ref}
          className="rounded-b-[12.5px] bg-nb-wash px-4 py-3 shadow-[inset_0_1px_3px_color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]"
        >
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="nb-outline bg-nb-paper">
      {titleBar}
      {!collapsed && bodyWell}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resume = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await resumeSessionAction(sessionId);
      // A refusal is the registry's own words — the card is locked by another
      // run, or this one aged out of the kept-30 window. Say it and leave the
      // button alive to try again.
      if (res.ok && res.sessionId) onResumed?.(res.sessionId);
      else setError(res.error || "couldn't resume that run");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex shrink-0 items-center gap-2">
      {error && <span className="text-[11px] text-nb-peach-ink">{error}</span>}
      <Button
        variant="ghost"
        size="sm"
        onClick={resume}
        disabled={busy}
        title="Continue where this run failed — the coding agent picks its own session back up"
        // The same ghost sticker as the other quiet controls (header buttons,
        // dialog cancels), shrunk to meta-row scale — it sits inside full nb
        // panels, so it wears the ink frame + press shadow like everything else.
        // Quiet, not the ember CTA: it starts an agent, but on a run that already
        // went wrong, so it invites rather than urges.
        className="gap-1 rounded-[7px] px-2 py-1 text-[11px] font-[700]"
      >
        <FiPlay className="text-[12px]" aria-hidden />
        {busy ? "Resuming…" : "Resume"}
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
function StopButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

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
    setOpen(false);
    setAsked(true);
    setError(null);
    try {
      const res = await stopSessionAction(sessionId);
      // A refusal is the registry's own words — the run aged out of the kept-30
      // window. Say it and let the button be pressed again.
      if (!res.ok) {
        setAsked(false);
        setError(res.error || "couldn't stop that run");
      }
    } catch (e) {
      setAsked(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (asked) {
    return <span className="text-[11px] text-nb-ink-soft">stopping…</span>;
  }

  return (
    // The title bar is a click target of its own on the card page (it collapses
    // the log), so every press in here stops at this element.
    <span ref={ref} className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {error && <span className="text-[11px] text-nb-peach-ink">{error}</span>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Stop this run"
        aria-expanded={open}
        title="Stop this run"
        className="-my-0.5 grid size-[22px] cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[background-color,color,transform] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90"
      >
        <FiX className="text-[14px]" aria-hidden />
      </button>
      {open && (
        // A full nb panel, small: ink frame and hard shadow like every other
        // surface, hung off the ✕ and right-aligned so it can't run off the edge
        // of the log window.
        <span className="nb-panel-sm absolute right-0 top-full z-30 mt-2 block w-[248px] p-3 text-left">
          <span className="block text-[13px] font-[700] leading-snug text-nb-ink">
            Stop this run?
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-nb-ink-soft">
            It ends where it is. Anything it half-wrote stays in your working tree.
          </span>
          <span className="mt-2.5 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-[7px] px-2 py-1 text-[11px] font-[700]"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-[7px] border-nb-peach-ink px-2 py-1 text-[11px] font-[700] text-nb-peach-ink"
              onClick={stop}
            >
              Stop run
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
function cardlessTitle(session: SessionView): string {
  const running = session.status === "running";
  if (session.action === "plan-release") {
    const of = session.input ? ` ${session.input}` : "";
    return running ? `Planning${of}` : `Plan${of}`;
  }
  if (session.action === "changelog") {
    const of = session.input ? ` ${session.input}` : "";
    return running ? `Writing the changelog for${of}` : `Changelog${of}`;
  }
  if (session.action === "propose") return running ? "Proposing tasks" : "Propose tasks";
  if (session.action === "setup") return running ? "Finishing setup" : "Finish setup";
  return running ? "Creating task" : "Create task";
}

// The run log in a modal, opened from a running badge on a board card. Like
// Dialog, the fixed scrim is portaled to <body>: the sticky
// header has a `backdrop-filter`, which would otherwise become the containing
// block for the fixed scrim and trap it inside the header (the board then paints
// over it). The panel is height-capped so a long log scrolls instead of running
// off-screen.
export function SessionLogOverlay({
  session,
  onClose,
  onResumed,
}: {
  session: SessionView | null;
  onClose: () => void;
  // Resuming a failed run starts a fresh run; the overlay follows it, so the
  // owner of `session` is handed the new id to watch.
  onResumed?: (sessionId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A create, propose or plan-release run touches no card, so it has no
  // `#id — action` handle: name it by what it's doing instead. A plan-release
  // names the version it planned, which is the whole of what that run was about
  // and the only thing the panel could say to tell two of them apart. Every
  // other run is tied to a card and reads `#5 — refine`, with the id linking
  // to that card the way every other `#id` in the UI does (see the runs
  // dialog for why it isn't gated on the card still being open).
  const title = !session ? (
    "run log"
  ) : session.cardId === null ? (
    cardlessTitle(session)
  ) : (
    <>
      <Link href={`/${session.cardId}`} className="nb-idlink" onClick={onClose}>
        #{session.cardId}
      </Link>
      {` — ${session.action}`}
    </>
  );

  if (!mounted) return null;

  return createPortal(
    <div className="nb-scrim" style={{ alignItems: "center" }} onClick={onClose}>
      <div
        className="nb-panel flex flex-col"
        style={{ width: 620, maxWidth: "100%", maxHeight: "calc(100vh - 2rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-3" style={{ borderBottom: "1.5px solid var(--color-nb-ink)" }}>
          <h2 className="text-[15px] font-[800]">{title}</h2>
          <div className="flex items-center gap-3">
            {session?.canResume && (
              <ResumeButton sessionId={session.sessionId} onResumed={onResumed} />
            )}
            <button aria-label="Close" className="text-[18px] text-nb-ink-soft hover:text-nb-ink" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          <SessionLog session={session} flush />
        </div>
      </div>
    </div>,
    document.body,
  );
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

// --- the input dialogs for each action --------------------------------------

export function ActionDialog({
  dialog,
  onClose,
  onRun,
  onSchedule,
  onResolveFirst,
  plan = { commitMode: "auto" },
  modules = [],
  release = null,
}: {
  dialog: Exclude<DialogState, null>;
  onClose: () => void;
  onRun: (req: AgentReq, label: string) => void;
  // Answer the card's open questions before building it (#307) — the Implement dialog's
  // way out of its third warning. The card page swaps this dialog for Resolve; a view
  // with no Resolve dialog of its own simply doesn't offer it.
  onResolveFirst?: () => void;
  // What the click would do (#307): the branch it lands on, and whether it lands at all.
  // Implement only. Defaults to the plain auto-commit answer with no branch named, which
  // is what a board whose rules predate the one-click flow can say.
  plan?: DeliveryPlan;
  // Queue this action instead of starting it (#140) — offered only on a card
  // with an open blocker, and only where the owner passed a handler. A view that
  // doesn't schedule (the board's Create dialog) simply doesn't offer it.
  onSchedule?: (action: ScheduledAction, notes: string) => void;
  // The module names for the create dialog's picker (from modules.md, read
  // server-side). Only the create kind uses it; the per-card dialogs ignore it.
  modules?: string[];
  // The release the board is showing, which a card made here ships in (#104).
  // Create only, like `modules`.
  release?: string | null;
}) {
  // Persist the draft per action + card so an accidental close keeps the text
  // (resolve keeps its own list-shaped draft in ResolveDialog below). `run`
  // clears the draft once the run has actually started.
  const draftKey = dialog.kind === "create" ? "create" : `${dialog.kind}:${dialog.card.id}`;
  const [text, setText, clearDraft] = useDraft(draftKey);
  // "Yes, I know" for a warned action (see the implement branch). Deliberately NOT
  // persisted like the note draft is: closing the dialog drops it, so every open
  // asks again. The dialog unmounts on close, so this resets on its own. There is
  // one per warning, because a card can wear both at once and each tick answers
  // its own box.
  const [ack, setAck] = useState(false);
  const [ackRough, setAckRough] = useState(false);
  const [ackAsked, setAckAsked] = useState(false);
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
    // carries it: Resolve & implement answers the questions first, and Schedule (#140)
    // waits for the blocker. Questions win the slot when a card wears both — it is the
    // one the user can settle now, and the blocker box still names Schedule in words.
    const blockers = dialog.card.blocked_by;
    const notReady = dialog.card.status !== "ready";
    const asked = dialog.card.questions.length;
    const warned = blockers.length > 0 || notReady || asked > 0;
    const canSchedule = onSchedule && dialog.card.openBlockers.length > 0;
    return (
      <Dialog title={`Implement #${dialog.card.id}`} onClose={onClose}>
        <p className={INTRO}>
          One click carries this card all the way: the agent builds it, a fresh run reviews
          it, corrections fix what the review found, and{" "}
          {plan.commitMode === "auto" ? (
            <>
              the board lands it as one commit on{" "}
              {plan.branch ? <span className={BRANCH}>{plan.branch}</span> : "the branch you are on"}.
              {/* The one place the click does NOT carry the card all the way (#308). */}
              {plan.needsApproval
                ? " It waits for you to approve the tree before that, because this board requires diff approval."
                : ""}{" "}
              Then it ticks the todos, writes the shipped line, and archives the card.
            </>
          ) : (
            <>
              it stops. <strong>Manual commit mode</strong> is on
              {plan.manualWhy ? ` — ${plan.manualWhy}` : ""}, so nothing is committed for you: commit
              what review passed, and the card is archived then.
            </>
          )}
        </p>
        {asked > 0 && (
          <WarningBox
            tone="accent"
            ack={ackAsked}
            onAck={setAckAsked}
            ackLabel={`I know ${asked === 1 ? "a question is" : `${asked} questions are`} still open.`}
          >
            This card has <strong>{asked} open question{asked === 1 ? "" : "s"}</strong>. It will be
            built and reviewed, then hold at landing until{" "}
            {asked === 1 ? "you answer it" : "you answer them"} — or press{" "}
            <strong>Resolve &amp; implement</strong> to answer{" "}
            {asked === 1 ? "it" : "them"} first.
          </WarningBox>
        )}
        {blockers.length > 0 && (
          <WarningBox
            tone="peach"
            ack={ack}
            onAck={setAck}
            ackLabel={`I know ${blockers.map((n) => `#${n}`).join(", ")} ${blockers.length === 1 ? "isn't" : "aren't"} done yet.`}
          >
            This card is blocked by {blockers.map((n) => `#${n}`).join(", ")}, still open on the
            board. Finish {blockers.length === 1 ? "that card" : "those cards"} first
            {canSchedule ? (
              <>
                {" "}
                — or <strong>Schedule</strong> the build and the board will start it by itself
                once {blockers.length === 1 ? "that card is" : "those cards are"} done.
              </>
            ) : (
              "."
            )}
          </WarningBox>
        )}
        {notReady && (
          <WarningBox
            tone="accent"
            ack={ackRough}
            onAck={setAckRough}
            ackLabel="I know the plan may still be rough."
          >
            This card isn&apos;t marked <strong>ready</strong> yet — its plan may still be
            rough. Press <strong>Refine</strong> on its page to take it to ready first.
          </WarningBox>
        )}
        <textarea className={INPUT} rows={4} placeholder="Optional extra notes for the agent…" value={text} onChange={(e) => setText(e.target.value)} />
        <DialogButtons
          onClose={onClose}
          confirmLabel={warned ? "Implement anyway" : "Implement"}
          risky={warned}
          disabled={(blockers.length > 0 && !ack) || (notReady && !ackRough) || (asked > 0 && !ackAsked)}
          onConfirm={() => run({ action: "implement", id: dialog.card.id, title: dialog.card.title, notes: text.trim() || undefined }, `Implement #${dialog.card.id}`)}
          alternate={
            asked > 0 && onResolveFirst
              ? {
                  label: "Resolve & implement",
                  title: "Answer the open questions first, and build the card once nothing is left to decide",
                  onClick: onResolveFirst,
                }
              : canSchedule
                ? {
                    label: "Schedule",
                    title: "Build this card by itself, once nothing is in its way",
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
    return (
      <Dialog title={`Run #${dialog.card.id}`} onClose={onClose}>
        <p className={INTRO}>
          The agent works through this card&apos;s <strong>Process</strong> in order, records
          the run, and rewrites a step or two so the next run needs less of you. The card
          stays on the board — a recurring task is never finished.
        </p>
        <p className={INTRO}>
          Nobody watches a run, so a step that needs your judgment is left undone and written
          into this run&apos;s open-questions file for you to answer later.{" "}
          {lastRun ? `Last run ${lastRun}.` : "This card has never run."}
        </p>
        <textarea
          className={INPUT}
          rows={3}
          placeholder="Optional extra notes for this run…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogButtons
          onClose={onClose}
          confirmLabel="Run"
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
    return (
      <Dialog title={`Refine #${dialog.card.id}`} onClose={onClose}>
        <p className={INTRO}>
          The agent takes this card one step forward: it answers the open questions it can
          settle itself, leaves the ones only you can decide for you, and sharpens the plan.
          It works on the card, not the code.
        </p>
        {/* A blocked card is refined all the same — the board's rule for blocked
            is warn, don't stop — so this is one plain line saying what's still
            open, with nothing to tick. Scheduling (#140) is the answer it now
            offers: refining a card whose foundation could still change shape is
            the wasted work the dispatcher already skips, and waiting for the
            blocker is exactly the fix. */}
        {blockers.length > 0 && (
          <p className="mb-3 rounded-[8px] bg-nb-peach-soft px-3 py-2 text-[12.5px] leading-relaxed text-nb-peach-ink">
            This card is blocked by {blockers.map((b) => `#${b.id}`).join(", ")}, still open on
            the board. The plan may change once {blockers.length === 1 ? "that card is" : "those cards are"} done
            {canSchedule ? (
              <>
                {" "}
                — <strong>Schedule</strong> it and the board refines it by itself once{" "}
                {blockers.length === 1 ? "that card is" : "they are"} off the board.
              </>
            ) : (
              "."
            )}
          </p>
        )}
        <DialogButtons
          onClose={onClose}
          confirmLabel={blockers.length > 0 ? "Refine anyway" : "Refine"}
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
                  label: "Schedule",
                  title: "Refine this card by itself, once nothing is in its way",
                  onClick: () => schedule("refine"),
                }
              : undefined
          }
        />
      </Dialog>
    );
  }

  if (dialog.kind === "reject") {
    return (
      <Dialog title={`Reject #${dialog.card.id}`} onClose={onClose}>
        <p className={INTRO}>
          The agent adds a one-line note to rejected.md and removes the card.
        </p>
        <textarea className={INPUT} rows={3} placeholder="Why are you rejecting this?" value={text} onChange={(e) => setText(e.target.value)} />
        <DialogButtons
          onClose={onClose}
          confirmLabel="Reject"
          disabled={!text.trim()}
          onConfirm={() => run({ action: "reject", id: dialog.card.id, title: dialog.card.title, reason: text.trim() }, `Reject #${dialog.card.id}`)}
        />
      </Dialog>
    );
  }

  if (dialog.kind === "archive") {
    return (
      <Dialog title={`Archive #${dialog.card.id}`} onClose={onClose}>
        <p className={INTRO}>
          All todos are done. The agent writes the &ldquo;what you can now do&rdquo; note into readme.md and moves the card off the board into .archive/.
        </p>
        <textarea className={INPUT} rows={3} placeholder="Optional note for the agent…" value={text} onChange={(e) => setText(e.target.value)} />
        <DialogButtons
          onClose={onClose}
          confirmLabel="Archive"
          onConfirm={() => run({ action: "archive", id: dialog.card.id, title: dialog.card.title, notes: text.trim() || undefined }, `Archive #${dialog.card.id}`)}
        />
      </Dialog>
    );
  }

  if (dialog.kind === "edit") {
    return (
      <Dialog title={`Edit #${dialog.card.id}`} onClose={onClose}>
        <p className={INTRO}>
          Tell the agent how to change this task. It re-reads the card and rewrites the plan —
          summary, scope, and todos — to match. The card body is only ever edited by the agent.
        </p>
        <textarea
          className={INPUT}
          rows={4}
          placeholder="What should change about this task? e.g. narrow the scope to…, add a todo for…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogButtons
          onClose={onClose}
          confirmLabel="Save edit"
          disabled={!text.trim()}
          onConfirm={() => run({ action: "edit", id: dialog.card.id, title: dialog.card.title, notes: text.trim() }, `Edit #${dialog.card.id}`)}
        />
      </Dialog>
    );
  }

  if (dialog.kind === "resolve") {
    return <ResolveDialog card={dialog.card} onClose={onClose} onRun={onRun} />;
  }

  // create — its own component so the propose toggle + module pick are clean,
  // unconditional hooks (like ResolveDialog).
  return <CreateDialog modules={modules} release={release} onClose={onClose} onRun={onRun} />;
}

// The Create-task dialog, which also folds in propose (#38). They're two modes
// of making new cards — not a create with an option bolted on — so a tab strip
// (design.md's tab-strip pattern: hairline rule, bold-ink active tab over a
// short ember underline) switches the dialog's whole shape:
//   • Describe — a textarea for what you want; the agent runs add-task and
//     infers the modules itself (`akb guide add-task` step 1).
//   • Propose — no textarea (there's nothing to describe); the agent walks one
//     module as a user and proposes new tasks inside it (`akb guide propose`).
//     Three chip rows steer it instead: WHERE the tasks land (the focus module,
//     with "auto-pick" as the default chip), HOW MANY there are, and HOW BIG
//     they are (the boldness).
function CreateDialog({
  modules,
  release,
  onClose,
  onRun,
}: {
  modules: string[];
  release: string | null;
  onClose: () => void;
  onRun: (req: AgentReq, label: string) => void;
}) {
  const [text, setText, clearDraft] = useDraft("create");
  const [mode, setMode] = useState<"describe" | "propose">("describe");
  const [module, setModule] = useState("");
  // How many cards the run writes, 1..PROPOSE_MAX. Sent every time — the skill
  // has the same default, but a count the user tapped is worth saying out loud.
  const [count, setCount] = useState(PROPOSE_DEFAULT);
  // How big a swing those tasks take. "normal" is the size a propose run has
  // always written, so it's the default and travels as no instruction at all.
  const [boldness, setBoldness] = useState<Boldness>("normal");
  const propose = mode === "propose";
  const run = (req: AgentReq, label: string) => {
    clearDraft();
    onRun(req, label);
  };

  const TABS = [
    { key: "describe", label: "Describe a task" },
    { key: "propose", label: "Propose tasks" },
  ] as const;

  return (
    <Dialog title="Create task" onClose={onClose} width={600}>
      {/* The mode strip. Hairline under both tabs; the active tab's ember
          underline laps the hairline (bottom-[-1px]) and is the strip's only
          strong mark, per design.md. */}
      <div className="mb-4 flex gap-5 border-b border-nb-ink/12" role="tablist">
        {TABS.map((t) => {
          const active = mode === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(t.key)}
              className={`relative cursor-pointer pb-2 text-[13.5px] tracking-[-0.01em] transition-colors ${active ? "font-[800] text-nb-ink" : "font-[600] text-nb-ink-soft hover:text-nb-ink"
                }`}
            >
              {t.label}
              {active && (
                <span
                  className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-nb-accent"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <p className={INTRO}>
        {propose
          ? "The agent walks one module of the product as a user and proposes new tasks inside it — nothing to describe."
          : "Describe what you want. The agent turns it into one or more cards and figures out which modules they touch."}
        {/* Where the new cards land, when the board is showing one release. Said
            here rather than left to be discovered: a card that quietly joined a
            version is worse than one you were told about. Propose says nothing —
            its cards start with no release whatever is on screen. */}
        {!propose && release && (
          <>
            {" "}
            They ship in <strong>{release}</strong>, the release on screen.
          </>
        )}
      </p>

      {propose ? (
        <div className="flex flex-col gap-4">
          {/* The focus-module chips — every module visible at a glance, one tap
              to focus. "Auto-pick" (the AI default, led by a zap mark) sits
              apart from the module names behind a hairline divider so it doesn't
              read as a module itself. The two sides are an either/or: whichever
              isn't in effect dims to a disabled look, but stays clickable —
              that's how you switch. No module map → no row; the agent picks
              anyway. */}
          {modules.length > 0 && (
            <PickerSection
              label="Focus module"
              blurb="Pick the part of the product you want new tasks in — they all land inside it. Leave it on “auto-pick” and the agent chooses the part that needs work most."
            >
              <button
                type="button"
                onClick={() => setModule("")}
                aria-pressed={module === ""}
                className={`${PICK_CHIP} ${module === "" ? PICK_CHIP_ON : PICK_CHIP_DIM}`}
              >
                <FiZap className="text-[12px]" aria-hidden />
                auto-pick
              </button>
              <span aria-hidden className="mx-1 h-[18px] w-px bg-nb-ink/15" />
              {modules.map((m) => {
                const selected = module === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModule(m)}
                    aria-pressed={selected}
                    className={`${PICK_CHIP} ${
                      selected ? PICK_CHIP_ON : module === "" ? PICK_CHIP_DIM : PICK_CHIP_OFF
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </PickerSection>
          )}

          {/* How many cards the run writes. Single digits, so the whole range
              fits one wrapped row and every count is one tap — no stepper to
              click up ten times. PROPOSE_MAX is the skill's cap ("How many" in
              `akb guide propose`), not a UI limit. */}
          <PickerSection
            label="How many"
            blurb="Tasks this run writes. More tasks means a longer run and a thinner idea each."
          >
            {Array.from({ length: PROPOSE_MAX }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                aria-pressed={count === n}
                className={`${PICK_CHIP} min-w-[30px] justify-center ${count === n ? PICK_CHIP_ON : PICK_CHIP_OFF}`}
              >
                {n}
              </button>
            ))}
          </PickerSection>

          {/* How big a swing they take. Same chip row as the module pick, so
              the rows read as one set of dials: where the tasks land, how many
              there are, and how big they are. The picked level's own words sit
              under the row — one line changes as you tap, instead of three lines
              of small print spelling out every level at once. */}
          <PickerSection label="Boldness" blurb="How big a move each task is.">
            {BOLDNESS_LEVELS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setBoldness(b.key)}
                aria-pressed={boldness === b.key}
                className={`${PICK_CHIP} ${boldness === b.key ? PICK_CHIP_ON : PICK_CHIP_OFF}`}
              >
                {b.label}
              </button>
            ))}
            <p className="mt-2 basis-full text-[12px] leading-relaxed text-nb-ink-soft">
              {BOLDNESS_LEVELS.find((b) => b.key === boldness)?.blurb}
            </p>
          </PickerSection>
        </div>
      ) : (
        <textarea
          className={INPUT}
          rows={5}
          autoFocus
          placeholder="What do you want to happen?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}

      <DialogButtons
        onClose={onClose}
        confirmLabel={propose ? `Propose ${count} task${count === 1 ? "" : "s"}` : "Create task"}
        disabled={!propose && !text.trim()}
        onConfirm={() =>
          propose
            ? run(
                {
                  action: "propose",
                  module: module || undefined,
                  count,
                  // "normal" is what a propose run does on its own — send it as
                  // nothing, so only a level the user actually reached for
                  // reaches the prompt.
                  boldness: boldness === "normal" ? undefined : boldness,
                },
                "Propose tasks",
              )
            : run(
                { action: "create", description: text.trim(), release: release ?? undefined },
                "Create task",
              )
        }
      />
    </Dialog>
  );
}

// The three boldness levels, in order of how big a swing they take, with the
// words the dialog shows for each. What the levels MEAN to the agent is the
// skill's ("Boldness" in `akb guide propose`) — these blurbs say the same
// thing in the user's terms, so the row isn't three bare adjectives.
const BOLDNESS_LEVELS: { key: Boldness; label: string; blurb: string }[] = [
  {
    key: "safe",
    label: "safe",
    blurb: "Small moves — polish a rough edge, fill a gap in something that already works.",
  },
  {
    key: "normal",
    label: "normal",
    blurb: "A feature each — one card a run can finish. This is what a propose run does on its own.",
  },
  {
    key: "bold",
    label: "bold",
    blurb:
      "A big leap each — a capability the module doesn't have at all, still sized so one run can finish it.",
  },
];

// One labelled row in the propose tab: the uppercase kicker, a quiet one-liner
// under it, then the chips. Both picks (focus module, boldness) wear this, so
// they read as one pair of dials rather than two separate widgets.
function PickerSection({
  label,
  blurb,
  children,
}: {
  label: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-[12px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">
        {label}
      </span>
      <p className="mb-2 text-[12px] leading-relaxed text-nb-ink-soft">{blurb}</p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

// Resolve is the one action with structured input: a card carries a *list* of
// open questions, so the dialog gives each its own answer box instead of one
// catch-all note. Answers are optional — leave a box blank and the agent
// researches that question itself (see `akb guide resolve`). Its own component
// so the per-question answer array is a clean, unconditional hook.
function ResolveDialog({
  card,
  onClose,
  onRun,
}: {
  card: Card;
  onClose: () => void;
  onRun: (req: AgentReq, label: string) => void;
}) {
  // Persist the per-question answers so an accidental close keeps them; reconciled
  // to the current question count on reopen. Cleared once the run starts.
  const [answers, setAnswer, clearAnswers] = useDraftList(`resolve:${card.id}`, card.questions.length);
  // The ticked options beside them. An untouched question opens on the agent's
  // recommendation, so a whole card of options questions is one click to confirm.
  const [picks, setPick, clearPicks] = useDraftPicks(
    `resolve-picks:${card.id}`,
    card.questions.map((q) => (hasOptions(q) ? (q.recommend ?? []) : [])),
  );

  // Ticking and typing are the two ways to answer one question, and they never
  // mix: whichever the user just used wipes the other. So the answer that
  // reaches the agent is either the options or the words, never a muddle of both.
  const tick = (i: number, q: CardQuestion, n: number) => {
    const current = picks[i] ?? [];
    const next =
      q.mode === "multi"
        ? current.includes(n)
          ? current.filter((x) => x !== n)
          : [...current, n].sort((a, b) => a - b)
        : current.includes(n)
          ? [] // clicking the ticked option again unticks it — back to unanswered
          : [n];
    setPick(i, next);
    if (next.length > 0 && answers[i]) setAnswer(i, "");
  };
  const type = (i: number, value: string) => {
    setAnswer(i, value);
    if (value.trim() && (picks[i] ?? []).length > 0) setPick(i, []);
  };

  // Both footer buttons share this — resolve alone, or resolve then keep going into
  // implement in the same session. The prompt (see buildPrompt) tells the agent to
  // only implement when nothing genuine is left for the user to decide.
  const submit = (andImplement: boolean) => {
    const notes = composeAnswers(card.questions, answers, picks);
    clearAnswers();
    clearPicks();
    onRun(
      {
        action: "resolve",
        id: card.id,
        title: card.title,
        notes,
        andImplement: andImplement || undefined,
      },
      `${andImplement ? "Resolve & implement" : "Resolve"} #${card.id}`,
    );
  };

  return (
    <Dialog title={`Resolve #${card.id}`} onClose={onClose}>
      <p className={INTRO}>
        Answer what you know; the agent researches the rest and writes it to the card. Real judgment
        calls stay open for you. <strong>Resolve &amp; implement</strong> also builds the task, but
        only if nothing&apos;s left for you to decide.
      </p>
      <div className="flex flex-col gap-3.5">
        {card.questions.map((q, i) => {
          const { tag, text } = parseQuestion(q.text);
          return (
          <div key={i} className="flex flex-col gap-1.5">
            {/* Marker inline ahead of the question, not in a column beside it — see
                the same call in CardPage's open questions. */}
            <label className="block text-[13px] font-[700] leading-[19px] text-nb-ink">
              <QuestionTagBadge tag={tag} />
              {text}
            </label>
            {hasOptions(q) && (
              <OptionPicker question={q} picked={picks[i] ?? []} onTick={(n) => tick(i, q, n)} />
            )}
            <textarea
              className={INPUT}
              rows={2}
              placeholder={
                hasOptions(q)
                  ? "None of these? Answer in your own words — that clears the ticks…"
                  : "Your answer, or leave blank for the agent to research…"
              }
              value={answers[i]}
              onChange={(e) => type(i, e.target.value)}
            />
          </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="ghost" onClick={() => submit(false)}>Resolve</Button>
        <Button onClick={() => submit(true)}>Resolve &amp; implement</Button>
      </div>
    </Dialog>
  );
}

// The tick list for a question that carries options. Rows are buttons, not native
// radios/checkboxes, for one reason: a ticked option can be clicked again to untick
// it — a native radio can't — and leaving everything unticked is a real answer
// here ("I have no view; you research it"). The marker's shape still says how many
// may be picked: round for one, square for as many as you like.
function OptionPicker({
  question,
  picked,
  onTick,
}: {
  question: CardQuestion;
  picked: number[];
  onTick: (n: number) => void;
}) {
  const many = question.mode === "multi";
  const On = many ? FiCheckSquare : FiCheckCircle;
  const Off = many ? FiSquare : FiCircle;
  return (
    <div
      role={many ? "group" : "radiogroup"}
      aria-label={parseQuestion(question.text).text}
      className="flex flex-col gap-1"
    >
      {(question.options ?? []).map((option, k) => {
        const n = k + 1;
        const on = picked.includes(n);
        const Icon = on ? On : Off;
        return (
          <button
            key={k}
            type="button"
            role={many ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => onTick(n)}
            className="nb-outline flex items-start gap-2 px-2.5 py-1.5 text-left text-[12.5px] leading-[18px] transition-colors hover:bg-nb-accent-soft"
            style={{
              background: on ? "var(--color-nb-accent-soft)" : "transparent",
              color: on ? "var(--color-nb-accent-deep)" : undefined,
              fontWeight: on ? 700 : 400,
            }}
          >
            <Icon aria-hidden className="relative top-[2px] shrink-0" style={{ width: 13, height: 13 }} />
            <span>
              {option}
              {(question.recommend ?? []).includes(n) && (
                <span className="ml-1.5 text-[10.5px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">
                  recommended
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Pair the questions the user answered with their answers into a note block the
// agent can fold into the card. A question answered by ticking sends the option
// lines themselves, so the agent reads a choice rather than interpreting prose.
// Unanswered questions are dropped — those are the ones the agent researches —
// and if nothing was answered we send no note at all, so the agent resolves every
// question on its own just as before.
function composeAnswers(
  questions: CardQuestion[],
  answers: string[],
  picks: number[][],
): string | undefined {
  const answered = questions
    .map((q, i) => {
      const asked = parseQuestion(q.text).text;
      const chosen = hasOptions(q)
        ? (picks[i] ?? []).map((n) => (q.options ?? [])[n - 1]).filter(Boolean)
        : [];
      if (chosen.length > 0) {
        return `Q: ${asked}\nPicked:\n${chosen.map((o) => `- ${o}`).join("\n")}`;
      }
      const typed = answers[i]?.trim();
      return typed ? `Q: ${asked}\nA: ${typed}` : null;
    })
    .filter((x): x is string => x !== null);
  if (answered.length === 0) return undefined;
  return [
    "My answers to some of the open questions — fold these in, and research the rest:",
    ...answered,
  ].join("\n\n");
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
  return (
    <div className="mt-4 flex justify-end gap-2.5">
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
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
