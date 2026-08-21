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
  /** Take a card from vague to ready. Always the loop — check, rewrite, resolve, round
   *  again — never a single pass; `akb guide refine` is the whole of it. */
  | 'refine'
  | 'resolve'
  /** Finish setting the board up — every step still unticked on
   *  `docs/kanban/setup-checklist.md`, in one run. It names no card and no release: the
   *  checklist is the plan, and the run starts at its first unticked box, so a run started
   *  again after a failure carries on from where the last one stopped. */
  | 'setup'
  /** One spec agent filling the part of a card's spec it owns (#187). It is named by
   *  `specAgent`, it starts clean, and it writes one section of that card and nothing
   *  else. A flow asks for one; the board starts it once that flow's own run has ended. */
  | 'spec'

/** Everything one run is asked for. What the user typed rides along so the run list can
 *  show it beside the log. */
export interface AgentRequest {
  action: AgentAction
  id?: number
  title?: string
  notes?: string // implement, edit, refine, resolve, archive, run
  reason?: string // reject
  description?: string // create
  /** create: the version the new card(s) ship in. plan-release: the version being
   *  planned — the whole of what that run is about, since it names no card. */
  release?: string
  module?: string // propose: the focus module (a name from modules.md)
  count?: number // propose: how many tasks to write (1–PROPOSE_MAX)
  boldness?: Boldness // propose: how big a swing the tasks take
  andImplement?: boolean // resolve: keep going and implement once the questions settle
  /** spec: which spec agent this run is — a name from `lib/spec-agents.ts`. It decides
   *  the prompt the run is given and the section it is allowed to write. */
  specAgent?: string
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
  /** Which spec agent this run is, on a `spec` run. Kept on the record so the run list can
   *  say which one is working, and so a resume starts the same agent again. */
  specAgent?: string
}

/** One ask for a spec agent, as the run that wanted it wrote it down.
 *
 *  These do NOT live on the record. They are a handoff one process writes and one process
 *  reads once — the run's own watcher, at its close — so they sit beside the run's plan,
 *  in a file of the run's own. That also keeps them out of reach of an older copy of these
 *  rules polling the record: the record is rebuilt field by field on every read, so a
 *  reader that predates a field drops it, and a dropped ask is a spec agent that silently
 *  never runs. */
export interface SpecAsk {
  /** The agent's name — a name from `lib/spec-agents.ts`. */
  specAgent: string
  cardId: number
  /** What the flow wants looked at, in a line or two. Everything else the agent is given
   *  is the card itself: the conversation that asked is deliberately not passed on. */
  notes?: string
}

/** One run as a reader is told about it — the record, plus the few things worked out
 *  fresh on every read (how long it took, whether it can be resumed). */
export interface RunView extends RunRecord {
  durationMs?: number
  /** This run ended before finishing — it failed, was cut off or was stopped — and can be
   *  picked up: we know the id to continue by, and the agent that ran it is still the one
   *  the board runs. */
  canResume?: boolean
  /** The run's log, when it was asked for. */
  tail?: string
}

// ---- talking to the agent, rather than setting it a job ---------------------

/** One thing said in a conversation. `you` is the user's message, `agent` is the reply as
 *  it was written — the agent's words, its thinking and the tool calls it made, exactly the
 *  text that went past on screen. */
export interface ChatMessage {
  role: 'you' | 'agent'
  text: string
  at: number
  /** On a reply that stopped before the agent had finished: why, in the agent's own words
   *  where it gave any. `text` is what arrived before it stopped, and it is kept. */
  stoppedWhy?: string
}

/** One conversation — the board's, or one card's. It is not a run: nothing here reaches
 *  the run record, so a chat never shows in the runs panel, never holds a card, and never
 *  keeps a run off one. */
export interface Chat {
  /** Null for the conversation about the whole board; a card id for that card's own. */
  cardId: number | null
  /** The agent this conversation is being held with. A board switched to another agent
   *  can't carry it on — that agent's CLI knows nothing about this session. */
  harness: string
  /** The id that agent's own CLI carries the conversation on by. Absent until the agent
   *  has named one, which for most of them is partway through the first reply. */
  resumeId?: string
  /** The model the last reply was written by, as the agent named it. */
  model?: string
  messages: ChatMessage[]
  startedAt: number
  updatedAt: number
}

/** Which agent holds this board's conversations, and whether it can hold one at all. */
export interface ChatAgent {
  name: string
  label: string
  /** Its command can be sent a second message into the session it already opened. */
  canChat: boolean
  /** The labels of every agent the board ships that can — what a refusal names, so the
   *  user is told where to go rather than only what doesn't work. */
  able: string[]
}

/** A conversation as a reader is shown it: the conversation itself when there is one, plus
 *  what the board can do about it right now. */
export interface ChatView {
  cardId: number | null
  chat: Chat | null
  /** The agent the board runs right now can hold a conversation. */
  canChat: boolean
  /** That agent's label, for saying which one is meant. */
  agent: string
  /** The labels of every agent that can hold one — what a refusal names. */
  able: string[]
  /** Why a message can't be sent right now, when something is in the way: the agent can't
   *  hold a conversation, this one belongs to another agent, or a reply is still coming. */
  blocked?: string
}

/** What sending one message came back with. */
export interface ChatReply {
  /** The reply as it was written, and as the transcript keeps it. */
  text: string
  /** The reply stopped before the agent had finished; `text` is what arrived. */
  stoppedWhy?: string
  /** The model that wrote it, when the agent named one. */
  model?: string
  chat: Chat
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

/** One thing this connector can't do that another one can (`agent/capabilities.ts`). The
 *  words are the board's own, so a screen listing them never keeps a copy that could say
 *  something else. */
export interface HarnessGap {
  id: string
  /** The capability, named as a person would ask for it. */
  label: string
  /** What happens instead on a connector that lacks it. */
  blurb: string
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
  /** The binary a run would spawn: the first word of this agent's command — the `command`
   *  override in its own block when it has one, its default otherwise. */
  binary: string
  /** True when that binary is on the PATH a run would be spawned on. Worked out fresh on
   *  every read, never cached, and it starts nothing: it says the CLI is there, not that
   *  it is logged in or that a run would pass. That is `testConnection`'s answer. */
  installed: boolean
  /** The command that installs this agent's CLI. Handed over wherever the CLI turns out
   *  not to be on the machine — a picker offering it, a run that can't spawn, a failed
   *  test — so the user reads what to do instead of a raw spawn error. */
  install: string
  /** What this agent can't do that another one on the list can, worked out fresh on every
   *  read. Empty for a connector that lacks nothing. A screen offering the agents shows
   *  these where the pick is made, so what a switch costs is read before it is paid. */
  gaps: HarnessGap[]
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

/** One spec agent, as a screen reads it (#191) — the two lines it is shown by, and
 *  whether it is switched on. The words are the board's own (`lib/spec-agents.ts`), so a
 *  screen listing them never keeps a copy that could say something else. */
export interface SpecAgentView {
  name: string
  /** What that agent fills in, in one line. */
  owns: string
  /** The kind of card the board calls it for, in one line. */
  calledOn: string
  /** False only when somebody switched it off. While it is off the board starts no new run
   *  of it, on any card, from a screen or a terminal. */
  enabled: boolean
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
