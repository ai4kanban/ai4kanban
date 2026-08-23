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
//
// What IS declared here is the one shape the CLI has no opinion about: `SessionView`, a run
// as the browser reads it. The record the CLI keeps carries a couple of fields the UI has
// no use for and holds its log under another name; lib/registry.ts is where one becomes the
// other.

import type { AgentAction, TokenUsage } from "./format/agent/types";

export type {
  AgentAction,
  AgentInfo,
  AgentRequest,
  Boldness,
  Chat,
  ChatMessage,
  ConnectionTest,
  HarnessGap,
  HarnessOption,
  HarnessSetting,
  Provider,
  RunStatus,
  SettingChoice,
  SpecAgentSettingView,
  SpecAgentView,
  TokenUsage,
} from "./format/agent/types";
export { PROPOSE_DEFAULT, PROPOSE_MAX } from "./format/agent/types";

export type {
  ArchiveGroup,
  Board,
  BulkReleaseResult,
  Card,
  CardPatch,
  CardRef,
  CardSchedule,
  CardStatus,
  ClosePlan,
  ClosePlanCard,
  Column,
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
  Subtask,
  TrackDraft,
  VerifyResult,
  WriteResult,
} from "./format/view/types";
export { GUIDED_STEPS, MEMORY_FILES, METRICS_WINDOW_DAYS, NO_RELEASE, SCORE_SERIES } from "./format/view/types";

export type {
  CommandState,
  SkillFolder,
  SkillFolderState,
  SkillInstall,
  SkillState,
  SkillWrite,
} from "./format/skill/types";

/** A running or finished agent run, as the UI sees it when it polls the server. One shared
 *  picture across every tab. */
export interface SessionView {
  /** This session's unique id — ours, and the key the run is tracked by. It is the agent's
   *  OWN id only when that harness adopted it (Claude Code does, via `--session-id`); a
   *  harness that mints its own keeps a second id, which the UI never sees — Resume is a
   *  server-side action and the server knows which id to hand back to which CLI. */
  sessionId: string;
  /** Which harness ran this session (a name from the CLI's list, e.g. "claude-code"). Saved
   *  with the run, so the resume handoff is built from the harness the session actually
   *  used — not whatever the setting says today. */
  harness?: string;
  /** The card this session touches, or null for a run that names none (create, propose,
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
  /** How long the session ran, in ms. Terminal sessions only. For an `interrupted` run this
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
  /** The tokens this run consumed, as its own closing event counted them. Terminal sessions
   *  only — the numbers arrive with the agent's last event. */
  usage?: TokenUsage;
  /** The text the user typed for this session — a create's description, an action's notes,
   *  or a reject's reason. Absent when the session carried no note. */
  input?: string;
  /** Exit was clean. Set once the session reaches a terminal state — except an `interrupted`
   *  one, which never reported an exit code at all, so this stays unset rather than guessing
   *  an outcome we never saw. */
  ok?: boolean;
  code?: number | null;
  /** Spawn/child error message, if any. */
  error?: string;
  /** The agent's final message, parsed from its event stream. Terminal sessions only. When
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
  /** The session this one continued, when it was started by Resume. Marks the run in the
   *  panel as a second turn of an earlier conversation. The session it names is gone — a
   *  resumed run replaces the one it took over from — so this is a mark, not a link. */
  resumedFrom?: string;
  /** Tail of the session's output (last few KB). The board-wide poll attaches it only to
   *  terminal sessions; getSession() attaches it for any session — live or done — by
   *  reading the log file, so the UI can tail a running agent. */
  tail?: string;
}
