// Shapes shared between the board reader (server) and the UI (client).

import type { CardQuestion } from "./questions";

export type Level = "high" | "med" | "low";

/** The most cards auto-refine will work on at once (#88). It lives here, not in
 *  lib/config.ts, because both sides need it and config.ts reads the filesystem
 *  — a client component can't import that. The server clamps the saved setting
 *  to it, the dialog's stepper stops at it. */
export const MAX_PARALLEL = 5;

/** A card with no release — wanted, but not promised to a version. The empty
 *  string is that state; there is no sentinel name for it. Both sides need it
 *  (the card reader normalizes to it, the picker offers clearing to it), so it
 *  lives here. */
export const NO_RELEASE = "";

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
  /** The release this card ships in — a free-text version id like `v1`, or
   *  empty for a card in no release: wanted, not promised to a version. The
   *  card page picks it from the open releases (#105), and the header's release
   *  dropdown is where one is made (#115). */
  release: string;
  blocked_by: number[];
  related: number[];
  /** The card's open questions, plain and options ones alike (see CardQuestion). */
  questions: CardQuestion[];
  /** The parts of the product this card touches (module names from
   *  docs/kanban/modules.md). A card with no field, or an empty list, touches
   *  none. Read-only in the UI — the CLI writes it. */
  modules: string[];
  /** When this card last ran, as `YYYY-MM-DD HH:MM` — recurring cards only, and
   *  only once one has run: `kanban run <id>` stamps it. Empty means never run.
   *  Read-only in the UI, like `modules`; both frontmatter serializers keep it,
   *  so an edit in between can't erase it. */
  last_run: string;
  /** How often this card repeats — `30m`, `6h`, `1d at 09:30` (#139). Recurring
   *  cards only, and optional there: empty means the card runs when someone
   *  clicks Run and never on its own. Written by the card page's cadence
   *  control and by `kanban update --cadence`; kept exactly as the file has it,
   *  since reading it is lib/cadence.ts's job. */
  cadence: string;
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
  /** The release this subtask ships in. A subtask carries its own — the root is
   *  a tracking card — and neither board view draws a subtask, so this is what
   *  lets the root stand in for a group under a picked release (#104). */
  release: string;
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
  /** True when this card is a recurring job — it lives under `todo/recurring/`,
   *  a reserved folder whose cards repeat on a cadence instead of being built
   *  once. Read from the path, the same way the CLI reads it. It changes what
   *  the card offers: **Run** instead of Implement, no Archive (a recurring card
   *  has no end state), and no refine (its `## Process` has no todo boxes to
   *  sharpen toward `ready`). */
  recurring: boolean;
  /** When this card comes round again, ready to print: a `YYYY-MM-DD HH:MM`
   *  stamp, or "Due now" when the wait is already over (#139). Empty on a card
   *  with no cadence — nothing will start it but a person — and on every
   *  one-shot card. Worked out on the server, whose clock is the one the
   *  schedule runs on. */
  nextRun: string;
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

/** One box on setup's checklist. `owner` says who does the step: `script` is
 *  already done by the time the board exists, `agent` needs a run in the user's
 *  coding harness, `you` is the user's own — the goal is the one such step, and
 *  the setup bar gives it a button instead of a line to copy. */
export interface SetupStep {
  name: string;
  owner: "script" | "agent" | "you";
  text: string;
  done: boolean;
}

/** How far setup got, read from `docs/kanban/setup-checklist.md`. Absent (null)
 *  means there is no checklist — setup is finished, or the board predates it. */
export interface SetupState {
  done: number;
  total: number;
  /** The first unticked step — what setup does next. */
  next: SetupStep | null;
}

export interface Board {
  columns: Column[];
  archive: ArchiveGroup[];
  /** Ids of every open card — used to linkify only #<id>s that still exist. */
  openIds: number[];
  /** The open releases from `docs/kanban/releases.md`, in ship order. Empty on a
   *  board that plans no versions — then the UI says nothing about releases at
   *  all: no picker, no chip on a card. */
  releases: string[];
  /** How many open cards name each release, keyed by version id, with the empty
   *  key for the cards in no release. It counts every open card — subtasks answer
   *  for themselves, the way they do on the CLI — so the number beside a release
   *  in the board's dropdown (#104) is the one `release list` prints. A release
   *  with nothing open in it is absent, not zero. */
  releaseCounts: Record<string, number>;
  /** True when the board should ask for a goal: `memory/goal.md` is missing or
   *  empty, or the agent judged what's in it `weak` (#108). A goal the user just
   *  wrote never counts — no agent runs on a save, so the board would be asking
   *  for work already done. With no checklist left this is the whole setup bar —
   *  one item, the goal — since the agent can judge a goal weak again long after
   *  setup. */
  goalNeedsWork: boolean;
  /** True when `memory/goal.md` holds the user's own words — so the header's
   *  goal button has something to open (#128). A missing or empty file reads
   *  false, and the setup bar is what asks for the goal in that state. */
  goalWritten: boolean;
  /** Setup's checklist while it exists, null once setup deleted it. Drives the
   *  setup bar above the board; the board itself works either way. */
  setup: SetupState | null;
}

/** How many tasks a propose run writes when the user doesn't say, and the most
 *  it will ever write. The cap is the skill's ("How many" in
 *  `references/propose.md`); both sides need the pair — the dialog's picker
 *  stops at the max, the server clamps whatever a client sends. */
export const PROPOSE_DEFAULT = 3;
export const PROPOSE_MAX = 10;

/** How big a swing a propose run takes. `safe` polishes what already works,
 *  `normal` is a feature-sized card, `bold` is a big move — a whole capability,
 *  usually a group task. The three levels are defined in the skill
 *  (`references/propose.md`, "Boldness"); this is only the name the UI sends. */
export type Boldness = "safe" | "normal" | "bold";

/** The tokens one run consumed, as the agent's own closing event counted them.
 *  Four numbers because the API bills them differently: fresh input, input
 *  written to the prompt cache, input read back from it, and output. This run's
 *  own numbers alone — the board never adds runs together. */
export interface TokenUsage {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
}

export type AgentAction =
  | "implement"
  /** One pass of a recurring card (#64) — the agent walks its `## Process`,
   *  records the run with `kanban run`, and sharpens the process for next time.
   *  It never finishes the card: a recurring job has no end state. */
  | "run"
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
   *  `--session-id`); a harness that mints its own (Codex's thread id) keeps a
   *  second id, which the UI never sees — Resume is a server-side action and the
   *  server knows which id to hand back to which CLI. */
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
  /** The tokens this run consumed, as its own closing event counted them.
   *  Terminal sessions only — the numbers arrive with the agent's last event.
   *  Absent for a live run, one cut off early, an agent whose output reports no
   *  usage, and a run from before this existed — all of which show nothing
   *  rather than zeros. */
  usage?: TokenUsage;
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

/** What one connection test found out (#96) — the Test button in the
 *  Configuration dialog sends a tiny chat through the setup that is saved and
 *  this is everything it learned. The panel under the button is drawn from it
 *  and nothing else. */
export interface ConnectionTest {
  /** The agent answered — the setup works. Nothing reads what it answered. */
  ok: boolean;
  /** How long the test took, in ms. Shown on a pass. */
  ms: number;
  /** The agent's own output, exactly as it came (stdout and stderr in the order
   *  they arrived), for a failure. Never a guess at what went wrong: an
   *  explanation invented on top of a real error message sends people down the
   *  wrong path. Absent on a pass. */
  output?: string;
  /** The agent's CLI isn't on this machine: the command that wasn't found. Its
   *  own kind of failure, because a raw spawn error says nothing a user can act
   *  on — this is the one case the board explains in its own words. */
  missing?: string;
  /** The command that installs it, shown with `missing`. */
  install?: string;
  /** The test gave up on its own after the time limit, so a dead endpoint
   *  reports a failure instead of leaving the panel spinning. */
  timedOut?: boolean;
}

/** One choice on a `select` setting's list. `value` is what gets saved; an
 *  empty `value` means the agent's own default, like an empty text box. */
export interface SettingChoice {
  value: string;
  label: string;
}

/** One provider a connector can talk to (#95) — who pays for a run and where it
 *  goes. A connector ships its own list, the dialog shows the list as one
 *  setting, and the pick decides two things: which of the connector's other
 *  settings are shown, and the whole environment a run starts under.
 *
 *  It is plain data, no functions: this crosses to the browser with the rest of
 *  the settings. The rules that read it live in `lib/providers.ts`, which both
 *  sides share. */
export interface Provider {
  /** What gets saved, e.g. "subscription" — the value of the provider setting. */
  id: string;
  /** The name in the list, e.g. "Anthropic API". */
  label: string;
  /** One plain line under the list saying what this pick is. */
  blurb: string;
  /** The setting keys this provider shows and uses. A setting no provider names
   *  is always shown; one that some provider names is shown, and reaches a run,
   *  only while a provider that needs it is picked. */
  needs: string[];
  /** The subset of `needs` that must carry a value before this pick can be
   *  saved — the endpoint's base URL, without which the pick means nothing. */
  requires?: string[];
  /** Fixed variables this provider sets on every run, on top of what its
   *  settings map to. An empty value is a real setting, not a skip: it is how a
   *  provider says "this variable must be there and empty". */
  env?: Record<string, string>;
  /** The variable a setting's value goes out under while this provider is
   *  picked, INSTEAD of the setting's own `env`, keyed by the setting's key.
   *  One connector's key can mean a different variable per provider — the same
   *  Anthropic key is `ANTHROPIC_API_KEY` on Anthropic's own API and
   *  `ANTHROPIC_AUTH_TOKEN` on a gateway. */
  envAs?: Record<string, string>;
  /** When the file names no provider, this one is the default instead of the
   *  setting's own `defaultProvider` if every setting key listed here is
   *  already filled in. It is how a board that saved a key before the list
   *  existed goes on running with that key. */
  preferWhenSet?: string[];
}

/** One setting a harness declares (#93). A harness's configuration IS its list
 *  of these — the dialog draws the list and nothing else — so a new agent brings
 *  its settings with it instead of the dialog learning its name.
 *
 *  Four shapes ship: a box to type in (`text`), a list to pick one from
 *  (`select`), a key (`secret`, #94), and the provider list (`provider`, #95).
 *  A setting that needs more than these brings it itself. */
export interface HarnessSetting {
  /** The key it saves under inside the `harness` block of ui.config.json — e.g.
   *  `model` writes `harness.model`. `name` and `command` are the block's own
   *  keys, so no setting can take either.
   *
   *  A `secret` saves nowhere near that block: its value goes to
   *  `docs/kanban/.env` under the variable `env` names, and this key only
   *  identifies the field. */
  key: string;
  /** The label above the control, e.g. "Model". */
  label: string;
  /** One plain line of help under the control. Left out when the control needs
   *  none — the provider list explains its picked entry instead (Provider.blurb). */
  help?: string;
  kind: "text" | "select" | "secret" | "provider";
  /** Text only: the hint shown in an empty box. */
  placeholder?: string;
  /** Select only: what the list offers, in the order it shows them. */
  choices?: SettingChoice[];
  /** Provider only: the providers this connector can talk to, in the order the
   *  dialog lists them (#95). */
  providers?: Provider[];
  /** Provider only: the pick a board that has never made one runs under. */
  defaultProvider?: string;
  /** The environment variable this setting's value reaches the run under, e.g.
   *  `ANTHROPIC_API_KEY` for a key or `ANTHROPIC_BASE_URL` for an endpoint. A
   *  setting with no `env` reaches the run some other way (a flag) or not at
   *  all.
   *
   *  For a `secret` it is also the name of the line in `docs/kanban/.env`, so
   *  writing that line by hand and typing the key into the dialog are the same
   *  thing. A secret carries no `flags` — it never touches the command. */
  env?: string;
  /** Every flag name this agent's CLI takes for this setting — how the setting
   *  reaches the command. The first one is what a run appends. A setting with no
   *  flags reaches the run some other way (its own card says how) and adds
   *  nothing to the command. */
  flags?: string[];
  /** The line to show instead of `help` when a hand-written `harness.command`
   *  already names one of `flags`: the override wins, so the field isn't in
   *  effect and a filled-in one never looks broken. */
  overriddenHelp?: string;
}

/** One harness the user can pick in the Configuration dialog. */
export interface HarnessOption {
  /** The name written to the `harness` setting, e.g. "claude-code". */
  name: string;
  /** Friendly name shown in the dialog, e.g. "Claude Code". */
  label: string;
  /** Public path of the harness's mark, e.g. "/agents/claude.svg". */
  icon: string;
  /** The command this harness runs when the setting carries no override. */
  command: string;
  /** The settings this harness takes, in the order the dialog draws them. Each
   *  agent brings its own list; picking one draws that list and nothing else. */
  settings: HarnessSetting[];
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
  /** What the active harness's settings are set to, keyed by the setting's key
   *  (`model` for `harness.model`). A key that isn't here is unset — the agent's
   *  own default; the board never invents a value. A `secret` is never in
   *  here: a saved key is never read back (see `secretsSet`).
   *
   *  The provider setting (#95) is the one exception: it always carries a
   *  value, because a run always goes through one provider. A board that never
   *  picked reads as the default, and so the dialog shows what the run will
   *  actually do. */
  values: Record<string, string>;
  /** The keys of the `secret` settings that have a key in `docs/kanban/.env`
   *  right now — set or not set, and nothing more. The value never leaves the
   *  server, so the dialog shows Replace and Clear instead of the key. A key
   *  written into that file by hand shows here too: the file is the one place
   *  the board looks. */
  secretsSet: string[];
  /** The keys of the settings a `harness.command` override already names. The
   *  override wins, so those fields aren't in effect and the dialog says so
   *  rather than letting a filled-in field look broken. */
  ignored: string[];
  /** Every harness the dialog can pick. */
  options: HarnessOption[];
  /** The harness name the config asked for, when we don't know it. We run the
   *  default and say so — never move the user to another agent silently. */
  unknownName?: string;
  /** True when the config still holds the old top-level `command` key. Nothing
   *  reads it, so the dialog says so instead of letting it look live. */
  staleCommand?: boolean;
}
