"use client";

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
//   strips   the app's own bands, drawn INSIDE the body at the three places they belong:
//            `head` above everything, `notice` under the error strip, `foot` under the
//            columns. They are the app's because each one leads somewhere only this machine
//            has — the download page, the goal editor, the setup run.
//
// A caller that passes neither gets the board and nothing else. A caller that passes no
// actions gets the same board, read-only: every control that would write is gone rather
// than dead.

import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { filterColumns, hasOwnCards, useReleasePick, type ReleasePick } from "@/lib/release-pick";
import { useActions, type ReleaseClosed, type ReleaseMade, type StartAnswer, type StripPlace } from "@/lib/screen";
import type { BoardScreen, SessionView, WriteResult } from "@/lib/types";
import { BulkReleaseBar } from "./BulkReleaseBar";
import { OpenIdsProvider } from "./open-ids";
import { QueueView } from "./Queue";
import { SessionLogOverlay, stoppedShort } from "./agent-shared";
import { runningCardIds, sessionsPanel, useAgentSessions, useOnTabFocus, useSessionLog } from "./sessions";

/** Everything the board screen knows that something drawn around it needs. The app's window
 *  hands most of it to its top row; a caller with a different frame takes what it wants. */
export interface BoardChrome {
  /** The board as it now reads — the server's first paint until a write re-reads it. */
  screen: BoardScreen;
  /** Which release the columns are showing, and the way to change it (#104). */
  release: ReleasePick;
  onReleaseChange: (r: ReleasePick) => void;
  onCreateRelease: (id: string, fill: boolean, goal: string) => Promise<ReleaseMade>;
  onPlanRelease: (id: string) => Promise<StartAnswer>;
  onDropRelease: (id: string) => Promise<WriteResult>;
  onCloseRelease: (id: string) => Promise<ReleaseClosed>;
  onSetReleaseGoal: (id: string, goal: string) => Promise<WriteResult>;
  /** Say something across the top of the board — where a save from the chrome reports. */
  onError: (message: string | null) => void;
  /** Every run this board can see, and the cards an agent is inside right now. */
  sessions: SessionView[];
  running: Set<number>;
  /** The setup run going right now, from this tab or another (#173), and the newest one
   *  when it stopped short and none has been started since (#230). */
  setupRunId: string | null;
  failedSetupRunId: string | null;
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
}: {
  /** The one read this screen draws from — the server's, for the first paint. */
  screen: BoardScreen;
  shell?: BoardShell;
  strips?: BoardStrips;
}) {
  const t = useCopy();
  const c = t.board;
  const actions = useActions();
  const [screen, setScreen] = useState<BoardScreen>(first);
  const board = screen.board;
  // Whatever the last read, or a control in the chrome, had to say. It starts as the read's
  // own reason and moves with every re-read.
  const [error, setError] = useState<string | null>(first.error);
  // The run whose log is open in the overlay, opened by clicking a card's
  // running badge. The board has no inline session log of its own.
  const [logSessionId, setLogSessionId] = useState<string | null>(null);
  const openLog = useSessionLog(logSessionId);
  // Which release the board shows (#104). Remembered per board in the browser;
  // No release is the default — the cards not promised to a version yet.
  const [release, setRelease] = useReleasePick(screen.id, board?.releases ?? []);
  // The cards the queue splits — filtered once here, so what the pick hides is
  // decided in one place and every column below draws from the same set.
  const columns = useMemo(
    () => filterColumns(board?.columns ?? [], release),
    [board, release],
  );
  // The pick has nothing of its own on screen — and the board does have cards, so
  // this is the filter emptying the screen rather than an empty board. Without
  // that second half a board whose every card is planned reads the same as a
  // board with no cards at all, and only one of those is worth a note.
  const emptyPick = !hasOwnCards(columns) && hasOwnCards(board?.columns ?? []);
  // The cards ticked for a bulk release move (#114), and what the last move
  // couldn't do. Not remembered anywhere: a selection is one action in progress,
  // not a way of looking at the board.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState<{ id: number; error: string }[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setFailed([]);
    setMoveError(null);
  }, []);
  // Touching a tick drops the last move's report: the user has moved on to a
  // different set of cards, and a message about the old one would read as
  // something the next move did.
  const toggleSelected = useCallback((id: number, next: boolean) => {
    setFailed([]);
    setMoveError(null);
    setSelected((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  }, []);

  // Changing what is on screen unticks everything: the release dropdown can hide
  // a ticked card, and moving a card someone has stopped looking at is the one
  // way this action surprises them.
  useEffect(clearSelection, [release, clearSelection]);

  // A ticked card that has left the screen some other way — archived by a run,
  // rejected, its file edited — is dropped from the selection in the same render
  // it goes, so a move can only ever write the cards in front of the user. The
  // same identity is handed back when nothing changed, so this can't loop.
  const onScreen = useMemo(
    () => new Set(columns.flatMap((col) => col.cards.map((c) => c.id))),
    [columns],
  );
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => onScreen.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [onScreen]);

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

  // The board starts no sessions itself (Create task lives in the header,
  // per-card actions on the card page) except the one that plans a release
  // (#165), so it mostly reads the registry — for the per-card running badges,
  // to say a release is being planned, and to refresh when any session finishes.
  const { sessions, watch, kick } = useAgentSessions(() => {});

  // The plan run this tab just started, held from the click until the poll
  // catches it. The registry poll can be a second and a half behind, and the
  // board switches to the new release at once — so without this the user gets a
  // frame of "v1 has no open cards" on a version that is being filled right now,
  // which reads as a release that did nothing.
  const [planRun, setPlanRun] = useState<{ release: string; sessionId: string } | null>(null);

  // Start the run and take it on as this tab's: the poll wakes at once, so the
  // run is in the runs panel from the moment the release is. The board says it is
  // planning (below); nothing opens over the board, since the note is on the very
  // release the user was just put on.
  const takeOnPlan = useCallback(
    (release: string, sessionId: string) => {
      setPlanRun({ release, sessionId });
      watch(sessionId, `plan ${release}`);
    },
    [watch],
  );

  // Start a release from the header (#115). The board is re-read before the pick
  // moves, so the new release is on the list the pick is checked against — a pick
  // the list doesn't hold yet would be dropped back to No release in the same
  // render. Then the board switches to it: the user asked for this version to
  // work in it, and a card made while it is picked lands in it. It is empty, so
  // the "no open cards" note — or, while it is being filled, the "being planned"
  // note — is what greets them, with the way back on it.
  // A release made on the goal tab is planned against that goal by an agent run
  // (#165) — started behind the release, never waited for. The release is made
  // either way, so a run that couldn't start is reported across the top of the
  // board rather than back into a dialog that has already closed on a version
  // that does exist.
  const makeRelease = useCallback(
    async (raw: string, fill: boolean, goal: string): Promise<ReleaseMade> => {
      if (!actions) return { ok: false };
      // Trimmed once, here, so the version the pick moves to, the version the
      // planning note is keyed on, and the version the run records as its input
      // are all the same string — the server trims as it writes either way.
      const id = raw.trim();
      const res = await actions.createRelease(id, fill, goal);
      if (!res.ok) return res;
      await refresh();
      setRelease(id);
      if (res.planSessionId) takeOnPlan(id, res.planSessionId);
      if (res.planError) setError(c.notice.planNotStarted(id, res.planError));
      return res;
    },
    [actions, refresh, setRelease, takeOnPlan, c],
  );

  // Fill a release that already exists from its goal (#165) — the ⋯ menu's entry.
  // The board starts it rather than the picker so the run is taken on here, the
  // one place that also says the release is being planned and re-reads the board
  // when it ends.
  const planRelease = useCallback(
    async (id: string): Promise<StartAnswer> => {
      if (!actions) return { ok: false };
      const res = await actions.planRelease(id);
      if (res.ok && res.sessionId) takeOnPlan(id, res.sessionId);
      return res;
    },
    [actions, takeOnPlan],
  );

  // A plan run on the release on screen, from any tab — a run started in a second
  // tab plans this same board, so it says so here too. `input` is the version a
  // plan-release run was started for.
  const livePlan = sessions.find(
    (r) => r.status === "running" && r.action === "plan-release" && r.input === release,
  );
  // …and the one this tab started a moment ago, until the poll has it. Dropped
  // once the poll reports it ended, so a run whose record ages out of the kept
  // window can't bring the note back weeks later.
  const planSessionId =
    livePlan?.sessionId ??
    (planRun &&
    planRun.release === release &&
    !sessions.some((r) => r.sessionId === planRun.sessionId)
      ? planRun.sessionId
      : null);
  useEffect(() => {
    if (!planRun) return;
    const seen = sessions.find((r) => r.sessionId === planRun.sessionId);
    if (seen && seen.status !== "running") setPlanRun(null);
  }, [sessions, planRun]);

  // Finishing setup (#173) — the run the app's own strips start. It is one run at a time
  // across the whole board, so the live one is looked up from the shared poll rather than
  // remembered anywhere: a run started in another tab, or from a terminal, holds the offer
  // down in this one too.
  const setupRun = sessions.find((r) => r.status === "running" && r.action === "setup");
  const setupRunId = setupRun?.sessionId ?? null;
  // …and the newest setup run when it stopped short (#230), so the strip and the
  // guided run's closing screen say a run was tried and died instead of falling
  // silently back to the offer. Only the newest one is asked: a failure the user
  // has since run past is history. A run the user stopped is not a failure, and a
  // run cut off by a dead server is — the board treats those two apart already.
  const lastSetupRun = sessions.reduce<SessionView | undefined>(
    (best, r) => (r.action === "setup" && (!best || r.startedAt > best.startedAt) ? r : best),
    undefined,
  );
  const failedSetupRunId = stoppedShort(lastSetupRun) ? (lastSetupRun?.sessionId ?? null) : null;

  // A setup run writes the board as it goes — a box ticked, the module map, the
  // first cards — so while one is going the board is re-read on every poll rather
  // than only when the run ends. That is what keeps the progress bar moving under
  // it. Nothing else polls the board this way, and nothing needs to: every other
  // run's work shows up on a card, which the finish below already catches.
  useEffect(() => {
    if (setupRunId) refresh();
  }, [sessions, setupRunId, refresh]);

  // Send every ticked card into one release, or back out of one (#114). Each
  // card is written on its own on the server, so one card that can't be moved
  // costs the others nothing: the ones that went through are unticked and the
  // ones that didn't stay ticked, with the reason in the bar above them — a
  // second try needs no re-ticking. Then the board is re-read from the files, so
  // what is on screen is what the cards say and anything that left the release
  // being shown drops off it.
  const moveSelected = useCallback(
    async (target: string) => {
      if (!actions) return;
      const ids = [...selected];
      const res = await actions.setCardsRelease(ids, target);
      setMoveError(res.error ?? null);
      setFailed(res.failed);
      if (!res.error) {
        const stuck = new Set(res.failed.map((f) => f.id));
        setSelected(new Set(ids.filter((id) => stuck.has(id))));
        await refresh();
      }
    },
    [actions, selected, refresh],
  );

  // Give up on a release from the header (#131). The pick moves back to No
  // release first — the release is about to be gone, and the fallback in
  // useReleasePick would land there anyway, this just skips the frame where a
  // dead version is picked. Then the board is re-read: its cards have no
  // release and the version is off the list, so the screen the user lands on is
  // the one now holding the cards that came back.
  const dropRelease = useCallback(
    async (id: string): Promise<WriteResult> => {
      if (!actions) return { ok: false };
      const res = await actions.dropRelease(id);
      if (!res.ok) return res;
      setRelease(null);
      await refresh();
      return res;
    },
    [actions, refresh, setRelease],
  );

  // Close a shipped release from the header (#136). The pick moves the same way
  // the drop moves it: back to No release before the re-read, since the version
  // it was showing no longer exists.
  //
  // The close also starts the changelog run (#232). The version is off the list
  // by then, so there is nowhere left to offer it a second time — a run that
  // could not start, or that stopped short, is said across the top of the board
  // instead, and it names the command that writes the changelog after all.
  const closeRelease = useCallback(
    async (id: string): Promise<ReleaseClosed> => {
      if (!actions) return { ok: false };
      const res = await actions.closeRelease(id);
      if (!res.ok) return res;
      setRelease(null);
      await refresh();
      if (res.changelogSessionId) {
        setChangelogRun({ release: id, sessionId: res.changelogSessionId });
        watch(res.changelogSessionId, `changelog ${id}`);
      }
      if (res.changelogError) setChangelogGone({ release: id, why: res.changelogError });
      return res;
    },
    [actions, refresh, setRelease, watch],
  );

  // The changelog run this tab started, watched to its end. The close is over and
  // the version has left the screen, so a run that ends badly would otherwise end
  // badly in silence — the board says so once, and names the command that writes
  // it after all.
  //
  // It gets a note of its own rather than the error strip: `refresh` owns that
  // strip and clears it on every read, and a board re-read is the very thing a
  // finished run triggers — so a message put there would be wiped the instant it
  // was written.
  const [changelogRun, setChangelogRun] = useState<{ release: string; sessionId: string } | null>(
    null,
  );
  const [changelogGone, setChangelogGone] = useState<{ release: string; why: string } | null>(null);
  useEffect(() => {
    if (!changelogRun) return;
    const seen = sessions.find((r) => r.sessionId === changelogRun.sessionId);
    if (!seen || seen.status === "running") return;
    setChangelogRun(null);
    if (seen.status === "done") return;
    setChangelogGone({
      release: changelogRun.release,
      why:
        seen.status === "stopped" ? c.notice.changelogStopped : c.notice.changelogUnfinished,
    });
  }, [sessions, changelogRun, c]);

  // Say what the release on screen is for, or change it (#164). Only the board
  // file changes, so the pick stays where it is — but the board is re-read, since
  // the dropdown shows the goal under the version.
  const setGoal = useCallback(
    async (id: string, goal: string): Promise<WriteResult> => {
      if (!actions) return { ok: false };
      const res = await actions.setReleaseGoal(id, goal);
      if (res.ok) await refresh();
      return res;
    },
    [actions, refresh],
  );

  // Re-read the board whenever any session finishes (from this tab or another),
  // so created/archived/rejected cards appear or disappear without a manual
  // reload — a plan run's moved and written cards included (#165).
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
    release,
    onReleaseChange: setRelease,
    onCreateRelease: makeRelease,
    onPlanRelease: planRelease,
    onDropRelease: dropRelease,
    onCloseRelease: closeRelease,
    onSetReleaseGoal: setGoal,
    onError: setError,
    sessions,
    running: runningCardIds(sessions),
    setupRunId,
    failedSetupRunId,
    refresh,
    kick,
    watch,
  };
  const Shell = shell ?? Bare;
  const Strip = strips;
  const state = screen.standing;

  return (
    <OpenIdsProvider ids={board?.openIds ?? []}>
      <Shell {...chrome}>
        <div className="flex h-full flex-col overflow-hidden">
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

          {/* The goal ask (#53), which rides on nothing: a board long set up can
              have its goal judged weak again, and that is not setup. It drops out
              with the next board refresh — the same one that already runs on
              session finish and tab focus — so it moves as the files do. */}
          {Strip && board && !board.setup && board.goalNeedsWork && <Strip {...chrome} at="notice" />}

          {!board && !error && (
            <div className="p-10 text-nb-ink-soft">{c.reading}</div>
          )}

          {/* A release being filled from its goal (#165) says so, and says it
              before the "no open cards" note can: the board switches to the new
              version the instant it is made, and a version that is empty because
              an agent is still writing its cards is not the same thing as a
              version with nothing in it. It stands until the run ends, since the
              cards arrive over the run rather than all at once at the close. */}
          {board && planSessionId && (
            <div className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6" style={{ background: "var(--color-nb-sky-soft)" }}>
              <Rich>{c.notice.planning(release ?? "")}</Rich>{" "}
              <button
                type="button"
                className="cursor-pointer underline underline-offset-2 hover:text-nb-accent-deep"
                onClick={() => sessionsPanel.open(planSessionId)}
              >
                {c.notice.watchRun}
              </button>
              {t.shared.stop}
            </div>
          )}

          {/* The changelog a close asked for never arrived (#232). The version is
              off the list, so there is no menu left to offer it again — this names
              the command instead, and stays until it is dismissed. */}
          {changelogGone && (
            <div
              className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6"
              style={{ background: "var(--color-nb-peach-soft)" }}
            >
              <Rich>{c.notice.changelogMissing(changelogGone.release, changelogGone.why)}</Rich>{" "}
              <Rich>{c.notice.changelogWriteIt(`akb changelog ${changelogGone.release}`)}</Rich>{" "}
              <button
                type="button"
                className="cursor-pointer underline underline-offset-2 hover:text-nb-accent-deep"
                onClick={() => setChangelogGone(null)}
              >
                {c.notice.dismiss}
              </button>
              {t.shared.stop}
            </div>
          )}

          {/* A filter that can empty the screen has to explain itself, or the user
              reads it as a broken board and goes looking for their cards. Above both
              views, so it says the same thing in either one, with the way back one
              click away. Blockers on screen don't make the pick non-empty — a
              blocker belongs to whoever it blocks.
              On No release the way back is the picker itself: there is no view
              above this one, and an empty screen there is the good news that
              every card is promised to a version. */}
          {board && emptyPick && !planSessionId && (
            <div className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6" style={{ background: "var(--color-nb-sky-soft)" }}>
              {release === null ? (
                <>{c.notice.allPlanned}</>
              ) : (
                <>
                  <Rich>{c.notice.releaseEmpty(release)}</Rich>{" "}
                  <button
                    type="button"
                    className="cursor-pointer underline underline-offset-2 hover:text-nb-accent-deep"
                    onClick={() => setRelease(null)}
                  >
                    {c.notice.showNoRelease}
                  </button>
                  {t.shared.stop}
                </>
              )}
            </div>
          )}

          {/* Only while cards are ticked, or while the last move has something left
              to say (#114). With nothing ticked the board is exactly what it was
              before this existed. Above the columns, like the note above it. */}
          {board && actions && (selected.size > 0 || moveError || failed.length > 0) && (
            <BulkReleaseBar
              count={selected.size}
              releases={board.releases}
              failed={failed}
              error={moveError}
              onMove={moveSelected}
              onClear={clearSelection}
            />
          )}

          {board && (
            <QueueView
              columns={columns}
              sessions={sessions}
              onOpenLog={setLogSessionId}
              selected={selected}
              onSelect={actions ? toggleSelected : undefined}
            />
          )}

          {/* Setup left unfinished (#172, #173) — the app's own strip, under the columns
              rather than over them: the cards are what the board is for, and a strip this
              wide at the top pushes them off the first screen. Outside the scrolling row,
              so it stays put as the columns move. */}
          {Strip && board?.setup && <Strip {...chrome} at="foot" />}

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
      </Shell>
    </OpenIdsProvider>
  );
}
