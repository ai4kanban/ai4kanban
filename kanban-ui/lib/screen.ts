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
  CardDrafts,
  CardPatch,
  ChannelStatus,
  CommentBatch,
  CloudEventAnswer,
  CommandRequest,
  ScheduledAction,
  SessionView,
  TopicResult,
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
  /** Carry an ended delivery on from where it stopped (#639). */
  resumeDelivery(deliveryId: string): Promise<StartAnswer>;

  // ---- an approval taken elsewhere whose machine stopped (#318) ------------
  resumeCloudRequest(eventId: string): Promise<WriteResult>;
  cancelCloudRequest(taskId: number, eventId: string): Promise<WriteResult>;

  // ---- a marketing card's drafts and channels (#411, #434) -----------------
  // Only the marketing card page calls these, and only a marketing board draws it. A caller
  // with no marketing board of its own still implements them; the page is never reached.
  readDrafts(id: number): Promise<CardDrafts>;
  saveDraft(id: number, name: string, text: string): Promise<CardDrafts>;
  /** The CLI's `channel` command, with every check it makes. `again` answers a draft that
   *  is already written; `kind` names the refusal, so `draft-exists` becomes a confirm.
   *  `ask` is what was typed with this one repurpose, and is unset by default. */
  repurpose(id: number, channel: string, again: boolean, ask?: RepurposeAsk): Promise<RepurposeAnswer>;
  /** Move one channel along and record where the piece went up. It posts nothing. */
  setChannelStatus(id: number, channel: string, status: ChannelStatus, url: string): Promise<WriteResult>;
  /** Choose the channels this topic goes to — the page's `+` appends one. A
   *  channel that stays keeps its status and the URL it went up at. */
  setChannels(id: number, names: string[]): Promise<WriteResult>;

  // ---- the two ends of a topic (#507) --------------------------------------
  // New topic is the marketing board's Create — it writes the card and the page it opens is
  // the editor — and Discard is the `…` menu's way back off the board. Neither starts an
  // agent, so neither answers with a session: the write is done when the call returns.
  /** Write one blank topic and answer with the id its page is at. */
  newTopic(): Promise<TopicResult>;
  /** Take one topic off the board. A press, never a timer. */
  discardTopic(id: number): Promise<TopicResult>;

  // ---- the comments on one draft, and the polish they go to (#458) ---------
  // Only ever called where `CardDrafts.canComment` said yes: a board whose rules predate
  // the move draws no comment control, so the page never reaches these.
  /** Leave one comment on a passage. The passage carries its own context, so the file keeps
   *  no offsets and the quote is re-found wherever it has moved to. */
  commentOnDraft(id: number, draft: string, passage: DraftPassage): Promise<CommentBatch>;
  /** Change what one comment asks for. Its passage stays. */
  editDraftComment(id: number, draft: string, commentId: string, words: string): Promise<CommentBatch>;
  dropDraftComment(id: number, draft: string, commentId: string): Promise<CommentBatch>;
  /** Submit the batch: one `polish` run over that draft, with what was typed about the batch
   *  as a whole (#573). The board clears the comments when it ends `done`, so a run that
   *  failed leaves them to submit again. */
  polishDraft(id: number, draft: string, note?: string): Promise<RepurposeAnswer>;
}

/** The passage a comment is left on: the words, enough of the draft around them to tell
 *  repeats apart, and where they start inside that (`lib/format/view/anchor.ts`). */
export interface DraftPassage {
  quote: string;
  context: string;
  at: number;
  words: string;
}

/** What one repurpose is asked with, beside the channel (#457): the idea the user had while
 *  asking, and a language for this one piece instead of the channel's own. Both unset by
 *  default, and neither is kept anywhere — they are arguments to one action. */
export interface RepurposeAsk {
  note?: string;
  language?: string;
}

/** A repurpose that started, or the reason it did not. */
export interface RepurposeAnswer {
  ok: boolean;
  sessionId?: string;
  error?: string;
  /** The refusal's own name — `draft-exists` is the one the pane turns into a confirm. */
  kind?: string;
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
  /** Whether this MACHINE still owes the usage-reporting disclosure (#293). The window
   *  draws that step ahead of the board and ahead of the guided run. Absent on a caller
   *  that is not this app (#322), which then draws no step: the answer belongs to the
   *  machine holding `docs/kanban/`, not to whoever is reading the board. */
  usageDisclosure?: boolean;
  /** The screens the card on screen points its `<Mockup>` tags at, already read off this
   *  disk (#239). Absent on the board, which draws none. */
  mockups?: MockupSet;
}

// ---- which of a card page's controls a surface offers (#364) ----------------
//
// A screen handed actions used to draw its WHOLE toolbar: `CardPage` draws it on `!!actions`
// and Edit and Reject are unconditional, so a surface that supplies actions to get one button
// gets every other one with it.
//
// The hosted board is the surface that needs otherwise. A signed-in reader may approve a
// delivery and answer a card's questions from a borrowed phone (#322, #364), and nothing else:
// a card's fields, its body and its delivery all stay in the app. So a surface says which
// controls it offers, and the page draws those and no more.

/**
 * The controls a card page can draw.
 *
 * The seven toolbar buttons — `run` is Implement's place on a recurring card — plus `resume`,
 * which is the pair of ways out of a request whose machine stopped mid-delivery. Not in the
 * list, and so never offered by a surface that names its controls: a card's fields, a
 * hand-check cross-off and a queued run, all of which stay in the app.
 */
export type CardControl =
  | 'implement'
  | 'run'
  | 'refine'
  | 'edit'
  | 'resolve'
  | 'archive'
  | 'reject'
  | 'resume'

const ControlsContext = createContext<readonly CardControl[] | null>(null);

export const ScreenControlsProvider = ControlsContext.Provider;

/** The controls this surface offers, or null — then the page draws every one that fits the
 *  card, which is the app's own page unchanged. */
export const useControls = (): readonly CardControl[] | null => useContext(ControlsContext);

/** Where in a screen's body one of the app's own bands is drawn (#374). They are the app's
 *  because each one leads somewhere only the machine holding the board has — the download
 *  page, the goal editor, the setup run — so the screens leave a place for them rather than
 *  drawing them. */
export type StripPlace = "head" | "foot";

const ActionsContext = createContext<ScreenActions | null>(null);
const MachineContext = createContext<ScreenMachine | null>(null);

export const ScreenActionsProvider = ActionsContext.Provider;
export const ScreenMachineProvider = MachineContext.Provider;

/** The actions this screen was handed, or null — then it draws read-only. */
export const useActions = (): ScreenActions | null => useContext(ActionsContext);

/** The machine holding this board, or null — then no control that needs one is drawn. */
export const useMachine = (): ScreenMachine | null => useContext(MachineContext);
