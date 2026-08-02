"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createReleaseAction, dropReleaseAction, getBoard } from "@/app/actions";
import { filterColumns, pickIsEmpty, useReleasePick } from "@/lib/release-pick";
import type { AgentInfo, Board } from "@/lib/types";
import { useBoardView } from "@/lib/view";
import { BoardCard } from "./BoardCard";
import { Header } from "./Header";
import { SetupBar } from "./SetupBar";
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
  setupInstruction,
}: {
  initialBoard: Board | null;
  initialError: string | null;
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
  autoRefineParallelism: number;
  /** The line the setup bar hands over for the coding harness. It comes from the
   *  server (lib/agent.ts reads the filesystem, which a client can't import). */
  setupInstruction: string;
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
  // Which release both views show (#104). Remembered per project like the view
  // above; All releases is the default and the whole board.
  const [release, setRelease] = useReleasePick(projectRoot, board?.releases ?? []);
  // The same set of cards for both layouts — the columns filtered once here, so
  // the kanban columns and the queue's halves can never disagree about what the
  // pick hides.
  const columns = useMemo(
    () => filterColumns(board?.columns ?? [], release),
    [board, release],
  );
  const emptyRelease = pickIsEmpty(columns, release);

  const refresh = useCallback(async () => {
    try {
      setBoard(await getBoard());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Start a release from the header (#115). The board is re-read before the pick
  // moves, so the new release is on the list the pick is checked against — a pick
  // the list doesn't hold yet would be dropped back to All releases in the same
  // render. Then the board switches to it: the user asked for this version to
  // work in it, and a card made while it is picked lands in it. It is empty, so
  // the "has no open cards" note is what greets them, with the way back on it.
  const makeRelease = useCallback(
    async (id: string, fill: boolean) => {
      const res = await createReleaseAction(id, fill);
      if (!res.ok) return res;
      await refresh();
      setRelease(id);
      return res;
    },
    [refresh, setRelease],
  );

  // Give up on a release from the header (#131). The pick moves back to All
  // releases first — the release is about to be gone, and the fallback in
  // useReleasePick would land there anyway, this just skips the frame where a
  // dead version is picked. Then the board is re-read: its cards have no
  // release and the version is off the list.
  const dropRelease = useCallback(
    async (id: string) => {
      const res = await dropReleaseAction(id);
      if (!res.ok) return res;
      setRelease(null);
      await refresh();
      return res;
    },
    [refresh, setRelease],
  );

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
        releases={board?.releases ?? []}
        releaseCounts={board?.releaseCounts ?? {}}
        release={release}
        onReleaseChange={setRelease}
        onCreateRelease={makeRelease}
        onDropRelease={dropRelease}
        // A card written while a version is on screen ships in that version.
        createRelease={release}
        goalWritten={board?.goalWritten ?? false}
      />

      {error && (
        <div className="mx-6 mt-4 nb-panel-sm p-3 text-[13px]" style={{ background: "var(--color-nb-peach-soft)" }}>
          {error}
        </div>
      )}

      {/* Unfinished setup (#85), else the goal nudge (#53) when the agent has
          judged goal.md weak again. Both drop out with the next board refresh —
          the same refresh that already runs on session finish and tab focus — so
          the bar moves on its own as setup's boxes tick. */}
      {board && (
        <SetupBar
          setup={board.setup}
          goalWeak={board.goalWeak}
          setupInstruction={setupInstruction}
          onSaved={refresh}
        />
      )}

      {!board && !error && (
        <div className="p-10 text-nb-ink-soft">Reading the board…</div>
      )}

      {/* A filter that can empty the screen has to explain itself, or the user
          reads it as a broken board and goes looking for their cards. Above both
          views, so it says the same thing in either one, with the way back one
          click away. Blockers on screen don't make the release non-empty — a
          blocker belongs to whoever it blocks. */}
      {board && emptyRelease && (
        <div className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6" style={{ background: "var(--color-nb-sky-soft)" }}>
          <strong>{release}</strong> has no open cards.{" "}
          <button
            type="button"
            className="cursor-pointer underline underline-offset-2 hover:text-nb-accent-deep"
            onClick={() => setRelease(null)}
          >
            Show all releases
          </button>
          .
        </div>
      )}

      {board && view === "queue" && (
        <QueueView
          columns={columns}
          sessions={sessions}
          onOpenLog={setLogSessionId}
        />
      )}

      {board && view === "kanban" && (
        <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto p-6">
          {columns.map((col) => (
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
