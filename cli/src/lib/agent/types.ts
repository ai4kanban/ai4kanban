// The shapes an agent run is described by — what a connector takes, what one run is, and
// what a reader is told about it.
//
// They are plain data on purpose: the board UI draws its Configuration dialog from the
// very same objects, handed over by `akb agent list --json`, so a front end never keeps
// its own list of agents or of the settings each one takes.

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

/** How full the model's context window is right now (#675) — NOT a total, and never added
 *  up. `used` is the prompt the last finished request carried, cached parts included, which
 *  is exactly what the model is holding; `limit` is the window that prompt went into, from
 *  the connector where it reports one and from the models.dev catalogue where it doesn't
 *  (./catalog.ts).
 *
 *  Either can be missing, and a reader draws nothing unless both are known: a ring over a
 *  window nobody knows is a proportion of nothing. */
export interface ContextWindow {
  used?: number
  limit?: number
}

/** Every kind of agent session the board can start. */
export type AgentAction =
  | 'implement'
  /** Retired (#1414): one pass of a recurring card. Repeating work is a `scheduled` pass
   *  now; this stays so the runs already recorded still read back as what they were. */
  | 'run'
  /** Retired (#1497): a rejection is filed on the spot. Stays so old runs read back. */
  | 'reject'
  | 'archive'
  | 'edit'
  | 'create'
  /** Retired (#438). No flow starts one; it stays here so the propose runs already
   *  recorded still read back as what they were. */
  | 'propose'
  /** Retired (#1671) with releases. Kept so the runs already recorded still read back. */
  | 'plan-release'
  /** Plan one card in a single session (`akb guide refine`): settle every gap the session
   *  can settle itself, and leave only the decisions that are the user's. */
  | 'clarify'
  | 'resolve'
  /** Approve a card's current previews (#1790, #2154): the board moves it to its next
   *  approval, and planning makes those previews. */
  | 'approve'
  /** Retired (#1203) with the sessions they were: a planning pass now writes and closes the
   *  card itself, nothing gates a ready card, and nothing answers for the user. They stay
   *  here so the runs already recorded still read back as what they were. */
  | 'writing'
  | 'gate'
  | 'decide'
  /** Finish setting the board up — every step still unticked on
   *  `docs/kanban/setup-checklist.md`, in one run. It names no card: the
   *  checklist is the plan, and the run starts at its first unticked box, so a run started
   *  again after a failure carries on from where the last one stopped. */
  | 'setup'
  /** One spec agent filling the part of a card's spec it owns (#187). It is named by
   *  `specAgent`, it starts clean, and it writes one section of that card and nothing
   *  else. A flow asks for one; the board starts it once that flow's own run has ended. */
  | 'spec'
  /** Retired (#1671) with releases. Kept so the runs already recorded still read back. */
  | 'changelog'
  /** Retired (#1203): nothing reviews a delivery any more. Kept for the runs recorded. */
  | 'review'
  /** Fit a delivery onto a target branch that moved while it was built (#304, #2043): it
   *  resolves any conflict, fixes what the two sides break together, stages the result, and
   *  the board finishes the rebase or folds it into the delivery's commit. */
  | 'conflict'
  /** Retired (#1507): nothing runs after a build any more. Kept for the runs recorded. */
  | 'hook'
  /** One pass of a workflow's scheduled agent (#1401): named by `specAgent` and `workflow`, on
   *  no card. The board starts it when its cadence comes round; it is a card-less delivery of
   *  its own, so what it changes is committed and landed like a build. */
  | 'scheduled'
  /** A sub-run (#1421): a prompt another run handed off with `akb run start`, in that run's
   *  folder, as the same agent. Named by `parentId`; it holds no card and lands nothing. */
  | 'sub'
  /** Squeeze the memory back down to what helps planning (#514) — the memory pruner's one
   *  flow. It names no card: the memory set is the whole of what it works on, so it is
   *  started from the agent's own page or by the cadence that page carries. It raises
   *  nothing for a human — what it cannot settle stays in the memory file. */
  | 'prune-memory'
  /** Read the conversations that have said something new and write what they settled into
   *  memory (#748) — the chat reviewer's one flow. It names no card: the conversations on
   *  this machine are the whole of what it works on, and the flow picks out the ones with
   *  new content since the last review that passed. Chats write no memory themselves, so
   *  this is the only thing that turns what a conversation settled into a note. */
  | 'review-memory'
  /** Learn what the user does not want from their rejection and dismissal reasons (#929,
   *  #1497) — the dismissal reviewer's one flow. It names no card: the flow lists the new
   *  reasons and the restored items, and it writes only the planner's `rejected.md`. */
  | 'review-dismissals'
  /** Rewrite `memory/project.md`, what the project is today (#1268) — the project writer's
   *  one flow. It names no card and writes only that file. */
  | 'describe-project'
  /** Reflect on a card the board has just completed (#534) — the proposer's one flow. It
   *  names the completed card, which is no longer on the board, so it reads it at its
   *  `.archive/` path; what it writes is inbox items for the work that should follow, and
   *  finding nothing worth proposing is a valid result. Only runs while the proposer is
   *  switched on. */
  | 'reflect'
  /** Retired (#2115): the board no longer sorts triage. Kept for the runs recorded. */
  | 'triage'
  /** Retired (#1334): the sweeper is gone. Kept for the runs recorded. */
  | 'unstick'

/** The actions a hook's agent runs as itself: one section of a card (`spec`), or a pass on
 *  its cadence (`scheduled`). Each is named by an agent rather than run by a role. The
 *  retired `hook` stays so its old records still name their agent. */
export const SPECIALIST_ACTIONS: ReadonlySet<AgentAction> = new Set<AgentAction>(['spec', 'hook', 'scheduled'])

/** The actions that do not hold the card they name: a spec agent, which works beside the loop
 *  that asked for it, and a reflection whose card has left the board altogether (#534). */
const CARD_FREE_ACTIONS: ReadonlySet<AgentAction> = new Set<AgentAction>(['spec', 'reflect', 'sub'])

/** Whether a run of this action holds the card it names. The one answer every lock reads,
 *  so a card-free run is exempt everywhere or nowhere. */
export const holdsCard = (action: AgentAction): boolean => !CARD_FREE_ACTIONS.has(action)

/** The action names used by refinement passes (`agent/refine.ts`). A pass carries its
 *  refine round; `resolve` without one is the standalone flow a user typed. */
export const REFINE_ACTIONS: ReadonlySet<AgentAction> = new Set<AgentAction>([
  'clarify',
  'resolve',
])

/** Everything one run is asked for. */
export interface AgentRequest {
  action: AgentAction
  id?: number
  title?: string
  /** The delivery this run is for, when it is not named by a card (#428). A card-less build
   *  carries none — its delivery is opened as the run is written down — and its conflict run
   *  carries the delivery the build opened. */
  deliveryId?: string
  notes?: string // implement, edit, clarify, resolve, archive, run
  /** review-memory: the Cloud tasks whose chats the Runner keeps, read instead of `chats/` (#2065). */
  tasks?: string[]
  /** review-dismissals: every reason on the board, not only those since the last review — a
   *  Runner's board, whose reviews Cloud keeps track of (#2067). */
  allReasons?: boolean
  reason?: string // reject
  /** reject: drop the card and write no memory at all (#601) — a backlog clear-out, not a
   *  conclusion worth keeping. The reason may be empty under it, and nothing judges whether
   *  the idea earned a note. */
  discard?: boolean
  /** create: what the user wants, in their own words. implement with no `id`: the typed
   *  sentence a **Start now** is approved to build (#428) — its requirements, its prompt and
   *  its delivery's title at once, and the card the run writes from it (#470). */
  description?: string
  /** create: the plan this run writes cards from (#427), as a path from the project root.
   *  implement with no `id`: the plan a **Start now** under the plan handoff is approved to build
   *  (#481) — it stands in for `description`, and the delivery is titled and bounded by the
   *  file. The words are in the file, so `description` is left off — a copy pasted into the
   *  prompt would go stale the moment the discussion rewrote it. */
  plan?: string
  /** create: two or more plans one discussion wrote, handed off together (#917), each a path
   *  from the project root. One plan goes as `plan`. */
  plans?: string[]
  /** create: the workflow each plan's cards run on (#1442), keyed by the plan's path. */
  planWorkflows?: Record<string, string>
  /** create: the session the command was typed in (#1222). */
  origin?: ChatHandoff
  /** create: the card this came up on (#1273), whose dependency on the new card(s) the run
   *  records. */
  fromCard?: number
  /** create, and implement with no `id`: the pictures pasted into the create sheet (#517).
   *  `box` is the folder they were written to as they were pasted and `shots` their names in
   *  the order they went into the box. `startRun` renames that folder after the run and
   *  turns the pair into `pictures`; nothing else reads them. */
  box?: string
  shots?: string[]
  /** The pictures this run was handed, as paths on this machine — worked out from `box` and
   *  `shots` when the run is written down, so a browser never names one. */
  pictures?: string[]
  /** The workflow the card this run is for runs on (#715) — a workflow's stable id, read
   *  off the card as the run is prepared. It decides which agents the run calls in, and
   *  which flow text the run is given. Absent on a run that names no card and on a run
   *  prepared by a copy of these rules from before workflows existed, both of which read
   *  the board's default workflow. */
  workflow?: string
  /** Internal position in a watcher-managed refinement run chain. */
  refineRound?: number
  /** clarify, resolve: how the run's session is opened (#1304), set as the run is written
   *  down — the card's planning session resumed, or the one it was created in forked. `new`
   *  asks for a new one: the rerun after that session turned out to be gone. */
  session?: 'resume' | 'fork' | 'new'
  /** clarify, resolve, edit: the session Cloud's task carries (#2146), over the board's own —
   *  resumed, or copied with `fork` — and the discussion the task came from, read when none is. */
  carry?: { resumeId?: string; fork?: boolean; transcript?: string }
  /** The flow this run belongs to. Absent on the run that opens one — it is given an id
   *  when it is written down, and every session it goes on to start inherits that id. A
   *  run that joins a delivery takes the delivery's id instead, whatever is asked for
   *  here (#417). */
  flowId?: string
  /** spec: which agent this run is — a name from the board's catalog (`lib/agents/`). It
   *  decides the prompt the run is given and the section it is allowed to write. */
  specAgent?: string
  /** implement: how THIS build commits (#346) — the Implement dialog's tick, and this one
   *  delivery's answer. Absent on every other way in — a terminal `akb card implement`, a queued
   *  build, a resolve that carries on — and those fall back to **Allow automatic Git
   *  commits**. Ignored where no worktree is possible; the build is manual there regardless. */
  commitMode?: DeliveryCommitMode
  /** The runtime THIS run spawns on (#518) — the create sheet's pick, over the runtime its
   *  agent is set to. It applies to the one run and changes nothing in Configuration →
   *  Agents. Absent on every run that named none, which is the agent's own. */
  runtime?: string
  /** sub: the run that started this one (#1421). */
  parentId?: string
  /** reflect: the completed cards this one reflection covers (#1467). */
  cards?: number[]
}

/** Every action a run can still be started with — everything but the retired ones. */
export type StartableAction = Exclude<AgentAction, RetiredAction>

/** The actions no flow starts any more. */
export type RetiredAction = 'propose' | 'writing' | 'gate' | 'decide' | 'review' | 'unstick' | 'run' | 'reject' | 'hook' | 'plan-release' | 'changelog' | 'triage'

const RETIRED: ReadonlySet<AgentAction> = new Set<RetiredAction>(['propose', 'writing', 'gate', 'decide', 'review', 'unstick', 'run', 'reject', 'hook', 'plan-release', 'changelog', 'triage'])

/** Whether nothing starts this action any more — it only reads back off an old record. */
export const isRetired = (action: AgentAction): action is RetiredAction => RETIRED.has(action)

/** Actions accepted by user-facing run commands. Internal refinement actions are absent. */
export type CommandAction =
  | Exclude<StartableAction, 'clarify' | 'spec' | 'scheduled' | 'sub'>
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

/** Where a run stands in an automatic retry after a passing provider failure (#525).
 *
 *  It rides on the run and is carried onto the one that continues it, so the three attempts
 *  and the fifteen minutes are counted across the whole chain rather than per session. */
export interface RunRetry {
  /** Attempts made so far, this one included. */
  attempt: number
  /** And how many this chain gets in all. Kept with the run rather than read off the
   *  policy, so a screen shows the limit this run was actually held to. */
  of: number
  /** What the provider said, in its own words — one line. */
  reason: string
  /** When the next attempt starts. In the past on a run that IS that attempt, so a reader
   *  draws a countdown only while it is ahead. */
  at: number
  /** When the FIRST attempt of this chain started. The fifteen minutes run from here, not
   *  from its failure, so the time a harness spent retrying inside an attempt counts
   *  against the same window. */
  since: number
}

/** Why a run was refused before it started, where the board can name the kind (#706). A
 *  screen that must say it in its own language reads this instead of the sentence; a
 *  refusal with no kind here is said in the board's own words. */
export type RunRefusalKind =
  /** Tracked changes are sitting in the checkout the build would work in. */
  | 'dirty'
  /** Another build without a branch of its own is already working in this checkout. */
  | 'busy'
  /** The delivery's branch or worktree could not be made. */
  | 'worktree'
  /** The folder the worktrees go in could not be prepared. */
  | 'akb'
  // A run or a delivery that cannot be started, continued or ended (#955).
  | 'runNotFound'
  | 'runAmbiguous'
  | 'runGoing'
  | 'runNotResumable'
  | 'runNoSession'
  | 'runContinued'
  | 'runForeign'
  /** A sub-run is started again by its parent, never on its own (#1421). */
  | 'subRunResume'
  /** A sub-run cannot start sub-runs of its own (#1421). */
  | 'subRunNested'
  /** A sort that cannot be started again: this account may not sort (#1321). */
  | 'discardUnfinished'
  | 'creationHeld'
  | 'deliveryUnnamed'
  | 'deliveryNotFound'
  | 'deliveryActive'
  | 'deliveryFinished'
  | 'deliveryCancelled'
  | 'deliveryFiles'
  | 'deliveryManual'
  | 'deliveryWorktreeGone'
  | 'deliveryBranchGone'
  | 'deliveryCardGone'
  | 'deliveryHeld'
  | 'deliveryTakenOver'
  | 'deliveryRunGoing'
  | 'deliveryNone'
  | 'planEmpty'
  | 'cardBusy'
  | 'cardDiscarded'
  | 'cardCreating'
  | 'cardUnfinished'
  | 'workflowUnknown'
  /** A card whose workflow lands nothing: its last approval archives it (#2152). */
  | 'planDelivered'
  | 'workflowLandMissing'
  /** A land agent's file is there and the board does not use it (#1342); `args.cause` says why. */
  | 'workflowLandRefused'
  // Runtimes, workflows and settings the Configuration dialog saves.
  | 'runtimeUnnamed'
  | 'runtimeTaken'
  | 'runtimeNotFound'
  | 'runtimeKey'
  | 'harnessNotFound'
  | 'globalRename'
  | 'globalDelete'
  | 'harnessUnused'
  | 'workflowUnnamed'
  | 'workflowTaken'
  | 'workflowNotFound'
  | 'workflowBuiltInRename'
  | 'workflowBuiltInChange'
  | 'workflowBuiltInDelete'
  | 'agentNotFound'
  | 'agentOtherWorkflow'
  | 'agentNotListed'
  | 'agentNotScheduled'
  /** A scheduled agent's pass that cannot start (#1401): already running, or its last pass
   *  still landing. */
  | 'scheduledRunning'
  | 'scheduledLanding'
  | 'minutes'
  | 'fileParse'
  | 'fileWrite'
  | 'fileRead'
  | 'gitignoreWrite'
  | 'cadence'

/** The values a refusal's sentence names — ids, names, paths, commands — for a screen that
 *  says the sentence in its own words. Never translated. */
export type RefusalArgs = Record<string, string>

/** A refused run: the board's own sentence, and the kind behind it where there is one. */
export interface RunRefusal {
  error: string
  reason?: RunRefusalKind
  args?: RefusalArgs
  /** The files a `dirty` refusal named, so a screen can list them under its own sentence. */
  paths?: string[]
}

/** What a settings write answers: ok, or the refusal. */
export type Saved = { ok: boolean } & Partial<RunRefusal>

/** A refusal with its kind, for a screen to say in its own language. */
export const refusal = (reason: RunRefusalKind, error: string, args?: RefusalArgs): RunRefusal =>
  args ? { error, reason, args } : { error, reason }

/** A sentence the board wrote into a run's `error` or `note` (#1241), by kind, so a screen
 *  can say it in the user's language. The English stays in the record for the CLI. */
export type RunReasonKind =
  | 'resumeUnstarted'
  | 'silent'
  | 'backgroundSilent'
  | 'notInstalled'
  | 'format'
  | 'repairUnstarted'
  | 'retryUnstarted'
  | 'broken'
  | 'qaUnfinished'
  | 'refineStalled'
  | 'stageShort'
  | 'specRefused'

/** One part of a run's `error` or `note`. No `kind` is a part the board has no sentence for,
 *  kept as `text`. `lines` are quoted as they are; `refusals` are nested ones, said through
 *  their own kinds. */
export interface RunReason {
  kind?: RunReasonKind
  args?: RefusalArgs
  lines?: string[]
  refusals?: RunRefusal[]
  text?: string
}

/** One run, as the shared record holds it. Every process reads and writes this same
 *  shape — the record is the only thing that knows what is running. */
export interface RunRecord {
  /** This run's id and the record's key — ours, always, generated before anything
   *  spawns. A harness that mints an id of its own keeps it in `resumeId`. */
  sessionId: string
  cardId: number | null
  /** Cards this run created through `akb raw create`. A cardless creation run holds these
   *  until it closes, so an overlapping run cannot adopt and refine its half-written cards. */
  createdCardIds?: number[]
  /** create: the session `akb create` was typed in (#1222), handed to every card it writes. */
  origin?: ChatHandoff
  discard?: boolean
  discardedCards?: { id: number; path: string; pending?: boolean }[]
  action: AgentAction
  status: RunStatus
  startedAt: number
  endedAt?: number
  /** The process watching this run — the supervisor, not the agent. It is what a stop
   *  signals and what a reader checks to tell a live run from one that was cut off. */
  pid?: number
  /** The agent the watcher started, and when it was recorded. Windows looks under this pid
   *  for what an unwatched run left behind (#1313). */
  agentPid?: number
  agentStartedAt?: number
  /** The text the user typed for this run — a create's description, an action's notes, or
   *  a reject's reason. */
  input?: string
  ok?: boolean
  code?: number | null
  error?: string
  /** A concrete interruption that needs one action from the user before Resume. */
  blocker?: ExecutionBlocker
  /** What this run cost in US dollars, as its own output reported it at close. An
   *  estimate the agent worked out from tokens at list prices — not a bill. */
  costUsd?: number
  /** The session's running total behind `costUsd`, on a connector that reports one (#1480). */
  sessionCostUsd?: number
  /** The session total this run started from, taken off `sessionCostUsd` for `costUsd` (#1483). */
  sessionCostFrom?: number
  usage?: TokenUsage
  /** How full the context window was after this run's last finished request (#675). Kept
   *  apart from `usage` above, which counts what the whole run spent: this one neither adds
   *  up nor only grows, and it is written while the run is still going. */
  context?: ContextWindow
  /** The model that did the work, as the run's own output named it. */
  model?: string
  /** The agent's final message, parsed out of its event stream at close. */
  result?: string
  /** What the BOARD has to say about how this run ended, when the agent's own message
   *  can't: a refinement loop that stopped with its card still unsettled, or a board this
   *  run left disagreeing with itself. Kept apart from `result` so the two voices are never
   *  mixed. Several of them are one string, a blank line between each. */
  note?: string
  /** `error` and `note` by kind (#1241), one entry per part. Absent on older runs. */
  errorWhy?: RunReason[]
  noteWhy?: RunReason[]
  /** The harness this run ran under, recorded when it starts, so a finished run keeps
   *  showing the agent that ran IT — changing the setting later can't rewrite history. */
  harness: string
  /** The runtime it ran on (#467, #518), by id — the agent's own, or the one this run was
   *  started with. Recorded for the same reason as the harness, and read by a resume so the
   *  turn that continues it runs as the turn before it did. Absent on a run written before
   *  runtimes. */
  runtime?: string
  /** The agent it was run by — a role, or a specialist by name (#443). Absent on a run that
   *  belongs to no agent, and on one written before agents picked a connector. */
  agent?: string
  /** The akb version this run went on, written down when it started (#628). Absent on a run
   *  recorded before this field. */
  version?: string
  /** Where it worked and what it spawned (#628) — the project or a delivery's worktree, and
   *  the argv behind `harness`. Absent on a run written before them. */
  cwd?: string
  argv?: string[]
  /** The run's SECOND id: the one that harness's own CLI resumes by. Set only when it
   *  isn't ours to know — the harness minted its own mid-run, or this run continues an
   *  earlier conversation and inherited that one's id. */
  resumeId?: string
  logPath: string
  /** The run this one continued, when it was started by Resume. It names a run that is
   *  deliberately gone: resuming drops the record it took over from. */
  resumedFrom?: string
  /** The session this planning run carried on (#1304): the one it resumed, or with `fork`
   *  the one it started as a copy of. */
  continues?: { resumeId: string; fork?: boolean }
  formatRepair?: { attempt: number; errors: string; cardIds: number[]; changedIds: number[]; existingIds: number[] }
  /** The automatic retry this run is part of (#525), on the run WAITING for the next
   *  attempt and on every attempt after the first. Absent on a run that has never hit a
   *  provider failure, which is nearly all of them. */
  retry?: RunRetry
  /** The card's saved stage the instant before this run overwrote it with
   *  `implementing`, so the end of the run puts back what was there. */
  priorStatus?: string
  /** The pictures this run was handed (#517), as paths in its own folder beside the log.
   *  Kept so a connector taking a flag per file is handed them at spawn, and so a restart
   *  can name them again. */
  pictures?: string[]
  /** The agent's process never started (#1321), so no session stands behind this run —
   *  even under a connector that takes our id. */
  unspawned?: boolean
  /** create, and implement with no card: the workflow the sheet named (#1321), kept so a
   *  retry asks for the same thing. */
  workflow?: string
  /** A stop has been asked for. Written so the supervisor's own end, whichever path
   *  witnesses it, records `stopped` rather than a failure. */
  stopping?: boolean
  /** Which agent this run is, on a `spec` run. Kept on the record so the run list can say
   *  which one is working, and so a resume starts the same agent again. */
  specAgent?: string
  /** A create's `--from-card` (#1273), kept so a resumed prompt still names it. */
  fromCard?: number
  /** On a setup run: the checklist boxes already ticked when it started (#909). Absent when
   *  there was no checklist. A resume carries the first run's count on. */
  setupTicked?: number
  /** A setup run that exited cleanly without ticking a single box (#909). It closes as a
   *  failure, and this is what tells that failure apart from any other. */
  tickedNothing?: boolean
  /** Position in a watcher-managed refinement run chain. */
  refineRound?: number
  /** The FLOW this run is one session of — the id shared by the command a user typed and
   *  every session it went on to start: a refinement's passes, the spec agents a create
   *  asked for, the review that follows a build. It is what lets the runs panel show one
   *  job instead of six unrelated rows. A run recorded before flows carries none and
   *  stands on its own.
   *
   *  A run inside a delivery takes the DELIVERY's id (#417), whoever handed it back: the
   *  job is the delivery, so its runs group under it however many watchers started them,
   *  and a refinement one of them starts inherits that id and stays with the job. */
  flowId?: string
  /** The delivery this run belongs to, when it belongs to one. Only an `implement` run
   *  does today; a refine or a resolve stands alone and carries none. */
  deliveryId?: string
  /** The run that started this one with `akb run start` (#1421). */
  parentId?: string
  /** reflect: the completed cards it covers (#1467). */
  cards?: number[]
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

/** What one review pass concluded. */
export type ReviewVerdict = 'pass' | 'ask'

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

/** Why a delivery stopped for the user. Historical reasons remain readable. */
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
  /** A helper the stage's contract requires wrote nothing (#714), and asking again would
   *  not change that. The delivery stops unfinished with the card still held — there is a
   *  person's call behind it, never a card with no way out. */
  | 'capability'
  /** A `files` delivery changed tracked files outside the board (#874). */
  | 'outside'
  /** A `files` delivery recorded no output file, or one it recorded is not there (#874). */
  | 'output'

/** Review across a delivery. */
export interface DeliveryReview {
  rounds: ReviewRound[]
  stopped?: {
    reason: ReviewStopReason
    /** One plain sentence: what stopped it, in the words the card's question uses. */
    why: string
    at: number
    /** `outside`: the files changed; `output`: the recorded files that are missing. */
    paths?: string[]
  }
}

// ---- what one round of answers concluded (#637) -----------------------------

/** What applying the user's answers did to a delivery's requirements. */
export type AnswerOutcome =
  /** Nothing about what is to be built moved: an option already implemented was confirmed, a
   *  decision already on the card was written down again, or the prose was tidied. */
  | 'unchanged'
  /** A requirement was added, dropped or changed. */
  | 'changed'

/** One round of answers, as the run that applied them concluded (#637).
 *
 *  It belongs to ONE delivery and one round: it never reaches the fresh delivery a supersede
 *  opens, and `actedAt` is what keeps it from concluding twice. */
export interface AnswerVerdict {
  outcome: AnswerOutcome
  /** Why, in one short sentence, from the run that applied the answers. */
  why: string
  at: number
  /** When the board acted on it — the run it started, the new round that replaced it, or the
   *  supersede it caused. Unstamped is a conclusion still owed its effect. */
  actedAt?: number
}

// ---- landing a delivery on the target branch (#304) -------------------------

/** Where a delivery stands on landing.
 *
 *  `waiting` — built and ready, queued for the repository's one landing slot, or put
 *  back in the queue because the checkout was not clean. `landing` — it holds the slot.
 *  `landed` — its commit is on the target branch. `conflict` — a conflict it could not
 *  resolve stopped it, and the card carries the question. */
export type LandingStatus = 'waiting' | 'landing' | 'landed' | 'conflict'

/** One check a landing ran, and what it said — the build that authorized it. */
export interface LandingCheck {
  name: string
  ok: boolean
  at: number
}

/** How a delivery's landing is going. It is also the landing SLOT: exactly one active
 *  delivery may be `landing`, which is what "one card at a time" means. */
/** What a landing's fast-forward would have written over in the user's own checkout
 *  (#958): a tracked file they have changed, or an untracked file of theirs on a path the
 *  landed commit creates. Recorded beside the sentence so a screen can say it in its own
 *  language, and because the two have different ways out. */
export interface LandingWait {
  kind: 'overwrite' | 'untracked'
  files: string[]
}

/** Which of the board's own sentences a landing's `why` is (#1377), kept beside it for the
 *  same reason as `LandingWait`. Absent when `why` is git's own words. */
export interface LandingReason {
  kind: 'queued' | 'worktree-gone' | 'no-base' | 'target-gone' | 'worktree-dirty' | 'interrupted'
  /** `queued`: what holds the slot — `#<card>`, or a card-less delivery's id in backticks. */
  behind?: string
  /** `worktree-dirty`: the files the worktree still holds. */
  files?: string[]
}

export interface DeliveryLanding {
  status: LandingStatus
  /** Why it is waiting, or why it stopped — one plain sentence. */
  why?: string
  /** The user's own files the landing will not write over (#958), while that is what it is
   *  waiting on. Cleared by every other reason a landing waits. */
  wait?: LandingWait
  /** Which fixed sentence `why` is (#1377). Written and cleared with it. */
  reason?: LandingReason
  /** Rebases spent on a target branch that kept moving. Never bounded: a target that keeps
   *  moving is a race inside the board, so the landing waits and replays until it goes
   *  through (#665). */
  attempts: number
  /** When the last rebase finished. */
  rebasedAt?: number
  /** The base it was rebased from — what the target branch brought in is the diff between
   *  that commit and the new base. */
  rebasedFrom?: string
  /** The base the delivery was built on, kept through every rebase — what the target branch
   *  brought in since the build started is the diff from here. */
  originalBase?: string
  /** What the last rebase turned out to be: `disjoint` shares no file with the delivery,
   *  `overlap` shares one, `conflict` was resolved by an agent. A record of the replay, not
   *  a gate (#665). */
  rebaseKind?: 'disjoint' | 'overlap' | 'conflict'
  /** The squash commit that landed. */
  commit?: string
  /** The target tip it landed onto — the comparison base the landed commit sits on. */
  onto?: string
  /** Cards whose delivery touches the same files. A warning recorded here, never a reason
   *  to refuse. */
  overlap?: number[]
  /** The checks that ran for this landing, with their results. */
  checks?: LandingCheck[]
  /** The files a conflict with the target branch is being resolved in (#595). Set while an
   *  agent is on it and while the board waits to reopen one, and cleared the moment the
   *  rebase goes through — so it is also what says a landing is on the conflict path. */
  conflictFiles?: string[]
  /** `conflict` runs in a row that ended without the result going through. At
   *  `RETRY_ATTEMPTS` the delivery stops; `afterRebase` clears this. */
  conflictFails?: number
  /** When a `conflict` run was asked for on a rebase that went through cleanly — the run
   *  checks the combined result, and the board folds what it staged into the delivery's
   *  commit. Cleared once that is done. */
  fitAt?: number
  /** When the next `conflict` run may open. The delivery gives the landing slot back until
   *  then, so another delivery lands while it waits. */
  conflictAt?: number
  /** When the next landing attempt may open, after the target branch moved under this one
   *  (#665). Same shape as `conflictAt` and the same slot-free wait: the delivery holds no
   *  landing slot until then, and the wait is never bounded — the target moving is the
   *  board's own race, and there is nothing for the user to answer. */
  retryAt?: number
  at: number
}

/** One delivery: one end-to-end effort to implement an exact version of a card. It has an
 *  id, a card has at most one active one, and it is several runs long.
 *
 *  It lives twice. This row sits in the machine's `sessions.json` (#590), where the lock and
 *  the card page read it. The permanent copy is one JSON file per delivery under
 *  `docs/kanban/deliveries/`, tracked in git and kept after the card is archived. */
export interface DeliveryRecord {
  deliveryId: string
  /** The card it builds, or null for a build with no card at all (#428) — **Start now**
   *  sends a typed sentence straight to an implementation run. A card-less delivery is found
   *  by its own id everywhere a carded one is found by its card, and its worktree, branch and
   *  commit message are named by the delivery id. */
  cardId: number | null
  /** The card's title when the delivery started, so a record still names its card after
   *  the card has been archived — and the typed sentence itself on a card-less one, which is
   *  the only account of what it was asked to build. */
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
  /** The plan this build was started from (#481), as a path from the project root. Set only
   *  on a card-less build under the plan handoff, where `approved` is that file's text as it
   *  read when the run was written down. */
  plan?: string
  /** Questions already open when implementation began. Review waits only on a new decision
   *  it appends; these pre-existing questions continue to hold at landing. */
  initialQuestions?: number
  /** The steps this delivery entered, in order. */
  steps: DeliveryStep[]
  /** The commit the candidate is compared against — the repository's HEAD when the
   *  delivery started, so `git diff <base>` is everything this delivery changed and nothing
   *  that was already there. Absent outside a git repository. */
  base?: string
  /** Why the delivery stopped, and what each review before #1203 concluded (#302). */
  review?: DeliveryReview
  /** What each round of applied answers concluded about these requirements (#637), oldest
   *  first. The run that writes the answers onto the card is the one that can tell, so it
   *  says so with `delivery answered` before it drops the questions — and the landing queue
   *  reads THIS rather than comparing card text. */
  answers?: AnswerVerdict[]
  /** The card's stage the instant before the delivery's FIRST run overwrote it with
   *  `implementing`, so the end of the delivery puts back what was there — not the
   *  `implementing` its own second run would otherwise have found and saved. */
  priorStatus?: string
  /** How this delivery commits, decided when it started and never afterwards (#303).
   *  `auto` builds on its own branch in its own worktree; `manual` works in the user's
   *  checkout and waits for them to commit; `files` (#874) works in the project, commits
   *  nothing and ends on the files it records on the card. Flipping the setting changes the
   *  next delivery, never one already in flight. */
  commitMode?: DeliveryCommitMode
  /** `files` only: the tracked files outside the board that were already changed when it
   *  started, by path, with a fingerprint of each. A change beyond these stops it (#874). */
  touched?: Record<string, string>
  /** `files` only: every todo on the card when it started. An `Output:` line among these
   *  is an earlier delivery's. */
  planned?: string[]
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
  /** What the build left, in manual commit mode: the fingerprint of the code as it stood
   *  when the build finished, and where the diff of it was written. */
  reviewed?: { mark: string; diff?: string; at: number }
  /** Where this delivery stands on landing (#304). Absent until its build is done in
   *  auto commit mode; manual commit mode never lands, because the commit is the user's. */
  landing?: DeliveryLanding
  /** The rules this delivery froze when it started (#306), keyed by agent (#420) — the
   *  agents a delivery's flows are run by, and only the ones that had a rule. A delivery
   *  frozen before #420 is keyed by flow, and its runs are still read under both. Every run in the
   *  delivery is given these rather than the files, so editing a rule changes the next
   *  delivery and never one in flight. Absent on a delivery started before flow rules
   *  existed, which reads the files instead. */
  rules?: Record<string, string>
  /** The workflow this delivery froze when it started (#715) — its id, its name as it read
   *  then, and who led and helped each of its three stages. Every run in the delivery reads
   *  THIS rather than the board's settings, so renaming a workflow, reassigning a stage or
   *  deleting the workflow outright changes the next delivery and never one in flight.
   *
   *  Absent on a delivery started before workflows existed, whose runs read the board — which
   *  is exactly what they always did. */
  workflow?: FrozenWorkflow
  /** On a scheduled agent's pass (#1401): whose it is. It holds no card and writes none. */
  scheduled?: ScheduledPass
}

/** Which scheduled agent a pass is: the workflow's id and the agent's name. */
export interface ScheduledPass {
  workflow: string
  agent: string
}

/** A delivery's own copy of the workflow it builds under (#715). */
export interface FrozenWorkflow {
  /** The workflow's stable id — what the card carried when the delivery opened. */
  id: string
  /** Its name at that moment, so a record still names its workflow after a rename and after
   *  the workflow itself is gone. */
  name: string
  /** Whether this delivery has to leave a file behind to count as finished — frozen with
   *  the rest, so a workflow retyped mid-flight cannot change what this build owes. */
  needsArtifact?: boolean
  /** Its previews and land agents (#2152), with the extra requirements each assignment
   *  carried. Absent on a record frozen before #2152. */
  previews?: { agent: string; extra: string }[]
  land?: { agent: string; extra: string }[]
}

/** How a delivery commits its work (#303). */
export type DeliveryCommitMode = 'auto' | 'manual' | 'files'

/** Where a resumed delivery picks back up (#639) — the step it stopped at, never one it
 *  has already done. */
export type DeliveryCarryOn = 'build' | 'landing' | 'conflict'

/** One ask for a spec agent, as the run that wanted it wrote it down.
 *
 *  These do NOT live on the record. They are a handoff one process writes and one process
 *  reads once — the run's own watcher, at its close — so they sit beside the run's plan,
 *  in a file of the run's own. That also keeps them out of reach of an older copy of these
 *  rules polling the record: the record is rebuilt field by field on every read, so a
 *  reader that predates a field drops it, and a dropped ask is a spec agent that silently
 *  never runs. */
export interface SpecAsk {
  /** The agent's name — a name from the board's catalog (`lib/agents/`). */
  specAgent: string
  cardId: number
  /** What the flow wants looked at, in a line or two. Everything else the agent is given
   *  is the card itself: the conversation that asked is deliberately not passed on. */
  notes?: string
}

/** One ask for a refinement, written down by the run that asked for it with
 *  `akb card refine <id>`. Same handoff as `SpecAsk`, in the same file and started by the same
 *  watcher — and in the same flow, so the refinement reads as the next step of the job
 *  that handed the card over. */
export interface RefineAsk {
  cardId: number
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
  /** This run failed or was cut off with no session to pick up (#1321), and its ask can be
   *  started again from the record. Never set beside `canResume`. */
  canRetry?: boolean
  /** The card this run names has left the board since — landed, archived or rejected (#673,
   *  #809). Set only on a run that stopped short, where it says the work the run was left
   *  owing is settled. */
  cardOffBoard?: boolean
  /** The run's log, when it was asked for. */
  tail?: string
}

// ---- talking to the agent, rather than setting it a job ---------------------

/** One agent session, as a CLI would resume it (#1222). */
export interface AgentSession {
  harness: string
  runtime?: string
  resumeId: string
  cwd?: string
}

/** The session a run that creates cards was started from (#1222): an agent in a terminal. */
export type ChatHandoff = AgentSession

/** What a build with no card was handed, and everything its delivery is opened from: the
 *  sentence **Start now** typed (#428), or the plan the handoff was answered on (#481). */
export interface DirectBuild {
  /** On a scheduled agent's pass (#1401): whose it is, in place of a requirement. */
  scheduled?: ScheduledPass
  /** The delivery's title — the sentence itself, or the plan's own title. */
  title: string
  /** And its frozen `approved` requirements — the same sentence, or the plan's words. */
  approved: string
  /** The plan those words were read from, as a path from the project root. Absent on a
   *  build started from a typed sentence. */
  plan?: string
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
  /** Values to offer under a `text` box, filled in per machine as the settings are read —
   *  the model ids this agent's own CLI knows about here (`agent/harnesses/models.ts`).
   *  Unlike `choices` it decides nothing: the box stays free text, nothing is checked
   *  against it, and an agent with no list to read draws the box it always drew. */
  suggestions?: string[]
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
  /** True for a setting that PICKS A MODEL. It no longer routes storage — a runtime holds
   *  every one of its settings in one place (#467) — so what is left of the flag is grouping
   *  Model id, Reasoning and Extra args in the expanded row, and the rule that a runtime is
   *  never called unreachable for one: an empty model is the CLI's own default, and a bad one
   *  fails the run with the reason in its log.
   *
   *  Declared by the connector so adding one is one line in its own file — nothing outside
   *  `agent/harnesses/` keeps a list of which keys are which. */
  agentOwned?: boolean
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
  /** The binary this harness's own command names. */
  binary: string
  /** True when that binary is on the PATH a run would be spawned on. Worked out fresh on
   *  every read, never cached, and it starts nothing: it says the CLI is there, not that
   *  it is logged in or that a run would pass. That is `testConnection`'s answer. */
  installed: boolean
  /** The version of the copy a run would use; null when it can't be read. */
  version: string | null
  /** The command that installs this agent's CLI. Handed over wherever the CLI turns out
   *  not to be on the machine — a picker offering it, a run that can't spawn, a failed
   *  test — so the user reads what to do instead of a raw spawn error. */
  install: string
  /** What this agent can't do that another one on the list can, worked out fresh on every
   *  read. Empty for a connector that lacks nothing. A screen offering the agents shows
   *  these where the pick is made, so what a switch costs is read before it is paid. */
  gaps: HarnessGap[]
  /** What the FIRST runtime on this harness is set to, for a screen that lists harnesses
   *  rather than rows. A run never reads these — it resolves one runtime and nothing else
   *  (#467) — and a harness no runtime names carries the empty answers. */
  runs: string
  values: Record<string, string>
  secretsSet: string[]
  ignored: string[]
}

/** One runtime as a screen draws it (#467) — the whole answer to what a run runs as, in one
 *  row. Its shape is in ui.config.json, its key in `.env`; whether the CLI is here is this
 *  computer's. */
export interface RuntimeView {
  /** Stable, environment-safe, and what everything keys by: the agents' picks, a chat's pin,
   *  a run's record and the row's own key line in docs/kanban/.env. */
  id: string
  /** The user's own words. Free text, unique on the board. */
  name: string
  /** **Global default** — the first row, which no board can delete or rename. */
  fixed: boolean
  /** The harness it runs, by name — the default where the file names one we don't ship, the
   *  same fallback a run makes. */
  harness: string
  /** That harness's label and mark, for the folded row. */
  label: string
  icon: string
  /** The harness the file asked for, when this build doesn't ship it. Everything else on the
   *  row is the one running instead. */
  unknownHarness?: string
  /** How many agents name this row of their own accord — what a delete puts back on **Global
   *  default**. Read off the board's picks, so it costs no roster read; 0 on **Global default**,
   *  which is what a pick of none already runs. */
  agents: number
  /** The settings that harness declares, in the order the expanded row draws them. */
  settings: HarnessSetting[]
  /** What this row has them set to. A `secret` is never in here. */
  values: Record<string, string>
  /** The keys of its `secret` settings this computer holds right now — set or not set, and
   *  nothing more. */
  secretsSet: string[]
  /** The keys whose flag a `command` override already names, so the override wins and the
   *  setting is never appended. */
  ignored: string[]
  /** The model id, for the folded row. */
  model: string
  /** The harness's own command. */
  command: string
  /** The command a run on this row would spawn. */
  runs: string
  /** Its first word, which is the binary a spawn resolves. */
  binary: string
  /** That binary is on this computer's PATH. */
  installed: boolean
  /** The command that puts it there. */
  install: string
  /** What this row's harness can't do that another can. */
  gaps: HarnessGap[]
}

/** What one agent runs (#467): the runtime it names, and enough of that row to say what it
 *  is, out of ui.config.json. */
export interface HarnessRun {
  /** The runtime it runs — its own pick, or **Global default** when it named none. */
  runtime: string
  /** That runtime's name, for the row. */
  runtimeName: string
  /** The harness that runtime runs. */
  harness: string
  /** The model id under it, for the row. Empty means the harness's own default. */
  model: string
  /** True when the runtime is a pick rather than **Global default**. */
  own: boolean
  /** The agent whose pick this is, on an agent that has none of its own: planning runs what
   *  the discussion runs (#1316). */
  follows?: string
  /** The runtime id the board holds for this agent, when the board no longer has that row.
   *  The fields around it are the runtime that runs instead. */
  unknownRuntime?: string
}

/** Which agent runs one flow, and what that agent runs here. Keyed by the command a user
 *  types, which is the same key a flow's rule file uses. */
export interface FlowAgent {
  /** The flow's name — what the rule file is keyed by. */
  command: string
  /** The line a user types: `card refine`. What a screen shows. */
  path: string
  /** The role that runs it. */
  agent: string
  /** The connector that role runs here. */
  harness: string
}

/** The board's runtimes, every harness they can name, and which agent runs each flow. */
export interface AgentInfo {
  /** The harness **Global default** runs — what an agent naming no runtime spawns. */
  name: string
  /** The command it spawns — the harness's own, or that row's `command` override. */
  command: string
  /** True when **Global default** names a harness this build doesn't ship, so the default
   *  runs instead. */
  isDefault: boolean
  /** What **Global default** is set to. A `secret` is never in here. */
  values: Record<string, string>
  /** The keys of its `secret` settings docs/kanban/.env holds right now — set or not
   *  set, and nothing more. The value never leaves this machine. */
  secretsSet: string[]
  /** The keys whose flag the `command` override already names, so the override wins. */
  ignored: string[]
  /** Every runtime the board holds, **Global default** first (#467). */
  runtimes: RuntimeView[]
  /** Every harness a runtime could name, with the settings each one takes — what the Harness
   *  field inside an expanded row offers. */
  options: HarnessOption[]
  /** What a person recognises this computer by — its hostname. Only ever a label a screen
   *  shows. */
  machine: string
  /** Which agent runs each flow, and what that agent runs here — every flow, in the order
   *  `FLOWS` lists them, so no screen keeps a list of its own. */
  flows: FlowAgent[]
  /** The harness name **Global default** asked for, when we don't ship it. We run the
   *  default and say so — never move the user to another harness silently. */
  unknownName?: string
  /** The file still holds the old top-level `command` key. Nothing reads it. */
  staleCommand?: boolean
}

/** One choice on a spec agent's setting (#255, #403). */
export interface SpecAgentChoice {
  value: string
  label: string
  /** What this choice costs, in one line: how long the run takes, how much detail it
   *  gives, or how readable the result is. Shown wherever the choice is offered. */
  cost: string
  /** What a run is told when this choice is picked (#1469). A role's own settings only. */
  prompt?: string
}

/** One setting on a spec agent's page (#255, #1003) — `HarnessSetting` above, for the agent
 *  that fills part of a card's spec rather than the CLI a run spawns. It is always a pick
 *  from named choices: never free text, never a number.
 *
 *  Every one of them is a role's (./roles.ts, #1469). An `AGENT.md` declares none: two ways of
 *  working is two agents. */
export interface SpecAgentSetting {
  /** The key it saves under inside that agent's entry in ui.config.json. */
  key: string
  label: string
  help?: string
  choices: SpecAgentChoice[]
  /** The `value` of the choice a run uses when nothing is saved. */
  default: string
}

/** One scheduled agent's cadence (#514, #929) — the pruner and the dismissal
 *  review. `agent/settings.ts` owns the reading and the writing. */
export interface CadenceSchedule {
  /** False once somebody disabled it (#1464): the board starts none, Run now still does. */
  enabled: boolean
  /** How often, in the grammar of `../cadence.ts`. */
  cadence: string
  /** The last pass that PASSED, as a minute stamp, or empty for "never run". */
  lastRun: string
  /** Where a cadence that never ran counts from — written by the scheduler's first look. */
  since?: string
}

/** Why a scheduled agent that is on is not starting right now (#1475): its gap has not
 *  passed, an `auto` one is backing off a failed run, nothing new arrived, or a card is being
 *  built. */
export type ScheduleWait = 'tooSoon' | 'retrying' | 'nothingNew' | 'building'

/** That wait as a screen says it (#1476): nothing new reads as what the agent reads. A gap
 *  still to pass is no reason — the next run's time says it. */
export type ScheduleReason = 'archived-cards' | 'chats' | 'dismissals' | 'retrying' | 'building'

/** What `auto` runs one agent on (#1543): its least gap, and the input it waits for, if any. */
export interface AutoSchedule {
  every: string
  reads?: 'archived-cards' | 'chats' | 'dismissals'
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
  /** What was actually spawned — never what the screen asked for. A result that doesn't say
   *  which connector answered can be read as being about the wrong one. */
  harness?: string
}

// ---- the workflows a card runs through (#715) -------------------------------
//
// A card runs through one workflow, and a workflow lists its agents in three groups (#2152):
// previews a person approves, each waiting on the approvals its `after` names (#2154), the
// agents that land the work once the last approval is in, and scheduled agents. The shapes are here because this is the
// module the board UI keeps a copy of; what they MEAN is `agent/workflows.ts`.

/** The three groups a workflow lists its agents in. */
export const WORKFLOW_GROUPS = ['previews', 'land', 'scheduled'] as const

/** One of the three. */
export type WorkflowGroup = (typeof WORKFLOW_GROUPS)[number]

// Built-in workflows the command no longer ships (#821). A card still naming one runs on the
// default instead of being refused — it cannot be moved to another workflow.
const RETIRED_WORKFLOWS: readonly string[] = ['content']

/** Whether a card naming `id` points at a workflow this board deleted — one it refuses to
 *  start. `known` is every workflow id the board has. */
export const workflowDeleted = (id: string, known: readonly string[]): boolean =>
  !!id && !known.includes(id) && !RETIRED_WORKFLOWS.includes(id)

/** One agent of one workflow, and what the workflow asks of it on top of the agent's own
 *  instructions. An agent belongs to one workflow (#1095); `off` keeps it there without
 *  running it. */
export interface WorkflowHelper {
  agent: string
  extra: string
  off?: boolean
}

/** The cadence a scheduled agent runs on until somebody sets one. */
export const SCHEDULED_CADENCE = '1d'

/** One scheduled agent of one workflow (#1401): it runs by itself on `cadence`, on no card. */
export interface WorkflowScheduled extends WorkflowHelper {
  /** How often, in the grammar of `../cadence.ts`. */
  cadence: string
  /** When its last pass that PASSED began, as a minute stamp, or empty for "never run". */
  lastRun: string
  /** Where a cadence that never ran counts from — written by the scheduler's first look. */
  since?: string
}
