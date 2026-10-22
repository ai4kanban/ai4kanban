"use client";

import { BoardRefreshContext } from "@/lib/board-refresh";

// The board screen: the columns, and the bands above and below them.
//
// It draws from one read (`BoardScreen`, lib/format/board/screen.ts) and acts through one
// passed-in client (`ScreenActions`, lib/screen.ts). Nothing here reaches a filesystem, git
// or the coding agent, and nothing here imports the app's own window — so the same screen is
// served by the machine holding `docs/kanban/` and by something else entirely (#374).
//
// What the app puts around it arrives as two components:
//
//   shell    drawn AROUND the screen — the app's window and top row. It may also draw
//            something else entirely instead of the board, which is how the guided first run
//            takes the whole screen.
//   strips   the app's own bands, drawn INSIDE the body at the two places they belong:
//            `head` above everything, `foot` under the columns. They are the app's because
//            each one leads somewhere only this machine has — the download page, the setup
//            run.
//
// A caller that passes neither gets the board and nothing else. A caller that passes no
// actions gets the same board, read-only: every control that would write is gone rather
// than dead.

import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCopy } from "@/i18n/use-copy";
import { createSheet } from "@/lib/create-open";
import { NewCardsContext, newCards, useNewCards } from "@/lib/new-cards";
import { useActions, type StripPlace } from "@/lib/screen";
import type { BoardScreen, SessionView } from "@/lib/types";
import { BoardCheer } from "./Cheer";
import { OpenIdsProvider } from "./open-ids";
import { TourOnFirstOpen } from "./WelcomeTour";
import { EmptyBoard, QueueView } from "./Queue";
import { setupFailure, type SetupFailure } from "./agent-shared";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";

/** Everything the board screen knows that something drawn around it needs. The app's window
 *  hands most of it to its top row; a caller with a different frame takes what it wants. */
export interface BoardChrome {
  /** The board as it now reads — the server's first paint until a write re-reads it. */
  screen: BoardScreen;
  /** Say something across the top of the board — where a save from the chrome reports. */
  onError: (message: string | null) => void;
  /** Every run this board can see, and the cards an agent is inside right now. */
  sessions: SessionView[];
  running: Set<number>;
  /** The setup run going right now, from this tab or another (#173), and the newest one
   *  when it stopped short and none has been started since (#230). */
  setupRunId: string | null;
  failedSetup: SetupFailure | null;
  /** Read the board again — what every write here already does for itself. */
  refresh: () => Promise<void>;
  /** Wake the runs poll, and take on a run this tab caused but did not start. */
  kick: () => void;
  watch: (sessionId: string, label: string) => void;
}

export type BoardShell = ComponentType<BoardChrome & { children: ReactNode }>;
export type BoardStrips = ComponentType<BoardChrome & { at: StripPlace }>;

/** No frame at all: the board draws itself and nothing around it. */
const Bare: BoardShell = ({ children }) => <>{children}</>;

export function Board({
  screen: first,
  shell,
  strips,
  tour,
}: {
  /** The one read this screen draws from — the server's, for the first paint. */
  screen: BoardScreen;
  shell?: BoardShell;
  strips?: BoardStrips;
  /** Whether the welcome tour is owed and how its close is kept (#1500). Left out, the
   *  browser keeps it. */
  tour?: { owed: boolean; record: () => void };
}) {
  const c = useCopy().board;
  const actions = useActions();
  const [screen, setScreen] = useState<BoardScreen>(first);
  const board = screen.board;
  // Whatever the last read, or a control in the chrome, had to say. It starts as the read's
  // own reason and moves with every re-read.
  const [error, setError] = useState<string | null>(first.error);
  const columns = board?.columns ?? [];
  // Nothing on the board at all (#437): setup finished without writing a seed card, or every
  // card has been archived. Not while setup is still running — the run is writing them, and
  // the strip under the columns already says so.
  const noCards = Boolean(board) && !board?.setup && !columns.some((col) => col.cards.length > 0);
  const fresh = useNewCards(screen.id);
  useEffect(() => {
    if (board) newCards.keep(screen.id, new Set(board.columns.flatMap((col) => col.cards.map((card) => card.id))));
  }, [board, screen.id]);

  // The board comes back with its reason attached rather than thrown (#169): a board whose
  // copy of the rules is missing or too old can't be read at all, and a thrown error from a
  // server action reaches the browser redacted — "an error occurred" is exactly the empty
  // answer the strip is here to avoid. The last board that DID read stays on screen under
  // the message, so a rules folder deleted mid-session doesn't blank the page.
  const refresh = useCallback(async () => {
    if (!actions) return;
    try {
      const next = await actions.readBoard();
      setScreen((was) => (next.board ? next : { ...next, board: was.board }));
      setError(next.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [actions]);

  // The board starts no sessions itself (Create task lives in the header, per-card actions
  // on the card page), so it only reads the registry — for the per-card running badges, and
  // to refresh when any session finishes.
  const { sessions, watch, kick } = useAgentSessions(() => {});

  // Finishing setup (#173) — the run the app's own strips start. It is one run at a time
  // across the whole board, so the live one is looked up from the shared poll rather than
  // remembered anywhere: a run started in another tab, or from a terminal, holds the offer
  // down in this one too.
  const setupRun = sessions.find((r) => r.status === "running" && r.action === "setup");
  const setupRunId = setupRun?.sessionId ?? null;
  // …and the newest setup run when it stopped short (#230), so the strip and the
  // guided run's closing screen say a run was tried and died instead of falling
  // silently back to the offer.
  const failedSetup = useMemo(() => setupFailure(sessions), [sessions]);

  // A setup run writes the board as it goes — a box ticked, the module map, the
  // first cards — so while one is going the board is re-read on every poll rather
  // than only when the run ends. That is what keeps the progress bar moving under
  // it. Nothing else polls the board this way, and nothing needs to: every other
  // run's work shows up on a card, which the finish below already catches.
  useEffect(() => {
    if (setupRunId) refresh();
  }, [sessions, setupRunId, refresh]);

  // Re-read the board whenever any session finishes (from this tab or another),
  // so created/archived/rejected cards appear or disappear without a manual
  // reload.
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

  const chrome: BoardChrome = {
    screen,
    onError: setError,
    sessions,
    running: runningCardIds(sessions),
    setupRunId,
    failedSetup,
    refresh,
    kick,
    watch,
  };
  const Shell = shell ?? Bare;
  const Strip = strips;
  const state = screen.standing;

  return (
    <BoardRefreshContext.Provider value={refresh}><OpenIdsProvider ids={board?.openIds ?? []}><NewCardsContext.Provider value={fresh}>
      <Shell {...chrome}>
        {/* Inside the shell, so the usage disclosure and the guided run, drawn instead of
            the board, come first; and not while setup is still unfinished. */}
        {board && !board.setup && <TourOnFirstOpen owed={tour?.owed} record={tour?.record} />}
        <div className="relative flex h-full flex-col overflow-hidden">
          {/* The app's own band about how this board is being run (#175). Above the error
              strip because it is about the whole session, not this action. */}
          {Strip && <Strip {...chrome} at="head" />}

          {/* Cloud out of reach (#316). Above the error strip and separate from it: the
              board on screen is real, it is simply the copy — and a save is what says no. */}
          {state.offline && (
            <div className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6" style={{ background: "var(--color-nb-sky-soft)" }}>
              {state.readWhen ? c.notice.offline(state.readWhen) : c.notice.offlineNeverRead}
            </div>
          )}

          {error && (
            <div className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6" style={{ background: "var(--color-nb-peach-soft)" }}>
              {error}
            </div>
          )}

          {!board && !error && (
            <div className="p-10 text-nb-ink-soft">{c.reading}</div>
          )}

          {board && noCards ? (
            // The offer only where a card can actually be written: a read-only caller has
            // nothing to open. The ask goes to the header's own create control.
            <EmptyBoard onCreate={actions ? () => createSheet.open() : undefined} />
          ) : board ? (
            <QueueView columns={columns} sessions={sessions} />
          ) : null}

          {/* Setup left unfinished (#172, #173) — the app's own strip, under the columns
              rather than over them: the cards are what the board is for, and a strip this
              wide at the top pushes them off the first screen. Outside the scrolling row,
              so it stays put as the columns move. */}
          {Strip && board?.setup && <Strip {...chrome} at="foot" />}

          <BoardCheer boardId={screen.id} sessions={sessions} />
        </div>
      </Shell>
    </NewCardsContext.Provider></OpenIdsProvider></BoardRefreshContext.Provider>
  );
}
