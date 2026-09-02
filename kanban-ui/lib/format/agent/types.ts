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

/** How much planning QA one refinement needs. */
export type RefineEffort = 'lightweight' | 'standard'

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

/** Every kind of agent session the board can start. */
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
  /** Work a task's plan over to convergence (`akb guide qa-loop`): settle every gap the
   *  session can settle itself, and leave only the decisions that are the user's. */
  | 'clarify'
  | 'resolve'
  /** Improve a settled card's writing and mark it ready. */
  | 'writing'
  /** Finish setting the board up — every step still unticked on
   *  `docs/kanban/setup-checklist.md`, in one run. It names no card and no release: the
   *  checklist is the plan, and the run starts at its first unticked box, so a run started
   *  again after a failure carries on from where the last one stopped. */
  | 'setup'
  /** One spec agent filling the part of a card's spec it owns (#187). It is named by
   *  `specAgent`, it starts clean, and it writes one section of that card and nothing
   *  else. A flow asks for one; the board starts it once that flow's own run has ended. */
  | 'spec'
  /** Write one closed version's changelog (#232) — a few plain lines saying what the
   *  version changed, from the goal and the cards the close wrote down. It touches no
   *  card, so it carries a release id, and the close that made the record starts it. */
  | 'changelog'
  /** Judge and fix a delivery against its approved card in a fresh run (#302). */
  | 'review'
  /** A correction run already in flight when upgrading from the older review loop. */
  | 'correct'
  /** Resolve the conflict a landing's rebase stopped on (#304). It may read both cards,
   *  both diffs and the checkout, it stages the resolution, and the board finishes the
   *  rebase after it. Its result is reviewed from scratch. */
  | 'conflict'

/** The action names used by refinement passes (`agent/refine.ts`). A pass carries its
 *  refine round; `resolve` without one is the standalone flow a user typed. */
export const REFINE_ACTIONS: ReadonlySet<AgentAction> = new Set<AgentAction>([
  'clarify',
  'resolve',
  'writing',
])

/** Everything one run is asked for. What the user typed rides along so the run list can
 *  show it beside the log. */
export interface AgentRequest {
  action: AgentAction
  id?: number
  title?: string
  notes?: string // implement, edit, clarify, resolve, archive, run
  reason?: string // reject
  description?: string // create
  /** create: the version the new card(s) ship in. plan-release: the version being
   *  planned, and changelog: the version being written up — the whole of what either run
   *  is about, since neither names a card. */
  release?: string
  module?: string // propose: the focus module (a name from modules.md)
  count?: number // propose: how many tasks to write (1–PROPOSE_MAX)
  boldness?: Boldness // propose: how big a swing the tasks take
  andImplement?: boolean // resolve: keep going and implement once the questions settle
  /** Internal position in a watcher-managed refinement run chain. */
  refineRound?: number
  /** The one QA guide this refinement's clarify session loads. */
  refineEffort?: RefineEffort
  /** The flow this run belongs to. Absent on the run that opens one — it is given an id
   *  when it is written down, and every session it goes on to start inherits that id. */
  flowId?: string
  /** spec: which spec agent this run is — a name from `lib/spec-agents.ts`. It decides
   *  the prompt the run is given and the section it is allowed to write. */
  specAgent?: string
  /** implement: how THIS build commits (#346) — the Implement dialog's tick, and this one
   *  delivery's answer. Absent on every other way in — a terminal `akb implement`, a queued
   *  build, a resolve that carries on — and those fall back to **Allow automatic Git
   *  commits**. Ignored where no worktree is possible; the build is manual there regardless. */
  commitMode?: DeliveryCommitMode
}

/** Actions accepted by user-facing run commands. Internal refinement actions are absent. */
export type CommandAction =
  | Exclude<AgentAction, 'clarify' | 'writing' | 'spec' | 'correct'>
  | 'refine'

/** A user-facing command request; `refine` is transformed before a session starts. */
export interface CommandRequest extends Omit<AgentRequest, 'action'> {
  action: CommandAction
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

/** One reason an implementation cannot safely continue, written for the person who can
 *  unblock it. It belongs to the run, not to the card's planning questions. */
export interface ExecutionBlocker {
  step: string
  cause: string
  unblock: string
}

/** One run, as the shared record holds it. Every process reads and writes this same
 *  shape — the record is the only thing that knows what is running. */
export interface RunRecord {
  /** This run's id and the record's key — ours, always, generated before anything
   *  spawns. A harness that mints an id of its own keeps it in `resumeId`. */
  sessionId: string
  cardId: number | null
  /** Cards this run created through `akb board create`. A cardless creation run holds these
   *  until it closes, so an overlapping run cannot adopt and refine its half-written cards. */
  createdCardIds?: number[]
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
  /** A concrete interruption that needs one action from the user before Resume. */
  blocker?: ExecutionBlocker
  /** What this run cost in US dollars, as its own output reported it at close. An
   *  estimate the agent worked out from tokens at list prices — not a bill. */
  costUsd?: number
  usage?: TokenUsage
  /** The model that did the work, as the run's own output named it. */
  model?: string
  /** The agent's final message, parsed out of its event stream at close. */
  result?: string
  /** What the BOARD has to say about how this run ended, when the agent's own message
   *  can't: a refinement loop that stopped with its card still unsettled, or a board this
   *  run left disagreeing with itself. Kept apart from `result` so the two voices are never
   *  mixed. Several of them are one string, a blank line between each. */
  note?: string
  /** The harness this run ran under, recorded when it starts, so a finished run keeps
   *  showing the agent that ran IT — changing the setting later can't rewrite history. */
  harness: string
  /** The runtime it was resolved through (#343), recorded for the same reason. Absent on a
   *  run written before runtimes existed. */
  runtime?: string
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
  /** Position in a watcher-managed refinement run chain. */
  refineRound?: number
  /** The QA guide this refinement uses across its sessions and resume. */
  refineEffort?: RefineEffort
  /** The FLOW this run is one session of — the id shared by the command a user typed and
   *  every session it went on to start: a refinement's passes, the spec agents a create
   *  asked for, the review that follows a build. It is what lets the runs panel show one
   *  job instead of six unrelated rows. A run recorded before flows carries none and
   *  stands on its own. */
  flowId?: string
  /** The delivery this run belongs to, when it belongs to one. Only an `implement` run
   *  does today; a refine, a resolve or a propose stands alone and carries none. */
  deliveryId?: string
}

// ---- a delivery: everything one Implement click starts ---------------------

/** How a delivery ended, or that it hasn't.
 *
 *  `active` covers a delivery still working AND one whose run failed or was cut off —
 *  the card stays held either way, until Resume carries it on or Discard ends it.
 *  A delivery is never "blocked": it is running or it has ended, and a pause is read off
 *  the card. */
export type DeliveryStatus = 'active' | 'finished' | 'failed' | 'cancelled'

/** One step a delivery entered, as history. Resuming never trusts it — a stored position
 *  goes stale in exactly the crash it exists for — so it is read, not acted on. */
export interface DeliveryStep {
  step: string
  at: number
}

// ---- what review said about a delivery's work (#302) -----------------------

/** What one review pass concluded. `correct` is retained only to read records written by
 *  the older review/correction loop. New conclusions are derived as `pass` or `ask`. */
export type ReviewVerdict = 'pass' | 'correct' | 'ask'

/** One thing a review found. */
export interface ReviewFinding {
  title: string
  /** The requirement or changed code it concerns, and the evidence needed to act on it. */
  detail: string
}

/** One review pass, as the delivery keeps it. */
export interface ReviewRound {
  sessionId: string
  verdict: ReviewVerdict
  findings: ReviewFinding[]
  at: number
}

/** Why review stopped for the user. Historical reasons remain readable. */
export type ReviewStopReason =
  | 'ask'
  | 'repeat'
  | 'no-progress'
  | 'session'
  | 'limit'
  | 'uncommitted'
  /** Landing could go no further on its own (#304): the target branch kept moving, or a
   *  conflict stayed unresolved. */
  | 'landing'

/** Review across a delivery. Correction fields remain for old records. */
export interface DeliveryReview {
  rounds: ReviewRound[]
  /** Legacy correction count. */
  corrections: number
  /** Legacy pre-correction fingerprint. */
  mark?: string
  stopped?: {
    reason: ReviewStopReason
    /** One plain sentence: what stopped it, in the words the card's question uses. */
    why: string
    at: number
  }
}

// ---- landing a delivery on the target branch (#304) -------------------------

/** Where a delivery stands on landing.
 *
 *  `waiting` — reviewed and ready, queued for the repository's one landing slot, or put
 *  back in the queue because the checkout was not clean. `landing` — it holds the slot.
 *  `landed` — its commit is on the target branch. `conflict` — a conflict it could not
 *  resolve stopped it, and the card carries the question. */
export type LandingStatus = 'waiting' | 'landing' | 'landed' | 'conflict'

/** One check a landing ran, and what it said. With no review rule (#306) the re-review is
 *  the whole gate, so that is what this records. */
export interface LandingCheck {
  name: string
  ok: boolean
  at: number
}

/** How a delivery's landing is going. It is also the landing SLOT: exactly one active
 *  delivery may be `landing`, which is what "one card at a time" means. */
export interface DeliveryLanding {
  status: LandingStatus
  /** Why it is waiting, or why it stopped — one plain sentence. */
  why?: string
  /** Rebases spent on a target branch that kept moving. `MAX_LAND_ATTEMPTS` and then the
   *  card gets an open question rather than another round. */
  attempts: number
  /** When the last rebase finished. */
  rebasedAt?: number
  /** The squash commit that landed. */
  commit?: string
  /** The target tip it landed onto — the comparison base the landed commit sits on. */
  onto?: string
  /** Cards whose delivery touches the same files. A warning recorded here, never a reason
   *  to refuse. */
  overlap?: number[]
  /** The checks that ran for this landing, with their results. */
  checks?: LandingCheck[]
  at: number
}

// ---- diff approval: the tree the user signed off (#308) ---------------------

/** One thing that happened to a delivery's approval, kept in order so the record says who
 *  approved what and why an approval stopped standing. */
export interface DeliveryApprovalEvent {
  /** `approved` — the user signed the tree off. `cancelled` — the base or the tree moved
   *  under the approval, so it stopped covering what would land. */
  kind: 'approved' | 'cancelled'
  /** The base commit the approval covered. */
  base?: string
  /** The candidate's fingerprint it covered. */
  mark?: string
  /** On a cancellation: which of the two moved. */
  moved?: 'base' | 'tree'
  /** Where the approval came from — the card page, or `akb approve`. */
  from?: string
  at: number
}

/** Whether this delivery needs the user's approval before it lands, and the approval it has
 *  (#308).
 *
 *  `required` is frozen when the delivery starts, the way its commit mode is. `granted` is
 *  the approval standing right now: it is bound to the base commit and the candidate's
 *  fingerprint as they stood when it was given, and landing drops it the moment either one
 *  moves — otherwise "approved" would stop meaning anything. */
export interface DeliveryApproval {
  required: boolean
  granted?: { base?: string; mark?: string; from?: string; at: number }
  /** Every approval given and every one cancelled, oldest first. */
  events: DeliveryApprovalEvent[]
}

/** One delivery: one end-to-end effort to implement an exact version of a card. It has an
 *  id, a card has at most one active one, and it is several runs long.
 *
 *  It lives twice. This row sits in `docs/kanban/.sessions.json`, where the lock and the
 *  card page read it. The permanent copy is one JSON file per delivery under
 *  `docs/kanban/deliveries/`, tracked in git and kept after the card is archived. */
export interface DeliveryRecord {
  deliveryId: string
  cardId: number
  /** The card's title when the delivery started, so a record still names its card after
   *  the card has been archived. */
  title: string
  status: DeliveryStatus
  startedAt: number
  endedAt?: number
  /** Every run in this delivery, oldest first. */
  sessions: string[]
  /** The approved requirements, copied out of the card when the delivery started: the
   *  title, the opening paragraph, `## Worth noting`, `## Scope`, `## Scope out` and every
   *  spec agent's section. Every run in the delivery builds from THIS, so a change to
   *  the card file underneath never changes what the delivery was approved to build. */
  approved: string
  /** Questions already open when implementation began. Review waits only on a new decision
   *  it appends; these pre-existing questions continue to hold at landing. */
  initialQuestions?: number
  /** The steps this delivery entered, in order. */
  steps: DeliveryStep[]
  /** The commit the candidate is compared against — the repository's HEAD when the
   *  delivery started. Review reads `git diff <base>`, so the diff is everything this
   *  delivery changed and nothing that was already there. Absent outside a git
   *  repository, and review says so rather than guessing at a base. */
  base?: string
  /** What each completed review concluded (#302). */
  review?: DeliveryReview
  /** The card's stage the instant before the delivery's FIRST run overwrote it with
   *  `implementing`, so the end of the delivery puts back what was there — not the
   *  `implementing` its own second run would otherwise have found and saved. */
  priorStatus?: string
  /** The run this delivery is due to start next, written the moment the one before it
   *  closed. The watcher reads it and clears it; it survives a watcher that died between
   *  the two, so the delivery still says what it was about to do. */
  next?: 'review'
  /** How this delivery commits, decided when it started and never afterwards (#303).
   *  `auto` builds on its own branch in its own worktree; `manual` works in the user's
   *  checkout and waits for them to commit. Flipping the setting changes the next
   *  delivery, never one already in flight. */
  commitMode?: DeliveryCommitMode
  /** Why this delivery is in manual commit mode when the setting did not ask for it —
   *  no git, or no commit to fork from. The card page says it in these words. */
  manualWhy?: string
  /** The branch checked out in the user's own checkout when the delivery started: where
   *  its work is meant to land. Read once, so a branch switched later can't move the
   *  target under a card whose author only ever saw one. */
  targetBranch?: string
  /** The delivery's own worktree, repo-relative — `.akb/worktrees/<card>/<delivery>`.
   *  Absent in manual commit mode, which works in the project itself. */
  worktree?: string
  /** The branch that worktree builds on — `card/<card>/<delivery>`. */
  branch?: string
  /** What review passed, in manual commit mode: the fingerprint of the code as it stood
   *  when review finished, and where the diff of it was written. The user's own commit
   *  is matched against this — the same code committed reads as the same fingerprint, and
   *  anything else goes back through review. */
  reviewed?: { mark: string; diff?: string; at: number }
  /** Where this delivery stands on landing (#304). Absent until review has passed it in
   *  auto commit mode; manual commit mode never lands, because the commit is the user's. */
  landing?: DeliveryLanding
  /** Whether this delivery needs the user to approve the tree before it lands, and the
   *  approval it has (#308). `required` is read from the setting when the delivery starts
   *  and never again, so flipping the setting changes the next delivery. Absent on a
   *  delivery started before diff approval existed, which needs none. */
  approval?: DeliveryApproval
  /** The flow rules this delivery froze when it started (#306), keyed by command — the
   *  flows a delivery is made of, and only the ones that had a rule. Every run in the
   *  delivery is given these rather than the files, so editing a rule changes the next
   *  delivery and never one in flight. Absent on a delivery started before flow rules
   *  existed, which reads the files instead. */
  rules?: Record<string, string>
}

/** One flow and the rule it carries, as the Rules pane draws it (#306). The list is the
 *  board's own — every command that can start a flow — so a flow shipped later appears
 *  without the pane being touched. */
export interface FlowRuleView {
  /** The command a user types, which is also the rule file's name. */
  command: string
  /** One clause of plain words saying what the flow is. */
  gloss: string
  /** What this flow's rule is for, or what it can cost. Absent when there is nothing
   *  particular to say about this flow's rule. */
  note?: string
  /** The rule as it stands, or empty when the flow has none. */
  rule: string
}

/** How a delivery commits its work (#303). */
export type DeliveryCommitMode = 'auto' | 'manual'

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
  refineEffort?: RefineEffort
}

/** One ask for a refinement, written down by the run that asked for it with
 *  `akb refine <id>`. Same handoff as `SpecAsk`, in the same file and started by the same
 *  watcher — and in the same flow, so the refinement reads as the next step of the job
 *  that handed the card over. */
export interface RefineAsk {
  cardId: number
  notes?: string
  effort?: RefineEffort
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
  /** How long this reply took, in ms — the board's own clock, from the moment the message
   *  was sent to the moment the turn ended. On a reply, and counted for a stopped one too:
   *  it ran for the time it ran. */
  ms?: number
  /** What the turn consumed, when the connector counted it (agent/harnesses/). Absent on
   *  one that reports no usage — nothing is estimated in its place. */
  usage?: TokenUsage
  /** What the turn cost in US dollars, when the connector priced it. The agent's own
   *  arithmetic from tokens at list prices, never a bill. */
  costUsd?: number
}

/** What a conversation is about: the whole board, one card, or the board's first run
 *  (#280). The first run's is separate from the board's own so neither can read the
 *  other's — one is a form being filled in, the other is a chat about a working board. */
export type ChatTarget = number | null | 'setup'

/** One conversation — the board's, one card's, or the first run's. It is not a run:
 *  nothing here reaches the run record, so a chat never shows in the runs panel, never
 *  holds a card, and never keeps a run off one. */
export interface Chat {
  /** Null for the conversation about the whole board, a card id for that card's own, and
   *  `setup` for the first run's. */
  cardId: ChatTarget
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
  cardId: ChatTarget
  chat: Chat | null
  /** The agent the board runs right now can hold a conversation. */
  canChat: boolean
  /** That agent's label, for saying which one is meant. */
  agent: string
  /** The labels of every agent that can hold one — what a refusal names. */
  able: string[]
  /** A reply is being written this second — by this process or by any other on this
   *  machine. A screen watches it to follow a conversation held in a terminal, and to keep
   *  the board it is changing up to date while it writes. */
  answering: boolean
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
  /** Fixed arguments this provider adds to the command line, for a connector that names
   *  its provider there rather than in the environment — Codex declares one with
   *  `-c model_provider=…` and a block of its own beside it. They go on every run under
   *  this pick, and a `command` that already names the provider setting's flag turns them
   *  off along with the pick, the same way it turns off any other setting. */
  args?: string[]
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
  /** The variable a run gets this value under, INSTEAD of `env` — for a key whose
   *  `docs/kanban/.env` line has to keep a name of its own while the agent reads another.
   *  ZCode's Coding Plan key is `ZAI_API_KEY` in the file and `ANTHROPIC_API_KEY` in the
   *  run, because sharing Claude Code's line would mean one key box overwriting the other.
   *  A picked provider's own `envAs` wins over this one. */
  envAs?: string
  /** Every flag name this agent's CLI takes for this setting. The first one is what a
   *  run appends. A setting with no flags reaches the run some other way.
   *
   *  On a `provider` list these name the flag a hand-written `command` would pick with,
   *  and nothing more: the list itself is never appended — what a pick writes is that
   *  provider's own `args`. */
  flags?: string[]
  /** The flag this setting's value rides on, for a CLI with no flag of its own for it.
   *  Codex takes every config value through one `-c key=value`, so `flags` holds the
   *  config KEY — `model_reasoning_effort` — and a run appends this flag followed by
   *  `key=value` as a single entry. `flags` stays what a hand-written `command` is checked
   *  against, which is that same config key there too. */
  configFlag?: string
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

/** One agent this machine has whose own CLI says nobody is logged into it (#392). Worked out
 *  on a second, cached path beside the one that answers `installed` — it spawns, so it is
 *  never on the page-load answer — and it gates nothing: a run under a logged-out agent
 *  still starts, and a wrong reading costs one wasted run rather than an agent that works.
 *
 *  Only a clear logged-out reading is ever on this list. A connector with no probe, a spawn
 *  that failed, a probe that ran out of time and output its connector's readings don't cover
 *  are all absent. */
export interface LoggedOutAgent {
  /** The agent's `name`, as `HarnessOption` gives it. */
  harness: string
  /** The command that logs the user back in. */
  login: string
}

/** One runtime as a reader is told about it, and everything a pane needs to change one. All
 *  of it is the board's answer, out of docs/kanban/ui.config.json — no machine holds a
 *  runtime setting of its own, so every checkout reads this same list. */
export interface RuntimeView {
  name: string
  /** True for the one a flow that names none runs on. */
  global: boolean
  /** The agent it runs. The board's own `harness` for the global runtime, this runtime's own
   *  entry for any other. */
  harness: string
  /** The model that agent is set to. Absent where nothing set one, so it runs its own
   *  default — there is no name for that default to give. */
  model?: string
  /** The agent name the board holds for this runtime, when it is one this build can't run.
   *  The fields here are the agent that RAN instead. */
  unknownHarness?: string
  /** The command a run would spawn: the agent's own, or the `command` override set for this
   *  runtime. */
  command: string
  /** What that agent's settings are set to for this runtime — its own block on the board
   *  with this runtime's overrides on top. A `secret` is never in here. */
  values: Record<string, string>
  /** The keys of that agent's `secret` settings docs/kanban/.env holds right now. The file is
   *  the board's, so two runtimes on one agent share one key. */
  secretsSet: string[]
  /** The keys whose flag the `command` override already names, so the override wins and the
   *  setting is never appended. */
  ignored: string[]
}

/** What one flow runs on: the runtime it names, and what that resolves to here. Keyed by
 *  the command a user types, which is the same key a flow's rule file uses. */
export interface FlowRuntime {
  command: string
  runtime: string
  harness: string
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
  /** The board's runtimes, and what each one runs as (#343). A board that names none has the
   *  one, running whatever `harness` and `harnessSettings` already say. */
  runtimes: RuntimeView[]
  /** False when the board names no runtimes at all — one written before they existed. Then
   *  `runtimes` holds the one every flow is on, which IS the harness above, and a screen
   *  offering them says so rather than putting a name on screen the board doesn't hold. */
  namedRuntimes: boolean
  /** The name of the runtime a flow that names none runs on. */
  globalRuntime: string
  /** What a person recognises this computer by — its hostname. Nothing about a runtime is
   *  this machine's, so this is only ever a label a screen shows. */
  machine: string
  /** What each flow runs on — every flow, in the order `FLOWS` lists them, so no screen
   *  keeps a list of its own. The spec agents are on the spec agent list instead. */
  flows: FlowRuntime[]
  /** The agent name the config asked for, when we don't ship it. We run the default and
   *  say so — never move the user to another agent silently. */
  unknownName?: string
  /** The file still holds the old top-level `command` key. Nothing reads it. */
  staleCommand?: boolean
}

/** One choice on a spec agent's setting (#255). `prompt` is the block of text appended to
 *  that agent's own prompt when this choice is the picked one — so what a setting means is
 *  written with the agent's prompt, and no board code has to know. */
export interface SpecAgentChoice {
  value: string
  label: string
  /** What this choice costs, in one line: how long the run takes, how much detail it
   *  gives, or how readable the result is. Shown wherever the choice is offered. */
  cost: string
  /** The block of prompt text this choice adds. */
  prompt: string
}

/** One setting a spec agent declares (#255) — `HarnessSetting` above, for the agent that
 *  fills part of a card's spec rather than the CLI a run spawns. It is always a pick from
 *  named choices: never free text, never a number.
 *
 *  A spec agent's settings ARE its configuration, so a new agent brings its own with it and
 *  no screen has to learn its name. */
export interface SpecAgentSetting {
  /** The key it saves under inside that agent's entry in ui.config.json. `enabled` is the
   *  entry's own key — the switch — so no setting may take it. */
  key: string
  label: string
  help?: string
  choices: SpecAgentChoice[]
  /** The `value` of the choice a run uses when nothing is saved. */
  default: string
}

/** One choice as a screen reads it: everything but the prompt text, which is the run's
 *  business and nothing a dialog would draw. */
export type SpecAgentChoiceView = Omit<SpecAgentChoice, 'prompt'>

/** One setting as a screen reads it. */
export type SpecAgentSettingView = Omit<SpecAgentSetting, 'choices'> & { choices: SpecAgentChoiceView[] }

/** One spec agent, as a screen reads it (#191) — the two lines it is shown by, whether it
 *  is switched on, and what it is set to (#255). The words are the board's own
 *  (`lib/spec-agents.ts`), so a screen listing them never keeps a copy that could say
 *  something else. */
export interface SpecAgentView {
  name: string
  /** What that agent fills in, in one line. */
  owns: string
  /** The kind of card the board calls it for, in one line. */
  calledOn: string
  /** False only when somebody switched it off. While it is off the board starts no new run
   *  of it, on any card, from a screen or a terminal. */
  enabled: boolean
  /** The settings this agent declares, in the order a dialog draws them. Empty for an agent
   *  that takes none. */
  settings: SpecAgentSettingView[]
  /** What each of those settings is set to right now, by key. Every setting is in here — one
   *  nobody picked carries its own default, so a screen never has to work one out. */
  values: Record<string, string>
  /** The runtime this agent runs on (#343) — the board's global one when it names none. */
  runtime: string
  /** What that runtime resolves to on this computer. */
  harness: string
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
  /** What was actually spawned, and the runtime it resolved through — never what the screen
   *  asked for. A pane drawing the board's own answer can be showing one agent while this
   *  computer's binding runs another, and a result that doesn't say which is a result that
   *  can be read as being about the wrong one. */
  harness?: string
  runtime?: string
}

/** What the first-run conversation came back with (#280) — the board's two config answers
 *  as the agent read them off the repo, plus a fallback summary for an unsure answer.
 *
 *  Nothing here has been written: the board writes it when the user says yes, through the
 *  same move the form's project screen calls. */
export interface SetupProposal {
  /** On an unsure answer, what little the repo showed. */
  summary: string
  /** The project's name, and the one line saying what it is — `config.md`'s two values. */
  name: string
  description: string
  /** The tracks its work falls into, each with the line saying what belongs in it. `was` is
   *  the folder a track replaces, so a rename moves the folder and its cards rather than
   *  making one and stranding the other. */
  tracks: { name: string; note: string; was?: string }[]
  /** The repo said nothing worth stating. Then `summary` is what little it saw, `ask` is
   *  the one question, and the tracks are whatever the board was scaffolded with. */
  unsure: boolean
  /** The one question an unsure answer asks. Empty otherwise. */
  ask: string
}
