# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Card format

- ❌ **A `## Worth noting` bullet that states a fact** → ✅ name the cost, the tradeoff, or
  the option it beat, so a reviewer has something to reverse.
- ❌ **A card's state lives somewhere other than the card** → ✅ everything about a card is a
  frontmatter field the command writes, so the state survives a restart and any reader can
  parse it. A fact the board never wrote down is stamped on the card the moment it becomes
  true, as an optional field.
- ❌ **One feature split into sibling top-level cards** → ✅ a group task: a root holding the
  shared plan, ordering and spanning questions, with each piece a subtask. Read the open
  groups' roots first — a goal an open group already carries gets a subtask, not a second
  group.
- ❌ **A card claims behavior the product already has** → ✅ scope lists only what this task
  changes; restating what already holds reads as new work.
- ❌ **A user-facing answer planned as a command only** → ✅ a card whose result the user
  would want while looking at the board says where it shows in the UI too. But where the
  board's existing commands already return the data, the deliverable is a flow the command
  prints and the agent applies, and nothing is built.
- ❌ **Name a file off a title the user has not decided yet** → ✅ name it off the id alone.
- ❌ **用成对的自定义标签给 agent 写的卡片内容分区** → ✅ 用普通 Markdown 标题，由界面折叠；模型常漏写结束标签，新格式还要校验器和旧卡迁移。
- ❌ **为一项选择在卡片上新加一个持久控件（如 MDX 选择器）** → ✅ 用已有的选择机制：frontmatter、
  `[user]` 问题、对话与审批；MDX 组件无状态，存不下答案。

## Planning a card

- ❌ **Treat every test as "check by hand"** → ✅ put agent-executable checks in `## Todo`;
  reserve `verify:` for a reproducible human plan, and add the fixtures that plan needs.
- ❌ **Put an agent-proposed material change only in the folded half and let it become
  ready** → ✅ preserve the user's accepted behavior by default and surface every new
  user-facing scope choice as a `[user]` question. Self-answer implementation gaps only.
- ❌ **Record every auto-answer in `decisions.md`** → ✅ keep auto-answers on the card and
  append only a decision that helps a future planning call.
- ❌ **A run does its own follow-up work inside its own session** → ✅ each step is its own
  run, so the user can see it, read its log and stop it.
- ❌ **Infer which cards became unblocked after every run** → ✅ a rough card saves a one-shot
  refine when it first becomes blocked; finishing the blocker only makes that schedule
  eligible.
- ❌ **Scope a chain of runs by its happy path alone** → ✅ a card handing one run's report to
  the next also says what a stopped run, a failed run and an empty report do to the chain.
- ❌ **Fold a structure layer the user did not name into the call they did settle** → ✅ a
  module layer is a separate axis from ownership; dropping or merging it is an open question
  for the user, never a `Decided by the agent`.
- ❌ **Ask users to choose an unverified protection mechanism** → ✅ verify feasibility and
  bypass paths first, and never weaken an accepted protection requirement without agreement.
  "A determined bypass cannot be blocked" does not mean the agent cannot be constrained: a
  contract in the agent's own guide plus an ownership check in the command that writes is a
  real constraint, and is not a reason to escalate into a sandbox nobody asked for.

## Idea intake

- ❌ **Send an article, analysis or complaint straight to add-task** → ✅ treat it as
  evidence: extract the user problems, route them to modules, and validate them against
  shipped, planned, rejected and remembered work before creating cards.
- ❌ **Give each external source a separate task-creation or board-editing path** → ✅ treat
  every source as a peer input to the shared Triage lifecycle.
- ❌ **A plan's split adds a limit the user never asked for and parks the rest of the result
  in a recurring card** → ✅ the cards together deliver what the discussion asked for; batching
  splits the work, never the result.
- ❌ **Return a discussion plan with decisions the agent could propose left unresolved** → ✅
  choose and justify proposed outcomes, then loop until no gap remains; ask only for
  indispensable user information, with a recommendation, and never force a closing question.
- ❌ **Let a discussion take over another discussion's plan, or treat source preservation as
  version management** → ✅ each discussion owns its own plan; reading another never grants
  write access, and no snapshots or extra UI are needed.
- ❌ **Make users locate a session before reporting a bad result** → ✅ the flow starts from
  their complaint and linked card and locates the evidence itself.
- ❌ **Truncate shared evidence to fit arbitrary size caps** → ✅ keep shared conversations
  whole and let the feedback assistant select the relevant trajectory content.

## Agents and workflows

- ❌ **Hard-code one pair of agents' order into the command** → ✅ declare dependencies
  generically, so agents a user writes collaborate with no change to the command — and keep
  it a start guardrail, never scheduling, waiting queues and approval states.
- ❌ **Write a workflow's stage behaviour as guides the command overrides by workflow id** →
  ✅ make each role an agent that the workflow loads from its configuration.
- ❌ **Generalize by moving role lists while keeping one work mode per board** → ✅ one shared
  three-stage flow per card type, so software and content run on the same board.
- ❌ **Expose hypothetical hook support as configurable functionality** → ✅ keep other events
  extensible, but expose only supported stages.
- ❌ **Fixing a long agent output by changing its format (styleless HTML, a preview file)** →
  ✅ the card already renders Markdown; distil the content instead — the final copy first,
  then only the notes that affect the user's call.
- ❌ **A five-item handoff contract, a generated brief and an artifact folder with preview,
  annotation and drag-drop for work done outside** → ✅ the card is the brief, an external
  executor is one more execute-stage runtime, and what comes back is a list of paths.
- ❌ **A service token became a required user-facing connection step** → ✅ let the integration
  own service authorization and keep connector management separate from collection behavior.
- ❌ **A screen that assumes an agent wrote every field its layout needs** → ✅ everything the
  UI reads is structured output with a full example in the prompt and a validator that names
  the failing field; invalid output goes back to the session that wrote it and blocks approval.

## The command and its guides

- ❌ **Assume the command can find the board from where its own file sits** → ✅ it locates
  the board from the working directory, and anything moving per-project state keeps that true.
- ❌ **Publish the board's bookkeeping verbs as the command a person types** → ✅ publish the
  actions the UI's buttons stand for. A published verb is a contract forever.
- ❌ **Let a word mean a bookkeeping move at one layer and an agent run at another** → ✅ one
  meaning per word, and one name per level — delivery, run, session. Don't reuse a coding
  agent's own word for one of our nested things.
- ❌ **Ship the flows as reference pages copied into each project** → ✅ the command prints
  the flow for the board it was asked about, naming that project's own modules and paths.
- ❌ **Route a flow's card edits through a board command** → ✅ flows edit card bodies with
  their own file tools; only frontmatter goes through the command.
- ❌ **Give an action a second mode without saying when to pick it** → ✅ a card that adds a
  mode also states the rule for choosing it, and where the agent reads that rule.
- ❌ **Keep legacy commands and settings when renaming a feature** → ✅ one name across the
  product, removed without aliases or read-time fallbacks.
- ❌ **Teach `npx <short name>` without checking npm first**, or **check for a tool with
  `command -v <short name>`** → ✅ a short name is usually already someone else's package;
  check npm before publishing one, and prove a tool with a subcommand of its own.
- ❌ **Describe in the board guide storage that no planning, review or build agent reads** →
  ✅ the general guide carries only what those agents act on, each rule said once and short.

## Modules and the goal

- ❌ **Assume one top-level folder is one module** → ✅ a module can span several folders and
  two can share one, so no code maps a file path back to a module. Only the name is
  machine-read; where it lives is prose.
- ❌ **Judge the goal by a rule in the code** → ✅ the agent is the only judge of how good a
  goal is; the board only sees whether text is there.
- ❌ **Seed a file with a paragraph explaining what belongs in it** → ✅ the file starts empty
  and the explanation sits where the user is asked for it.

## Releases and retirement

- ❌ **A release is a group task you drag work into** → ✅ a release is a field on a card, so
  an ordinary card never has to live inside someone else's folder.
- ❌ **Make the agent's judgement safe by parking it in a proposal the user accepts** → ✅ the
  agent decides and writes; the log is the record, and undo is asking it to move a card back.
- ❌ **Collect a measurement with another bookkeeping call in an agent flow** → ✅ add the
  evidence to a call the flow already makes.
- ❌ **Retire a feature but keep the record it reads, because other code still touches that
  file** → ✅ follow every writer and reader to its purpose first; when all of them exist only
  to feed what is being retired, the file goes with it.

## Deliveries

- ❌ **Treat text differences as changed requirements** → ✅ the agent applying an answer
  judges whether requirements actually changed, and delivery control consumes that decision.
- ❌ **Turn an implementation detail found by review into a card** → ✅ review fixes in-scope
  mistakes and drops unrelated discoveries; task discovery belongs to a planning flow.
- ❌ **Keep a review verdict after rebasing onto a moved target** → ✅ review the composed
  tree after a conflict resolution, so the reviewed tree is the one that lands.

## UI design

- ❌ **Plan a screen in prose and call the card ready** → ✅ a card that changes what the user
  sees carries a drawing before it leaves planning.
- ❌ **Make one drawing style the only one, and decide it for every board** → ✅ a rendered
  screen is the default and ASCII the other choice, and which one is a board setting.
- ❌ **Put the mockup's markup in the card body** → ✅ each rendered mockup is its own file
  under a folder keyed by the card's id, with one short line pointing at it.
- ❌ **Call a mockup drawn by an outside engine "self-contained" and stop there** → ✅ name
  the board's sandbox as the constraint: no scripts, network, webfonts or images.
- ❌ **Build what the mockup shows where it contradicts the card's scope** → ✅ the scope is
  what is agreed; a redrawn mockup replaces it only when the card says so in words.

## Connectors

- ❌ **Read a connector's capability off what the protocol hands back** → ✅ prove the
  capability against the installed runtime and declare it on the harness.
- ❌ **Pin the one version a connector was exercised at, and check every connector** → ✅ a
  version-sensitive connector declares the range it was exercised across; a mature harness
  declares nothing and is never asked.
- ❌ **Treat standalone CLI paths as Desktop discovery coverage** → ✅ scan the reported
  Desktop cache paths, hashed folders included.
- ❌ **Scope a feature by an assumed harness format limit** → ✅ the agent reads the file
  itself, so research the actual path and surface a reading failure as a gap instead of
  writing a parser per harness.
- ❌ **Keep a second handled-ID list beside retained result files** → ✅ scan the files
  through one operation, and limit the UI's default range without deleting the evidence
  deduplication needs.
- ❌ **One global endpoint and token limit every intake source** → ✅ keep connection
  identity, settings and pull results per source while sharing the Triage lifecycle.
