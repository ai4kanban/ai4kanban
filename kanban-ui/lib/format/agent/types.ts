// Copied from cli/src/lib/agent/types.ts by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

// The shapes an agent run is described by — what a connector takes, what one run is, and
// what a reader is told about it.
//
// They are plain data on purpose: the board UI draws its Configuration dialog from the
// very same objects, handed over by `akb agent list --json`, so a front end never keeps
// its own list of agents or of the settings each one takes.

/** How many tasks a propose run writes when nobody says, and the most it will ever write.
 *  The cap is the flow's ("How many" in `akb guide propose`). */
export const PROPOSE_DEFAULT = 3
export const PROPOSE_MAX = 10

/** How big a swing a propose run takes. The levels are the skill's
 *  (`akb guide propose`, "Boldness"); this is only the name a run sends. */
export type Boldness = 'safe' | 'normal' | 'bold'

/** The tokens one run consumed, as the agent's own closing event counted them. Four
 *  numbers because the API bills them differently: fresh input, input written to the
 *  prompt cache, input read back from it, and output. This run's own numbers alone — the
 *  board never adds runs together. */
export interface TokenUsage {
  input: number
  cacheCreation: number
  cacheRead: number
  output: number
}

/** Every kind of run the board can start. Each one is a command of its own. */
export type AgentAction =
  | 'implement'
  /** One pass of a recurring card — the agent walks its `## Process` and the run is
   *  stamped at the end. It never finishes the card: a recurring job has no end state. */
  | 'run'
  | 'reject'
  | 'archive'
  | 'edit'
  | 'create'
  | 'propose'
  /** Fill one release with the open cards that ship its goal, and write the ones the goal
   *  needs that the board is missing. It touches no single card, so it carries a release
   *  id instead of a card id. */
  | 'plan-release'
  | 'auto-refine'
  | 'resolve'

/** Everything one run is asked for. What the user typed rides along so the run list can
 *  show it beside the log. */
export interface AgentRequest {
  action: AgentAction
  id?: number
  title?: string
  notes?: string // implement, edit, auto-refine, resolve, archive, run
  reason?: string // reject
  description?: string // create
  /** create: the version the new card(s) ship in. plan-release: the version being
   *  planned — the whole of what that run is about, since it names no card. */
  release?: string
  module?: string // propose: the focus module (a name from modules.md)
  count?: number // propose: how many tasks to write (1–PROPOSE_MAX)
  boldness?: Boldness // propose: how big a swing the tasks take
  andImplement?: boolean // resolve: keep going and implement once the questions settle
}

/** How a run ended, or that it hasn't.
 *
 *  `interrupted` is not a finish: the run was cut off — the process watching it died, the
 *  agent ended out of our sight — so there is no exit code and no reason to believe the
 *  work is complete. It reads as unfinished and offers Resume, like a failure.
 *
 *  `stopped` is a run somebody ended. Nothing went wrong, so it is never shown as a
 *  failure, and it offers no Resume: a run you ended is over. */
export type RunStatus = 'running' | 'done' | 'error' | 'interrupted' | 'stopped'

/** One run, as the shared record holds it. Every process reads and writes this same
 *  shape — the record is the only thing that knows what is running. */
export interface RunRecord {
  /** This run's id and the record's key — ours, always, generated before anything
   *  spawns. A harness that mints an id of its own keeps it in `resumeId`. */
  sessionId: string
  cardId: number | null
  action: AgentAction
  status: RunStatus
  startedAt: number
  endedAt?: number
  /** The process watching this run — the supervisor, not the agent. It is what a stop
   *  signals and what a reader checks to tell a live run from one that was cut off. */
  pid?: number
  /** The text the user typed for this run — a create's description, an action's notes, a
   *  reject's reason, or the release a plan run was pointed at. */
  input?: string
  ok?: boolean
  code?: number | null
  error?: string
  /** What this run cost in US dollars, as its own output reported it at close. An
   *  estimate the agent worked out from tokens at list prices — not a bill. */
  costUsd?: number
  usage?: TokenUsage
  /** The model that did the work, as the run's own output named it. */
  model?: string
  /** The agent's final message, parsed out of its event stream at close. */
  result?: string
  /** The harness this run ran under, recorded when it starts, so a finished run keeps
   *  showing the agent that ran IT — changing the setting later can't rewrite history. */
  harness: string
  /** The run's SECOND id: the one that harness's own CLI resumes by. Set only when it
   *  isn't ours to know — the harness minted its own mid-run, or this run continues an
   *  earlier conversation and inherited that one's id. */
  resumeId?: string
  logPath: string
  /** The run this one continued, when it was started by Resume. It names a run that is
   *  deliberately gone: resuming drops the record it took over from. */
  resumedFrom?: string
  /** The card's saved stage the instant before this run overwrote it with
   *  `implementing`, so the end of the run puts back what was there. */
  priorStatus?: string
  /** A stop has been asked for. Written so the supervisor's own end, whichever path
   *  witnesses it, records `stopped` rather than a failure. */
  stopping?: boolean
}

/** One run as a reader is told about it — the record, plus the few things worked out
 *  fresh on every read (how long it took, whether it can be resumed). */
export interface RunView extends RunRecord {
  durationMs?: number
  /** This run stopped short — it failed or was cut off — and can be picked up: we know
   *  the id to continue by, and the agent that ran it is still the one the board runs. */
  canResume?: boolean
  /** The run's log, when it was asked for. */
  tail?: string
}

/** One choice on a `select` setting's list. An empty `value` means the agent's own
 *  default, like an empty text box. */
export interface SettingChoice {
  value: string
  label: string
}

/** One provider a connector can talk to — who pays for a run and where it goes. A
 *  connector ships its own list, and the pick decides two things: which of the
 *  connector's other settings apply, and the whole environment a run starts under. */
export interface Provider {
  /** What gets saved, e.g. "subscription". */
  id: string
  label: string
  /** One plain line saying what this pick is. */
  blurb: string
  /** The setting keys this provider shows and uses. A setting no provider names is
   *  always in effect; one some provider names applies only while it is picked. */
  needs: string[]
  /** The subset of `needs` that must carry a value before this pick can be saved. */
  requires?: string[]
  /** Fixed variables this provider sets on every run. An empty value is a real setting,
   *  not a skip: it is how a provider says "this must be there and empty". */
  env?: Record<string, string>
  /** The variable a setting's value goes out under while this provider is picked,
   *  INSTEAD of the setting's own `env`, keyed by the setting's key. */
  envAs?: Record<string, string>
  /** When the file names no provider, this one is the default instead of the setting's
   *  own if every key listed here is already filled in. */
  preferWhenSet?: string[]
}

/** One setting a harness declares. A harness's configuration IS its list of these, so a
 *  new agent brings its settings with it instead of a front end learning its name. */
export interface HarnessSetting {
  /** The key it saves under inside this agent's block in ui.config.json. `command` is
   *  the block's own key, so no setting can take it. A `secret` saves nowhere near that
   *  block: its value goes to `docs/kanban/.env` under the variable `env` names. */
  key: string
  label: string
  help?: string
  kind: 'text' | 'select' | 'secret' | 'provider'
  placeholder?: string
  choices?: SettingChoice[]
  providers?: Provider[]
  defaultProvider?: string
  /** The environment variable this setting's value reaches the run under. For a `secret`
   *  it is also the name of the line in `docs/kanban/.env`. */
  env?: string
  /** Every flag name this agent's CLI takes for this setting. The first one is what a
   *  run appends. A setting with no flags reaches the run some other way. */
  flags?: string[]
  /** The line to show instead of `help` when a hand-written `command` already names one
   *  of `flags`: the override wins, so the field isn't in effect. */
  overriddenHelp?: string
}

/** One agent the board can run. */
export interface HarnessOption {
  name: string
  label: string
  /** Public path of the harness's mark, e.g. "/agents/claude.svg". */
  icon: string
  /** The command this harness runs when the setting carries no override. */
  command: string
  settings: HarnessSetting[]
}

/** Which agent runs the board, what it is set to, and what it could be switched to. */
export interface AgentInfo {
  name: string
  /** The resolved command every run spawns — the harness's default, or the `command`
   *  override from the config file. */
  command: string
  /** True when the config names no agent at all, so we run the default. */
  isDefault: boolean
  /** What the active harness's settings are set to. A `secret` is never in here. */
  values: Record<string, string>
  /** The keys of the `secret` settings docs/kanban/.env holds right now — set or not
   *  set, and nothing more. The value never leaves this machine. */
  secretsSet: string[]
  /** The keys whose flag the `command` override already names, so the override wins. */
  ignored: string[]
  /** Every agent the board can run, with the settings each one takes. */
  options: HarnessOption[]
  /** The agent name the config asked for, when we don't ship it. We run the default and
   *  say so — never move the user to another agent silently. */
  unknownName?: string
  /** The file still holds the old top-level `command` key. Nothing reads it. */
  staleCommand?: boolean
}

/** What one connection test found out. */
export interface ConnectionTest {
  /** The agent answered — the setup works. Nothing reads what it answered. */
  ok: boolean
  ms: number
  /** The agent's own output, exactly as it came, for a failure. Never a guess at what
   *  went wrong: an explanation invented on top of a real error sends people down the
   *  wrong path. */
  output?: string
  /** The agent's CLI isn't on this machine: the command that wasn't found. */
  missing?: string
  /** The command that installs it, shown with `missing`. */
  install?: string
  /** The test gave up on its own after the time limit. */
  timedOut?: boolean
}
