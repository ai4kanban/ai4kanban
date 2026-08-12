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
  FiXCircle,
} from "react-icons/fi";
import { patchCardAction } from "@/app/actions";
import type { CardPatch } from "@/lib/edit";
import { NO_RELEASE, type AgentInfo, type Card, type SessionView } from "@/lib/types";
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
} from "./agent-shared";
import {
  CadenceSelect,
  LevelSelect,
  ModuleChip,
  QuestionTagBadge,
  ReleaseSelect,
  StatusPill,
  TodoProgress,
  TrackChip,
} from "./chips";
import { hasOptions, parseQuestion, type CardQuestion } from "@/lib/questions";
import { canRefine } from "@/lib/refine";
import { Markdown } from "./Markdown";
import { OpenIdsProvider } from "./open-ids";
import { Window } from "./Window";
import { latestSessionForCard, runningCardIds, runningSessionForCard, type StartedSession, useAgentSessions, useOnTabFocus, useSessionLog } from "./sessions";

const CAP = "text-[10px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft";

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
  else if (!allDone && !card.isGroup) buttons.add("implement"); // Implement — unless all todos are checked, and never on a group root
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
  autoRefine,
  autoRefineParallelism,
  goalWritten,
  desktop,
}: {
  card: Card;
  openIds: number[];
  releases: string[];
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
  autoRefineParallelism: number;
  /** Whether the header's goal button has anything to open (#128). The header is
   *  the same on both pages, and direction is worth rereading wherever you are. */
  goalWritten: boolean;
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

  const { sessions, start } = useAgentSessions(onFinish);

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

  // A live session on this card (from any tab) blocks a second one and shows a badge.
  const busy = runningCardIds(sessions).has(card.id);
  // The session itself, so the badge can name the action in flight (refining, etc.).
  const liveSession = runningSessionForCard(sessions, card.id);
  const { total, done } = card.todos;
  const actions = visibleActions(card);

  // Tail the newest session on this card: live while it runs, and re-openable once
  // it's done so the user can read back what the agent did (task #14).
  const latestSession = latestSessionForCard(sessions, card.id);
  const sessionLog = useSessionLog(latestSession?.sessionId ?? null);
  const [showLog, setShowLog] = useState(false);
  // A session just started on this card — open the log so the user watches it live.
  useEffect(() => {
    if (busy) setShowLog(true);
  }, [busy]);

  // Start a non-blocking session. The per-card lock refusal comes back as an error.
  const runAgent = async (req: AgentReq, label: string) => {
    setDialog(null);
    const removes = req.action === "reject" || req.action === "archive";
    const res = await start(req, label, removes);
    if (!res.ok) setError(res.error || "could not start the agent");
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
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            autoRefine={autoRefine}
            autoRefineParallelism={autoRefineParallelism}
            sessions={sessions}
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
                <RunningBadge label={liveSession ? `${RUNNING_VERB[liveSession.action]} this card…` : "working…"} />
              ) : (
                card.status !== "todo" && <StatusPill status={card.status} detailed />
              )}
            </div>

            {/* toolbar — the state machine (visibleActions) decides which buttons
                fit the card's state; busy still disables every one that shows. */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {actions.has("implement") && (
                <Button size="sm" disabled={busy} onClick={() => setDialog({ kind: "implement", card })}>
                  <FiPlay className="text-[15px]" aria-hidden />
                  Implement
                </Button>
              )}
              {/* Run (#64) — Implement's place on a recurring card. Same ember CTA:
                  it is the one thing you came to this card to do. */}
              {actions.has("run") && (
                <Button
                  size="sm"
                  disabled={busy}
                  title="Do one pass of this recurring task now"
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
                  disabled={busy}
                  title={
                    busy && liveSession
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
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDialog({ kind: "edit", card })}>
                  <FiEdit2 className="text-[15px]" aria-hidden />
                  Edit
                </Button>
              )}
              {actions.has("resolve") && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDialog({ kind: "resolve", card })}>
                  <FiHelpCircle className="text-[15px]" aria-hidden />
                  Resolve
                </Button>
              )}
              {actions.has("archive") && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDialog({ kind: "archive", card })}>
                  <FiArchive className="text-[15px]" aria-hidden />
                  Archive
                </Button>
              )}
              {actions.has("reject") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={busy}
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

            <div className="nb-panel-sm p-5">
              <Markdown body={card.body} />
            </div>
          </main>

          {dialog && <ActionDialog dialog={dialog} onClose={() => setDialog(null)} onRun={runAgent} />}
        </div>
      </Window>
    </OpenIdsProvider>
  );
}
