"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closeReleaseAction,
  createReleaseAction,
  dropReleaseAction,
  getBoard,
  planReleaseAction,
  setCardsReleaseAction,
  setReleaseGoalAction,
  startSetupRunAction,
} from "@/app/actions";
import { filterColumns, hasOwnCards, useReleasePick } from "@/lib/release-pick";
import type { AgentInfo, Board, SessionView } from "@/lib/types";
import { BulkReleaseBar } from "./BulkReleaseBar";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import {
  GoalNotice,
  leftSetup,
  needsFirstRun,
  SetupFlow,
  SetupNotice,
  setupHasQuestionsLeft,
} from "./Setup";
import { QueueView } from "./Queue";
import { Window } from "./Window";
import { SessionLogOverlay } from "./agent-shared";
import { runningCardIds, sessionsPanel, useAgentSessions, useOnTabFocus, useSessionLog } from "./sessions";

export function BoardView({
  initialBoard,
  initialError,
  agent: initialAgent,
  projectRoot,
  setupInstruction,
  skillInstalled,
  desktop,
}: {
  initialBoard: Board | null;
  initialError: string | null;
  agent: AgentInfo;
  projectRoot: string;
  /** The line a coding agent is handed to finish setup. It comes from the server
   *  (lib/agent.ts reads the filesystem, which a client can't import). */
  setupInstruction: string;
  /** Whether a coding agent can see this board at all (#174). A board no longer
   *  arrives with the skill, so the line above only works once someone has added
   *  it — every place that hands that line over says so when it isn't there. */
  skillInstalled: boolean;
  /** Whether this board is running inside the desktop app (#175). Read on the
   *  server so the first paint is already right. */
  desktop: boolean;
}) {
  const [board, setBoard] = useState<Board | null>(initialBoard);
  // Which agent runs this board. It starts as the server's first paint and moves
  // when a screen here answers that question — the guided run's agent step, or the
  // Configuration dialog. What the runs panel names turns on it, so it can't be a
  // page-load value.
  const [agent, setAgent] = useState<AgentInfo>(initialAgent);
  const [error, setError] = useState<string | null>(initialError);
  // Has the user stepped out of the guided first run to look at the board (#172)?
  // `null` until the browser has been asked — sessionStorage doesn't exist during
  // SSR, so the server and the first client render have to agree on the board, and
  // the flow can only take over once that answer is in.
  const [leftFlow, setLeftFlow] = useState<boolean | null>(null);
  // Is the guided run on screen? It opens itself while setup still has questions,
  // and from then on only the user closes it — the flow's own last screen comes
  // after the last box ticks, and a board that took itself back the moment that
  // happened would snatch it away.
  const [inFlow, setInFlow] = useState(false);
  useEffect(() => setLeftFlow(leftSetup.read()), []);
  // The flow opens itself while setup has questions left and the user hasn't
  // stepped out of it this session; from there `inFlow` holds it open.
  const setupAsks = leftFlow === false && Boolean(board?.setup) && needsFirstRun(board?.setup ?? null);
  useEffect(() => {
    if (setupAsks) setInFlow(true);
  }, [setupAsks]);
  const resumeSetup = useCallback(() => {
    leftSetup.set(false);
    setLeftFlow(false);
    setInFlow(true);
  }, []);
  const exitSetup = useCallback(() => {
    leftSetup.set(true);
    setLeftFlow(true);
    setInFlow(false);
  }, []);
  // The session whose log is open in the overlay, opened by clicking a card's
  // running badge. The board has no inline session log of its own.
  const [logSessionId, setLogSessionId] = useState<string | null>(null);
  const openLog = useSessionLog(logSessionId);
  // Which release the board shows (#104). Remembered per project in the browser;
  // No release is the default — the cards not promised to a version yet.
  const [release, setRelease] = useReleasePick(projectRoot, board?.releases ?? []);
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
    try {
      const res = await getBoard();
      if (res.board) setBoard(res.board);
      setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

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
    async (raw: string, fill: boolean, goal: string) => {
      // Trimmed once, here, so the version the pick moves to, the version the
      // planning note is keyed on, and the version the run records as its input
      // are all the same string — the server trims as it writes either way.
      const id = raw.trim();
      const res = await createReleaseAction(id, fill, goal);
      if (!res.ok) return res;
      await refresh();
      setRelease(id);
      if (res.planSessionId) takeOnPlan(id, res.planSessionId);
      if (res.planError) setError(`${id} was made, but filling it from its goal didn't start: ${res.planError}`);
      return res;
    },
    [refresh, setRelease, takeOnPlan],
  );

  // Fill a release that already exists from its goal (#165) — the ⋯ menu's entry.
  // The board starts it rather than the picker so the run is taken on here, the
  // one place that also says the release is being planned and re-reads the board
  // when it ends.
  const planRelease = useCallback(
    async (id: string) => {
      const res = await planReleaseAction(id);
      if (res.ok && res.sessionId) takeOnPlan(id, res.sessionId);
      return res;
    },
    [takeOnPlan],
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

  // Finishing setup (#173) — the run started from the guided run's closing screen
  // and from the setup strip. It is one run at a time across the whole board, so
  // the live one is looked up from the shared poll rather than remembered here:
  // a run started in another tab, or from a terminal, holds the offer down in
  // this one too.
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
  const failedSetupRunId =
    lastSetupRun && (lastSetupRun.status === "error" || lastSetupRun.status === "interrupted")
      ? lastSetupRun.sessionId
      : null;
  const finishSetup = useCallback(async () => {
    const res = await startSetupRunAction();
    // Take it on as this tab's, so the poll wakes at once and the run joins the
    // panel in the same moment the strip says it started.
    if (res.ok && res.sessionId) watch(res.sessionId, "finish setup");
    return res;
  }, [watch]);

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
      const ids = [...selected];
      const res = await setCardsReleaseAction(ids, target);
      setMoveError(res.error ?? null);
      setFailed(res.failed);
      if (!res.error) {
        const stuck = new Set(res.failed.map((f) => f.id));
        setSelected(new Set(ids.filter((id) => stuck.has(id))));
        await refresh();
      }
    },
    [selected, refresh],
  );

  // Give up on a release from the header (#131). The pick moves back to No
  // release first — the release is about to be gone, and the fallback in
  // useReleasePick would land there anyway, this just skips the frame where a
  // dead version is picked. Then the board is re-read: its cards have no
  // release and the version is off the list, so the screen the user lands on is
  // the one now holding the cards that came back.
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

  // Close a shipped release from the header (#136). The pick moves the same way
  // the drop moves it: back to No release before the re-read, since the version
  // it was showing no longer exists.
  const closeRelease = useCallback(
    async (id: string) => {
      const res = await closeReleaseAction(id);
      if (!res.ok) return res;
      setRelease(null);
      await refresh();
      return res;
    },
    [refresh, setRelease],
  );

  // Say what the release on screen is for, or change it (#164). Only the board
  // file changes, so the pick stays where it is — but the board is re-read, since
  // the dropdown shows the goal under the version.
  const setGoal = useCallback(
    async (id: string, goal: string) => {
      const res = await setReleaseGoalAction(id, goal);
      if (res.ok) await refresh();
      return res;
    },
    [refresh],
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

  // A chat wrote the board while it was answering (#243) — a card written, moved
  // into a release, archived. The chat's own poll notices within a few hundred
  // milliseconds, so the columns catch up while the reply is still arriving. The
  // runs poll is woken too: the same message may have started a run, and it
  // belongs in the panel now rather than at the next idle tick.
  const boardChanged = useCallback(() => {
    void refresh();
    kick();
  }, [refresh, kick]);

  // A board whose setup still has questions of its own opens on the guided run
  // instead of the columns — the questions come first, and a board being asked
  // about is not yet a board to work in. It draws the window's own top row (in
  // the app that row is the title bar the traffic lights sit in), which is why
  // it gets the header's props too. Stepping out of it shows the columns, with
  // the way back on them.
  if (board?.setup && leftFlow === false && inFlow) {
    return (
      <SetupFlow
        setup={board.setup}
        agent={agent}
        projectRoot={projectRoot}
        goalWritten={board.goalWritten ?? false}
        desktop={desktop}
        setupInstruction={setupInstruction}
        skillInstalled={skillInstalled}
        setupRunId={setupRunId}
        failedSetupRunId={failedSetupRunId}
        onFinishSetup={finishSetup}
        onAgentChanged={setAgent}
        onSaved={refresh}
        onExit={exitSetup}
      />
    );
  }

  return (
    <OpenIdsProvider ids={board?.openIds ?? []}>
      {/* The board is what the rail's All cards row shows — the window's own
          first screen, so it passes no current card and the rail leaves that row
          lit. Everything below is the body: it sits on the window's paper, and
          scrolls inside it rather than moving the chrome. */}
      <Window
        projectRoot={projectRoot}
        openIds={board?.openIds ?? []}
        memoryModules={board?.memoryModules ?? []}
        running={runningCardIds(sessions)}
        onBoardChanged={boardChanged}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            onError={setError}
            releases={board?.releases ?? []}
            releaseGoals={board?.releaseGoals ?? {}}
            releaseCounts={board?.releaseCounts ?? {}}
            release={release}
            onReleaseChange={setRelease}
            onCreateRelease={makeRelease}
            onPlanRelease={planRelease}
            onDropRelease={dropRelease}
            onCloseRelease={closeRelease}
            onSetReleaseGoal={setGoal}
            // A card written while a version is on screen ships in that version.
            createRelease={release}
            goalWritten={board?.goalWritten ?? false}
            desktop={desktop}
          />
        }
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* How this board is being run, when that is worth saying: a newer app
              inside the app, a pointer to the app in a browser (#175). Above the
              error strip because it is about the whole session, not this action. */}
          <RunningNotice desktop={desktop} />

          {error && (
            <div className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6" style={{ background: "var(--color-nb-peach-soft)" }}>
              {error}
            </div>
          )}

          {/* The goal ask (#53), which rides on nothing: a board long set up can
              have its goal judged weak again, and that is not setup. It drops out
              with the next board refresh — the same one that already runs on
              session finish and tab focus — so it moves as the files do. */}
          {board && !board.setup && board.goalNeedsWork && <GoalNotice onSaved={refresh} />}

          {!board && !error && (
            <div className="p-10 text-nb-ink-soft">Reading the board…</div>
          )}

          {/* A release being filled from its goal (#165) says so, and says it
              before the "no open cards" note can: the board switches to the new
              version the instant it is made, and a version that is empty because
              an agent is still writing its cards is not the same thing as a
              version with nothing in it. It stands until the run ends, since the
              cards arrive over the run rather than all at once at the close. */}
          {board && planSessionId && (
            <div className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6" style={{ background: "var(--color-nb-sky-soft)" }}>
              <strong>{release}</strong> is being planned — the agent is moving in the cards that ship
              its goal and writing the ones the board hasn&apos;t got. They appear here as it goes.{" "}
              <button
                type="button"
                className="cursor-pointer underline underline-offset-2 hover:text-nb-accent-deep"
                onClick={() => sessionsPanel.open(planSessionId)}
              >
                Watch the run
              </button>
              .
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
                <>Every open card is in a release — nothing is waiting to be planned. Pick a version above to see it.</>
              ) : (
                <>
                  <strong>{release}</strong> has no open cards.{" "}
                  <button
                    type="button"
                    className="cursor-pointer underline underline-offset-2 hover:text-nb-accent-deep"
                    onClick={() => setRelease(null)}
                  >
                    Show the cards in no release
                  </button>
                  .
                </>
              )}
            </div>
          )}

          {/* Only while cards are ticked, or while the last move has something left
              to say (#114). With nothing ticked the board is exactly what it was
              before this existed. Above the columns, like the note above it. */}
          {board && (selected.size > 0 || moveError || failed.length > 0) && (
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
              onSelect={toggleSelected}
            />
          )}

          {/* Setup left unfinished (#172) — the way back into the guided run for
              someone who stepped out of it, and, once its questions are all
              answered, the offer to finish the rest here (#173). It sits under the
              columns rather than over them: the cards are what the board is for, and
              a strip this wide at the top pushes them off the first screen. Outside
              the scrolling row, so it stays put as the columns move. */}
          {board?.setup && (
            <SetupNotice
              setup={board.setup}
              skillInstalled={skillInstalled}
              setupRunId={setupRunId}
              failedSetupRunId={failedSetupRunId}
              onFinishSetup={finishSetup}
              onResume={setupHasQuestionsLeft(board.setup) ? resumeSetup : undefined}
            />
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
      </Window>
    </OpenIdsProvider>
  );
}
