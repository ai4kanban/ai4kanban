"use client";

// ---- what a screen is handed besides the board (#374) -----------------------
//
// The board screen and a card page used to import `@/app/actions` outright, and that file
// spawns the coding agent and reads this machine's filesystem. So the screens could only
// ever be served by the machine holding `docs/kanban/`.
//
// Two things arrive instead, each through a context a caller provides and each optional:
//
//   • ScreenActions — everything the screens can DO. A caller with none renders exactly the
//     same screens, read-only: every control that would write is gone rather than dead.
//   • ScreenMachine — the values only the machine holding the board can answer: the coding
//     agent, the repository root, the setup instruction, the skill state, a mockup on disk.
//     A caller without one draws no control that needs one.
//
// Both are built on the CLIENT side of the boundary. A server component may hand a client
// component only serializable props and Server Action references, so an object of actions
// cannot be passed down from a page — components/app-actions.tsx is where the app assembles
// its own (and the only place in the reading path that names `@/app/actions`).

import { createContext, useContext } from "react";
import type { MockupSet } from "./mockup-tag";
import type {
  AgentInfo,
  BoardScreen,
  BulkReleaseResult,
  CardPatch,
  CloudEventAnswer,
  CommandRequest,
  ScheduledAction,
  SessionView,
  VerifyResult,
  WriteResult,
} from "./types";

/** A run that was asked for: it started, or this line says why not. */
export interface StartAnswer {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

/** Making a release can also start the run that fills it from its goal (#165). The release
 *  is made either way, so a run that would not start is reported rather than refused. */
export interface ReleaseMade extends WriteResult {
  planSessionId?: string;
  planError?: string;
}

/** Closing one starts the changelog run the same way (#232). */
export interface ReleaseClosed extends WriteResult {
  changelogSessionId?: string;
  changelogError?: string;
}

/**
 * Everything the board screen and a card page can do.
 *
 * Grouped the way the work falls: reading the board again, a card's own fields, the
 * releases, the runs, and a delivery. Every one of them is something the board answers —
 * nothing here needs a filesystem in front of it, so a board somewhere else implements the
 * same interface and the screens are unchanged.
 */
export interface ScreenActions {
  /** The board screen's read again, after something wrote the board. */
  readBoard(): Promise<BoardScreen>;
  /** Whether this card is still on the board — what a card page asks before it gives up on
   *  the page it is showing (#299). */
  cardOnBoard(id: number): Promise<boolean>;

  // ---- one card ------------------------------------------------------------
  // `expect` is the revision the page read the card at (#316): a card rewritten under an
  // open page comes back as a conflict with nothing written.
  patchCard(id: number, patch: CardPatch, expect: string): Promise<WriteResult>;
  dropVerify(id: number, line: string, expect: string): Promise<VerifyResult>;
  scheduleCard(id: number, action: ScheduledAction, notes: string, expect: string): Promise<WriteResult>;
  unscheduleCard(id: number, expect: string): Promise<WriteResult>;

  // ---- releases ------------------------------------------------------------
  setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult>;
  createRelease(id: string, fill: boolean, goal: string): Promise<ReleaseMade>;
  planRelease(id: string): Promise<StartAnswer>;
  dropRelease(id: string): Promise<WriteResult>;
  closeRelease(id: string): Promise<ReleaseClosed>;
  setReleaseGoal(id: string, goal: string): Promise<WriteResult>;

  // ---- the runs ------------------------------------------------------------
  listSessions(): Promise<SessionView[]>;
  getSession(sessionId: string): Promise<SessionView | null>;
  /** Start one run. `cloudRevision` and `cloudAnswers` are what a card page adds so the same
   *  decision reaches this card's live Cloud event (#319); the board drops them on a card
   *  with no live event, which is most of them. */
  startAgent(
    req: CommandRequest & { cloudRevision?: string; cloudAnswers?: CloudEventAnswer[] },
  ): Promise<StartAnswer>;
  stopSession(sessionId: string): Promise<StartAnswer>;
  resumeSession(sessionId: string): Promise<StartAnswer>;

  // ---- the delivery in flight ----------------------------------------------
  approveDelivery(deliveryId: string): Promise<StartAnswer>;
  discardDelivery(deliveryId: string): Promise<StartAnswer>;

  // ---- an approval taken elsewhere whose machine stopped (#318) ------------
  resumeCloudRequest(eventId: string): Promise<WriteResult>;
  cancelCloudRequest(taskId: number, eventId: string): Promise<WriteResult>;
}

/** What only the machine holding the board can answer. Everything here is read on the
 *  server beside the board and handed to the app's own shell; a caller serving these screens
 *  from somewhere else has none of it. */
export interface ScreenMachine {
  /** The repository holding `docs/kanban/` — the header's badge, and the folder a chat and
   *  the rail are keyed on. */
  projectRoot: string;
  /** Which agent runs this board, what it is set to, and what it could be switched to. */
  agent: AgentInfo;
  /** The line a coding agent is handed to finish setup, worded for the agent picked, and
   *  whether that line would reach anything (#174). Only the guided first run and the setup
   *  strip need them, so a card page carries neither. */
  setupInstruction?: string;
  skillInstalled?: boolean;
  /** Whether this board is running inside the desktop app (#175). */
  desktop: boolean;
  /** The screens the card on screen points its `<Mockup>` tags at, already read off this
   *  disk (#239). Absent on the board, which draws none. */
  mockups?: MockupSet;
}

/** Where in a screen's body one of the app's own bands is drawn (#374). They are the app's
 *  because each one leads somewhere only the machine holding the board has — the download
 *  page, the goal editor, the setup run — so the screens leave a place for them rather than
 *  drawing them. */
export type StripPlace = "head" | "notice" | "foot";

const ActionsContext = createContext<ScreenActions | null>(null);
const MachineContext = createContext<ScreenMachine | null>(null);

export const ScreenActionsProvider = ActionsContext.Provider;
export const ScreenMachineProvider = MachineContext.Provider;

/** The actions this screen was handed, or null — then it draws read-only. */
export const useActions = (): ScreenActions | null => useContext(ActionsContext);

/** The machine holding this board, or null — then no control that needs one is drawn. */
export const useMachine = (): ScreenMachine | null => useContext(MachineContext);
