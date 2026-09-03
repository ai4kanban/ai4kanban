"use client";

// The board, in this app's own window (#374).
//
// `Board` is the screen — the columns and the bands over them, drawn from one read. This is
// everything the app wraps around it and nothing else: the window and its top row, the
// guided first run, and the three bands that lead somewhere only this machine has.
//
// Splitting them is what lets the same board be served by something other than the machine
// holding `docs/kanban/`: a caller that is not this app renders `<Board>` with its own frame,
// or with none.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { startSetupRunAction } from "@/app/actions";
import { useMachine, ScreenMachineProvider, type ScreenMachine, type StripPlace } from "@/lib/screen";
import type { BoardScreen } from "@/lib/types";
import { Board, type BoardChrome } from "./Board";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import {
  GoalNotice,
  leftSetup,
  needsFirstRun,
  SetupFlow,
  SetupNotice,
  setupHasQuestionsLeft,
} from "./Setup";
import { Window } from "./Window";

// Whether the guided first run is on screen. The window draws it INSTEAD of the board and
// the strip under the columns is the way back into it, so the two need one answer between
// them — and neither is inside the other.
interface SetupFlowState {
  /** Has the user stepped out of the guided run to look at the board (#172)? `null` until
   *  the browser has been asked: sessionStorage doesn't exist during SSR, so the server and
   *  the first client render have to agree on the board. */
  left: boolean | null;
  open: boolean;
  resume: () => void;
  exit: () => void;
}

const FlowContext = createContext<SetupFlowState | null>(null);

// Both are always there: BoardWindow below provides them, and nothing else draws these two.
const useFlow = () => useContext(FlowContext)!;
const useAppMachine = (): ScreenMachine => useMachine()!;

export function BoardWindow({ screen, machine }: { screen: BoardScreen; machine: ScreenMachine }) {
  const [left, setLeft] = useState<boolean | null>(null);
  // Is the guided run on screen? It opens itself while setup still has questions, and from
  // then on only the user closes it — the flow's own last screen comes after the last box
  // ticks, and a board that took itself back the moment that happened would snatch it away.
  const [open, setOpen] = useState(false);
  useEffect(() => setLeft(leftSetup.read()), []);
  const asks = left === false && Boolean(screen.board?.setup) && needsFirstRun(screen.board?.setup ?? null);
  useEffect(() => {
    if (asks) setOpen(true);
  }, [asks]);
  const resume = useCallback(() => {
    leftSetup.set(false);
    setLeft(false);
    setOpen(true);
  }, []);
  const exit = useCallback(() => {
    leftSetup.set(true);
    setLeft(true);
    setOpen(false);
  }, []);

  return (
    <ScreenMachineProvider value={machine}>
      <FlowContext.Provider value={{ left, open, resume, exit }}>
        <Board screen={screen} shell={BoardShell} strips={BoardStrips} />
      </FlowContext.Provider>
    </ScreenMachineProvider>
  );
}

/** Start the run that finishes setup (#173). The board owns the run, so this only takes it
 *  on as this tab's — the poll wakes at once and it joins the panel in the same moment the
 *  strip says it started. */
function useFinishSetup(watch: BoardChrome["watch"]) {
  return useCallback(async () => {
    const res = await startSetupRunAction();
    if (res.ok && res.sessionId) watch(res.sessionId, "finish setup");
    return res;
  }, [watch]);
}

/** The window around the board — or, while the guided run is up, that run instead of it.
 *
 *  A board whose setup still has questions of its own opens on the guided run rather than
 *  the columns: the questions come first, and a board being asked about is not yet a board
 *  to work in. The flow draws the window's own top row (in the app that row is the title bar
 *  the traffic lights sit in), which is why it gets the header's values too. */
function BoardShell({ screen, children, ...chrome }: BoardChrome & { children: ReactNode }) {
  const machine = useAppMachine();
  const flow = useFlow();
  const board = screen.board;
  // Which agent runs this board. It starts as the server's first paint and moves when a
  // screen here answers that question — the guided run's agent step, or the Configuration
  // dialog. What the runs panel names turns on it, so it can't be a page-load value.
  const [agent, setAgent] = useState(machine.agent);
  const finishSetup = useFinishSetup(chrome.watch);
  // A chat wrote the board while it was answering (#243) — a card written, moved into a
  // release, archived. The chat's own poll notices within a few hundred milliseconds, so the
  // columns catch up while the reply is still arriving. The runs poll is woken too: the same
  // message may have started a run, and it belongs in the panel now rather than at the next
  // idle tick.
  const { refresh, kick } = chrome;
  const boardChanged = useCallback(() => {
    void refresh();
    kick();
  }, [refresh, kick]);

  if (board?.setup && flow.left === false && flow.open) {
    return (
      <SetupFlow
        setup={board.setup}
        agent={agent}
        projectRoot={machine.projectRoot}
        goalWritten={board.goalWritten ?? false}
        desktop={machine.desktop}
        setupInstruction={machine.setupInstruction ?? ""}
        skillInstalled={machine.skillInstalled ?? false}
        setupRunId={chrome.setupRunId}
        failedSetupRunId={chrome.failedSetupRunId}
        onFinishSetup={finishSetup}
        onAgentChanged={setAgent}
        onSaved={chrome.refresh}
        onExit={flow.exit}
      />
    );
  }

  return (
    // The board is what the rail's All cards row shows — the window's own first screen, so
    // it passes no current card and the rail leaves that row lit. Everything below is the
    // body: it sits on the window's paper, and scrolls inside it rather than moving the
    // chrome.
    <Window
      projectRoot={machine.projectRoot}
      openIds={board?.openIds ?? []}
      memoryModules={board?.memoryModules ?? []}
      goalWritten={board?.goalWritten ?? false}
      running={chrome.running}
      onBoardChanged={boardChanged}
      header={
        <Header
          agent={agent}
          projectRoot={machine.projectRoot}
          onError={chrome.onError}
          releases={board?.releases ?? []}
          releaseGoals={board?.releaseGoals ?? {}}
          releaseCounts={board?.releaseCounts ?? {}}
          release={chrome.release}
          onReleaseChange={chrome.onReleaseChange}
          onCreateRelease={chrome.onCreateRelease}
          onPlanRelease={chrome.onPlanRelease}
          onDropRelease={chrome.onDropRelease}
          onCloseRelease={chrome.onCloseRelease}
          onSetReleaseGoal={chrome.onSetReleaseGoal}
          // A card written while a version is on screen ships in that version.
          createRelease={chrome.release}
          goalWritten={board?.goalWritten ?? false}
          desktop={machine.desktop}
        />
      }
    >
      {children}
    </Window>
  );
}

/** The app's own three bands inside the board's body, each drawn where it belongs. */
function BoardStrips({ at, screen, ...chrome }: BoardChrome & { at: StripPlace }) {
  const machine = useAppMachine();
  const flow = useFlow();
  const finishSetup = useFinishSetup(chrome.watch);

  // How this board is being run, when that is worth saying: a newer app inside the app, a
  // pointer to the app in a browser (#175).
  if (at === "head") return <RunningNotice desktop={machine.desktop} />;

  // The goal ask (#53). The board decides when it applies; this is the editor behind it.
  if (at === "notice") return <GoalNotice onSaved={chrome.refresh} />;

  // The way back into an unfinished setup, and — once its questions are answered — the
  // offer to finish the rest here (#172, #173).
  const setup = screen.board?.setup;
  if (!setup) return null;
  return (
    <SetupNotice
      setup={setup}
      skillInstalled={machine.skillInstalled ?? false}
      setupRunId={chrome.setupRunId}
      failedSetupRunId={chrome.failedSetupRunId}
      onFinishSetup={finishSetup}
      onResume={setupHasQuestionsLeft(setup) ? flow.resume : undefined}
    />
  );
}
