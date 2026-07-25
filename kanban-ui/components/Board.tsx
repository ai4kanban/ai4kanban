"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiHelpCircle } from "react-icons/fi";
import { getBoard } from "@/app/actions";
import type { AgentInfo, Board } from "@/lib/types";
import { Header } from "./Header";
import { RUNNING_VERB, RunningBadge, SessionLogOverlay } from "./agent-shared";
import { GroupChip, PriorityChip, RoiTag, StatusPill, TodoProgress } from "./chips";
import { parseQuestion } from "@/lib/questions";
import { runningSessionForCard, useAgentSessions, useOnTabFocus, useSessionLog } from "./sessions";

export function BoardView({
  initialBoard,
  initialError,
  agent,
  projectRoot,
  autoRefine,
}: {
  initialBoard: Board | null;
  initialError: string | null;
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
}) {
  const [board, setBoard] = useState<Board | null>(initialBoard);
  const [error, setError] = useState<string | null>(initialError);
  // The session whose log is open in the overlay, opened by clicking a card's
  // running badge. The board has no inline session log of its own.
  const [logSessionId, setLogSessionId] = useState<string | null>(null);
  const openLog = useSessionLog(logSessionId);

  const refresh = useCallback(async () => {
    try {
      setBoard(await getBoard());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // The board starts no sessions itself (Create task lives in the header,
  // per-card actions on the card page), so it only reads the registry — for the
  // per-card running badges and to refresh when any session finishes.
  const { sessions } = useAgentSessions(() => {});

  // Re-read the board whenever any session finishes (from this tab or another),
  // so created/archived/rejected cards appear or disappear without a manual reload.
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);

  // On tab focus, re-read the board once, unconditionally. A hidden tab stops
  // polling, so a session that both started and finished while it was hidden
  // leaves the running-set diff above with nothing to witness. A fresh read on
  // focus is always correct regardless of what the diff saw.
  useOnTabFocus(refresh);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-nb-cream">
      <Header agent={agent} projectRoot={projectRoot} autoRefine={autoRefine} onError={setError} />

      {error && (
        <div className="mx-6 mt-4 nb-panel-sm p-3 text-[13px]" style={{ background: "var(--color-nb-peach-soft)" }}>
          {error}
        </div>
      )}

      {!board && !error && (
        <div className="p-10 text-nb-ink-soft">Reading the board…</div>
      )}

      {board && (
        <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto p-6">
          {board.columns.map((col) => (
            <section
              key={col.track}
              className="flex w-[300px] shrink-0 flex-col rounded-[14px] p-3"
              style={{ background: "var(--color-nb-wash)" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="nb-tag">
                  <span style={{ color: "var(--color-nb-accent)" }}>●</span>
                  {col.title}
                </h2>
                <span className="text-[12px] text-nb-ink-soft">{col.cards.length}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden pl-px pr-1 pt-px pb-1">
                {col.cards.length === 0 && (
                  <p className="text-[12px] italic text-nb-ink-soft">no open cards</p>
                )}
                {col.cards.map((card) => {
                  // A group root's progress comes from its own todo checklist, not
                  // from counting subtask files: a finished subtask gets archived
                  // and its file removed, so the files on disk only cover the OPEN
                  // subtasks and would undercount done work. The root's `## Todo`
                  // stays accurate across archives, so it drives the bar.
                  // Group-ness is the reader's flag (the folder has a root.md),
                  // not a subtask count — the count drops to zero once every
                  // subtask is finished, and the chip would vanish right then.
                  const isGroup = card.isGroup;
                  // The one live session on this card (any tab), if any. It drives
                  // the action-named badge that stands in for the saved-stage pill.
                  const liveSession = runningSessionForCard(sessions, card.id);
                  return (
                  <Link
                    key={card.id}
                    href={`/${card.id}`}
                    className="nb-panel-sm nb-press block cursor-pointer p-3.5 text-left"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
                        #{card.id}
                      </span>
                      <span className="flex items-center gap-2">
                        {isGroup && <GroupChip />}
                        {liveSession ? (
                          <RunningBadge
                            label={RUNNING_VERB[liveSession.action]}
                            onClick={(e) => {
                              // The card is a link; keep the click on the badge.
                              e.preventDefault();
                              e.stopPropagation();
                              setLogSessionId(liveSession.sessionId);
                            }}
                          />
                        ) : (
                          <StatusPill status={card.status} />
                        )}
                        {card.questions.length > 0 &&
                          (() => {
                            const total = card.questions.length;
                            const userCount = card.questions.filter(
                              (q) => parseQuestion(q).tag === "user",
                            ).length;
                            // A `[user]` question waits on the human (accent); the
                            // rest auto-refine still works on its own (quieter).
                            const tip =
                              `${total} open question${total === 1 ? "" : "s"}` +
                              (userCount > 0
                                ? ` · ${userCount} need${userCount === 1 ? "s" : ""} you`
                                : "");
                            return (
                              <span
                                tabIndex={0}
                                className="nb-tip inline-flex"
                                data-tip={tip}
                                style={{
                                  color:
                                    userCount > 0
                                      ? "var(--color-nb-accent)"
                                      : "var(--color-nb-ink-soft)",
                                }}
                              >
                                <FiHelpCircle aria-hidden style={{ width: 14, height: 14 }} />
                              </span>
                            );
                          })()}
                        {card.todos.total > 0 && (
                          <TodoProgress done={card.todos.done} total={card.todos.total} />
                        )}
                      </span>
                    </div>
                    <p className="mb-3 text-[14px] font-[700] leading-snug tracking-[-0.01em]">
                      {card.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <PriorityChip value={card.priority} />
                      <RoiTag value={card.roi} />
                    </div>
                  </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {logSessionId && <SessionLogOverlay session={openLog} onClose={() => setLogSessionId(null)} />}
    </div>
  );
}
