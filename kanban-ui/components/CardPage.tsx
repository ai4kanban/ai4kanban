"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiArchive,
  FiCheckCircle,
  FiCheckSquare,
  FiChevronRight,
  FiCircle,
  FiCornerLeftUp,
  FiEdit2,
  FiFeather,
  FiHelpCircle,
  FiPlay,
  FiSquare,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import {
  cancelDeliveryAction,
  dropVerifyAction,
  patchCardAction,
  scheduleCardAction,
  unscheduleCardAction,
} from "@/app/actions";

import {
  NO_RELEASE,
  type AgentInfo,
  type Card,
  type CardDelivery,
  type CardPatch,
  type MemoryModule,
  type ScheduledAction,
  type SessionView,
} from "@/lib/types";
import { Button } from "./button";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import {
  ActionDialog,
  type AgentReq,
  type DialogState,
  RUNNING_VERB,
  RunningBadge,
  SessionLog,
  stoppedShort,
} from "./agent-shared";
import {
  CadenceSelect,
  LevelSelect,
  ModuleChip,
  PendingPill,
  QuestionTagBadge,
  ReleaseSelect,
  StatusPill,
  TodoProgress,
  TrackChip,
} from "./chips";
import { PULSE_DOT } from "./chrome";
import type { MockupSet } from "@/lib/mockup-tag";
import { hasOptions, parseQuestion, type CardQuestion } from "@/lib/questions";
import type { BoardChange } from "@/lib/chat-rail";
import { canImplement, canRefine } from "@/lib/refine";
import { scheduleLabel } from "@/lib/schedule";
import { CardBody } from "./CardBody";
import { OpenIdsProvider } from "./open-ids";
import { Window } from "./Window";
import { latestSessionForCard, runningCardIds, runningSessionForCard, type StartedSession, useAgentSessions, useOnTabFocus, useSessionLog } from "./sessions";

const CAP = "text-[10px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft";

// How long a cross-off waits for its second click before going back to being an ✕. The
// same window the rail's Clear gives the conversation it is about to throw away.
const CONFIRM_MS = 4000;

// How long a refused hand-check edit says so. Long enough to read, and then gone — the
// panel it sits in has already redrawn to what the card holds, so leaving the line up
// would keep an empty panel on screen over news the user has taken in.
const NOTE_MS = 7000;

// ---- what the build left for you to check by hand (#231, #276) ---------------
//
// Its own panel, below the questions and never inside them: an open question waits on an
// answer and holds the card back, while every line here is a note on work that is already
// done. Sky rather than the accent for the same reason.
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
function HandChecks({
  cardId,
  verify,
  busy,
}: {
  cardId: number;
  verify: string[];
  busy: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState(verify);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

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
    settle(res, "could not cross that hand-check off");
  };

  // Nothing to check — no empty panel.
  if (lines.length === 0 && !note) return null;

  return (
    <div className="nb-outline mb-3 p-3" style={{ background: "var(--color-nb-sky-soft)" }}>
      <div className="nb-tag mb-2">
        <span style={{ color: "var(--color-nb-sky-ink)" }}>✓</span> check by hand
      </div>
      {lines.length > 0 && (
        <ul className="mb-1 flex flex-col gap-1 text-[13px] leading-[19px]">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-1.5">
              <span className="relative top-[7px] shrink-0 text-[5px]" aria-hidden>
                ●
              </span>
              <span className="min-w-0 flex-1">{line}</span>
              {!busy &&
                (confirming === line ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void crossOff(line)}
                    className="shrink-0 cursor-pointer rounded-[6px] px-1.5 py-0.5 text-[11px] font-[700] uppercase tracking-[0.04em]"
                    style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
                  >
                    Cross it off
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Cross off "${line}"`}
                    title="Cross this check off — it comes off the card"
                    disabled={saving}
                    onClick={() => setConfirming(line)}
                    className="nb-press shrink-0 rounded-[6px] px-1 py-0.5 text-nb-ink-soft hover:text-nb-peach-ink disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FiX className="text-[13px]" aria-hidden />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className="mb-1 text-[12px] leading-snug" style={{ color: "var(--color-nb-peach-ink)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

// The choices on an options question, read-only — the same list the Resolve
// dialog hands the user, shown here so the options can be read without opening
// the dialog. The recommended ones wear a filled marker and say so in words; the
// marker's SHAPE says how many may be picked (round = one, square = as many as
// you like), matching the radio / checkbox the dialog shows.
function QuestionOptions({ question }: { question: CardQuestion }) {
  const many = question.mode === "multi";
  const On = many ? FiCheckSquare : FiCheckCircle;
  const Off = many ? FiSquare : FiCircle;
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {(question.options ?? []).map((option, k) => {
        const recommended = (question.recommend ?? []).includes(k + 1);
        const Icon = recommended ? On : Off;
        return (
          <li
            key={k}
            className="flex items-baseline gap-1.5 text-[12.5px] leading-[18px]"
            style={{ color: recommended ? "var(--color-nb-accent-deep)" : undefined }}
          >
            <Icon
              aria-hidden
              className="relative top-[2px] shrink-0"
              style={{ width: 12, height: 12 }}
            />
            <span>
              {option}
              {recommended && (
                <span className="ml-1.5 text-[10.5px] font-[700] uppercase tracking-[0.04em]">
                  recommended
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
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
  const hasQuestions = card.questions.length > 0;
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
  // Refine (#99) — only when a refine would really move the card (canRefine): the
  // background dispatcher would arrive at a `ready` card, a finished one, or one
  // waiting on a `[user]` question and leave it exactly as it was, so a button
  // there would promise work that never happens. Being blocked is not a reason to
  // hide it — the dialog says so and runs anyway.
  if (canRefine(card)) buttons.add("refine");
  if (hasQuestions) buttons.add("resolve"); // Resolve — has open questions
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
// and each says why in the same words. What takes the card back is Cancel delivery, which
// stands where Implement did.
//
// The card page does NOT compare the live card against what the delivery captured. A hand
// edit in the user's own editor still reaches the file and changes nothing for the delivery
// — it is building from its copy — so the honest thing to say is what it IS building, which
// is what the held controls say, before the edit is made rather than after.
const heldNote = (delivery: CardDelivery): string =>
  delivery.waiting
    ? `Delivery ${delivery.id} has stopped and is waiting on you — ${delivery.waiting}. ` +
      `Answer the question it left, then Review again. Cancel delivery to take the card back.`
    : `Delivery ${delivery.id} is in progress — it is building this card as it was approved when it started. ` +
      `Cancel delivery to take the card back.`;

// The card's one mark while a delivery holds it and nothing is running inside it — its
// last session failed or was cut off, and the job is still open. Ember, like the running
// badge, because the job is still in flight; no pulse, because nothing is working.
function DeliveryPill({ label, tone }: { label: string; tone: "live" | "ended" }) {
  const live = tone === "live";
  return (
    <span
      className="nb-chip nb-tip"
      tabIndex={0}
      data-tip={label}
      style={{
        background: live ? "var(--color-nb-accent-soft)" : "var(--color-nb-sky-soft)",
        color: live ? "var(--color-nb-accent-deep)" : "var(--color-nb-sky-ink)",
      }}
    >
      {label}
    </span>
  );
}

// Cancel delivery: Implement's place while one is in flight. It stops the running session,
// ends the delivery as cancelled, unlocks the card and brings Implement back — so it asks
// for a second click first, the same confirm a cross-off asks for. Whatever the delivery
// wrote is left where it is.
function CancelDelivery({
  delivery,
  onCancelled,
  onError,
}: {
  delivery: CardDelivery;
  onCancelled: () => void;
  onError: (why: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const cancel = async () => {
    setConfirming(false);
    setBusy(true);
    const res = await cancelDeliveryAction(delivery.id);
    setBusy(false);
    if (!res.ok) onError(res.error || "could not cancel the delivery");
    else onCancelled();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      title={`Delivery ${delivery.id} — end it, stop what it is running, and take the card back. What it has written stays.`}
      style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}
      onClick={() => (confirming ? void cancel() : setConfirming(true))}
    >
      <FiXCircle className="text-[15px]" aria-hidden />
      {confirming ? "Cancel it — the card comes back" : "Cancel delivery"}
    </Button>
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
  /** Whether this board is running inside the desktop app (#175). The header and
   *  the running notice are the same on both pages, so this is too. */
  desktop: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);

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
  const refresh = useCallback(() => router.refresh(), [router]);
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
  const heldWhy = delivery ? heldNote(delivery) : "";
  // A delivery whose review stopped is waiting on the question it left here (#302).
  // Answering is the way on, so Resolve stays live while every other held control is off —
  // the same one exception the CLI makes.
  const waiting = delivery?.waiting;
  // The session this delivery would start if you asked it to: another review once its
  // question is answered, or the one its watcher died before starting.
  const carryOn = waiting ? "review" : delivery?.next;
  // One test for every control the hold covers: a session on this card, or a delivery on it.
  const off = busy || held;
  const offUnlessAsked = busy || (held && !waiting);
  const { total, done } = card.todos;
  const actions = visibleActions(card);

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
  const runAgent = async (req: AgentReq, label: string) => {
    setDialog(null);
    const removes = req.action === "reject" || req.action === "archive";
    const res = await start(req, label, removes);
    if (!res.ok) setError(res.error || "could not start the agent");
  };

  // Queue an action on this card instead of starting it (#140). The card keeps its stage and
  // its place on the board; what changes is that the server starts this run by itself once
  // the last card in its way has gone. Nothing spawns here, so the dialog closes on a plain
  // re-read rather than on a session to watch.
  const scheduleAgent = async (action: ScheduledAction, notes: string) => {
    setDialog(null);
    const res = await scheduleCardAction(card.id, action, notes);
    if (!res.ok) setError(res.error || "could not schedule the action");
    else router.refresh();
  };

  const unschedule = async () => {
    const res = await unscheduleCardAction(card.id);
    if (!res.ok) setError(res.error || "could not take the schedule off");
    else router.refresh();
  };

  const patchCard = async (id: number, patch: CardPatch) => {
    try {
      const res = await patchCardAction(id, patch);
      if (!res.ok) {
        setError(res.error || "edit failed");
        return false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
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
        <div className="h-full overflow-y-auto">
          {/* Same line as the board's (#175) — a newer app in the app, a pointer
              to the app in a browser. */}
          <RunningNotice desktop={desktop} />

          <main className="mx-auto w-full max-w-[840px] px-6 py-6">
            {error && (
              <div className="nb-panel-sm mb-4 p-3 text-[13px]" style={{ background: "var(--color-nb-peach-soft)" }}>
                {error}
              </div>
            )}

            {/* part of a group — link up to the tracking root */}
            {card.parent && (
              <Link
                href={`/${card.parent.id}`}
                className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-accent-deep"
              >
                <FiCornerLeftUp className="text-[13px]" aria-hidden />
                Part of #{card.parent.id} {card.parent.title}
              </Link>
            )}

            {/* title band — the card's one mark rides beside the title: a live
                session's badge while busy, otherwise the saved stage (nothing while
                `todo`). Never both. */}
            <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <span className="shrink-0 text-[20px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
                #{card.id}
              </span>
              <h1 className="text-[20px] font-[800] tracking-[-0.02em] leading-tight">{card.title}</h1>
              {busy ? (
                <RunningBadge
                  label={
                    liveSession
                      ? `${RUNNING_VERB[liveSession.action]} this card${delivery ? ` — delivery ${delivery.id}` : ""}…`
                      : "working…"
                  }
                />
              ) : delivery ? (
                // A delivery whose session ended without finishing. It still holds the
                // card, and Resume or Cancel delivery is what moves it on — unless its
                // review stopped, in which case the move is to answer its question.
                <DeliveryPill
                  label={waiting ? `delivery ${delivery.id} waiting on you` : `delivery ${delivery.id} in progress`}
                  tone="live"
                />
              ) : cancelled ? (
                // The last delivery on this card was cancelled. The card is free again, and
                // saying "stopped" here would name the session and hide what happened.
                <DeliveryPill label="delivery cancelled" tone="ended" />
              ) : card.schedule ? (
                // Waiting on its blockers, with a run already queued (#140) — the mark
                // stands in for the stage, and says what will run and what it waits for.
                <PendingPill label={scheduleLabel(card)} detailed />
              ) : (
                card.status !== "todo" && <StatusPill status={card.status} detailed />
              )}
            </div>

            {/* toolbar — the state machine (visibleActions) decides which buttons
                fit the card's state; busy still disables every one that shows. */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {/* Implement, or — while a delivery is in flight — Cancel delivery in its
                  place. Never both: one starts the job, the other ends it. */}
              {delivery ? (
                <CancelDelivery
                  delivery={delivery}
                  onCancelled={() => {
                    router.refresh();
                    kick();
                  }}
                  onError={setError}
                />
              ) : (
                actions.has("implement") && (
                  <Button size="sm" disabled={busy} onClick={() => setDialog({ kind: "implement", card })}>
                    <FiPlay className="text-[15px]" aria-hidden />
                    Implement
                  </Button>
                )
              )}
              {/* Run (#64) — Implement's place on a recurring card. Same ember CTA:
                  it is the one thing you came to this card to do. */}
              {actions.has("run") && (
                <Button
                  size="sm"
                  disabled={off}
                  title={held ? heldWhy : "Do one pass of this recurring task now"}
                  onClick={() => setDialog({ kind: "run", card })}
                >
                  <FiPlay className="text-[15px]" aria-hidden />
                  Run
                </Button>
              )}
              {/* Refine — the same run the board makes on its own, on demand. While
                  another run holds this card it's disabled like every other button,
                  and its tooltip names what that run is doing, so a second refine is
                  never a click away. (The server refuses one anyway — the poll behind
                  `busy` can be a second and a half old.) */}
              {actions.has("refine") && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={off}
                  title={
                    held
                      ? heldWhy
                      : busy && liveSession
                        ? `Already ${RUNNING_VERB[liveSession.action]} this card`
                        : "Take this card's plan one step forward now"
                  }
                  onClick={() => setDialog({ kind: "refine", card })}
                >
                  <FiFeather className="text-[15px]" aria-hidden />
                  Refine
                </Button>
              )}
              {actions.has("edit") && (
                <Button variant="ghost" size="sm" disabled={off} title={held ? heldWhy : undefined} onClick={() => setDialog({ kind: "edit", card })}>
                  <FiEdit2 className="text-[15px]" aria-hidden />
                  Edit
                </Button>
              )}
              {actions.has("resolve") && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={offUnlessAsked}
                  title={held ? heldWhy : undefined}
                  onClick={() => setDialog({ kind: "resolve", card })}
                >
                  <FiHelpCircle className="text-[15px]" aria-hidden />
                  Resolve
                </Button>
              )}
              {/* Review again / Continue delivery (#302). The first is offered while a
                  delivery is waiting on the question its review left — answer it, or write
                  the exception you are approving under ## Worth noting after
                  implementation, and this judges the same work afresh. The second is the
                  way back for a delivery whose next session never started because the
                  process watching it died. */}
              {carryOn && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  title={
                    waiting
                      ? "Judge what this delivery built again, now that you have answered"
                      : `This delivery never started its ${carryOn} session — start it now`
                  }
                  onClick={() => void runAgent({ action: carryOn, id: card.id }, carryOn)}
                >
                  <FiCheckCircle className="text-[15px]" aria-hidden />
                  {waiting ? "Review again" : "Continue delivery"}
                </Button>
              )}
              {actions.has("archive") && (
                <Button variant="ghost" size="sm" disabled={off} title={held ? heldWhy : undefined} onClick={() => setDialog({ kind: "archive", card })}>
                  <FiArchive className="text-[15px]" aria-hidden />
                  Archive
                </Button>
              )}
              {actions.has("reject") && (
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
                  Reject
                </Button>
              )}
            </div>

            {/* Session log: the live tail while an agent works, and a re-openable view
                of the last session's output afterwards. The full log stays in its file. */}
            {latestSession && (
              <div className="mb-4">
                <SessionLog
                  session={sessionLog}
                  collapsed={!busy && !showLog}
                  onToggle={busy ? undefined : () => setShowLog((v) => !v)}
                  warnUnfinished
                  onResumed={onResumed}
                />
              </div>
            )}

            {/* meta box — stacked label/value columns in a flat outlined band; no
                shadow, so it reads subordinate to the content panel below */}
            <div className="nb-outline mb-4 flex flex-wrap items-start gap-x-7 gap-y-3 bg-nb-paper px-4 py-3">
              <MetaItem label="Track">
                <TrackChip track={card.track} />
              </MetaItem>

              {card.modules.length > 0 && (
                <MetaItem label="Modules">
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
                <MetaItem label="Release">
                  <ReleaseSelect
                    value={card.release}
                    releases={releases}
                    disabled={busy}
                    onChange={(v) => patchCard(card.id, { release: v })}
                  />
                </MetaItem>
              )}

              <MetaItem label="Priority">
                <LevelSelect value={card.priority} disabled={busy} onChange={(v) => patchCard(card.id, { priority: v })} />
              </MetaItem>

              <MetaItem label="ROI">
                <LevelSelect value={card.roi} disabled={busy} onChange={(v) => patchCard(card.id, { roi: v })} />
              </MetaItem>

              {total > 0 && (
                <MetaItem label="Todos">
                  <TodoProgress done={done} total={total} width={90} />
                </MetaItem>
              )}

              {/* When this job last ran (#64) — recurring cards only, since it is the
                  one card that has a "last time". A card that has never run says so
                  in words rather than showing a dash: never run is a real state, and
                  the Run button beside it is what changes it. */}
              {card.recurring && (
                <MetaItem label="Last run">
                  <span className="text-[12.5px] font-[700] tabular-nums text-nb-ink-soft">
                    {card.last_run || "Never run"}
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
                <MetaItem label="Cadence">
                  <CadenceSelect
                    value={card.cadence}
                    disabled={busy}
                    onChange={(v) => patchCard(card.id, { cadence: v })}
                  />
                </MetaItem>
              )}

              {card.recurring && card.nextRun && (
                <MetaItem label="Next run">
                  <span className="text-[12.5px] font-[700] tabular-nums text-nb-ink-soft">
                    {card.nextRun}
                  </span>
                </MetaItem>
              )}

              {card.blocked_by.length > 0 && (
                <MetaItem label="Blocked by">
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
                <MetaItem label="Scheduled">
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
                    title="Take the schedule off — nothing will start on its own"
                  >
                    take it off
                  </button>
                </MetaItem>
              )}

              {card.related.length > 0 && (
                <MetaItem label="Related">
                  {card.related.map((n) => (
                    <Link
                      key={n}
                      href={`/${n}`}
                      className="nb-chip"
                      style={{ background: "var(--color-nb-wash)", color: "var(--color-nb-ink-soft)" }}
                    >
                      #{n}
                    </Link>
                  ))}
                </MetaItem>
              )}
            </div>

            {card.subtasks && card.subtasks.length > 0 && (
              <div className="nb-outline mb-4 bg-nb-paper p-3">
                <div className="nb-tag mb-2">
                  <span style={{ color: "var(--color-nb-accent)" }}>●</span>
                  subtasks
                </div>
                <ul className="flex flex-col gap-1.5">
                  {card.subtasks.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/${s.id}`}
                        className="nb-press flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-nb-wash"
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
                            <span className="sr-only">running</span>
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

            {card.questions.length > 0 && (
              <div className="nb-outline mb-3 p-3" style={{ background: "var(--color-nb-accent-soft)" }}>
                <div className="nb-tag mb-2">
                  <span style={{ color: "var(--color-nb-accent)" }}>?</span> open questions
                </div>
                {/* The marker leads the question inline rather than sitting in its own
                    column: questions here run several lines, and a marker column holds
                    that width open for all of them — a blank gutter beside every line
                    but the first. Inline, the text wraps back under the marker. */}
                <ul className="flex flex-col gap-2.5 text-[13px] leading-[19px]">
                  {card.questions.map((q, i) => {
                    const { tag, text } = parseQuestion(q.text);
                    return (
                      <li key={i}>
                        <QuestionTagBadge tag={tag} />
                        {text}
                        {hasOptions(q) && <QuestionOptions question={q} />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <HandChecks cardId={card.id} verify={card.verify} busy={busy} />

            <CardBody
              body={card.body}
              title={card.title}
              cardId={card.id}
              mockups={mockups}
            />
          </main>

          {dialog && (
            <ActionDialog
              dialog={dialog}
              onClose={() => setDialog(null)}
              onRun={runAgent}
              onSchedule={scheduleAgent}
            />
          )}
        </div>
      </Window>
    </OpenIdsProvider>
  );
}
