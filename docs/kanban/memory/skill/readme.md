# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The board and the flows

- The daily loop users drive — add, refine, resolve, review, finish, reject, and what a
  finished build leaves on `verify:`: `web/content/docs/daily-loop.mdx`.
- How the board is laid out — the card's two halves around `<!-- agent -->`, group tasks,
  `## Worth noting after implementation`, per-agent rule files, the delivery records in
  `docs/kanban/deliveries/`, and mockups under `.mockups/`: `akb guide board`.
- Refining a card: one QA session looping to a clean sweep, a size check before details, a
  split at an obvious seam, and questions asked as options to tick: `akb guide qa-loop`,
  `akb guide qa-lightweight`.
- Planning a screen against the screens the project already has: `akb guide ui-design`.
- Turning an article, a report or feedback into cards, validated by module:
  `akb guide extract-ideas`.
- Naming which cards already on the board to build now: `akb guide next-card`.
- Splitting, renaming and removing a module, and where its memory goes:
  `akb guide module-map`.
- A card a run created is not actionable until that run finishes; every card action refuses
  until then, naming the run. The creating run itself is let through.
- One writer at a time on a board: a move waits its turn and says which process it is waiting
  on, and a lock left by a killed run is taken over.

## Setup and the goal

- Setup in one guide — config, goal, decisions, modules, first cards, with every call it
  can't settle left as `[user]` questions on one card: `akb guide setup`.
- The goal is optional: `goal.md` may stay empty, carries `reviewed: strong | good | pending
  | weak`, and no flow stops for it: `web/content/docs/daily-loop.mdx`,
  `web/content/docs/what-makes-a-good-goal.mdx`.

## Releases

- Plan a version, fill it against its goal, close or drop it, and get a changelog on close:
  `web/content/docs/releases.mdx`, `akb guide plan-release`, `akb guide changelog`.
- A card says which release it ships in through `--release`: `akb guide releases`.

## Deliveries

- One Implement carries a card from build to landed and archived, reviewing its own work and
  holding at landing on open questions or diff approval: `akb guide implement`,
  `akb guide review`.
- Review fixes in-scope mistakes, logs unrelated discoveries and never creates a card; a
  review that records nothing stops the delivery and asks: `akb guide review`.
- A conflict-free rebase lands on the verdict it already has; a resolved conflict is reviewed
  over the intersection only: `akb guide review`.
- Review can be switched off per board and per Implement (`aiReview`):
  `web/content/docs/daily-loop.mdx`.
- Answering a question does not cancel a build over wording — the pass applying the answers
  says whether requirements changed: `akb guide resolve`.
- A build's commit mode can be chosen per Implement, and a detached `HEAD` is a manual-mode
  case rather than a refusal.
- A failed or cancelled delivery is carried on with **Resume** rather than rebuilt; it keeps
  its worktree, branch, approved requirements and review, and refuses with a reason when the
  checkout, the card or the delivery itself is gone.
- **Build now** builds a sentence or a handed-over plan with no card of its own, writing its
  card as it starts: `akb guide implement`.

## The command

- Every board move and every run is an `akb` command that works on any board, answers
  `--json`, and prints its flow with `--print` instead of starting anything:
  `cli/README.md`, `akb help runs`.
- A run outlives the command that started it; `akb runs`, `akb log --follow`, `akb stop` and
  `akb resume` reach any run from anywhere: `cli/README.md`, `web/content/docs/runs.mdx`.
- Delivery, run and session are the three nested things, one name each: `akb help runs`.
- A repository can hold more than one board: `akb install --board <dir>`, `--board` or
  `AI4KANBAN_BOARD` on every command: `cli/README.md`.
- `akb chat` talks about the board or one card, keeps many discussions, pins a runtime per
  conversation and records each reply's time, tokens and cost:
  `web/content/docs/chat.mdx`, `cli/README.md`.
- `akb triage fetch | add | run | check` is the one name for what is waiting to be sorted:
  `web/content/docs/triage.mdx`.

## Workflows

- Every card runs through one workflow — `plan → execute → review`, each stage led by one
  agent that may call helpers in. Two ship with the command: `coding`, what every board did
  before, and `content`, whose three leads write into the repository. A board adds its own;
  a built-in can be reassigned and copied but not renamed or deleted. `akb workflow list`
  shows them, `akb workflow stage <id> --stage <stage> --lead <agent>` assigns one.
- A card names its workflow in its own frontmatter — `akb raw create --workflow <id>`, or
  the picker on the card page. A card that names none runs on `coding`. Moving a card to
  another workflow sends it back to `todo` to be planned again, and is refused while a
  delivery is building it.
- An agent declares which stage it can take, with `akb.stage: plan | execute | review` in
  its `AGENT.md`; one written before that key reads as `plan`. A stage offers only the
  agents that declare it, and no agent a stage can assign carries a switch of its own — the
  assignment is the whole answer, the Code reviewer included: `web/content/docs/agents.mdx`.
- A content card's execute and review are read in that workflow's own words: no tests, no
  diff-size bar, and a delivery that wrote no file stops unfinished rather than passing as
  one with nothing to land. Ask for the flow a card actually reads with
  `akb guide <topic> --card <id>`.
- Content work runs on the ordinary board, through the `content` workflow: the marketing
  board and everything only it had — `akb channel`, `akb write`, `akb marketing verify`,
  `akb raw channel-status`, `--channels`, `--solution` and the `write` agent kind — are gone,
  and there is one kind of board again. A board still carrying a `Solution` line, cards with
  `channels:` or a `kind: write` agent opens unchanged: the line is ignored, the cards read as
  ordinary cards, and the agent is listed as one problem.
- The three content agents keep a memory of their own in
  `docs/kanban/memory/agents/<agent>/` — the writing taste, in their own words. All three are
  handed all three folders on every content run; each writes back only its own.

## Agents, runtimes and keys

- Every flow is run by a named agent — the roles, the ones that switch off, and the
  specialists: `web/content/docs/agents.mdx`.
- A board adds one rule per agent in `docs/kanban/rules/<agent>.md`, appended to every run
  that agent does and frozen into a delivery when it starts: `akb guide board`.
- A runtime is the whole answer to what a run runs as, its shape in git and its key in
  `docs/kanban/.env`: `web/content/docs/runs.mdx`.
- Which coding agents the board runs, what each needs installed, and where each one's
  sandbox, resume and image support stand: `web/content/docs/connectors.mdx`.
- A run that goes silent ends by itself after the board's limit, as a failure Resume picks
  up: `web/content/docs/connectors.mdx`.
- Pruning the memory is the Memory pruner agent, not a card: `akb prune-memory` is its flow
  over the project's memory, each module's and the agents'. Recurring pruning is opt-in with
  a cadence, off by default; it names no card and leaves no `verify:` line.
- A chat writes no memory. What a conversation settled is written down once a day by the
  Review chat memory agent, which reads each conversation with new messages right through and
  writes, rewrites or deletes the notes it earns; `akb review-memory` asks for one by hand.
  It is on by default, runs only when something has been said, and switching it off is the
  one way a board stops remembering what a conversation decided:
  `web/content/docs/agents.mdx`, `web/content/docs/chat.mdx`.
- Settling the cards that have sat too long is the Sweeper agent, on a cadence of its own:
  one sweep takes up to five stale cards through `akb card unstick`, stalest first, one per
  dispatcher tick, and ends at the cap, at nothing left, at the first run that does not pass,
  or when the cadence is switched off. The cadence is the whole opt-in and is off by default;
  an `unstick` runs one at a time across the board.

## Spec agents

- A spec agent is one folder under `docs/kanban/agents/<name>/AGENT.md`, fills one
  ``## By `<name>` agent`` section, may carry settings, and may declare `memory: project`:
  `web/content/docs/agents.mdx`, `akb guide spec-agent`.
- `ui-designer` answers with one design rather than alternatives, one mockup per screen worth
  reviewing: "Mockups on a card" in `kanban-ui/README.md`.
- `technology-selection` answers with one table of candidates and one line naming the pick.

## Memory

- A memory file belongs to whoever writes it: `docs/kanban/memory/` holds the board's own
  record — `readme.md` and `goal.md` — and everything a run learned is an agent's, under
  `memory/agents/<agent>/`. The planner keeps `decisions.md`, `rejected.md` and
  `redesign.md`; a module is a `## <module>` topic inside a file, not a folder:
  `web/content/docs/agents.mdx`, "Who owns a memory file" in `akb guide board`.
- `akb update` moves an older board's memory over by itself — merged into what is already
  there, never overwritten, and only once: `akb guide update`.

## Installing and updating

- Install and quick start: `README.md`, `cli/README.md`.
- Updating is a newer command then `akb update`, which repairs the board and removes what a
  release retired: `akb guide update`.
- A desktop user needs no npm — the app carries `akb` and installs it as a symlink:
  `desktop/README.md`.
- Every board action a button offers can be asked for in plain words from a coding agent; an
  API key is the one thing handed back for the user to type.

## Cloud and language

- What a board publishes to Cloud, and how a local board and a hosted one carry across:
  `web/content/docs/local-and-cloud-boards.mdx`. `akb cloud` says what this machine is
  signed in as; `akb cloud import|export` moves a board either way.
- Anonymous usage reporting is read and changed with `akb telemetry status|on|off`:
  `web/content/docs/local-and-cloud-boards.mdx`.
- The reading language belongs to the machine, in `~/.ai4kanban/settings.json`, and what the
  board writes follows it: "The board's language" in `akb guide board`.
