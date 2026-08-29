"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArchive,
  FiCheckCircle,
  FiChevronRight,
  FiCornerLeftUp,
  FiEdit2,
  FiFeather,
  FiGitBranch,
  FiPlay,
  FiTrash2,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { FaPauseCircle } from "react-icons/fa";
import {
  approveDeliveryAction,
  cancelCloudRequestAction,
  cardOnBoardAction,
  discardDeliveryAction,
  dropVerifyAction,
  patchCardAction,
  resumeCloudRequestAction,
  resumeSessionAction,
  scheduleCardAction,
  stopSessionAction,
  unscheduleCardAction,
} from "@/app/actions";

import {
  NO_RELEASE,
  type AgentInfo,
  type Card,
  type CardApproval,
  type CardDelivery,
  type CardDeliveryStage,
  type CardFinished,
  type CardPatch,
  type DeliveryDiff,
  type DeliveryPlan,
  type MemoryModule,
  type ScheduledAction,
  type SessionView,
} from "@/lib/types";
import type { CardCopy } from "@/i18n/card/types";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { Button } from "./button";
import { RunningNotice } from "./desktop";
import { DiffPane } from "./Diff";
import { Header } from "./Header";
import {
  ActionDialog,
  type AgentReq,
  type DialogState,
  RunningBadge,
  SessionLog,
  stoppedShort,
} from "./agent-shared";
import {
  CadenceSelect,
  LevelSelect,
  ModuleChip,
  PendingPill,
  ReleaseSelect,
  StatusPill,
  TodoProgress,
  TrackChip,
} from "./chips";
import { HAIRLINE, PULSE_DOT } from "./chrome";
import type { MockupSet } from "@/lib/mockup-tag";
import { parseQuestion } from "@/lib/questions";
import { bandLabel, CARD_BAND_STATES, type CloudEventState } from "@/lib/types";
import { useCardEvent } from "./Notifications";
import type { BoardChange } from "@/lib/chat-rail";
import { canImplement, canRefine } from "@/lib/refine";
import { scheduleLabel } from "@/lib/schedule";
import { CardBody } from "./CardBody";
import { Fold } from "./fold";
import { OpenIdsProvider } from "./open-ids";
import { OpenQuestions } from "./questions";
import { SubtaskMap } from "./SubtaskMap";
import { Window } from "./Window";
import { latestSessionForCard, runningCardIds, runningSessionForCard, type StartedSession, useAgentSessions, useOnTabFocus, useSessionLog } from "./sessions";

const CAP = "text-[10px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft";

// The rule between a section's chrome and what it holds. Nothing on this page draws a
// border any more, so the one line still worth having is drawn at the quietest weight
// there is — enough to part a tab strip from its pane, never enough to box anything in.
const PART = { borderTop: `1px solid ${HAIRLINE}` } as const;

// How long a cross-off waits for its second click before going back to being an ✕. The
// same window the rail's Clear gives the conversation it is about to throw away.
const CONFIRM_MS = 4000;

// How long a refused hand-check edit says so. Long enough to read, and then gone — the
// panel it sits in has already redrawn to what the card holds, so leaving the line up
// would keep an empty panel on screen over news the user has taken in.
const NOTE_MS = 7000;

function ConfirmationPopover({
  open,
  anchorRef,
  title,
  description,
  cancelLabel,
  confirmLabel,
  busy,
  align = "left",
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  title: string;
  description: React.ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  /** Which edge it hangs from. A control at the right edge of a panel has to open
   *  leftwards: 320px past the page's right edge is horizontal scroll on the whole app. */
  align?: "left" | "right";
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const c = useCopy().card.delivery;
  const titleId = useId();
  const descriptionId = useId();
  const safeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    safeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onDismiss();
      requestAnimationFrame(() => anchorRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchorRef, onDismiss, open]);

  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={`nb-panel-sm absolute ${align === "right" ? "right-0" : "left-0"} top-[calc(100%+8px)] z-40 w-[min(320px,calc(100vw-32px))] bg-nb-paper p-3 text-left`}
    >
      <p id={titleId} className="text-[13px] font-[700] text-nb-ink">{title}</p>
      <p id={descriptionId} className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">{description}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button ref={safeRef} variant="ghost" size="xs" onClick={onDismiss}>
          {cancelLabel}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={busy}
          style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}
          onClick={onConfirm}
        >
          {busy ? c.working : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

// ---- what the build left for you to check by hand (#231, #276) ---------------
//
// Its own section, last on the page and never inside the questions: an open question waits on
// an answer and holds the card back, while every line here is a note on work that is already
// done. Mint, for the same reason the ✓ in its heading is: this is the one section on the
// page about work that is finished.
//
// A line you have checked is crossed off, which takes it off the card — there is no ticked
// state to keep, because the card already keeps its record in the archive. It cannot be
// undone from here, so the ✕ asks for a second click first; a dialog for one line would be
// more ceremony than the loss is worth.
//
// A cross-off names the LINE, not its place in the list: a run can add or take away
// hand-checks while this page sits open, and by then the third line is a different line. A
// line a run has already taken off says so here, and the panel redraws to what the card
// holds now.
//
// It opens on its heading, the same fold the agent half wears and the same component: both
// are notes on work already done, at the foot of a page whose top is what you decide on. How
// many are left is in the heading, so a shut panel still says there is something to check.
function HandChecks({
  cardId,
  verify,
  busy,
}: {
  cardId: number;
  verify: string[];
  busy: boolean;
}) {
  const c = useCopy().card.handChecks;
  const router = useRouter();
  const [lines, setLines] = useState(verify);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // The card is the record: a run that rewrote the hand-checks while this page sat open
  // wins over whatever the panel was showing.
  const fromCard = verify.join("\n");
  useEffect(() => setLines(verify), [fromCard]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(null), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(""), NOTE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  const settle = (res: { ok: boolean; error?: string; verify?: string[] }, fallback: string) => {
    if (res.verify) setLines(res.verify);
    setNote(res.ok ? "" : res.error || fallback);
    // The board card's clipboard mark counts these lines, so the board is re-read too.
    router.refresh();
    return res.ok;
  };

  const crossOff = async (line: string) => {
    setConfirming(null);
    setSaving(true);
    const res = await dropVerifyAction(cardId, line);
    setSaving(false);
    settle(res, c.failed);
  };

  // Nothing to check — no empty panel.
  if (lines.length === 0 && !note) return null;

  return (
    <Fold
      className="nb-section bg-nb-mint-wash"
      open={open}
      onToggle={setOpen}
      label={
        <>
          <span style={{ color: "var(--color-nb-mint-ink)" }}>✓</span>
          <span>{c.heading}</span>
          {/* How many are left, so a shut panel still says there is something to do. */}
          {lines.length > 0 && <span className="tabular-nums">{lines.length}</span>}
        </>
      }
    >
      {lines.length > 0 && (
        <ul className="flex flex-col gap-1 text-[13px] leading-[19px]">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-current" aria-hidden />
              <span className="min-w-0 flex-1">{line}</span>
              {!busy &&
                (confirming === line ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void crossOff(line)}
                    className="flex h-[19px] shrink-0 cursor-pointer items-center rounded-[6px] px-1.5 text-[11px] font-[700] uppercase tracking-[0.04em]"
                    style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
                  >
                    {c.crossOff}
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={c.crossOffAria(line)}
                    title={c.crossOffHint}
                    disabled={saving}
                    onClick={() => setConfirming(line)}
                    className="nb-press flex h-[19px] shrink-0 items-center rounded-[6px] px-1 text-nb-ink-soft hover:text-nb-peach-ink disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FiX className="text-[13px]" aria-hidden />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className="mt-2 text-[12px] leading-snug" style={{ color: "var(--color-nb-peach-ink)" }}>
          {note}
        </p>
      )}
    </Fold>
  );
}

type CardButton = "implement" | "run" | "refine" | "edit" | "resolve" | "archive" | "reject";

// The one place that maps a card's state to the buttons that fit it (task #29).
// Inputs are the whole card state: `status`, open questions, todo progress. Each
// button has exactly one rule, and every state combination falls out of them —
// read top to bottom to see all the states at a glance.
//
// A recurring card (#64) is the one card that reads differently, because it is a
// job rather than a piece of work: it is run again and again and never finished.
// So Implement becomes **Run** and Archive never shows — there is no end state to
// archive it into. Edit, Resolve and Reject stand exactly as they are.
function visibleActions(card: Card): Set<CardButton> {
  const hasUserQuestions = card.questions.some((q) => parseQuestion(q.text).tag === "user");
  const { total, done } = card.todos;
  const allDone = total > 0 && done === total; // zero-todo cards never count as done
  // A group root is implemented by finishing its subtasks, and it is done when
  // every subtask line on the root is resolved — done or rejected (#44). Its own
  // todo boxes don't gate it: a rejected subtask leaves an unticked box behind,
  // which would keep the root un-archiveable forever. A root that never got a
  // subtask line isn't archiveable by this gate — close that one with Reject.
  const sub = card.subtaskLines;
  const groupDone = !!sub && sub.total > 0 && sub.resolved === sub.total;
  const buttons = new Set<CardButton>();
  if (card.recurring) buttons.add("run"); // Run — a recurring card, always: a job you can start again
  // Implement — unless all todos are checked, and never on a group root. The board's own
  // rule (canImplement), the same one a schedule is refused by, so the button and the
  // schedule behind it can never disagree about whether this card is one to build.
  else if (canImplement(card)) buttons.add("implement");
  buttons.add("edit"); // Edit — always
  // Refine (#99) — only when it would move the card, and not while that same action
  // is queued. Cancelling the schedule brings the button back for this blocked episode.
  if (canRefine(card) && card.schedule?.action !== "refine") buttons.add("refine");
  if (hasUserQuestions) buttons.add("resolve"); // Resolve — has a decision the user owns
  // Archive — every subtask resolved, or all todos checked. Never on a recurring
  // card: it has no end state, and archiving one would take a job off the board.
  if (!card.recurring && (card.isGroup ? groupDone : allDone)) buttons.add("archive");
  buttons.add("reject"); // Reject — always
  return buttons;
}

// ---- the delivery in flight (#301) -------------------------------------------
//
// A delivery is the whole job one Implement click starts, and it builds the card exactly as
// it was approved when it started. So while one is in flight the card is held: the five
// controls that would rewrite the approved sections or take the card off the board are off,
// and each says why in the same words. What takes the card back is Discard, in the delivery
// block below.
//
// The card page does NOT compare the live card against what the delivery captured. A hand
// edit in the user's own editor still reaches the file and changes nothing for the delivery
// — it is building from its copy — so the honest thing to say is what it IS building, which
// is what the held controls say, before the edit is made rather than after.
// A native tooltip draws whatever it is given, so the line's backticks come off here.
const heldNote = (delivery: CardDelivery, c: CardCopy): string => {
  const line = delivery.state.line.replace(/`/g, "");
  return `${line} ${delivery.state.paused ? c.heldPaused : c.heldRunning}`;
};

// A control that belongs to the delivery block rather than the page (#307). It is the same
// chip the tabs at the other end of the strip wear — same radius, padding and weight — so the
// row reads as one strip of chips. Only the ink differs: accent, because this one acts on the
// run rather than switching what you are looking at.
//
// Its hover fill is that same accent, not the tabs' grey: the strip under it lightens on hover
// too, and a neutral chip on a lightening strip is a change you have to look for.
function PanelAction({
  icon,
  label,
  ...props
}: React.ComponentProps<"button"> & { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-0.5 text-[12px] font-[700] transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] active:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_26%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      style={{ color: "var(--color-nb-accent-deep)" }}
      {...props}
    >
      {icon}
      {label}
    </button>
  );
}

// Stop run (#49): ends the run in flight and nothing else. The delivery stands, its work
// stays where it is, and Resume carries it on.
//
// It is the ONLY control in the strip while a run is live, so nothing here has to be told
// apart from anything else (#313). Ending the delivery is the next screen's business: stop
// first, then Resume or Discard. Its glyph is the filled pause circle that pairs with Resume's
// play: a solid mark, and one that says the run is held rather than thrown away.
function StopRun({ session, onError }: { session: SessionView; onError: (why: string) => void }) {
  const c = useCopy().card.delivery.stop;
  const [confirming, setConfirming] = useState(false);
  const [asked, setAsked] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);

  // The agent is asked to end before it is killed, so a few seconds pass before the poll
  // brings the run back as stopped. Saying so beats a button that looks like it did nothing.
  const stop = async () => {
    setConfirming(false);
    setAsked(true);
    const res = await stopSessionAction(session.sessionId);
    if (!res.ok) {
      setAsked(false);
      onError(res.error || c.failed);
    }
  };

  if (asked) return <span className="text-[11px] text-nb-ink-soft">{c.stopping}</span>;
  return (
    <span ref={anchorRef} className="relative inline-flex">
      <PanelAction
        icon={<FaPauseCircle className="text-[12px]" aria-hidden />}
        label={c.label}
        aria-haspopup="dialog"
        aria-expanded={confirming}
        onClick={() => setConfirming((open) => !open)}
      />
      <ConfirmationPopover
        open={confirming}
        anchorRef={anchorRef}
        align="right"
        title={c.title}
        description={c.body}
        cancelLabel={c.keep}
        confirmLabel={c.label}
        busy={false}
        onDismiss={() => setConfirming(false)}
        onConfirm={() => void stop()}
      />
    </span>
  );
}

// Resume: the one way on when a delivery has stopped (#179, #302). Two different things can
// leave one stopped — a run that died mid-conversation, and a run that ended fine whose
// successor never started because the watcher died — and the way out of both is the same
// sentence: carry this delivery on. So it is one control with one name, and which of the two
// happened is the board's business, not the user's.
//
// Picking a dead conversation up is preferred whenever one is there: it keeps the turn the
// agent already spent. Either way the delivery is the same one — a resume re-joins it and
// re-enters the flow, so finished steps are not redone.
function ResumeDelivery({
  delivery,
  session,
  onResumed,
  onCarryOn,
  onError,
}: {
  delivery: CardDelivery;
  session: SessionView | null;
  onResumed: (sessionId: string) => void;
  onCarryOn: (action: NonNullable<CardDelivery["next"]>) => void;
  onError: (why: string) => void;
}) {
  const c = useCopy().card.delivery.resume;
  const [busy, setBusy] = useState(false);

  const pickUp = session && session.canResume && stoppedShort(session) ? session.sessionId : null;
  const owed = delivery.next;

  const resume = async () => {
    if (!pickUp) {
      if (owed) onCarryOn(owed);
      return;
    }
    setBusy(true);
    const res = await resumeSessionAction(pickUp);
    setBusy(false);
    // A refusal is the registry's own words — the card is locked by another run, or this
    // one aged out of the kept window. Say it and leave the control alive to try again.
    if (res.ok && res.sessionId) onResumed(res.sessionId);
    else onError(res.error || c.failed);
  };

  if (!pickUp && !owed) return null;
  return (
    <PanelAction
      icon={<FiPlay className="text-[12px]" aria-hidden />}
      label={busy ? c.resuming : c.label}
      disabled={busy}
      title={pickUp ? c.pickUpHint : c.startHint}
      onClick={() => void resume()}
    />
  );
}

// Discard: the one way out of a delivery, and the one control on this page that throws work
// away (#303, #313). It ends the delivery if it is still in flight — the card unlocks and
// Implement comes back — and removes the worktree and branch it built in.
//
// One control, not two. Ending a delivery and reclaiming its checkout used to be Cancel and
// Discard, which read as the same act under two names and left the checkout behind unless you
// remembered the second click. `akb cancel` is still the way to end one and keep its branch.
//
// The popover says exactly what will be lost, and there is nothing to lose in a delivery with
// no checkout of its own — one working in the project folder leaves the user's own tree alone.
// `panel` picks the block's strip over the toolbar, which is where it stands whenever the
// delivery still has a block to stand in.
function DiscardDelivery({
  id,
  worktree,
  branch,
  active,
  panel,
  onDiscarded,
  onError,
}: {
  id: string;
  worktree?: string;
  branch?: string;
  active?: boolean;
  panel?: boolean;
  onDiscarded: () => void;
  onError: (why: string) => void;
}) {
  const c = useCopy().card.delivery.discard;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const lost = worktree ? `${worktree}${branch ? ` and ${branch}` : ""}` : null;
  const discardIt = async () => {
    setConfirming(false);
    setBusy(true);
    const res = await discardDeliveryAction(id);
    setBusy(false);
    if (!res.ok) onError(res.error || c.failed);
    else onDiscarded();
  };

  return (
    <span ref={anchorRef} className="relative inline-flex">
      {panel ? (
        <PanelAction
          icon={<FiTrash2 className="text-[12px]" aria-hidden />}
          label={c.label}
          disabled={busy}
          aria-haspopup="dialog"
          aria-expanded={confirming}
          onClick={() => setConfirming((open) => !open)}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-haspopup="dialog"
          aria-expanded={confirming}
          style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}
          onClick={() => setConfirming((open) => !open)}
        >
          <FiTrash2 className="text-[15px]" aria-hidden />
          {c.label}
        </Button>
      )}
      <ConfirmationPopover
        open={confirming}
        anchorRef={anchorRef}
        align={panel ? "right" : "left"}
        title={active ? c.titleActive : c.titleSaved}
        description={
          <>
            {active && c.unlocks}
            {lost ? (
              <Rich code="break-all font-mono text-nb-ink">{c.deletes(lost)}</Rich>
            ) : (
              c.nothingToLose
            )}
          </>
        }
        cancelLabel={c.keep}
        confirmLabel={c.label}
        busy={busy}
        onDismiss={() => setConfirming(false)}
        onConfirm={() => void discardIt()}
      />
    </span>
  );
}

// The card's one mark while a delivery holds it: what the delivery is doing, or what it is
// waiting for (#307). It wears the pill shape the stage and the schedule already do, and
// the board's own three meanings — ember for work in flight or waiting on you, peach for
// something in the way, mint for done, blue for a job that has ended.
const PILL_SKIN: Record<string, { bg: string; ink: string }> = {
  live: { bg: "var(--color-nb-accent-soft)", ink: "var(--color-nb-accent-deep)" },
  warn: { bg: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" },
  done: { bg: "var(--color-nb-mint-soft)", ink: "var(--color-nb-mint-ink)" },
  ended: { bg: "var(--color-nb-sky-soft)", ink: "var(--color-nb-sky-ink)" },
};

function DeliveryPill({ label, tone }: { label: string; tone: keyof typeof PILL_SKIN }) {
  const skin = PILL_SKIN[tone]!;
  return (
    <span className="nb-chip nb-tip" tabIndex={0} data-tip={label} style={{ background: skin.bg, color: skin.ink }}>
      {label}
    </span>
  );
}

// A delivery's own words mark the names that matter — a file, a branch, a commit, the
// control to press — in backticks, and nothing else in them is markdown. Drawn as marks the
// eye finds them without reading the sentence twice.
function marked(line: string): ReactNode[] {
  return line.split(/`([^`]+)`/).map((part, i) =>
    i % 2 === 0 ? (
      part
    ) : (
      <code key={i} className="font-mono font-[700] text-nb-ink">
        {part}
      </code>
    ),
  );
}

// What the delivery waits on. A pause is the one thing on this page asking the reader to do
// something, so it is a note in the stage's own colour and not a grey line under the title —
// which read as a subtitle and got skipped. Everything the board is still moving along by
// itself stays a line: that is news, not a job.
function DeliveryNote({
  tone,
  paused,
  children,
}: {
  tone: keyof typeof PILL_SKIN;
  paused: boolean;
  children: ReactNode;
}) {
  const c = useCopy().card;
  if (!paused) {
    return <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">{children}</p>;
  }
  const skin = PILL_SKIN[tone]!;
  return (
    <div className="nb-section px-3.5 py-3" style={{ background: skin.bg }}>
      <div className="nb-tag mb-1.5" style={{ color: skin.ink }}>
        <FiAlertCircle className="text-[13px]" aria-hidden />
        {c.waitingOnYou}
      </div>
      <p className="text-[13px] leading-[19px] text-nb-ink">{children}</p>
    </div>
  );
}

/** The two ways out of an interrupted request: take it up again on this machine, or end it.
 *  Both act on the card, never on a delivery id — the delivery may be gone, which is exactly
 *  the case this block exists for. */
function InterruptedRequest({
  taskId,
  eventId,
  onError,
  onDone,
}: {
  taskId: number;
  eventId: string;
  onError: (message: string) => void;
  onDone: () => void;
}) {
  const card = useCopy().card;
  const c = card.interrupted;
  const [busy, setBusy] = useState<"resume" | "cancel" | null>(null);

  const move = async (which: "resume" | "cancel") => {
    if (busy) return;
    setBusy(which);
    try {
      const done =
        which === "resume"
          ? await resumeCloudRequestAction(eventId)
          : await cancelCloudRequestAction(taskId, eventId);
      if (!done.ok) onError(done.error || (which === "resume" ? c.resumeFailed : c.cancelFailed));
      onDone();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nb-section px-3.5 py-3" style={{ background: PILL_SKIN.warn!.bg }}>
      <div className="nb-tag mb-1.5" style={{ color: PILL_SKIN.warn!.ink }}>
        <FiAlertCircle className="text-[13px]" aria-hidden />
        {card.waitingOnYou}
      </div>
      <p className="text-[13px] leading-[19px] text-nb-ink">{c.line}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!!busy} onClick={() => void move("resume")}>
          {busy === "resume" ? c.resuming : c.resume}
        </Button>
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void move("cancel")}>
          {busy === "cancel" ? c.cancelling : c.cancel}
        </Button>
      </div>
    </div>
  );
}

// Which of those a delivery's stage wears.
const PILL_TONE: Record<CardDeliveryStage, keyof typeof PILL_SKIN> = {
  working: "live",
  stopped: "live",
  held: "live",
  approval: "live",
  commit: "live",
  rereview: "warn",
  refused: "warn",
  queued: "live",
  landed: "done",
};

// ---- the delivery block (#307) ----------------------------------------------
//
// The block that was the session log. It is the delivery's own space on the page: one tab
// strip over it — Diff, Log, Approval — with the log and the diff in them, and a foot
// naming the delivery, how it commits, and where its code is.
//
// A tab appears with the thing it holds: Diff shows once the server has one to draw (#305),
// and Approval waits on #308. A card with no delivery at all keeps the plain session log it
// has always had.
type DeliveryTabKey = "diff" | "log" | "approval";
type DeliveryTab = { key: DeliveryTabKey; label: string; note?: string };

function SessionMeta({ session }: { session: SessionView | null }) {
  const c = useCopy().card.delivery;
  if (!session) return null;
  const state =
    session.status === "running"
      ? ""
      : session.status === "stopped"
        ? c.stopped
        : session.status === "interrupted"
          ? c.interrupted
          : session.ok
            ? c.done
            : c.exited(String(session.code ?? "?"));
  const indicator =
    session.status === "running" ? (
      <span className={PULSE_DOT} aria-hidden />
    ) : session.status === "stopped" ? (
      <span aria-hidden style={{ color: "var(--color-nb-sky-ink)" }}>■</span>
    ) : session.status === "interrupted" ? (
      <span aria-hidden style={{ color: "var(--color-nb-peach-ink)" }}>⦸</span>
    ) : (
      <span aria-hidden style={{ color: "var(--color-nb-accent-deep)" }}>{session.ok ? "✓" : "✕"}</span>
    );
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 text-[11px] text-nb-ink-soft"
      aria-label={[state || c.running, session.model].filter(Boolean).join(", ")}
    >
      {indicator}
      {state && <span>{state}</span>}
      {state && session.model && <span aria-hidden>·</span>}
      {session.model && <span>{session.model}</span>}
    </span>
  );
}

// The strip carries the tabs on the left and, on the right, what this delivery is running on
// and the controls that carry it on or end it — the block's own affairs, kept out of the page
// toolbar. It is also the block's fold: a run that has stopped moving is worth a glance, not
// half a screen, so the pane under it opens on demand.
//
// The whole strip is the fold's control — a bar that lights on hover and presses on click,
// rather than a chevron nobody can see. A tab click opens the pane at that tab; clicking the
// tab already showing folds it again; the run's own controls inside keep their clicks.
function TabStrip({
  tabs,
  current,
  open,
  onPick,
  onToggle,
  meta,
  action,
}: {
  tabs: DeliveryTab[];
  current: DeliveryTabKey;
  open: boolean;
  onPick: (key: DeliveryTabKey) => void;
  onToggle: () => void;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const c = useCopy().card.delivery;
  return (
    <div
      role="button"
      aria-expanded={open}
      aria-label={open ? c.fold : c.unfold}
      onClick={onToggle}
      // Hovers darken whatever is under them rather than mixing towards paper: the strip
      // has no fill of its own now, and sits on the block's tinted ground.
      className={`flex cursor-pointer select-none items-center gap-1 rounded-t-[14px] py-1.5 pl-1.5 pr-3.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_4%,transparent)] active:bg-[color-mix(in_srgb,var(--color-nb-ink)_7%,transparent)]${open ? "" : " rounded-b-[14px]"}`}
    >
      {tabs.map((tab) => {
        const on = tab.key === current && open;
        return (
          <button
            key={tab.key}
            type="button"
            aria-expanded={on}
            onClick={(e) => {
              e.stopPropagation();
              if (on) onToggle();
              else onPick(tab.key);
            }}
            // The open tab is a filled chip, not an underlined one: the pane below already
            // draws a rule under this strip, and an underline four pixels above it read as
            // two lines doing one job. The fill is a step of ink INTO the block's own
            // ground, never the accent — that ember is the diff's deletion tint a few
            // pixels below, and a chip wearing it reads as "something is wrong here".
            className={`flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-0.5 text-[12px] font-[700] transition-colors${on ? "" : " hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)]"}`}
            style={
              on
                ? { background: "color-mix(in srgb, var(--color-nb-ink) 9%, transparent)" }
                : { color: "var(--color-nb-ink-soft)" }
            }
          >
            {tab.label}
            {tab.note && <span className="text-[10.5px] font-[600] text-nb-ink-soft">{tab.note}</span>}
          </button>
        );
      })}
      {/* The run's own affairs: they act on the delivery, never on the fold. */}
      <span className="ml-auto flex items-center gap-3.5" onClick={(e) => e.stopPropagation()}>
        {meta}
        {action}
      </span>
    </div>
  );
}

// ---- the Approval tab (#308) -------------------------------------------------
//
// On a board with **Approve diffs before landing** on, nothing lands until the tree
// has been read and signed off. This is where that is done: one line saying what an approval
// covers, and one button.
//
// It is deliberately next to **Diff** rather than instead of it — the block opens on Diff
// while a delivery waits, so the tree is the first thing read and this is the second.
function ApprovalPane({
  delivery,
  approval,
  onApproved,
  onError,
}: {
  delivery: CardDelivery;
  approval: CardApproval;
  onApproved: () => void;
  onError: (why: string) => void;
}) {
  const c = useCopy().card.delivery.approval;
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    const res = await approveDeliveryAction(delivery.id);
    setBusy(false);
    if (!res.ok) onError(res.error || c.failed);
    else onApproved();
  };

  return (
    <div className="bg-nb-paper px-4 py-3.5" style={PART}>
      {approval.approved ? (
        <>
          <p className="flex items-center gap-1.5 text-[13px] font-[700] text-nb-ink">
            <FiCheckCircle className="shrink-0 text-[15px]" aria-hidden />
            {c.approved}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
            {c.approvedBody(approval.covers)}
          </p>
        </>
      ) : (
        <>
          <p className="text-[13px] font-[700] text-nb-ink">{c.required}</p>
          <p className="mt-1.5 max-w-[68ch] text-[12px] leading-relaxed text-nb-ink-soft">
            {approval.cancelled ? `${upperFirst(approval.cancelled)}. ` : ""}
            <Rich>{c.readDiff(approval.covers)}</Rich>
          </p>
          <Button className="mt-3" size="sm" disabled={busy} onClick={() => void approve()}>
            <FiCheckCircle className="text-[15px]" aria-hidden />
            {c.approve}
          </Button>
        </>
      )}
    </div>
  );
}

const upperFirst = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text);

// The block's foot keeps only the useful location and commit behavior visible. Full paths
// remain in the location tooltip instead of turning the footer into a command line.
function DeliveryFoot({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-b-[14px] px-3.5 py-2.5 text-[11.5px] text-nb-ink-soft"
      style={PART}
    >
      {children}
    </div>
  );
}

function DeliveryBlock({
  delivery,
  diff,
  session,
  onApproved,
  onEnded,
  onResumed,
  onCarryOn,
  onError,
}: {
  delivery: CardDelivery;
  diff: DeliveryDiff | null;
  session: SessionView | null;
  onApproved: () => void;
  onEnded: () => void;
  onResumed: (sessionId: string) => void;
  onCarryOn: (action: NonNullable<CardDelivery["next"]>) => void;
  onError: (why: string) => void;
}) {
  const c = useCopy().card.delivery;
  const approval = delivery.approval;
  // A delivery waiting on an approval opens on **Diff** (#308): the tree is the thing to
  // read, and approving without reading it is the one outcome this policy exists to stop.
  // Otherwise the log opens first while a delivery is live — it is the thing that moves, and
  // the diff is not finished being written.
  const waitingOnApproval = !!approval?.required && !approval.approved;
  const [tab, setTab] = useState<DeliveryTabKey>(waitingOnApproval && diff ? "diff" : "log");
  // Open while something is moving, or while a tree is waiting to be read. A run that has
  // stopped leaves the block folded to its strip — the state is said beside the title, and
  // the log is there for whoever wants it.
  const live = session?.status === "running";
  const [open, setOpen] = useState(!!live || waitingOnApproval);
  // A delivery that STARTS waiting while the page is open opens on the diff too, and a run
  // that starts or stops swings the fold with it. Only on the change: whatever the user
  // picked or folded afterwards is theirs until the delivery moves again.
  const wasWaiting = useRef(waitingOnApproval);
  const wasLive = useRef(live);
  useEffect(() => {
    if (waitingOnApproval && !wasWaiting.current) {
      setTab("diff");
      setOpen(true);
    }
    if (live !== wasLive.current) setOpen(!!live || waitingOnApproval);
    wasWaiting.current = waitingOnApproval;
    wasLive.current = live;
  }, [waitingOnApproval, live]);
  const tabs: DeliveryTab[] = [
    ...(diff ? [{ key: "diff" as const, label: c.tabDiff }] : []),
    { key: "log" as const, label: c.tabLog },
    ...(approval
      ? [{ key: "approval" as const, label: c.tabApproval, note: approval.approved ? "✓" : undefined }]
      : []),
  ];
  // A tab that has gone — the diff a re-read no longer has — falls back to the first one
  // rather than leaving the strip pointing at nothing.
  const current = tabs.some((t) => t.key === tab) ? tab : tabs[0]!.key;
  // No `overflow-hidden` on the block: the strip and the foot round their own outer
  // corners, so a confirmation hanging off a control in the strip is not clipped.
  //
  // The page's ground, like the run log and the meta box — what a delivery is doing is said
  // in the pill and the strip, in ink, not by tinting a whole block. The panes inside stay
  // paper: chrome on the section's ground, the thing you read on paper, which is the same
  // inner-window shape a log wears anywhere else on the board.
  return (
    <div className="nb-section bg-nb-sheet">
      <TabStrip
        tabs={tabs}
        current={current}
        open={open}
        onPick={(key) => {
          setTab(key);
          setOpen(true);
        }}
        onToggle={() => setOpen((v) => !v)}
        meta={<SessionMeta session={session} />}
        action={
          /* One question at a time (#313). While a run is live the only thing to decide is
             whether it should keep going, so Stop run stands alone. Once nothing is running,
             the question becomes what to do with the delivery: carry it on, or end it. */
          live && session ? (
            <StopRun session={session} onError={onError} />
          ) : (
            <>
              <ResumeDelivery
                delivery={delivery}
                session={session}
                onResumed={onResumed}
                onCarryOn={onCarryOn}
                onError={onError}
              />
              <DiscardDelivery
                panel
                active
                id={delivery.id}
                worktree={delivery.worktree}
                branch={delivery.branch}
                onDiscarded={onEnded}
                onError={onError}
              />
            </>
          )
        }
      />
      {open &&
        (current === "approval" && approval ? (
          <ApprovalPane delivery={delivery} approval={approval} onApproved={onApproved} onError={onError} />
        ) : current === "diff" && diff ? (
          <DiffPane diff={diff} />
        ) : session ? (
          <SessionLog session={session} bare warnUnfinished />
        ) : (
          <p className="px-4 py-3 text-[12.5px] text-nb-ink-soft" style={PART}>
            {c.noLog}
          </p>
        ))}
      {open && (
        <DeliveryFoot>
          <span
            className="flex min-w-0 items-center gap-1.5"
            title={delivery.worktree ?? delivery.manualWhy ?? c.projectFolderHint}
          >
            <FiGitBranch className="shrink-0 text-[12px]" aria-hidden />
            <code className="truncate font-mono text-nb-ink">
              {delivery.branch ?? c.projectFolder}
            </code>
            {delivery.targetBranch && (
              <>
                <span aria-hidden>→</span>
                <code className="font-mono text-nb-ink">{delivery.targetBranch}</code>
              </>
            )}
          </span>
          <span className={CAP} title={delivery.manualWhy}>
            {delivery.commitMode === "auto" ? c.autoCommit : c.manualCommits}
          </span>
        </DeliveryFoot>
      )}
    </div>
  );
}

// The same block once the delivery has ended (#305). The card is normally archived in the
// same breath, so this is the blink between the two — and the way back to the commit that
// landed when someone comes looking for it. Nothing here is live, so Diff opens first.
function FinishedBlock({
  finished,
  discard,
  diff,
  session,
  onDiscarded,
  onError,
}: {
  finished: CardFinished;
  discard: Card["discard"];
  diff: DeliveryDiff;
  session: SessionView | null;
  onDiscarded: () => void;
  onError: (why: string) => void;
}) {
  const c = useCopy().card.delivery;
  const [tab, setTab] = useState<DeliveryTabKey>("diff");
  // Nothing here is running, so it opens folded like every other stopped block. What landed
  // is a click away for whoever came looking for it.
  const [open, setOpen] = useState(false);
  const tabs: DeliveryTab[] = [
    { key: "diff" as const, label: c.tabDiff },
    ...(session ? [{ key: "log" as const, label: c.tabLog }] : []),
  ];
  const current = tabs.some((t) => t.key === tab) ? tab : "diff";
  // Same ground as the delivery it is the end of, and no `overflow-hidden`: the strip and
  // the foot round their own outer corners, so a confirmation hanging off a control in the
  // strip is not clipped.
  return (
    <div className="nb-section bg-nb-sheet">
      <TabStrip
        tabs={tabs}
        current={current}
        open={open}
        onPick={(key) => {
          setTab(key);
          setOpen(true);
        }}
        onToggle={() => setOpen((v) => !v)}
        meta={<SessionMeta session={session} />}
        action={
          discard && (
            <DiscardDelivery
              panel
              id={discard.id}
              worktree={discard.worktree}
              branch={discard.branch}
              onDiscarded={onDiscarded}
              onError={onError}
            />
          )
        }
      />
      {open &&
        (current === "log" && session ? (
          <SessionLog session={session} bare warnUnfinished />
        ) : (
          <DiffPane diff={diff} />
        ))}
      {open && (
        <DeliveryFoot>
          <span className="flex items-center gap-1.5">
            <FiGitBranch className="shrink-0 text-[12px]" aria-hidden />
            {finished.commit ? (
              <>
                <span>{c.landedAs}</span>
                <code className="font-mono text-nb-ink">{finished.commit.slice(0, 7)}</code>
              </>
            ) : (
              <span>{c.finished}</span>
            )}
          </span>
          <span className={CAP}>
            {finished.targetBranch ?? (finished.commitMode === "auto" ? c.autoCommit : c.manualCommits)}
          </span>
        </DeliveryFoot>
      )}
    </div>
  );
}

// One meta column: micro-caption stacked over its value. Columns flow
// horizontally and wrap, so the box stays one shallow band instead of a tall
// stack of full-width rows. Every value is chip-height, so rows self-align.
function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={CAP}>{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function CardPage({
  card,
  openIds,
  releases,
  agent,
  projectRoot,
  goalWritten,
  memoryModules,
  mockups,
  plan,
  diff,
  desktop,
}: {
  card: Card;
  openIds: number[];
  releases: string[];
  agent: AgentInfo;
  projectRoot: string;
  /** Whether the header's goal button has anything to open (#128). The header is
   *  the same on both pages, and direction is worth rereading wherever you are. */
  goalWritten: boolean;
  /** The modules the rail's Memory panel offers (#130). The rail is the same on
   *  every page, so this is too. */
  memoryModules: MemoryModule[];
  /** The screens this card's `<Mockup>` tags point at, already read and drawn (#239).
   *  The card page is the only page that shows them. */
  mockups: MockupSet;
  /** What an Implement click would do from here (#307): the branch the change would land
   *  on, and whether it lands at all. Read on the server, where git is. */
  plan: DeliveryPlan;
  /** What the delivery on this card changed (#305) — the one in flight, or the one that
   *  landed. Read and capped on the server. Null when there is nothing to show, and then
   *  the delivery block has no **Diff** tab. */
  diff: DeliveryDiff | null;
  /** Whether this board is running inside the desktop app (#175). The header and
   *  the running notice are the same on both pages, so this is too. */
  desktop: boolean;
}) {
  const t = useCopy();
  const c = t.card;
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  // The open-questions panel is answering rather than being read. Held here rather than
  // inside it because two other controls open it: the toolbar's Resolve, and the Implement
  // dialog's way out of its open-question warning.
  const [deciding, setDeciding] = useState(false);
  const closeDeciding = useCallback(() => setDeciding(false), []);
  const [error, setError] = useState<string | null>(null);
  // The subtask chip under the cursor, said in the panel's heading (#333).
  const [mapTip, setMapTip] = useState("");

  // A session this tab started just finished. Reject/archive take the card off the
  // board, so we go back to it (the inline SessionLog can't show output for a card
  // that's no longer there); the rest re-read the card in place and the inline
  // SessionLog shows the agent's final message.
  const onFinish = useCallback(
    (session: SessionView, started: StartedSession) => {
      if (started.removes && session.ok) router.push("/");
      else router.refresh();
    },
    [router],
  );

  const { sessions, start, watch, kick } = useAgentSessions(onFinish);

  // Re-read the card in place whenever any session finishes — from this tab or
  // another. The onFinish above only covers sessions this tab started; a session
  // from the board view or another tab can rewrite the card while this page is
  // open, so give the page the same running-set diff Board uses. (Own-session
  // reject/archive still navigate home via onFinish; this only adds the in-place
  // refresh for the rest.)
  //
  // Asks first whether the card is still there (#299). Another card's run can take this
  // one off the board — a group root is archived by the board itself the moment its last
  // subtask leaves — and a plain refresh would then render "not on the board" and count
  // down at a user who did nothing. Gone means straight back to the board, which is where
  // the countdown was going anyway.
  const refresh = useCallback(() => {
    void cardOnBoardAction(card.id).then((there) => (there ? router.refresh() : router.push("/")));
  }, [router, card.id]);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);

  // On tab focus, re-read the card once, unconditionally — so a session that ran
  // entirely while the tab was hidden can't leave this page stale (the diff above
  // never witnessed it running). A fresh read is always correct.
  useOnTabFocus(refresh);

  // A chat wrote the board while it was answering (#243) — quite possibly this very
  // card, since the card's own conversation is the one in the rail. Re-read in place,
  // and wake the runs poll in case the same message started a run. When the card
  // itself has gone — the chat archived or rejected it — there is nothing left to
  // draw, so the app goes back to the board rather than sitting on a dead page.
  const boardChanged = useCallback(
    ({ cardGone }: BoardChange) => {
      if (cardGone) router.push("/");
      else {
        refresh();
        kick();
      }
    },
    [router, refresh, kick],
  );

  // A live session on this card (from any tab) blocks a second one and shows a badge.
  // The whole set is kept: the rail draws every open card, and a subtask can be
  // running while the root you're reading isn't.
  const running = runningCardIds(sessions);
  const busy = running.has(card.id);
  // The session itself, so the badge can name the action in flight (refining, etc.).
  const liveSession = runningSessionForCard(sessions, card.id);
  // The delivery in flight on this card, read off the card the server rendered — so the
  // hold stands BETWEEN a delivery's sessions too, which is exactly when `busy` is false
  // and the card would otherwise read as free.
  const delivery = card.delivery;
  const held = !!delivery;
  const heldWhy = delivery ? heldNote(delivery, c) : "";
  // A delivery whose review stopped is waiting on the question it left here (#302).
  // Review again is what judges the same work once it is answered.
  const waiting = delivery?.waiting;
  // Another review, once the question this delivery is waiting on has been answered. A
  // delivery that stopped rather than asked is Resume's business, in the block below.
  const carryOn = waiting ? ("review" as const) : null;
  // Resolve stays live whenever the delivery is waiting on the user (#307) — a hold nothing
  // lets you answer is a dead end — while every other held control is off. The CLI makes
  // exactly the same exception.
  const answerable = !!delivery?.state.paused;
  // A delivery that is only building — waiting on nothing, holding nothing up. The one stage
  // with nothing to say beyond the pill already saying it.
  const justBuilding = delivery?.state.stage === "working";
  // The one line under the title band — see where it renders for what it says.
  const deliveryLine = !!delivery && (!justBuilding || !!delivery.supersedes || !!delivery.lost);
  // One test for every control the hold covers: a session on this card, or a delivery on it.
  const off = busy || held;
  const offUnlessAsked = busy || (held && !answerable);
  const { total, done } = card.todos;
  const actions = visibleActions(card);
  // The delivery has ended and its block is still on the page — the one that carries Discard.
  const finishedBlock = !delivery && !!card.finished && !!diff;
  // Whether the toolbar has anything to draw. A free card always does (Edit and Reject are
  // unconditional); a held one only when the delivery leaves it something to click.
  const toolbar = !delivery || !!carryOn;

  // This card's live Cloud event (#319). Two things read it: the title band's one mark, for
  // the four states no local mark has words for, and the Implement and Resolve clicks —
  // which act on the spot exactly as they always have and record the same durable action
  // against it, so every other surface showing that event stops offering it.
  const cloudEvent = useCardEvent(card.id);
  const cloudBand =
    cloudEvent && (CARD_BAND_STATES as string[]).includes(cloudEvent.state)
      ? bandLabel(cloudEvent.state as CloudEventState)
      : "";

  // Tail the newest session on this card: live while it runs, and re-openable once
  // it's done so the user can read back what the agent did (task #14).
  const latestSession = latestSessionForCard(sessions, card.id);
  const sessionLog = useSessionLog(latestSession?.sessionId ?? null);
  const [showLog, setShowLog] = useState(false);
  // The newest run on this card stopped short (#179) — it failed, or it was cut off.
  // The card is then possibly part-built, which is a thing to learn on arriving at the
  // page, not on clicking around it.
  const unfinished = stoppedShort(latestSession);
  // The newest session on this card belonged to a delivery somebody cancelled. Worth saying
  // once, beside the title: the work it left is still in the tree, and nothing is coming
  // back to finish it.
  const cancelled = latestSession?.delivery?.status === "cancelled";
  // Open the log by itself in the two cases where its contents are the news: a run
  // just started here, and a run that stopped short. Each fires once on the change,
  // so shutting the window afterwards holds.
  useEffect(() => {
    if (busy || unfinished) setShowLog(true);
  }, [busy, unfinished]);

  // Resume starts a new run, and the page follows it: taking it on as this tab's makes
  // the poll wake now, and the newest run on the card is what this slot tails — so the
  // window swaps to the live one on its own, and the card is re-read when it ends.
  const onResumed = useCallback(
    (sessionId: string) => {
      watch(sessionId, "resume");
      setShowLog(true);
    },
    [watch],
  );

  // Start a non-blocking session. The per-card lock refusal comes back as an error.
  // A start that works clears whatever the last one said — a refusal the user has since
  // dealt with (committed the dirty files, waited out the lock) must not stay on screen
  // over the run it was about.
  const runAgent = async (req: AgentReq, label: string) => {
    setDialog(null);
    const removes = req.action === "reject" || req.action === "archive";
    const res = await start(req, label, removes);
    setError(res.ok ? null : res.error || c.toolbar.startFailed);
  };

  // Queue an action on this card instead of starting it (#140). The card keeps its stage and
  // its place on the board; what changes is that the server starts this run by itself once
  // the last card in its way has gone. Nothing spawns here, so the dialog closes on a plain
  // re-read rather than on a session to watch.
  const scheduleAgent = async (action: ScheduledAction, notes: string) => {
    setDialog(null);
    const res = await scheduleCardAction(card.id, action, notes);
    setError(res.ok ? null : res.error || c.toolbar.scheduleFailed);
    if (res.ok) router.refresh();
  };

  const unschedule = async () => {
    const res = await unscheduleCardAction(card.id);
    setError(res.ok ? null : res.error || c.toolbar.unscheduleFailed);
    if (res.ok) router.refresh();
  };

  const patchCard = async (id: number, patch: CardPatch) => {
    try {
      const res = await patchCardAction(id, patch);
      if (!res.ok) {
        setError(res.error || c.toolbar.editFailed);
        return false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  };

  return (
    <OpenIdsProvider ids={openIds}>
      {/* Landing here is what opens the card in the window's rail — every way in
          is this page, so a board card, a subtask, a `#12` in a body and a
          pasted link all leave the same row behind, which is also the way back
          out. The body is the window's paper and scrolls inside it: the rail
          stays put beside the card it opened. */}
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentId={card.id}
        currentTitle={card.title}
        memoryModules={memoryModules}
        running={running}
        onBoardChanged={boardChanged}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            onError={setError}
            goalWritten={goalWritten}
            desktop={desktop}
          />
        }
      >
        {/* The card page is white paper, and every section on it is one warm sheet lifting
            off it — the bands that annotate the card and the card's own body alike. What is
            left of colour is spent on the two sections that mean something: mint where the
            work is already done, ember where an answer is wanted. An alert is a rung louder
            than either. Depth inside a section is a step DOWN — the run log's well. */}
        <div className="h-full overflow-y-auto bg-nb-paper">
          {/* Same line as the board's (#175) — a newer app in the app, a pointer
              to the app in a browser. */}
          <RunningNotice desktop={desktop} />

          {/* Every gap on this page is a `gap` — nothing on it carries a margin of its own,
              so no two blocks can drift apart. Two stacks: the title, and everything under
              it evenly spaced. The one wider step (gap-8) is the title's, set once. */}
          <main className="mx-auto flex w-full max-w-[840px] flex-col gap-8 px-6 py-6">
            {/* An alert is the one thing here louder than a section: peach at `-soft`
                rather than at the `-wash` rung the sections sit on, so it reads as
                something that happened and not as another band of the page. */}
            {error && (
              <div className="nb-section bg-nb-peach-soft p-3.5 text-[13px] text-nb-peach-ink">
                {error}
              </div>
            )}

            {/* Where the card came from, and what it is called. */}
            <div className="flex flex-col gap-2">
              {/* part of a group — link up to the tracking root */}
              {card.parent && (
                <Link
                  href={`/${card.parent.id}`}
                  className="inline-flex self-start items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-accent-deep"
                >
                  <FiCornerLeftUp className="text-[13px]" aria-hidden />
                  {c.partOf(card.parent.id, card.parent.title)}
                </Link>
              )}

              {/* title band — the card's one mark rides beside the title: a live
                  session's badge while busy, otherwise where the delivery has got to
                  (#307), otherwise the saved stage (nothing while `todo`). Never two. */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className="shrink-0 text-[20px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
                  #{card.id}
                </span>
                <h1 className="min-w-0 text-[20px] font-[800] tracking-[-0.02em] leading-tight break-words">
                  {card.title}
                </h1>
                {busy ? (
                  <RunningBadge
                    label={
                      liveSession
                        ? c.working(t.runs.verb[liveSession.action])
                        : c.workingUnknown
                    }
                  />
                ) : delivery ? (
                  // What the delivery is doing, or what it is waiting for — the board's own
                  // answer, worked out from the card's questions and the delivery's records.
                  <DeliveryPill label={delivery.state.label} tone={PILL_TONE[delivery.state.stage]} />
                ) : card.landed ? (
                  // It landed, and the board is taking the card off. Normally the blink
                  // between the two; on screen for longer only when the archive failed.
                  <DeliveryPill
                    label={card.landed.commit ? c.landed(card.landed.commit.slice(0, 7)) : c.landedNothing}
                    tone="done"
                  />
                ) : cancelled ? (
                  // The last delivery on this card was ended before it landed — Discard here,
                  // or `akb cancel`. The card is free again, and saying "stopped" would name
                  // the session and hide what happened. One word for both ways out: the record
                  // spells them the same, and which one it was changes nothing from here.
                  <DeliveryPill label={c.ended} tone="ended" />
                ) : card.schedule ? (
                  // Waiting on its blockers, with a run already queued (#140) — the mark
                  // stands in for the stage, and says what will run and what it waits for.
                  <PendingPill label={scheduleLabel(card)} detailed />
                ) : cloudBand ? (
                  // The card's live Cloud event (#319), last in this band's order and only
                  // where no local mark already holds the slot: once a delivery is running
                  // its pill is already the local truth about the same work, and a second
                  // pill beside it would state that truth twice in two vocabularies.
                  <DeliveryPill label={cloudBand} tone="live" />
                ) : (
                  card.status !== "todo" && <StatusPill status={card.status} detailed />
                )}
              </div>
            </div>

            {/* Everything under the title, evenly spaced. Each block draws itself and
                nothing else — the spacing between them is this stack's, so one added or
                taken away costs no other block a class. */}
            <div className="flex flex-col gap-4">
              {/* What the delivery waits on, and what answers it. The worktree and branch
                  used to sit here; they moved to the delivery block's foot (#307). A pause
                  is drawn as a note in the stage's colour — it is the one thing here the
                  reader has to act on — and everything else stays a line. A delivery just
                  building says nothing: the IN PROGRESS pill above already does, and
                  restating it in a sentence buys the reader nothing. */}
              {/* An approval taken somewhere else whose machine stopped before it finished
                  (#318). It is the one Cloud state with something to press, and it is pressed
                  here — beside the delivery it belongs to — because a rail row opens this
                  page and draws no view of its own. */}
              {cloudEvent?.state === "interrupted" && (
                <InterruptedRequest
                  taskId={card.id}
                  eventId={cloudEvent.eventId}
                  onError={setError}
                  onDone={() => {
                    router.refresh();
                    kick();
                  }}
                />
              )}

              {deliveryLine && delivery && (
                <DeliveryNote tone={PILL_TONE[delivery.state.stage]} paused={delivery.state.paused}>
                  {!justBuilding && marked(delivery.state.line)}
                  {delivery.supersedes && <> {c.supersedes}</>}
                  {delivery.lost && (
                    <span className="ml-1" style={{ color: "var(--color-nb-accent-deep)" }}>
                      {delivery.lost}.
                    </span>
                  )}
                </DeliveryNote>
              )}

              {/* toolbar — the state machine (visibleActions) decides which buttons
                  fit the card's state; busy still disables every one that shows. It is gone
                  entirely while a held card has nothing left to offer: Discard rides in the
                  delivery block, and an empty row is just a gap. */}
              {toolbar && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Implement — gone while a delivery is in flight, since what ends one is
                      Discard in the block below. */}
                  {!delivery && actions.has("implement") && (
                    <Button size="sm" disabled={busy} onClick={() => setDialog({ kind: "implement", card })}>
                      <FiPlay className="text-[15px]" aria-hidden />
                      {c.toolbar.implement}
                    </Button>
                  )}
                  {/* Discard (#303) — the checkout a delivery built in, thrown away. Offered
                      whenever one is still on disk: `akb cancel` ends a delivery and leaves its
                      worktree and branch alone, so nothing else ever reclaims one. Here only
                      when there is no block to carry it. */}
                  {card.discard && !delivery && !finishedBlock && (
                    <DiscardDelivery
                      id={card.discard.id}
                      worktree={card.discard.worktree}
                      branch={card.discard.branch}
                      onDiscarded={() => {
                        router.refresh();
                        kick();
                      }}
                      onError={setError}
                    />
                  )}
                  {/* Run (#64) — Implement's place on a recurring card. Same ember CTA:
                      it is the one thing you came to this card to do. */}
                  {actions.has("run") && !delivery && (
                    <Button
                      size="sm"
                      disabled={off}
                      title={held ? heldWhy : c.toolbar.runHint}
                      onClick={() => setDialog({ kind: "run", card })}
                    >
                      <FiPlay className="text-[15px]" aria-hidden />
                      {c.toolbar.run}
                    </Button>
                  )}
                  {/* Refine — the same run the board makes on its own, on demand. While
                      another run holds this card it's disabled like every other button,
                      and its tooltip names what that run is doing, so a second refine is
                      never a click away. (The server refuses one anyway — the poll behind
                      `busy` can be a second and a half old.) */}
                  {actions.has("refine") && !delivery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={off}
                      title={
                        held
                          ? heldWhy
                          : busy && liveSession
                            ? c.toolbar.alreadyRunning(t.runs.verb[liveSession.action])
                            : c.toolbar.refineHint
                      }
                      onClick={() => setDialog({ kind: "refine", card })}
                    >
                      <FiFeather className="text-[15px]" aria-hidden />
                      {c.toolbar.refine}
                    </Button>
                  )}
                  {actions.has("edit") && !delivery && (
                    <Button variant="ghost" size="sm" disabled={off} title={held ? heldWhy : undefined} onClick={() => setDialog({ kind: "edit", card })}>
                      <FiEdit2 className="text-[15px]" aria-hidden />
                      {c.toolbar.edit}
                    </Button>
                  )}
                  {/* No Resolve button: the questions panel below is the control, and a
                      decision is made against the question it is about. */}
                  {/* Review again (#302) — offered while a delivery is waiting on the question
                      its review left. Answer it, or write the exception you are approving under
                      ## Worth noting after implementation, and this judges the same work afresh.
                      A delivery that merely STOPPED is not this: Resume in the block below
                      carries it on, and the user never has to tell the two kinds of stop apart. */}
                  {waiting && carryOn && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      title={c.toolbar.reviewAgainHint}
                      onClick={() => void runAgent({ action: carryOn, id: card.id }, carryOn)}
                    >
                      <FiCheckCircle className="text-[15px]" aria-hidden />
                      {c.toolbar.reviewAgain}
                    </Button>
                  )}
                  {actions.has("archive") && !delivery && (
                    <Button variant="ghost" size="sm" disabled={off} title={held ? heldWhy : undefined} onClick={() => setDialog({ kind: "archive", card })}>
                      <FiArchive className="text-[15px]" aria-hidden />
                      {c.toolbar.archive}
                    </Button>
                  )}
                  {actions.has("reject") && !delivery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={off}
                      title={held ? heldWhy : undefined}
                      style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}
                      onClick={() => setDialog({ kind: "reject", card })}
                    >
                      <FiXCircle className="text-[15px]" aria-hidden />
                      {c.toolbar.reject}
                    </Button>
                  )}
                </div>
              )}

              {/* The delivery block (#307) while one is in flight: the tab strip, the log in
                  it, and a foot naming the delivery, its commit mode and where its code is.
                  A card with no delivery keeps the plain session log it has always had — a
                  live tail while an agent works, re-openable afterwards. */}
              {delivery ? (
              <DeliveryBlock
                delivery={delivery}
                diff={diff}
                session={sessionLog}
                onApproved={refresh}
                onEnded={() => {
                  router.refresh();
                  kick();
                }}
                onResumed={onResumed}
                onCarryOn={(action) => void runAgent({ action, id: card.id }, action)}
                onError={setError}
              />
            ) : finishedBlock && card.finished && diff ? (
              /* The delivery has ended and the card is still here (#305) — normally the
                 blink before the board archives it. The same block, opening on the Diff:
                 what landed, and the commit to revert if it has to go. */
              <FinishedBlock
                finished={card.finished}
                discard={card.discard}
                diff={diff}
                session={sessionLog}
                onDiscarded={() => {
                  router.refresh();
                  kick();
                }}
                onError={setError}
              />
            ) : (
              latestSession && (
                <SessionLog
                  session={sessionLog}
                  collapsed={!busy && !showLog}
                  onToggle={busy ? undefined : () => setShowLog((v) => !v)}
                  warnUnfinished
                  onResumed={onResumed}
                />
              )
            )}

            {/* meta box — stacked label/value columns, on the page's one ground. */}
            <div className="nb-section flex flex-wrap items-start gap-x-7 gap-y-3 bg-nb-sheet px-4 py-3.5">
              <MetaItem label={c.meta.track}>
                <TrackChip track={card.track} />
              </MetaItem>

              {card.modules.length > 0 && (
                <MetaItem label={c.meta.modules}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {card.modules.map((m) => (
                      <ModuleChip key={m} module={m} />
                    ))}
                  </span>
                </MetaItem>
              )}

              {/* Release (#105) — the version this card ships in, picked from the
                  open releases plus a bare "—" for none. A board that plans no
                  versions says nothing about them at all, so the column is gone
                  rather than stuck on the dash; a card left pointing at a release
                  someone deleted from the list still shows its own value, so
                  nothing goes quiet. */}
              {(releases.length > 0 || card.release !== NO_RELEASE) && (
                <MetaItem label={c.meta.release}>
                  <ReleaseSelect
                    value={card.release}
                    releases={releases}
                    disabled={busy}
                    onChange={(v) => patchCard(card.id, { release: v })}
                  />
                </MetaItem>
              )}

              <MetaItem label={c.meta.priority}>
                <LevelSelect value={card.priority} disabled={busy} onChange={(v) => patchCard(card.id, { priority: v })} />
              </MetaItem>

              <MetaItem label={c.meta.roi}>
                <LevelSelect value={card.roi} disabled={busy} onChange={(v) => patchCard(card.id, { roi: v })} />
              </MetaItem>

              {total > 0 && (
                <MetaItem label={c.meta.todos}>
                  <TodoProgress done={done} total={total} width={90} />
                </MetaItem>
              )}

              {/* When this job last ran (#64) — recurring cards only, since it is the
                  one card that has a "last time". A card that has never run says so
                  in words rather than showing a dash: never run is a real state, and
                  the Run button beside it is what changes it. */}
              {card.recurring && (
                <MetaItem label={c.meta.lastRun}>
                  <span className="text-[12.5px] font-[700] tabular-nums text-nb-ink-soft">
                    {card.last_run || c.meta.neverRun}
                  </span>
                </MetaItem>
              )}

              {/* How often it repeats (#139), and when that lands next. Writing a
                  cadence is the opt-in to background runs: with one, the board
                  starts this job itself when it comes due; without one, only the
                  Run button above does. The next time is beside the last one
                  because the pair is the whole schedule — where it just was, and
                  where it goes next — and it is gone when there is no cadence to
                  work it out from. Both are the server's local time. */}
              {card.recurring && (
                <MetaItem label={c.meta.cadence}>
                  <CadenceSelect
                    value={card.cadence}
                    disabled={busy}
                    onChange={(v) => patchCard(card.id, { cadence: v })}
                  />
                </MetaItem>
              )}

              {card.recurring && card.nextRun && (
                <MetaItem label={c.meta.nextRun}>
                  <span className="text-[12.5px] font-[700] tabular-nums text-nb-ink-soft">
                    {card.nextRun}
                  </span>
                </MetaItem>
              )}

              {card.blocked_by.length > 0 && (
                <MetaItem label={c.meta.blockedBy}>
                  {card.blocked_by.map((n) => (
                    <Link
                      key={n}
                      href={`/${n}`}
                      className="nb-chip"
                      style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
                    >
                      #{n}
                    </Link>
                  ))}
                </MetaItem>
              )}

              {/* What is queued on this card, and the one control that takes it off (#140).
                  It sits beside "Blocked by" because the two are one sentence: what will
                  run, and what it is waiting for. Taking it off is a plain write — nothing
                  has started, so there is nothing to stop and nothing to undo. */}
              {card.schedule && (
                <MetaItem label={c.meta.scheduled}>
                  <span
                    className="nb-chip"
                    style={{
                      background: "var(--color-nb-peach-soft)",
                      color: "var(--color-nb-peach-ink)",
                    }}
                  >
                    {scheduleLabel(card)}
                  </span>
                  <button
                    type="button"
                    onClick={unschedule}
                    className="cursor-pointer text-[12px] font-[700] text-nb-ink-soft underline decoration-dotted underline-offset-2 hover:text-nb-ink"
                    title={c.meta.unscheduleHint}
                  >
                    {c.meta.unschedule}
                  </button>
                </MetaItem>
              )}

              {card.related.length > 0 && (
                <MetaItem label={c.meta.related}>
                  {card.related.map((n) => (
                    <Link
                      key={n}
                      href={`/${n}`}
                      className="nb-chip"
                      style={{
                        background: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)",
                        color: "var(--color-nb-ink-soft)",
                      }}
                    >
                      #{n}
                    </Link>
                  ))}
                </MetaItem>
              )}
            </div>

            {/* The group, in one section (#333): its build order drawn at the head, and the
                rows the drawing's ids stand for right under it. One heading covers both —
                the map has no words of its own, and the list is what reads them out. */}
            {card.subtasks && card.subtasks.length > 0 && (
              <div className="nb-section bg-nb-sheet p-3.5">
                <div className="nb-tag mb-2 w-full">
                  {c.subtasks.heading}
                  {/* What the chip under the cursor is. It replaces nothing and moves
                      nothing: the heading is one line whether it is here or not. */}
                  {mapTip && (
                    <span className="min-w-0 truncate text-[11.5px] font-[600] normal-case tracking-normal text-nb-ink-soft">
                      {mapTip}
                    </span>
                  )}
                </div>
                <SubtaskMap subtasks={card.subtasks} onHover={setMapTip} />
                <ul className="flex flex-col gap-1.5">
                  {card.subtasks.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/${s.id}`}
                        // A row darkens by a step of ink, the same hover every other
                        // pressable band on this page takes. Lightening it to paper was
                        // four units off the sheet under it — a change you had to look
                        // for — and it went cold against a warm ground while it was at it.
                        className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--color-nb-ink)_11%,transparent)]"
                      >
                        <span className="shrink-0 text-[12px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
                          #{s.id}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-[700] leading-snug">{s.title}</span>
                        {/* An agent is inside this subtask right now — the same
                            dot the rail and the board's badge use. A root is
                            where you watch a group being built, and its rows are
                            the only place here that name a card other than the
                            one on screen. */}
                        {running.has(s.id) && (
                          <>
                            <span className={PULSE_DOT} aria-hidden />
                            <span className="sr-only">{c.subtasks.running}</span>
                          </>
                        )}
                        {s.todos.total > 0 && <TodoProgress done={s.todos.done} total={s.todos.total} />}
                        <FiChevronRight className="shrink-0 text-[14px] text-nb-ink-soft" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* The questions, and the decision made in them — the panel is the control,
                so there is no dialog between reading one and answering it. */}
            <OpenQuestions
              card={card}
              open={deciding}
              onOpen={() => setDeciding(true)}
              onClose={closeDeciding}
              canDecide={actions.has("resolve") && !offUnlessAsked}
              disabledWhy={held ? heldWhy : busy && liveSession ? c.toolbar.alreadyRunning(t.runs.verb[liveSession.action]) : undefined}
              onRun={runAgent}
            />

              <CardBody
                body={card.body}
                title={card.title}
                cardId={card.id}
                mockups={mockups}
              />

              {/* Last on the page, under the body and its agent half: every line here is a
                  note on work already done, so it comes after what the card is. */}
              <HandChecks cardId={card.id} verify={card.verify} busy={busy} />
            </div>
          </main>

          {dialog && (
            <ActionDialog
              dialog={dialog}
              onClose={() => setDialog(null)}
              onRun={runAgent}
              onSchedule={scheduleAgent}
              onResolveFirst={() => {
                setDialog(null);
                setDeciding(true);
              }}
              plan={plan}
            />
          )}
        </div>
      </Window>
    </OpenIdsProvider>
  );
}
