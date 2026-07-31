// Shapes shared between the board reader (server) and the UI (client).

import type { CardQuestion } from "./questions";

export type Level = "high" | "med" | "low";

/** The most cards auto-refine will work on at once (#88). It lives here, not in
 *  lib/config.ts, because both sides need it and config.ts reads the filesystem
 *  — a client component can't import that. The server clamps the saved setting
 *  to it, the dialog's stepper stops at it. */
export const MAX_PARALLEL = 5;

/** The stage a card rests in, saved on the card so it survives a UI restart.
 *  In order: `todo` (raw), `ready` (plan concrete, no open questions, someone
 *  could start now), `implementing`. `reject`/`archive` take the card off the board, so they
 *  are not statuses — a live session's action is tracked in the session
 *  registry, not here. */
export type CardStatus = "todo" | "ready" | "implementing";

export interface CardMeta {
  title: string;
  track: string;
  priority: string;
  roi: string;
  status: CardStatus;
  blocked_by: number[];
  related: number[];
  /** The card's open questions, plain and options ones alike (see CardQuestion). */
  questions: CardQuestion[];
  /** The parts of the product this card touches (module names from
   *  docs/kanban/modules.md). A card with no field, or an empty list, touches
   *  none. Read-only in the UI — the CLI writes it. */
  modules: string[];
}

/** A pointer to another card — just enough to show a link. */
export interface CardRef {
  id: number;
  title: string;
}

/** A group root's subtask, as shown on the root's page. Light meta only —
 *  clicking through opens the subtask's own `/[id]` page for the full card. */
export interface Subtask {
  id: number;
  title: string;
  track: string;
  todos: { total: number; done: number };
}

export interface Card extends CardMeta {
  id: number;
  /** Path relative to docs/kanban/todo/, e.g. "ui/07-local-kanban-ui.md". */
  relPath: string;
  /** The card body below the frontmatter (markdown). */
  body: string;
  todos: { total: number; done: number };
  /** True when this card is a group root — a `<id>-<slug>/` folder holding a
   *  `root.md`. Read from that folder shape, never from the subtask count: a
   *  finished subtask's file is removed, so a group with everything done has no
   *  subtask files left and would otherwise stop reading as a group. */
  isGroup: boolean;
  /** The `blocked_by` ids that still point at an open card, so this card really
   *  is blocked. An id no longer on the board was archived or rejected and
   *  blocks nothing; a recurring card never closes, so it is skipped too, as is
   *  the card's own id. Empty means nothing is holding this card up. */
  openBlockers: CardRef[];
  /** For a group root: the subtask lines in its `## Todo` (the ones carrying a
   *  `#<subid>` ref), and how many are resolved — ticked `[x]` (done) or struck
   *  `~~…~~` (rejected). The root file keeps this true after the subtask files
   *  are gone, so it is what says a group is finished. Absent on a plain card. */
  subtaskLines?: { total: number; resolved: number };
  /** For a group root (`<id>-<slug>/root.md`): its subtasks, in id order.
   *  Absent on a plain card. Only the OPEN ones — a done or rejected subtask has
   *  no file left, so this shrinks as the group progresses. */
  subtasks?: Subtask[];
  /** For a subtask nested in a group folder: a link back up to the group root.
   *  Absent on a standalone card or a root. */
  parent?: CardRef;
}

export interface Column {
  /** Track folder name, or "blockers". */
  track: string;
  /** Heading to show above the column ("Blockers", or the track name). */
  title: string;
  cards: Card[];
}

export interface ArchiveGroup {
  /** The topic heading from archive.md (e.g. "Skill", "Board format"). */
  category: string;
  /** Raw markdown of the entries under that heading. */
  markdown: string;
}

export interface Board {
  columns: Column[];
  archive: ArchiveGroup[];
  /** Ids of every open card — used to linkify only #<id>s that still exist. */
  openIds: number[];
  /** True when `memory/goal.md`'s `reviewed:` field says the goal isn't clear
   *  enough to plan from (a missing file or field reads weak too). Drives the
   *  goal bar above the board; the board itself works either way. */
  goalWeak: boolean;
}

/** How big a swing a propose run takes. `safe` polishes what already works,
 *  `normal` is a feature-sized card, `bold` is a big move — a whole capability,
 *  usually a group task. The three levels are defined in the skill
 *  (`references/propose.md`, "Boldness"); this is only the name the UI sends. */
export type Boldness = "safe" | "normal" | "bold";

export type AgentAction =
  | "implement"
  | "reject"
  | "archive"
  | "edit"
  | "create"
  | "propose"
  | "auto-refine"
  | "resolve";

/** A running or finished agent session, as the UI sees it when it polls the
 *  server-side registry. One shared picture across every tab. */
export interface SessionView {
  /** This session's unique id — ours, and the key the run is tracked by. It is
   *  the agent's OWN id only when that harness adopted it (Claude Code does, via
   *  `--session-id`); a harness that mints its own keeps a second id, which the
   *  UI never sees on its own — it arrives baked into `resumeCommand`. */
  sessionId: string;
  /** Which harness ran this session (a name from `HARNESSES`, e.g.
   *  "claude-code"). Saved with the run, so the resume handoff is built from the
   *  harness the session actually used — not whatever the setting says today. */
  harness?: string;
  /** The card this session touches, or null for `create` (no card yet). */
  cardId: number | null;
  action: AgentAction;
  /** `interrupted` is its own terminal state: the run was cut off — the UI
   *  server died mid-run and the agent ended out of our sight — so it neither
   *  passed nor reported a failure. It is NOT a finish: it reads as unfinished
   *  work and offers Resume, the same as a failure.
   *
   *  `stopped` is the state of a run the user ended from the UI (#49). Nothing
   *  went wrong with it, so it is never shown as a failure — and it offers no
   *  Resume: a run you ended is over, not one that stopped short. */
  status: "running" | "done" | "error" | "interrupted" | "stopped";
  startedAt: number;
  endedAt?: number;
  /** How long the session ran, in ms. Terminal sessions only. Normally just
   *  `endedAt - startedAt`; when that pair didn't survive (a session read back
   *  from its log alone) it's recovered from the line the registry writes into
   *  the log at close, so a finished session can always say how long it took.
   *  For an `interrupted` run this is an upper bound — we only know it ended by
   *  the time we noticed — so the UI marks it `~`. */
  durationMs?: number;
  /** What this run cost, in US dollars. An ESTIMATE: the agent works it out on
   *  its own machine from the run's tokens at list prices, and the board's
   *  default agent runs on a subscription plan, where a single run isn't charged
   *  at all — so the UI never words it as a bill. It is this run's own number and
   *  nothing more: the board never adds runs up, and a run continued with Resume
   *  reports what that new run cost, not the whole conversation. Absent for a live
   *  run, one cut off before it reported a cost, a run from before this existed,
   *  and an agent command that says nothing about cost — all of which show no
   *  number rather than a zero. */
  costUsd?: number;
  /** The model that did this run's work, as the agent itself reported it — not
   *  the model field in the Configuration dialog, which most people leave empty
   *  and which says nothing about a run that started before it was changed. The
   *  id is shown exactly as the agent said it, suffixes and all; the board never
   *  invents or prettifies a model name. Present from the run's first seconds, so
   *  a live run shows what it is using. Absent for a run from before this
   *  existed, one cut off before its agent named a model, and any agent whose
   *  output never says — all of which show nothing rather than a guess. */
  model?: string;
  /** The text the user typed for this session — a create's description, an
   *  action's notes, or a reject's reason. Shown in the global sessions panel
   *  (#21); absent when the session carried no note. */
  input?: string;
  /** Exit was clean. Set once the session reaches a terminal state — except an
   *  `interrupted` one, which never reported an exit code at all, so this stays
   *  unset rather than guessing an outcome we never saw. */
  ok?: boolean;
  code?: number | null;
  /** Spawn/child error message, if any. */
  error?: string;
  /** The agent's final message, parsed from its event stream. Terminal sessions
   *  only. When present the UI leads with it and folds the event tail away;
   *  absent (custom agent command, or a session re-adopted after a UI restart)
   *  the tail is all there is. */
  result?: string;
  /** This run stopped short — it failed or was interrupted — AND can be picked
   *  up again: the agent that ran it can continue a conversation, it has told us
   *  the id to continue by, and it is still the agent the board runs. The Resume
   *  button appears only then — a run that passed has nothing to continue, and a
   *  run we can't reach again would give a button that could only fail. */
  canResume?: boolean;
  /** The session this one continued, when it was started by Resume. Marks the
   *  run in the panel as a second turn of an earlier conversation rather than a
   *  fresh one. The session it names is gone — a resumed run replaces the one it
   *  took over from — so this is a mark, not a link to follow. */
  resumedFrom?: string;
  /** Tail of the session's output (last few KB). The board-wide poll attaches it
   *  only to terminal sessions; getSession() attaches it for any session — live
   *  or done — by reading the log file, so the UI can tail a running agent. */
  tail?: string;
}

/** One harness the user can pick in the Configuration dialog. */
export interface HarnessOption {
  /** The name written to the `harness` setting, e.g. "claude-code". */
  name: string;
  /** Friendly name shown in the dialog, e.g. "Claude Code". */
  label: string;
  /** One short line under the label, e.g. "Subscription plan". */
  blurb: string;
  /** Public path of the harness's mark, e.g. "/agents/claude.svg". */
  icon: string;
  /** The command this harness runs when the setting carries no override. */
  command: string;
}

/** Which harness runs the card actions, and what the dialog can switch to. */
export interface AgentInfo {
  /** The active harness's name, e.g. "claude-code". */
  name: string;
  /** The resolved command every action runs, e.g. "claude -p" — the harness's
   *  default, or the `harness.command` override from the config file. */
  command: string;
  /** True when the config names no harness at all, so we run the default. */
  isDefault: boolean;
  /** The model id the active harness runs with, as the dialog's field shows it.
   *  Empty means the harness's own default — the board never invents an id. */
  model: string;
  /** True when the `harness.command` override already names a model flag. The
   *  override wins, so the model field above is not in effect and the dialog
   *  says so rather than letting a filled-in field look broken. */
  modelIgnored: boolean;
  /** Every harness the dialog can pick. */
  options: HarnessOption[];
  /** The harness name the config asked for, when we don't know it. We run the
   *  default and say so — never move the user to another agent silently. */
  unknownName?: string;
  /** True when the config still holds the old top-level `command` key. Nothing
   *  reads it, so the dialog says so instead of letting it look live. */
  staleCommand?: boolean;
}
