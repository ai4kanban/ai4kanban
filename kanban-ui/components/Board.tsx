"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBoard } from "@/app/actions";
import type { AgentInfo, Board } from "@/lib/types";
import { useBoardView } from "@/lib/view";
import { BoardCard } from "./BoardCard";
import { GoalBar } from "./GoalBar";
import { Header } from "./Header";
import { QueueView } from "./Queue";
import { SessionLogOverlay } from "./agent-shared";
import { runningSessionForCard, useAgentSessions, useOnTabFocus, useSessionLog } from "./sessions";

export function BoardView({
  initialBoard,
  initialError,
  agent,
  projectRoot,
  autoRefine,
  autoRefineParallelism,
}: {
  initialBoard: Board | null;
  initialError: string | null;
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
  autoRefineParallelism: number;
}) {
  const [board, setBoard] = useState<Board | null>(initialBoard);
  const [error, setError] = useState<string | null>(initialError);
  // The session whose log is open in the overlay, opened by clicking a card's
  // running badge. The board has no inline session log of its own.
  const [logSessionId, setLogSessionId] = useState<string | null>(null);
  const openLog = useSessionLog(logSessionId);
  // Kanban columns or the queue's two halves (#70). Remembered per project in
  // the browser, so the board opens the way you left it.
  const [view, setView] = useBoardView(projectRoot);

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
      <Header
        agent={agent}
        projectRoot={projectRoot}
        autoRefine={autoRefine}
        autoRefineParallelism={autoRefineParallelism}
        sessions={sessions}
        onError={setError}
        view={view}
        onViewChange={setView}
      />

      {error && (
        <div className="mx-6 mt-4 nb-panel-sm p-3 text-[13px]" style={{ background: "var(--color-nb-peach-soft)" }}>
          {error}
        </div>
      )}

      {/* The goal nudge (#53), keyed to the agent's judgment of goal.md. It
          drops out with the next board refresh once the value turns strong —
          the same refresh that already runs on session finish and tab focus. */}
      {board?.goalWeak && <GoalBar onSaved={refresh} />}

      {!board && !error && (
        <div className="p-10 text-nb-ink-soft">Reading the board…</div>
      )}

      {board && view === "queue" && (
        <QueueView board={board} sessions={sessions} onOpenLog={setLogSessionId} />
      )}

      {board && view === "kanban" && (
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
                {col.cards.map((card) => (
                  <BoardCard
                    key={card.id}
                    card={card}
                    // The one live session on this card (any tab), if any. It
                    // drives the action-named badge that stands in for the
                    // saved-stage pill.
                    liveSession={runningSessionForCard(sessions, card.id)}
                    onOpenLog={setLogSessionId}
                    // No track chip here — the column heading above already
                    // says which track this card is in.
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {logSessionId && (
        <SessionLogOverlay
          session={openLog}
          onClose={() => setLogSessionId(null)}
          // Resuming swaps the overlay onto the run that continues the failed
          // one, so the tail keeps playing instead of freezing on the dead log.
          onResumed={setLogSessionId}
        />
      )}
    </div>
  );
}
