# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Project memory

- ❌ **Assume one top-level folder is one module** → ✅ a module can span several folders and
  two can share one, so no code maps a file path back to a module. Only the name is
  machine-read; where it lives is prose.

## Card format

- ❌ **A `## Worth noting` bullet that states a fact** → ✅ name the cost, the tradeoff, or
  the option it beat, so a reviewer has something to reverse.
- ❌ **A card's state lives somewhere other than the card** → ✅ everything about a card is a
  frontmatter field the command writes, so the state survives a restart and any reader can
  parse it.
- ❌ **Accept that a fact the board never wrote down cannot be shown** → ✅ stamp it on the
  card at the moment it becomes true, as an optional field written only when set.
- ❌ **One feature split into sibling top-level cards** → ✅ a group task: a root holding the
  shared plan, ordering and spanning questions, with each piece a subtask.
- ❌ **A second group for a goal an open group already carries** → ✅ read the open groups'
  roots first and add the piece as a subtask where one already aims at that outcome.
- ❌ **A card claims behavior the product already has** → ✅ scope lists only what this task
  changes; restating what already holds reads as new work.
- ❌ **A user-facing answer planned as a command only** → ✅ a card whose result the user
  would want while looking at the board says where it shows in the UI too.
- ❌ **Answer an ask the agent already fields by adding a command and a screen** → ✅ when
  the board's existing commands already return the data, the deliverable is a flow the
  command prints and the agent applies, and nothing is built.
- ❌ **Name a file off a title the user has not decided yet, and rename it later** → ✅ name
  it off the id alone; a title box that saves as it is typed has no instant to rename at.

## Idea intake

- ❌ **Treat source preservation as version management** → ✅ each discussion owns one plan; enforce cross-discussion write isolation without extra snapshots or UI.
- ❌ **Truncate shared evidence to fit arbitrary size caps** → ✅ keep shared conversations whole and have the feedback assistant select relevant trajectory content; impose no application size caps on case submissions.

- ❌ **Send an article, analysis or complaint straight to add-task** → ✅ treat it as
  evidence: extract the user problems, route them to modules, and validate them against
  shipped, planned, rejected and remembered work before creating cards.
- ❌ **Give each external source a separate task-creation or board-editing path** → ✅ treat
  every source as a peer input to the shared Triage lifecycle.
- ❌ **Return a discussion plan with decisions the agent could propose left unresolved** → ✅
  choose and justify proposed outcomes, then loop until no gap remains; ask only for
  indispensable user information, with a recommendation, and never force a closing question.
- ❌ **Let a discussion take over another discussion’s plan** → ✅ each discussion maintains its own plan; reading or referencing another plan never grants write access.
- ❌ **Make users locate a session before reporting a bad result** → ✅ the flow starts from
  their complaint and linked card, locates the evidence itself, and asks about the task only
  when the history is ambiguous.

## The command

- ❌ **Assume the command can find the board from where its own file sits** → ✅ it locates
  the board from the working directory, and anything moving per-project state has to keep
  that true.
- ❌ **Publish the board's bookkeeping verbs as the command a person types** → ✅ publish the
  actions the UI's buttons stand for. A published verb is a contract forever.
- ❌ **Let a word mean a bookkeeping move at one layer and an agent run at another** → ✅ one
  meaning per word, and one name per level — delivery, run, session.
- ❌ **Reuse a coding agent's own word for one of our nested things** → ✅ pick a word the
  neighbouring tool is not already using for a different lifetime.
- ❌ **Ship the flows as reference pages copied into each project** → ✅ the command prints
  the flow for the board it was asked about, naming that project's own modules and paths.
- ❌ **Route a flow's card edits through a board command** → ✅ flows edit card bodies with
  their own file tools; `akb board` only rewrites frontmatter.
- ❌ **Give an action a second mode without saying when to pick it** → ✅ a card that adds a
  mode also states the rule for choosing it, and where the agent reads that rule.
- ❌ **Keep legacy commands and settings when renaming a feature** → ✅ one name across the
  product, removed without aliases or read-time fallbacks. We do not keep backward
  compatibility.
- ❌ **Teach `npx <short name>` without checking npm first**, or **check for a tool with
  `command -v <short name>`** → ✅ a short name is usually already someone else's package or
  a system binary; check npm before publishing one, and prove a tool with a subcommand of its
  own.

## The goal

- ❌ **Judge the goal by a rule in the code** → ✅ the agent is the only judge of how good a
  goal is; the board only sees whether text is there, and a goal just written never nudges.
- ❌ **Seed a file with a paragraph explaining what belongs in it** → ✅ the file starts empty
  and the explanation sits where the user is asked for it.

## Releases

- ❌ **A release is a group task you drag work into** → ✅ a release is a field on a card, so
  an ordinary card never has to live inside someone else's folder.
- ❌ **Make the agent's judgement safe by parking it in a proposal the user accepts or
  discards** → ✅ the agent decides and writes; the log is the record, and undo is asking the
  agent to move a card back.

## Retiring and measuring

- ❌ **Collect a measurement with another bookkeeping call in an agent flow** → ✅ add the
  evidence to a call the flow already makes. Measurement must not make the agent take an
  extra step.
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

## Refining on its own

- ❌ **Ask users to choose an unverified protection mechanism** → ✅ verify feasibility and bypass paths first; resolve technical choices and never weaken accepted protection requirements without agreement.
- ❌ **Read "a determined bypass cannot be blocked" as "the agent cannot be constrained"** → ✅ a contract in the agent's own guide plus an ownership check in the command that writes is a real constraint; design that layer, and do not escalate a scoping requirement into a sandbox nobody asked for.
- ❌ **Treat every test as "check by hand"** → ✅ put agent-executable checks in `## Todo`;
  reserve `verify:` for a reproducible human plan, and add the fixtures that plan needs.
- ❌ **Record every auto-answer in `decisions.md`** → ✅ keep auto-answers on the card and
  append only a decision that helps a future planning call.
- ❌ **Put an agent-proposed material change only in the folded half and let it become
  ready** → ✅ preserve the user's accepted behavior by default and surface every new
  user-facing scope choice as a `[user]` question. Self-answer implementation gaps only.
- ❌ **A run does its own follow-up work inside its own session** → ✅ each step is its own
  run, so the user can see it, read its log and stop it, and every handover line says "in a
  fresh session, not this one".
- ❌ **Infer which cards became unblocked after every run** → ✅ a rough card saves a one-shot
  refine when it first becomes blocked; finishing the blocker only makes that schedule
  eligible.
- ❌ **Scope a chain of runs by its happy path alone** → ✅ a card handing one run's report to
  the next also says what a stopped run, a failed run and an empty report do to the chain.

## UI design

- ❌ **Plan a screen in prose and call the card ready** → ✅ a card that changes what the user
  sees carries a drawing before it leaves planning; scope bullets read as agreed while every
  reader pictures a different screen.
- ❌ **Make one drawing style the only one, and decide it for every board** → ✅ a rendered
  screen is the default and ASCII the other choice, and which one is a board setting.
- ❌ **Put the mockup's markup in the card body** → ✅ each rendered mockup is its own file
  under a folder keyed by the card's id, with one short line pointing at it.
- ❌ **Call a mockup drawn by an outside engine "self-contained" and stop there** → ✅ name
  the board's sandbox as the constraint: no scripts, network, webfonts or images, so styles
  are inline, fonts are system stacks and art is inline SVG.

## Connectors

- ❌ **Read a connector's capability off what the protocol hands back** → ✅ prove the
  capability against the installed runtime and declare it on the harness.
- ❌ **Pin the one version a connector was exercised at, and check every connector** → ✅ a
  version-sensitive connector declares the range it was exercised across; a mature harness
  declares nothing and is never asked.
- ❌ **Treat standalone CLI paths as Desktop discovery coverage** → ✅ scan the reported
  Desktop cache paths, hashed folders included, by the same known-path approach.
- ❌ **Scope a feature by an assumed harness format limit** → ✅ the agent reads the file
  itself, so research the actual path, hand it the staged file, and surface a reading failure
  as a gap instead of writing a parser per harness.
- ❌ **Keep a second handled-ID list beside retained result files** → ✅ scan the files
  through one operation, and limit the UI's default range without deleting the evidence
  deduplication needs.
- ❌ **One global endpoint and token limit every intake source** → ✅ keep connection
  identity, settings and pull results per source while sharing the Triage lifecycle.

- ❌ **Generalize software by moving role lists while keeping one work mode per board** → ✅ resolve a shared three-stage flow per card type, allowing software and content on the same board with configurable specialist hooks.

- ❌ **Expose hypothetical hook support as configurable functionality** → ✅ keep other events extensible, but expose only supported stages; existing board decisions retain their triggers and settings.

- ❌ **A service token became a required user-facing connection step** → ✅ let the integration own service authorization, verify its contract, and keep connector management separate from collection behavior.

- ❌ **A five-item handoff contract, a generated brief and an artifact folder with preview, annotation and drag-drop for work done outside** → ✅ the card is the brief, an external executor is one more execute-stage runtime, and what comes back is a list of paths the existing review stage reads.
