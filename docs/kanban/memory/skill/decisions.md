# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## The memory set

- The set is four files, plus `goal.md` outside it at the project level. There is no
  `archive.md`: a file nothing writes is exactly the leftover we avoid, and what shipped is
  recorded in the published docs with a `readme.md` line pointing at them.
- What the agent decided by itself stays on the card, in its own section, so the user can
  check it. Only a call a future card would need reaches `decisions.md`.
- A finished card moves to `.archive/` beside `todo/` and stays in git, so finished work can
  be read and diffed; a rejected card is still deleted, since `rejected.md` records why. The
  archive is not project memory — no flow reads it.
- **A spec agent's memory is two files**: `redesign.md` and `decisions.md` in
  `memory/agents/<agent>/`, and no third — a product fact worth keeping is written into the
  decision or lesson it supports, and how the product looks is read from the app's design docs.

## The goal

- The agent judges only whether a goal is there, never the prose: missing or seed text is
  `weak`, anything the user wrote is at least `good`. Nagging about a goal the user did
  write is worse than no nag.
- What a good goal contains is advice in a guide setup links to. Nothing enforces it and the
  file stays free-form.
- `goal.md` is no flow's precondition. With it empty, evaluate-task, extract-ideas and
  plan-release read direction from the card's module memory and the repository itself and
  carry on; none of them stops, and none asks the user to write one.

## Setup

- Setup asks the user for nothing it can read, the goal included. It settles what the
  repository scan answers into `decisions.md` and hands every call it can't settle over as
  `[user]` questions on one card that tops the board — never in the checklist, never in
  `decisions.md`.
- Skipping the goal ticks the `goal` step and leaves `goal.md` empty, and setup runs to the
  end from there: `decisions`, `modules` and `tasks` read the repository — README, package
  files, the tree — and produce the same three seed cards whenever the scan supports them.
- The module map comes after the decisions — a project started without code has no code to
  read a map from.
- Setup ends after creating 3 initial cards, the foundations later work builds on. Their
  refinement runs continue independently in the background.
- Setup is a bounded bootstrap: one repository scan, at most 5 high-level decisions and 5
  modules, and seed cards without full plans. Background refinement does the deeper work.
- **Nothing to read**: with no goal and a repository that yields no README or package file,
  setup still finishes and creates no seed cards, leaving the board empty for the user's own
  first card.
- While `setup-checklist.md` is there no flow creates a card; the last tick deletes it and a
  finished checklist is never kept as a record. A card the user writes by hand is never
  blocked.

## The module map

- Be conservative, above all in a from-scratch repo — a simple single-purpose project is one
  module, not several. Add lines only as the code grows.
- Adding a module later moves the notes now clearly its own out of the memory they came
  from, once. A rename keeps the memory with the module; deleting one folds its memory back
  into the project-wide set.

## Refining on its own

- One session drives one card the whole way. It never pauses to ask the user: it answers
  what it is sure of and ends either `ready` or holding only the questions a human must
  answer.
- Creation and refinement keep a hard context boundary: creation distills the request into a
  self-contained card, and refinement starts fresh and tests that card on its own. Context
  the card failed to preserve is a creation defect.
- A card is refined as soon as a run creates it — every action that used to follow nothing
  starts a refine on the cards it created, and none on the cards it merely edited.

## The ready gate

- A card the gate turns down goes back to `todo`, with its reason appended to the card as a
  `[user]` question — the same rule any card holding an unanswered question already follows,
  so answering it refines the card and sends it through the gate again.
- Turning the gate on starts nothing already on the board: it applies only to cards that
  reach `ready` afterwards, so the switch never opens a batch of deliveries at once.
- **A new agent's rule starts empty**: splitting a flow out onto its own agent copies nothing
  out of the rule it used to run on, so gate lines left in the planner's rule stop reaching the
  gate run until the user moves them.

## Implementation runs

- Minor direct-to-target, no-commit execution is limited to interactive in-session work;
  background runs retain delivery tracking and landing semantics.
- A run's exit code is the verdict, except where an agent contradicts it: `claude -p` exits
  0 on a `result` that says `is_error`, so the Claude Code renderer reports that failure and
  the run closes as an error rather than advancing its card. Every other agent we ship exits
  non-zero for the same thing.
- Every agent's runs reach the network, Codex included. Its `workspace-write` sandbox blocks
  it by default and it is the only connector that fences the network at all — leaving it
  shut meant a card needing an `npm install` passed on five agents and failed on one.
  A hand-written sandbox in the agent's `command` chooses for itself, network and all.
- **Codex is fenced the same on every platform**: `workspace-write` holds on Windows too —
  measured on Windows 11 with Codex v0.152.0, reads, edits and shell commands all run under
  it, so no platform gets an unfenced Codex run.
- **A run that goes silent is ended by the board**: 10 minutes with no output, counted from
  its last line or from its start when it never printed one. It closes as a failed run, never
  as a stop, and the limit is a board setting that can be raised or switched off.
- **A connector's shell is not fenced to the project folder**: every agent but Codex runs its
  commands wherever the machine lets them, Antigravity included — fencing one whose sandbox
  also shuts the network from a settings file the board cannot write would cost every card an
  `npm install` or a `git fetch`. The fence stays available in Extra arguments.
- **A connector may ship before a card has run on it**: when no agent session on the machine
  can drive one end to end — Antigravity's `--dangerously-skip-permissions` is refused by the
  sandbox every session here runs under — it reaches the picker with the docs saying so, and
  the first real card's surprises become a new card.
- **A rebase is reviewed for what it brought in, not for the whole delivery again**: one that
  touches none of the delivery's files lands with nothing run — no review and no repository
  check — and only one that shares a file with the delivery, or a resolved conflict, takes a
  review, scoped to that intersection. A board that wants its own check on every rebase gets a
  hook to plug one into later.
- **A landing conflict is retried forever, never handed back**: a `conflict` run that fails
  is reopened after a backoff wait, without limit, until the rebase goes through — nobody
  is asked, at the price of a conflict nothing can resolve holding runs and cost
  indefinitely. The wait reuses the run-retry curve, capped at two minutes, so landing and
  run retries share one set of numbers rather than each having their own. The separate cap
  on rebases against a target branch that keeps moving still asks.

## Open questions

- A question can carry options — `single-option` to pick one, `multi-options` for as many as
  you want — and one with no options stays an open-ended ask. A question written as prose
  with the choices inside keeps working and is never rewritten; no card is migrated.
- No flow puts a human in the loop while it works. Anything it cannot settle is left on the
  card as an open question and the run finishes; the card is where the user answers, at the
  time they choose.
- **What `decider` answers**: with its switch on, every `[user]` question still open on a card,
  including the ones a review left when it sent a delivery back.
- **When `decider` cannot decide**: it takes that question's recommended option and carries on,
  and never hands the card back to the user.
- **How long `decider` keeps answering**: with no cap — every new `[user]` question raised on a
  card starts another decide run, however many rounds it has already answered.
- **Turning `decider` on**: it applies only to the QA convergences and delivery events that
  happen afterwards; cards already stopped on a question stay where they are until
  `akb card decide <id>` or the next refine.

## Recurring tasks

- A built-in background job ships as a seeded card in `todo/recurring/`, run when the user
  sets a cadence — never as its own UI switch with its own state file. The card is the
  visible, editable record; deleting it is the opt-out, and nothing re-adds it.
- **Memory pruning is the exception**: it is the Memory pruner agent, not a card. **Prune
  memory** in the Memory panel — and on the phone's Memory screen — opens that agent's page
  in Configuration → Agents rather than starting a run; **Run now** there is the pass, and a
  prune raises nothing for a human to review. Recurring pruning is opt-in behind a compact
  chip on the same page and starts Off, including after migration; the cadence and the last
  successful pass live in `docs/kanban/ui.config.json`. A board still carrying the old prune
  card loses it once on the next repair, keeping its cadence as an inactive preference.
- A cadence is always the units grammar — `30m`, `2h`, `1d`, `1d at 09:30`. There is no word
  form like `daily`, so nothing has to translate between two.

## Releases

- A version ships when the user says it ships, open cards or not. Closing clears the release
  off the cards still open; they are never moved into the release afterwards.
- The open releases are one line each in `docs/kanban/releases.md`, in ship order, holding
  only what is still ahead — short enough that reordering and renaming are hand edits.
- A version id is letters, numbers, dot, dash and underscore, kept as typed. A card with no
  release has an empty field, and there is no sentinel name for that state.
- A card naming a release that is not on the list keeps it and `release list` names the id,
  so it can be put back; setting a release the list doesn't have is still an error, so a
  typo can't invent a version.
- A release with a goal is filled by an agent run that judges each open card on whether it
  ships the goal and writes what the board hasn't got. One with **no** goal keeps the plain
  predictable rule: high-priority cards in no release, unblocked, not a group root.
- Filling only ever adds — a card already in another release is left alone — so it can be
  run as often as the goal changes, and taking a card back out is the user's move.

## The command

- One command owns every board and agent action, and the skill shrinks to a short note
  pointing at it. The UI drives its runs through the same command, so there is one
  implementation of every move rather than one per surface.
- What we teach a person is the actions the UI's buttons stand for. The board's own
  bookkeeping stays a command the agent calls and stays out of the README.
- The command is a Node program, not a compiled binary: everything the board runs on already
  carries Node, so a binary would remove no dependency and would add six signed builds per
  release. The desktop app runs it under Electron's own Node.
- `akb` typed alone opens the app when the app installed it — the same command is the CLI
  when given an action, the way `cursor` works. The npm copy prints help.
- On a machine with no `akb`, the board spells its own command as `node
  <path>/ai4kanban.mjs`, pointing at the copy that is running. Every flow writes `akb` and
  each printed line resolves it, so a test or doc that hard-codes `akb` is the thing to fix,
  and nothing installs the command or fetches it from npm to make the name work.
- `propose` is retired: finding work the board is missing is extract-ideas over the planning
  sources in `config.md`, and nothing else. `akb propose` is deleted outright with no alias
  and no pointer — an old call gets the ordinary unknown-command refusal.

## Installing and updating

- Our GitHub repo is `ai4kanban/ai4kanban` — every link, manifest and install instruction
  names it.
- A user installs and updates by running one Node script published on npm. No shell script,
  no `curl … | sh`, no git clone: the package carries the skill folder.
- Install never asks which agents you use; when it writes the skill it writes both
  `.claude/skills/kanban/` and `.agents/skills/kanban/`, and the skill names no agent's
  folder in its own instructions.
- Installing a board does not install the skill — that is a later extra, added on purpose.
  Updating still refreshes a skill already there.
- The board installs a git `pre-commit` hook wherever the skill is installed and without
  asking, writing it only when there is none and printing one line saying it did.
- **A retired board file is deleted, not left behind**: when a release drops a board file for
  good, `akb update`'s repair step removes it from the user's board and says so, the same way
  it clears other leftovers from an older layout.

## Storage

- The GitHub Projects backend is wanted but parked; Notion is a later idea that gets a card
  when a user asks for it.
- **External input sources**: Obsidian notes and GitHub Issues feed Triage alongside dist0 API and the mock provider; source material never directly edits the board.

- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend — only
  cards ever move. One backend per project.
- Machine-local state the board cleans up itself — the run record and its logs, the chats and
  their attachments, the mockups, the comments and every lock — lives under `~/.ai4kanban/`,
  one directory per project, so two projects on a machine never read each other's. Only the
  user's own configuration remains active in `docs/kanban/`: the API keys and the per-machine model.
- **Switch storage without migrating history**: finish existing runs and deliveries before
  switching all processes; new versions use only the machine directory. Legacy project
  state stays unread and untouched, with its ignore and transfer protections retained
  until the user cleans it up.
- Those directories are keyed by the project's path. Moving or renaming a project starts its
  records over and the old directory is moved across by hand — nothing in the project records
  a stable identity to find them back by.

## The market signal inbox

- **The board reaches one endpoint the user configures, not a platform we integrate**: the
  board fixes the signal format it accepts and the user points an endpoint and a token at
  it, so any platform that returns that format works and none of them is named in the code.
- **Connecting a provider is free and local**: the endpoint and the token are files in the board, so any board reaches any provider with no account; dist0, the paid provider we sell, is watched from inside Cloud instead, so a subscriber keeps one dashboard and one account.
- **dist0's paid signals are not billed separately**: dist0 is ours, so its cost sits inside the AI4Kanban cloud subscription rather than a provider account the user holds and pays; the published provider contract therefore documents credentials and never billing, quota or plan terms.
- **A signal that passes triage becomes a card that refines itself**: triage schedules a
  refine on every card it creates, so an external signal arrives with its plan already
  written rather than as one paragraph — the extra runs and their cost are spent
  automatically, without anyone asking.
- **When the proposer reflects**: one run per completed card, started as that card is archived; nothing else triggers reflection.
- **A dismissal only blocks the automatic pull**: a dismissed item is never fetched again, but a user adding the same thing by hand is always let through — re-pasting the link is the only way back from a wrong dismissal, and no screen offers a restore.
- **Triage has a demo mode anyone can turn on**: the mock provider we develop against ships with the board as an opt-in demo, so a user can try triage before paying for a provider, and every synthetic item is marked as such for good so a demo item can never be read as a real lead.

## Agents and harnesses

- **A runtime is the whole answer to what a run runs as**: harness, provider, endpoint, key,
  model id, reasoning and extra arguments are one named row on one list, with no inheritance
  from a per-harness block — so two agents on one harness sit on two gateways. "Harness" means
  the CLI itself, and "model" survives only as a box inside a runtime (#467).
- **The default is a position, not a badge**: the first row is **Global default**, which every
  board has, which no board can rename or delete, and which every agent naming no runtime runs.
  There is no "make default" anywhere.
- **The id keys everything, and the name keys nothing**: a runtime's name is free text, unique
  and never empty; its id is generated to what `docs/kanban/.env` parses and never changes, so a
  rename is lossless on every computer.
- **A runtime's shape travels and its key does not**: harness, endpoint, model id and arguments
  are the board's, in `ui.config.json`; the key is one line per runtime in `docs/kanban/.env`.
  So the first computer to upgrade sets the model every checkout runs, and a machine whose CLI
  never signed into that provider inherits a model it cannot run.
- **An upgrade turns an older board's blocks into rows, once**: every `harnessSettings` block
  becomes a runtime — the one `harness` named becomes **Global default** — and each agent whose
  `.local.json` model differed gets a row of its own, so a board runs exactly what it ran. A
  pre-#443 `runtimes` block is discarded rather than read under the new rules.
- **Deleting a runtime clears the agents that named it** rather than being refused: they fall
  back to **Global default**.
- **One key-naming scheme, and the upgrade enforces it**: every runtime's key line in
  `docs/kanban/.env` is named after that runtime's id, **Global default** included, and the
  upgrade rewrites the lines it finds — off the runtimes list rather than off the migration, so a
  second computer is repaired too. A rename then stays lossless on every computer, at the cost of
  the board rewriting the user's key file on each computer it is pulled to (#467).
- **The stale sweep is its own `sweeper` agent, and it drops cards without asking**: a card
  it judges already done or not worth the investment is rejected with no sign-off and no
  `rejected.md` line, so the idea can be raised again; a card it keeps comes back refined,
  with a note in the human half on what direction has to change first. It skips only a card
  being built and one blocked by another open card — a card waiting on the user's own answer
  is judged like any other, and can be dropped before that answer ever comes (#116).

- **A signal the `inputbox` agent turns down is not deleted**: it moves out of the inbox into
  a junkbox with the reason, and is cleared 30 days later — long enough to catch a wrong
  verdict, and the inbox holds only what has not been judged.
- **Turning one agent on never flips another agent's switch**: `inputbox` says on its own page
  that running it with `gater` and `decider` on lets an unread external signal reach landed
  work, and leaves both switches exactly where the user put them.
- **The proposer ships off**: reflection on a completed card costs a run, so a board
  proposes nothing until someone turns the proposer on.

- **Retry ships on Claude Code and Codex first**: both declare the retry capability, built from
  this board's own captured failure output; every other harness retries nothing until its
  signals are proven.
- **A retry gives up after 3 attempts or 15 minutes**: an ordinary provider blip recovers
  unattended, and a real outage stops holding the card long before an hour is gone.

- **A ZCode chat keeps turning a pasted picture away**: ZCode declares no image input, and
  that is the honest answer rather than a missing feature — its wire takes attachments, but
  the runtime drops any image whose model is text-only, and every GLM model ZCode ships is.
  It reopens when a vision-capable model appears in ZCode's own config.

## Spec agents

- Two spec agents ship, and only two: `ui-design` and `technology-selection`. Adding one
  later is writing a prompt, not changing the machinery.
- A spec agent may declare settings, and one that declares none is unchanged. `ui-design`
  gets the first — mockup style — and `technology-selection` gets none.
- A card points at a mockup with a tag the board UI knows, on a line of its own —
  `<Mockup src=".mockups/239/a.html" label="A" />`. A markdown link is never drawn as one,
  so nothing a card already says turns into a mockup by accident.
- Mockups are not in git: they live under `docs/kanban/.mockups/`, which `init` gitignores,
  because a mockup is a working drawing the build throws away — so what a layout settled has
  to be in the card's words. Archiving or rejecting a card still deletes its folder.
- The two styles are `full` — a `.tsx` or `.html` screen styled like the product, in a file
  the card points at — and `ascii`, a plain-text drawing written straight into the card
  section. `full` is the default and the setting is board-wide, so a card is never a mix.
- The ASCII style writes no file because the drawing is already text the card can hold: it
  survives the pull, with no tag, folder or cleanup. It is 96 columns wide, every character
  one column, and never re-wrapped.
- The agent draws one mockup by default and alternatives only when explicitly asked. Each stays
  short — one screen, about as long as the card's own plan.
- The Resolve dialog does not show the mockups a layout question is about: the options name
  the labels and the user opens the card page, one click away, to look.
- The list of mockup formats is written in `akb guide ui-design` only — putting it in
  `akb guide board` would cost every flow the context for a rule only screen cards need.
- **One design system per app**: a mockup style that draws against a saved design system reads
  `docs/kanban/design/<app>.md`, picked from the card's module, and extracts one per app.
- Revising a single screen by selecting it on the card page is not planned work: a mockup
  is re-drawn by re-running the agent with the change said in words, until splitting a design
  across screens has been used enough to show the chat handoff is the thing that hurts.

## Chat

- The Create task chat offers **Discuss**, **Add task**, and **Build now**: shape a vague idea,
  put clear work on the board, or implement it without a task.
- **What Build now leaves behind**: a delivery record and nothing else — the run is logged, its
  branch lands the way any delivery's does, and Runs shows it with the typed sentence where a card
  id would be.
- **Build now never waits**: it runs with AI review and diff approval off, so nothing holds the
  delivery between the implementation's commit and landing. The card it writes changes that in
  no way — it is a record, not a checkpoint.
- Only agents whose command can be sent a second message into the session it already opened
  can hold a chat; any other names the ones that can. A conversation is never held by
  sending the whole exchange again each turn.
- A chat does the board work itself, as soon as it is asked, through the board's own moves —
  it never writes out a change and waits for a click, and never sends the user to a button.
- It may take any action without asking, archiving, rejecting and starting a build included;
  what it changes stays in the working tree, and git is where the user takes it back.
- It adds no rule of its own: the session is an ordinary kanban-skill session, so `--print`
  does a flow there and no flag starts a run.
- A conversation pins one runtime, kept with the transcript, so a terminal continues it on the
  same row. The planner's is the default; picking a row on another CLI starts the conversation
  over rather than moving the transcript to one that never opened it, and picking one on the same
  CLI carries it on with the change marked. It has no model box of its own — the row carries the
  model.
- A plan a **Discuss** chat writes is kept: once the run it was handed to has written its
  cards it moves to `docs/kanban/plans/archive/`, and every card it produced names that
  archive path as its source.
- **`akb chat` reaches the board's discussions**: a board holds many rather than one, so with
  no message `akb chat` lists the discussions going and a message says which one it continues.
  The app and the terminal stay one conversation.
- **A card's chat freezes the card for one turn**: the card is held while its chat's agent is
  replying and free the moment that reply ends, so the board may pick it up between turns
  rather than waiting for the discussion to be ended.

## Card format

- The human half is for review — one short paragraph of what the task does plus the points
  worth noting, self-contained because the agent half is folded by default. The agent half
  is for execution — `## Scope`, `## Todo` and the rest — detailed enough to implement from
  but still plain, with no coding details.
- "Worth noting" is its own section in the human half, under the summary paragraph, written
  for the reviewer; the agent reads every line and needs no such section of its own.
- A spec agent's section goes in the human half when the user has to pick from it; every
  other one stays in the agent half.
- The boundary is an HTML comment, `<!-- agent -->`, on a line of its own, which does not
  show when the card is rendered. Cards written before it are reordered the next time they
  are refined — there is no pass over the board.

## The board's language

- On a card already written in English, an agent's open question and `verify:` line still
  come in the reader's language: the two things written to be read by the user personally
  follow the setting on every card, while the body around them follows the file.

## Solutions

- **The word for a job is `solution`**: it names both what a user picks — product,
  marketing — and the folder that provides it. `job` and `plugin` are not the product's
  words.
- **The marketing pack is its own code**: marketing's flows and commands are written
  separately rather than as options on the product ones. Content marketing runs
  draft → repurpose → edit → publish, which shares little with the product's
  add-task → refine → implement → archive; what the two really do share moves into the
  kernel at the extraction, not before.

## The eval set

- **What is a partner promised before the collection switch goes on?**: one page, once, before
  consent — no payment, the case stays in the closed eval set indefinitely, the analysis may pass
  through a model provider, and a letter from the partner deletes what they submitted. The terms
  are fixed at consent, so a later use of the cases needs consent gathered again.
- **Only reproducible cases are admitted**: a partner's submission enters the private eval set
  only after the team reproduces it from the files its trajectory read and reviews it against
  the behavioral criteria; one that cannot be reproduced stays in the pending store as a lead
  and its signal is given up, so every case in the set is reproducible.
