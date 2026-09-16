# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## The memory set

- A finished card moves to `.archive/` and stays in git, so finished work can be read and
  diffed; a rejected card is deleted, since `rejected.md` records why. The archive is not
  memory — no flow reads it.
- A file nothing writes is the leftover we avoid, so the set never grows a fifth file.
- Every memory file belongs to the agent that owns it: `decisions.md` and `rejected.md` to the
  planner, `readme.md` and `redesign.md` to the builder, its own preferences and corrections
  to every other agent. The board holds no preferences of its own.
- Neither the board nor a module keeps a memory folder — a module is a topic inside an
  agent's file, and the shipped list and the cross-agent product calls hang off an agent too.

## The goal

- The goal is optional and free-form. The agent judges only whether text is there, never the
  prose, and never nags about a goal the user did write.
- With the goal empty, every planning flow reads direction from the card's module memory and
  the repository instead, and none of them asks the user to write one.

## Setup

- Setup asks the user for nothing it can read. It settles what a repository scan answers and
  hands every remaining call over as `[user]` questions on one card that tops the board.
- Setup is a bounded bootstrap: one scan, at most 5 decisions and 5 modules, 3 seed cards
  without full plans, with background refinement doing the deeper work. A repository with
  nothing to read finishes with no seed card at all.
- The module map comes after the decisions — a project started without code has no code to
  read a map from.
- While `setup-checklist.md` is there no flow creates a card, and the last tick deletes it. A
  card the user writes by hand is never blocked.

## The module map

- Be conservative, above all in a from-scratch repo: a simple single-purpose project is one
  module. Add lines only as the code grows.
- Adding a module later moves the notes now clearly its own out of the memory they came from,
  once. A rename keeps the memory; deleting one folds it back into the project set.

## Refining on its own

- One session drives one card the whole way and never pauses to ask the user: it answers what
  it is sure of and ends either `ready` or holding only the questions a human must answer.
- Creation and refinement keep a hard context boundary: creation distills the request into a
  self-contained card, refinement starts fresh and tests that card on its own. Context the
  card failed to preserve is a creation defect.
- A card is refined as soon as a run creates it, and never because a run merely edited it.

## The ready gate

- A card the gate turns down goes back to `todo` with its reason as a `[user]` question, so
  answering it refines the card and sends it through again.
- Turning the gate on applies only to cards that reach `ready` afterwards, so the switch never
  opens a batch of deliveries at once.

## Implementation runs

- Every agent's runs reach the network, Codex included, and no connector's shell is fenced to
  the project folder. Fencing one whose sandbox also shuts the network would cost every card
  its `npm install`; the fence stays available in Extra arguments.
- A connector may ship before a card has ever run on it: where no session on the machine can
  drive one end to end, it reaches the picker with the docs saying so, and the first real
  card's surprises become a new card.
- A conflict-free rebase is never reviewed again, whether or not the target branch touched the
  delivery's files. Only a resolved conflict takes a review, and there is no switch to turn
  the skip off.
- A landing conflict is retried forever and never handed back, on the run-retry curve capped
  at two minutes — nobody is asked, at the price of an unresolvable conflict holding cost.
- A delivery that ended abnormally is carried on by hand and never restarted for you. It may
  finish without rebuilding only on evidence its change is already on the target branch —
  never because every todo is ticked.
- Minor direct-to-target, no-commit execution is for interactive in-session work only;
  background runs keep delivery tracking and landing.

## Open questions

- A question can carry options — `single-option` or `multi-options` — and one with no options
  stays open-ended. A question written as prose keeps working and is never migrated.
- No flow puts a human in the loop while it works. Anything it cannot settle is left on the
  card and the run finishes; the user answers at the time they choose.
- The decider answers every `[user]` question still open on a card, takes the recommended
  option when it cannot decide, never hands a card back, and has no round cap. Turning it on
  applies only to what happens afterwards.

## Recurring tasks

- A built-in background job ships as a seeded card in `todo/recurring/`, run when the user
  sets a cadence — never as its own switch with its own state file. Deleting the card is the
  opt-out.
- Memory pruning is the exception: it is an agent, and recurring pruning is opt-in on its
  page, off by default, with its cadence in `ui.config.json`.
- The daily chat-memory review is its own agent, not a pruner job: it runs once a day, on by
  default, with a switch but no cadence, and skips a day with no new conversation. Pruning
  stays opt-in and off; tying the two would leave a default board writing no memory at all.
- A cadence is always the units grammar — `30m`, `2h`, `1d`, `1d at 09:30`. There is no word
  form to translate between.

## Releases

- A version ships when the user says it ships, open cards or not. Closing clears the release
  off the cards still open, and they are never moved in afterwards.
- The open releases are one line each in `releases.md`, in ship order, short enough that
  reordering and renaming are hand edits. A card naming a release the list doesn't have keeps
  it and is named back, but setting one is an error, so a typo can't invent a version.
- A release with a goal is filled by an agent judging each open card against it; one with no
  goal keeps the plain rule. Filling only ever adds, so it can be re-run as the goal changes,
  and taking a card back out is the user's move.

## The command

- One command owns every board and agent action, and every surface drives its runs through
  it, so there is one implementation of each move.
- What we teach a person is the actions the UI's buttons stand for; the board's own
  bookkeeping stays a command the agent calls.
- The command is a Node program, not a compiled binary: everything the board runs on already
  carries Node, and a binary would add six signed builds per release.
- `akb` typed alone opens the app when the app installed it; on a machine with no `akb` the
  board spells its own command as `node <path>/ai4kanban.mjs`, and nothing installs the
  command to make the name work.

## Installing and updating

- The repo is `ai4kanban/ai4kanban` — every link, manifest and install instruction names it.
- A user installs and updates by running one Node script published on npm: no shell script,
  no `curl … | sh`, no git clone.
- Install never asks which agents you use — it writes both `.claude/skills/kanban/` and
  `.agents/skills/kanban/` — and installing a board does not install the skill.
- A board file a release retires is deleted by `akb update`'s repair step, not left behind.

## Storage

- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend; only
  cards ever move, and there is one backend per project.
- Machine-local state the board cleans up itself lives under `~/.ai4kanban/`, one directory
  per project keyed by the project's path — so moving or renaming a project starts its
  records over. Only the user's own configuration stays in `docs/kanban/`.
- The GitHub Projects backend is wanted but parked; Notion gets a card when a user asks.

## Triage

- The board reaches one endpoint the user configures rather than a platform we integrate: the
  format is fixed, the endpoint and token are files in the board, so any provider works and
  none is named in the code. Connecting one is free and local.
- Source connections are optional and independent — Reddit through dist0 today, Obsidian and
  GitHub planned, mock data for demo — and each keeps its own identity, settings and pull
  results while sharing one Triage lifecycle and its deduplication.
- dist0 is ours, so its cost sits inside the AI4Kanban Cloud subscription; the published
  provider contract documents credentials and never billing.
- A card triage creates schedules its own refine, so an external item arrives with its plan
  written; the extra runs are spent without anyone asking.
- A dismissal only blocks the automatic pull — adding the same thing by hand is always let
  through, and no screen offers a restore. A dismissed item is kept for good, with the reason
  it was turned down.
- Triage has an opt-in demo mode, and every synthetic item is marked as such for good.

## Agents and runtimes

- A runtime is the whole answer to what a run runs as, with no inheritance from a per-harness
  block, so two agents on one harness can sit on two gateways. "Harness" means the CLI itself.
- The default is a position, not a badge: the first row is **Global default**, which no board
  can rename or delete and every agent naming no runtime runs. There is no "make default".
- A runtime's id keys everything and its name keys nothing, so a rename is lossless on every
  computer. Deleting one puts its agents back on **Global default** rather than being refused.
- Splitting a flow out onto its own agent copies the old agent's rule and runtime across once,
  so the first run after the upgrade behaves exactly as before; from then on the two copies are
  maintained separately.
- A runtime's shape travels in git and its key does not, so the first computer to upgrade sets
  the model every checkout runs, and a machine whose CLI never signed in inherits one it
  cannot run.
- Turning one agent on never flips another's switch; a page may warn about a combination and
  leaves both where the user put them. The proposer ships off, because reflection costs a run.
- The board's own background agents keep an on/off switch — auto-approve, auto-answer, the
  proposer, triage and the memory review are never assembled into a workflow, so the switch is
  whether the board starts that background run at all, not whether the agent exists. An agent
  inside a workflow has no switch: the stage's assignment is the only thing that says it takes
  part.
- The sweeper drops a card it judges done or not worth the investment with no sign-off and no
  `rejected.md` line, so the idea can be raised again. It skips only a card being built or
  blocked by an open one — a card waiting on the user's own answer is judged like any other.
- Run retry ships on the harnesses whose failure signals are proven, and gives up after 3
  attempts or 15 minutes: a blip recovers unattended, an outage stops holding the card.
- A harness's capability is declared from what the installed runtime actually does, not from
  what its protocol hands back — ZCode reports a session id it cannot resume, and declares no
  image input because every GLM model it ships is text-only.
- A context-window reading trusts the harness's own number first and falls back to models.dev's
  nominal cap, at the cost of reading low where that cap is a larger tier than the CLI runs.

## Spec agents

- Two spec agents ship, and only two: `ui-design` and `technology-selection`. Adding one later
  is writing a prompt, not changing the machinery. A spec agent may declare settings, and one
  that declares none is unchanged.
- A card points at a mockup with one `<Mockup>` tag on a line of its own; a markdown link is
  never drawn as one.
- Mockups are gitignored under `docs/kanban/.mockups/`, because a mockup is a working drawing
  the build throws away — so what a layout settled has to be in the card's words.
- Two styles: `full`, a `.tsx` or `.html` screen styled like the product, and `ascii`, a
  96-column plain-text drawing written into the card and never re-wrapped. `full` is the
  default and the setting is board-wide, so a card is never a mix.
- The agent draws one mockup by default, alternatives only when explicitly asked, each about
  as long as the card's own plan.
- The Resolve dialog does not show the mockups a layout question is about: the options name
  the labels and the user opens the card page to look.
- One design system per app: a style drawing against a saved one reads
  `docs/kanban/design/<app>.md`, picked from the card's module.
- Re-drawing a mockup is re-running the agent with the change said in words; selecting a single
  screen on the card page is not planned work.
- A spec agent's `owns` names the kinds of work it covers, never repository paths; where those
  files actually live is what its own memory accumulates.

## Chat

- The Create task chat offers **Discuss**, **Add task** and **Build now**: shape a vague idea,
  put clear work on the board, or implement it without a task.
- A chat does the board work itself, as soon as it is asked, through the board's own moves. It
  may take any action without asking, and git is where the user takes it back.
- A chat adds no rule of its own: the session is an ordinary kanban-skill session, so `--print`
  does a flow there and no flag starts a run.
- Only an agent whose command can be sent a second message into an open session can hold a
  chat; a conversation is never held by resending the whole exchange.
- A board holds many discussions, not one, and the app and the terminal are the same
  conversation. A card's chat freezes that card for one turn only.
- A conversation pins one runtime, kept with the transcript and carrying no model box of its
  own. Picking a row on another CLI starts the conversation over.
- A plan a **Discuss** chat writes is kept: once its cards are written it moves to
  `docs/kanban/plans/archive/`, and every card names that path as its source.
- Each discussion owns one plan and cannot modify another discussion’s plan, even when discussing it; preserve submitted sources through write permissions, with no version UI or extra files on each save.
- Plans are modified through ai4kanban only; direct edits in an external editor are unsupported.
- **Build now** leaves a delivery record and runs with AI review and diff approval off, so
  nothing holds it between commit and landing. The card it writes is a record, not a checkpoint.

## Card format

- The human half is for review and stands alone, because the agent half is folded by default.
  A spec agent's section joins the human half only when the user has to pick from it.

## Solutions

- A board mixes software, design and content cards. Each card selects a card type with a
  configurable plan → execute → review flow; built-in presets provide the starting point.
  Agents are created independently and declare their stage; creation never assigns them.
  Each workflow step selects one lead and existing helpers; helpers run only on request, with no always-call or mandatory-helper setting. First expose plan, execute and review assignments; existing
  discussion, decisions and maintenance remain board capabilities, with other hooks deferred.
  Built-in flows may be configured or copied but not renamed or deleted. No solution folder
  is copied into a board.
- A helper's Extra is the user's own additional requirement and nothing else. An order two
  agents must keep between them — the copy is confirmed before the screen is drawn — is built
  into the board, invisible to the user and not overridable, and the board enforces it by
  holding the second request back rather than by wording in a prompt.
- Custom agents keep one instruction body in the board's `agents/<id>/AGENT.md`;
  purpose, inputs and deliverables are not separate required fields. Preserve legacy
  metadata and use the same file for UI and manual edits.
- `solution` stays the word only while the marketing pack does — `product` and `marketing` are
  code written separately, and the word retires with them. `job` and `plugin` were never the
  product's words and do not come back.
- The card is the brief. Handing work to any executor, built-in or external, gives it the
  card's requirements as frozen at delivery start; the board writes no separate handoff
  brief. A card that cannot serve as the brief is a card written wrong.
- The executor is always a separate agent from the planner. An external tool or a person is
  an execute-stage agent whose runtime is "external": the board runs nothing and records
  only the paths they hand back — no artifact folder, preview, annotation or drag-drop.

## The eval set

- A partner is promised one page, once, before consent: no payment, the case stays in the
  closed eval set indefinitely, the analysis may pass through a model provider, and a letter
  deletes what they submitted. The terms are fixed at consent, so a later use needs consent
  gathered again.
- Only reproducible cases are admitted: one the team cannot reproduce stays a lead and its
  signal is given up.
