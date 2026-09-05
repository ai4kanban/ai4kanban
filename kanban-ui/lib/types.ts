// The shapes the board is drawn from.
//
// Almost none of them are declared here. The board's own rules live in the CLI, and the
// two files below are its copies — `lib/format/`, written by `scripts/sync-format.mjs`, so
// the browser can name what the server hands it without a second set of shapes drifting out
// of step. This file is the one name the app imports them under.
//
//   format/view/types   the board: cards, columns, releases, setup, the daily numbers
//   format/agent/types  a run: which agents there are, what each one takes, what it cost
//   format/skill/types  the coding agent skill: whether this project has one, and what
//                       adding it wrote
//   format/cloud/types  the Cloud sign-in: which account this machine acts as
//   format/cloud/events what a Cloud event is (#319): the nine state names, and the one
//                       wording every surface — bell, card band, notification — says
//   format/machine/types  the languages the app works in — each one's own name and the
//                       `<html lang>` tag the layout wears — and what this machine has
//                       answered about usage reporting (#293)
//
// What IS declared here is the one shape the CLI has no opinion about: `SessionView`, a run
// as the browser reads it. The record the CLI keeps carries a couple of fields the UI has
// no use for and holds its log under another name; lib/registry.ts is where one becomes the
// other.

import type { AgentAction, DeliveryStatus, ExecutionBlocker, TokenUsage } from "./format/agent/types";

export type {
  AgentAction,
  AgentInfo,
  AgentRequest,
  Boldness,
  Chat,
  ChatMessage,
  ChatPick,
  ChatPickAgent,
  ChatTarget,
  CommandAction,
  CommandRequest,
  ConnectionTest,
  FlowRuleView,
  HarnessGap,
  HarnessOption,
  HarnessSetting,
  LoggedOutAgent,
  ModelChange,
  Provider,
  RuntimeView,
  RunStatus,
  SettingChoice,
  SetupProposal,
  SpecSkillSettingView,
  SpecSkillView,
  TokenUsage,
} from "./format/agent/types";
export type { DeliveryCommitMode, DeliveryRecord, DeliveryStatus, DeliveryStep } from "./format/agent/types";
export { PROPOSE_DEFAULT, PROPOSE_MAX } from "./format/agent/types";

export type {
  ArchiveGroup,
  ArchiveList,
  ArchivedCard,
  ArchivedCardFile,
  Board,
  BulkReleaseResult,
  Card,
  CardApproval,
  CardChannel,
  CardDelivery,
  CardDeliveryStage,
  CardDeliveryState,
  CardDraft,
  CardDrafts,
  CardFinished,
  CardLanding,
  CardPatch,
  CardRef,
  CardSchedule,
  CardStatus,
  ChannelStatus,
  ClosePlan,
  ClosePlanCard,
  Column,
  DeliveryDiff,
  DeliveryPlan,
  DropPlan,
  FillPlan,
  FillSkip,
  Level,
  MemoryFile,
  MemoryModule,
  MemoryName,
  MemoryRef,
  MetricsDay,
  MetricsResult,
  MetricsView,
  PlanCard,
  Question,
  QuestionMode,
  QuestionTag,
  SaveProjectResult,
  ScheduledAction,
  ScoreCount,
  ScoreResult,
  ScoreSeries,
  ScoreSeriesKey,
  ScoreView,
  ScoreWindow,
  SetupDraft,
  SetupState,
  // The board's own name for a checklist box; `SetupStepView` there only because the
  // writing side already had a `SetupStep` of its own.
  SetupStepView as SetupStep,
  Solution,
  Subtask,
  VerifyResult,
  WriteResult,
} from "./format/view/types";
export { FIRST_RUN_DONE, GUIDED_STEPS, MEMORY_FILES, METRICS_WINDOW_DAYS, NO_RELEASE, SCORE_SERIES, SOLUTIONS } from "./format/view/types";

// The one read each screen makes (#374) — what the board screen draws, and what a card page
// draws. The server fills them (lib/board.ts) and the screens take them as one prop.
export type { BoardScreen, BoardStanding, CardScreen, ScreenBoard } from "./format/board/screen";

// The workspace a Cloud board lives in (#317) — what Configuration → Workspace draws, and
// the one commit each of its exits offers.
export type { CloudChange, MemberRoleWire, WorkspaceMemberWire, WorkspaceNodeWire } from "./cli";
export type { WorkspaceExit, WorkspaceMove, WorkspaceView } from "./workspace";
export { LOCAL_STANDING } from "./format/board/screen";

export type {
  CommandState,
  SkillFolder,
  SkillFolderState,
  SkillInstall,
  SkillState,
  SkillWrite,
} from "./format/skill/types";

export type {
  CloudAccount,
  CloudMove,
  CloudState,
  LarkChat,
  LarkCloud,
  LarkCloudOffer,
  LarkConnection,
  LarkState,
  SlackConnection,
  SlackConversation,
  SlackState,
} from "./format/cloud/types";

export type {
  CloudEvent,
  CloudEventAnswer,
  CloudEventDecision,
  CloudEventKind,
  CloudEventQuestion,
  CloudEventState,
} from "./format/cloud/events";
export { answerNotes, bandLabel, CARD_BAND_STATES, eventLabel, isFinalEventState } from "./format/cloud/events";

/** Watch every card, whatever release it is promised to — mirrored from the rules' own
 *  `ALL_RELEASES`, since the release picker has to name it before any rules are loaded.
 *  It lives here, not in lib/notifications.ts, because that module reaches the CLI: a
 *  browser importing a constant out of it would drag `node:fs` into the client bundle. */
export const ALL_RELEASES = "*";

export type { Language, UsageReporting } from "./format/machine/types";
export { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_NAMES, LANGUAGE_TAGS, LANGUAGES } from "./format/machine/types";

/** A running or finished agent run, as the UI sees it when it polls the server. One shared
 *  picture across every tab. */
export interface SessionView {
  /** This run's unique id — ours, and the key the run is tracked by. It is the agent's
   *  OWN id only when that harness adopted it (Claude Code does, via `--session-id`); a
   *  harness that mints its own keeps a second id, which the UI never sees — Resume is a
   *  server-side action and the server knows which id to hand back to which CLI. */
  sessionId: string;
  /** Which harness ran this run (a name from the CLI's list, e.g. "claude-code"). Saved
   *  with the run, so the resume handoff is built from the harness the run actually
   *  used — not whatever the setting says today. */
  harness?: string;
  /** The runtime it was resolved through (#343), saved beside the harness for the same
   *  reason. Absent on a run started before runtimes existed. */
  runtime?: string;
  /** The card this run touches, or null for a run that names none (create, propose,
   *  plan-release). */
  cardId: number | null;
  action: AgentAction;
  /** `interrupted` is its own terminal state: the run was cut off — the server died mid-run
   *  and the agent ended out of our sight — so it neither passed nor reported a failure. It
   *  is NOT a finish: it reads as unfinished work and offers Resume, the same as a failure.
   *
   *  `stopped` is the state of a run the user ended. Nothing went wrong with it, so it is
   *  never shown as a failure — and it still offers Resume: the conversation is intact, and
   *  changing your mind about a stop shouldn't cost the work already done. */
  status: "running" | "done" | "error" | "interrupted" | "stopped";
  startedAt: number;
  endedAt?: number;
  /** How long the run took, in ms. Terminal runs only. For an `interrupted` run this
   *  is an upper bound — we only know it ended by the time we noticed — so the UI marks it
   *  `~`. */
  durationMs?: number;
  /** What this run cost, in US dollars. An ESTIMATE: the agent works it out on its own
   *  machine from the run's tokens at list prices, and the board's default agent runs on a
   *  subscription plan, where a single run isn't charged at all — so the UI never words it
   *  as a bill. This run's own number and nothing more. Absent for a live run, one cut off
   *  before it reported a cost, and an agent that says nothing about cost — all of which
   *  show no number rather than a zero. */
  costUsd?: number;
  /** The model that did this run's work, as the agent itself reported it — not the model
   *  field in the Configuration dialog, which says nothing about a run that started before
   *  it was changed. Shown exactly as the agent said it; the board never invents or
   *  prettifies a model name. */
  model?: string;
  /** The tokens this run consumed, as its own closing event counted them. Terminal runs
   *  only — the numbers arrive with the agent's last event. */
  usage?: TokenUsage;
  /** The text the user typed for this run — a create's description, an action's notes,
   *  or a reject's reason. Absent when the run carried no note. */
  input?: string;
  /** Exit was clean. Set once the run reaches a terminal state — except an `interrupted`
   *  one, which never reported an exit code at all, so this stays unset rather than guessing
   *  an outcome we never saw. */
  ok?: boolean;
  code?: number | null;
  /** Spawn/child error message, if any. */
  error?: string;
  /** The one concrete interruption to clear before this implementation resumes. */
  blocker?: ExecutionBlocker;
  /** The agent's final message, parsed from its event stream. Terminal runs only. When
   *  present the UI leads with it and folds the event tail away; absent, the tail is all
   *  there is. */
  result?: string;
  /** The board's own last word on this run, when the agent's message can't give it: a
   *  refinement loop that ended with its card still unsettled. Shown under the final
   *  message, marked as the board's, never folded into it. */
  note?: string;
  /** This run ended before finishing — it failed, was interrupted or was stopped — AND can
   *  be picked up again: the agent that ran it can continue a conversation, it has told us
   *  the id to continue by, and it is still the agent the board runs. The Resume button
   *  appears only then. */
  canResume?: boolean;
  /** The run this one continued, when it was started by Resume. Marks the run in the
   *  panel as a second turn of an earlier conversation. The run it names is gone — a
   *  resumed run replaces the one it took over from — so this is a mark, not a link. */
  resumedFrom?: string;
  /** Tail of the run's output (last few KB). The board-wide poll attaches it only to
   *  terminal runs; getSession() attaches it for any run — live or done — by
   *  reading the log file, so the UI can tail a running agent. */
  tail?: string;
  /** The JOB this session is one part of. Most things the board does take more than one
   *  session — a refine audits then writes, a create writes cards then refines each, a
   *  revise hands its card on, a build is reviewed — and every session is an ordinary run
   *  with its own log. This is what ties them back together, so the panel shows one job
   *  instead of six unrelated rows. `round` is a refinement pass's place in its loop,
   *  counting from 1. A run recorded before flows carries none and stands on its own. */
  flow?: { id: string; round: number };
  /** The delivery this run belongs to, when it belongs to one (#301). Only an `implement`
   *  run does: everything else is a single run that stands alone. The status is the
   *  DELIVERY's, not this run's — a run the user stopped inside a cancelled delivery reads
   *  "cancelled", because that is what happened. */
  delivery?: { id: string; status: DeliveryStatus };
}
