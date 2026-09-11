# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The board and the flows

- Module splits carry their existing memory with them; renames move the memory folder,
  and removing a module returns its remaining notes to project memory: `akb guide module-map`.
- The flows ship with the `akb` command, not with the project: `akb guide` lists them, a
  printed flow carries the ones its action needs in full, and a project holds only a short
  note pointing there, so an update upgrades every flow at once: `skill/SKILL.md`.
- The manual a coding agent reads — every command it may call, when to call each, and the
  line that fixes an ask that can't run: `akb help runs`.
- The daily loop as users drive it, archiving a finished card into `docs/kanban/.archive/`,
  and the refine that follows every run on every card it created or changed:
  `web/content/docs/daily-loop.mdx`.
- Refine runs one QA session that loops over the card until a clean sweep finds no new gap,
  and asks a question with choices as options to tick rather than prose: `akb guide qa-loop`.
- Refine checks a card's size before its details — roughly 200 lines or 12 todos is a stop
  sign for a cohesion check, and a split happens only at an obvious seam, never waiting for
  approval: "Split before refining details" in `akb guide qa-loop`.
- A card reads in two halves: what a reviewer must read on top, and everything a builder
  needs below a `<!-- agent -->` marker that never renders. Refine repairs an older card
  into that shape without rewording it: `akb guide board`, `akb guide qa-loop`.
- A card that changes a screen carries its layouts either as a file under
  `docs/kanban/.mockups/<card id>/` pointed at by one `<Mockup>` tag — gitignored, so what
  the drawing settled has to be in the card's words — or as a fenced plain-text block in the
  body, which travels with the card. `<Mockup>` is the only tag a card body may carry:
  `akb guide board`.
- A card that changes something users see is planned against `akb guide ui-design`: matched
  to the screens the project already has, saying what it shows with nothing to show and when
  it fails, with one drawn layout `A` by default and alternatives only when explicitly asked.
- Source-to-task extraction treats articles, research and user feedback as evidence,
  validates by module, and skips work already supported or planned: `akb guide extract-ideas`.
- A finished build leaves what only the user can confirm on the card's `verify:` field —
  `akb board update-verify <id> --append ".."` — as a note that blocks nothing, while a
  decision only the user can make stays a `[user]` question: "What the build leaves you to
  check" in `web/content/docs/daily-loop.mdx`.
- A card's `## Worth noting after implementation` holds what building it turned up that
  needs no decision, and is never part of what a delivery is approved to build:
  `akb guide board`.
- "Group task" in `akb guide board` gives the steps that build one, and a group closes
  itself: resolving the last subtask line archives the root in the same run, unless every
  line was struck out by reject or the root carries an open question or todo of its own.

## Setup and the goal

- Setup follows one guide — config, goal, decisions, modules, first tasks — asking only for
  the project, the goal, and the agent that works, and leaving every call it
  can't settle as `[user]` questions on one card that tops the board: `akb guide setup`.
- Setup keeps its steps in `docs/kanban/setup-checklist.md`, creating no cards while the
  file is there and deleting it on the last tick: "Setup" in `skill/SKILL.md`.
- `akb setup` finishes a board in one run from the first unticked box, so it can be run
  again after a failure, and needs no installed skill and no `akb` on the PATH:
  `akb help runs`.
- `goal.md` starts empty and carries `reviewed: strong | good | pending | weak`, the agent's
  judgement of whether the goal is clear enough to plan from: `web/content/docs/daily-loop.mdx`.
- What a good goal covers, offered as one line the user can skip:
  `web/content/docs/what-makes-a-good-goal.mdx`.
- A board with no goal written still gets its planning done: with `goal.md` missing, empty
  or still seed text, evaluate-task, extract-ideas and plan-release take direction from the
  card's module memory and the repository itself and carry on, and none of them asks the
  user to write one: `akb guide evaluate-task`, `akb guide extract-ideas`,
  `akb guide plan-release`.

## Releases

- Say which release a card ships in — `create --release v1`, `update <id> --release v1`,
  `--release ""` to take it out: "Releases" in `skill/SKILL.md`, `akb guide releases`.
- Plan a version, say what it is for, and list every version in ship order with its counts:
  "Plan a release" in `web/content/docs/releases.mdx`.
- Fill a version against its goal — the agent moves in the cards that ship it, writes the
  ones the board is missing, and only ever adds, so it can be run again: `akb guide plan-release`.
- Close a shipped version or drop one that won't ship; both clear it off the cards still
  open: "Close a release", "Drop a release" in `web/content/docs/releases.mdx`.
- Closing also writes a changelog — a few plain lines saying what the version changed, six
  at most, in the language of the release goal. `akb changelog <version>` starts the same
  run by hand and replaces rather than appends: `akb guide changelog`.

## Recurring tasks

- `akb raw create --recurring` writes `Run state` and `Process` into the card;
  cadence stays off unless `--cadence` is explicitly passed: `akb guide recurring-task`.
- Run a job, give it a cadence (`30m`, `6h`, `1d at 09:30`) so the board runs it itself, and
  read when it last ran: "Recurring tasks" in `kanban-ui/README.md`. From a terminal it is
  `akb run <id>`, one pass, stamping `last_run`.
- Every new board starts with one recurring card, "Prune the memory", with no cadence —
  setting one prunes on that schedule, deleting the card opts out for good. No published doc
  covers this yet.

## The command

- Every bookkeeping move is a command of `akb`, listed by `akb board help`; a move works on
  any board (`--dir <path>`, or the folder it was run in), a refused one says why and exits
  1, and `--json` makes any move answer as one object.
- Every run the board can start is also a command, so a card can be built from a terminal,
  over ssh or from a script: `cli/README.md`.
- Every one of those takes `--print`: it starts nothing and prints the job filled in for
  this board, so an agent already in a session does the work there. An agent inside a run
  always gets the printed flow, so a run can't spawn a copy of itself: `akb help runs`.
- A run outlives the command that started it, and `akb runs`, `akb log --follow`, `akb stop`
  and `akb resume` reach any run from anywhere, whoever started it: `cli/README.md`.
- The board's three nested things each have one name everywhere: a **delivery** is the whole
  job one Implement starts, a **run** is one execution attempt inside it, a **session** is
  the coding agent's own conversation that a resume picks back up: `akb help runs`.
- `akb implement` starts a delivery against the card exactly as it read when it started;
  `akb cancel <delivery-or-card-id>` ends one and hands the card back. While one is in
  flight, `revise`, `refine`, `resolve`, `reject` and `archive` refuse that card and name
  what has it — except from inside the delivery's own session: `akb help`.
- `akb implement <id>` warns about a card's open questions the way it warns about a blocker:
  the delivery starts and holds at landing until they are answered. The board archives the
  card itself as the last step after landing; the `review` flow no longer archives one.
- A delivery reviews its own work: `akb review <id>` judges the candidate against the
  approved card and fixes what it finds in the same run, and the board starts it. Review
  answers with `akb board review-verdict`, the only thing the delivery reads, so a review
  that records nothing stops the delivery and asks: `akb guide review`.
- Review takes work nobody asked for back out of the delivery: it fixes implementation
  mistakes in scope, notes unrelated discoveries in the run log, and never creates a card.
- A stopped delivery leaves one `[user]` question and keeps holding the card; `akb resolve`
  is the one held action let back through: `akb guide review`.
- `akb approve <delivery-or-card-id>` signs off the tree a delivery would land on a board
  requiring diff approval. It covers the base commit and tree as they stand, so read the
  diff first, and either one moving cancels it: `akb help runs`, `akb guide review`.
- A build's commit mode can be asked for per Implement, not just configured; `akb implement`
  in a terminal carries none and falls back to the setting. A detached `HEAD` no longer
  refuses a build — it joins no-git and no-commit as a case where manual mode is the answer.
- A rebase before landing no longer buys a second full review. When the target branch brought
  in nothing the delivery also changes, the verdict the delivery already has carries on and it
  lands; when the two share a file — a resolved conflict among them — the review that follows
  judges only that intersection and reruns only the checks those paths affect: `akb guide
  review`.
- Review can be turned off, per board and per Implement: `aiReview` in
  `docs/kanban/ui.config.json`, on by default and written only when off. With it off a
  finished implementation queues for landing itself, a rebase on the way starts no review
  either, and in manual commit mode the user's own commit ends the delivery whatever it
  holds. The repository's checks, the open-question hold and diff approval are untouched, and
  `akb delivery review <id>` still starts one: `web/content/docs/daily-loop.mdx`.
- Every delivery leaves one JSON file under `docs/kanban/deliveries/`, tracked in git and
  kept after the card is archived, including every review verdict and why one stopped:
  `akb guide board`.
- Every flow the board runs is run by a named **role** — Planner (create, refine,
  resolve, revise, plan-release, changelog, archive, reject, setup), Builder (implement,
  conflict, run) and Reviewer (review) on a product board, with Writer standing in for
  Builder and taking `channel` on a marketing one. A role is a name, one line, the flows it
  runs and the memory files it already owns; nothing moves: `web/content/docs/agents.mdx`.
- A board adds **one rule of its own per agent**, not per flow — plain words in
  `docs/kanban/rules/<agent>.md`, named for a role or a specialist and appended to the end of
  every run that agent does, tracked in git. One rule on `builder` reaches `implement`,
  `conflict` and `run` alike. `akb raw rule <agent> --text|--file` writes it and an empty one
  clears it; a board whose rules were keyed by flow folds each file into its role's, once, on
  first read. A delivery freezes the rules of the agents it is made of when it starts, so
  editing one changes the next delivery and never one in flight: `akb guide board`.
- A rough card gets `schedule: refine` when it first becomes blocked; `akb board schedule
  <id> --action implement|refine` replaces it and `--clear` cancels it for that episode:
  "Queue a card that is waiting on another" in `web/content/docs/daily-loop.mdx`.
- One writer at a time on a board: a move waits its turn and says which process it is
  waiting on. A lock left by a killed run is taken over the moment that process is gone. No
  published doc covers this yet.
- The board no longer scores its own planning, and no longer keeps `docs/kanban/record.csv`:
  the three per-release figures said nothing about whether shipped work met the need, so the
  view, the whole calculation and every line written only to feed it are gone. `akb update`
  deletes an older board's leftover copy. `metrics.csv` is untouched.
- `akb triage add --title ".." --text ".."` writes one item straight into triage, with
  `--file <path>` for a longer body and `--source` for where it came from. It needs no
  endpoint and no Cloud account, and an item triage already holds is refused: "Put
  something in yourself" in `web/content/docs/triage.mdx`.
- **Triage is the one name for it, and the old one is gone.** The command is `akb triage
  fetch | add`; `akb signals` fails as an unknown command. The endpoint is
  `- **Triage endpoint** — <url>` in `config.md` and the token `TRIAGE_ENDPOINT_TOKEN` in
  `docs/kanban/.env` — `Signal endpoint` and `SIGNAL_ENDPOINT_TOKEN` are no longer read, and
  a board carrying only those is told it is not set up. Nothing is rewritten for you: rename
  the two settings, and update any script or recurring card still running the old command.
  The recurring card a first pull seeds is now **Fetch triage items**; a board already
  carrying the old **Fill the inbox** card keeps it, unchanged, and gets the new one too:
  `web/content/docs/triage.mdx`.

## Agents, runtimes and keys

- A run goes through the settings the board saved, never what your shell exported, and the
  same command changes them — which agent, its model, how hard it thinks, who pays, the key
  — and says which agents it can run and what each takes: `cli/README.md`.
- **DeepSeek Harness** (`akb agent use dsh`) needs `npm install -g @deepseek-ai/dsh` and
  then `npm install -g @openma/deepseek-harness-acp` — two commands, never one, since npm
  gives everything named together its own folder. A dsh run is pinned to the dsh beside the
  bridge with `--dsh-path`, or every run dies as it opens: `cli/README.md`.
- **ZCode** (`akb agent use zcode`) needs `npm install -g zcode-app-cli` or ZCode Desktop,
  and signs in with a Z.AI or BigModel Coding Plan key alone. A ZCode run is not fenced to
  the project — ZCode ships no sandbox: `web/content/docs/connectors.mdx`.
- **A board names its runtimes, and one runtime is the whole answer to what a run runs as** —
  harness, provider, endpoint, key, model id, reasoning and extra arguments, with nothing
  inherited from anything. The list lives in `ui.config.json` and travels in git, **Global
  default** first and undeletable; each row's API key is this computer's, one line in
  `docs/kanban/.env` named after that row's id. `akb agent`, `agent runtime add|rename|delete`,
  `agent set --runtime`, `agent bind` and `agent use` are the whole of it: "Which runtime each
  agent runs on" in `web/content/docs/runs.mdx`.
- An agent naming no runtime runs **Global default**. Renaming a row moves nothing — the id
  keys the key line, the agents' picks and every run recorded — and deleting one puts the
  agents that named it back on **Global default**.
- A run that stops producing any output ends by itself after the board's silence limit —
  10 minutes unless the board says otherwise, and `0` switches it off — whatever agent it
  runs on. It ends as a failure, so the card keeps its work and Resume picks it up:
  `web/content/docs/connectors.mdx`.
- **Proposer** reads a card the board has just finished and puts the work that should follow
  it in Triage, each item carrying its rationale and the card that prompted it. Off by
  default and turned on in Configuration → Agents, where it costs one run per completion;
  archiving is its only trigger, and finding nothing worth proposing is a normal result:
  "Let the Proposer look back" in `web/content/docs/agents.mdx`.

## Spec agents

- A **spec agent** fills one part of a card's spec in a run of its own: `akb spec` lists
  them, `akb spec <name> <id>` puts one on a card. It starts clean, writes one
  ``## By `<name>` agent`` section and nothing else, and rewrites that section when it runs
  again: `web/content/docs/agents.mdx`, `akb guide spec-agent`.
- The board asks for one itself, so most spec runs are ones nobody typed: the flow writing a
  card asks for the part it would otherwise guess at, a refine or revise asks only when that
  part is still open, and a release plan asks for none.
- A spec agent can carry settings of its own — what it produces, not only whether it runs —
  chosen in the board UI and saved with the board, so every card that agent runs on gets the
  same answer: "The spec agents" in `kanban-ui/README.md`.
- `ui-design` answers with the screen drawn, not described: one layout labelled `A` by
  default, alternatives only when explicitly asked, and nothing written under a drawing. Its
  setting picks
  **Rendered screen** (a `.tsx`/`.html` file per option) or **ASCII drawing** (written into
  the card, travelling through git, a much shorter run): "Picking a layout by looking at it"
  in `web/content/docs/agents.mdx`.
- A spec agent can **remember what it learned about the product** across its runs: `memory:
  project` in its `AGENT.md` — the only scope, anything else reported as a problem — gives it
  `docs/kanban/memory/agents/<name>.md`, tracked in git and inlined into every run of that
  agent. Two hands write it: the flow that hears the user append one line when its section is
  taken or sent back, and the agent itself curates the file. `ui-design` declares it;
  `technology-selection` does not. `memory/agents/` is reserved — `akb raw memory-init agents`
  is refused: "Give an agent memory" in `web/content/docs/agents.mdx`.

- `technology-selection` comes back with one table — two or three candidates, what each is,
  pros and cons — and one line naming the pick. Keeping what the project already uses and
  writing it yourself are rows on the same terms, and every name is looked up before it is
  written down.

## Chat

- `akb chat "…"` talks about the board and `akb chat <id> "…"` about one card. The reply
  arrives as it is written, the next message lands in the same session, and
  `--clear` starts fresh. Conversations are kept under `docs/kanban/.chats/`, out of git,
  and a chat is not a run — it never shows in `akb runs` and never holds a card:
  `cli/README.md`.
- A fresh conversation is only the harness's kanban-skill invocation plus the user's
  message — no copied board snapshot, command manual or separate chat flow — so chat behaves
  exactly like the skill in a coding-agent conversation, `--print` and all. There is no
  `akb guide chat`: `web/content/docs/chat.mdx`.

## Installing and updating

- `akb` is a command you install — `npm install -g ai4kanban` — or run with
  `npx --yes ai4kanban@latest <command>`: "Quick start" in `README.md`.
- `akb install` scaffolds the board and writes nothing outside `docs/kanban/`. Letting a
  coding agent drive it is separate and optional: `akb skill`, `akb skill install`, and
  `akb update` for one already there: `cli/README.md`.
- Adding the skill writes one file, `SKILL.md`, so nothing generated lands in git.
- A desktop user needs no npm: the app carries `akb` and installs it as one symlink, so
  updating the app updates the command: `desktop/README.md`.
- Updating is two lines and no third — a newer command, then `akb update` to repair the
  board, which checks npm and names the line when it is behind: `akb guide update`.
- `akb board init` keeps `docs/kanban/.env` out of git on new boards and repairs the ignore
  rule on older ones: `kanban-ui/README.md`.
- Every board action a button offers can be asked for in plain words from a coding agent. An
  API key is the one thing handed back: the agent gives the user the line to type.

## Cloud and language

- `akb cloud` says which account this machine is signed in as, whether Cloud takes its work,
  which boards publish and which release each watches, and where Slack and Lark post or what
  they last refused; `akb cloud sign-out` forgets the account. Signing in is the app's — the
  consent screen comes back to it, so there is no code to paste anywhere.
- `akb` publishes a board's actionable tasks to Cloud after every write over plain `fetch`,
  through `.akb/cloud-outbox.json`, so a board write never waits for the network and an
  unreachable Cloud loses nothing; a start reconciles the board against Cloud. `akb` still
  runs on Node 18 with no dependencies.
- An event carries enough of the card to review away from your machine: the opening
  paragraph and `## Worth noting` sections beside the number, title, release, revision and
  questions, bounded and refreshed when the card is rewritten.
- The language you read in belongs to the machine, held in `~/.ai4kanban/settings.json`
  outside every repository, so no project carries a language in git. There is no command
  that sets it — the switcher is the app's — and what `akb` prints stays English either way.
- A board set to 中文 comes back in 中文: card prose, questions, options, `verify:` lines,
  memory notes and changelogs follow it, while frontmatter keys, `##` headings, the
  `<!-- agent -->` boundary, the `[user]` tag, module names and filenames stay
  English. Rewriting a file keeps the language it is already in: "The board's language" in
  `akb guide board`.
- "What's next?" now answers with a pick from the cards you already have, not three new ones:
  `akb guide next-card` is the rule — ready and unblocked cards, ranked by priority, then ROI,
  then which release ships first, up to three named with one line each on why. "What are we
  missing?" is what still proposes new work. No new command and no new field; the two asks
  route apart in the skill and in `web/content/docs/daily-loop.mdx`.
- Adding a card chooses lightweight or standard QA and loads only its matching guide.
  Lightweight uses `--print` and finishes inline; standard QA gets its own session and
  checks task boundaries before refining details: "Push a card forward" in
  `web/content/docs/daily-loop.mdx`.
- Grok Build joins the agents a board can run, and it needs no folder of its own:
  `akb skill install` writes it into `.agents/skills/kanban/`, the folder the other six
  agents already share, because grok scans that folder from the working folder up to the
  repo root: `web/content/docs/connectors.mdx`.
- Antigravity CLI reads that same folder, and needs no target of its own either:
  `akb skill install` writes it into `.agents/skills/kanban/`, and every run carries
  `--add-dir <folder>` because `agy -p` expands a skill's slash name only when the run
  names the folder holding it: `web/content/docs/connectors.mdx`.
- A DeepSeek Harness resume whose session the agent has forgotten now restarts instead of
  failing: the board opens a fresh session, sends the task from the top, writes the new id
  over the dead one, and the log says it restarted. A chat thread unwedges the same way.
  Any other refusal still fails the run: `web/content/docs/connectors.mdx`.
- `akb cloud import <workspace>` carries a board into an AI4Kanban Cloud workspace and
  `akb cloud export <workspace> --to <folder>` writes one back out as a markdown board the
  command opens as a Local one. Import reads the board and changes nothing in it, and a second
  run after an interruption carries on rather than doubling anything. The board's memory files
  and its per-flow rules are board operations now, so both clients read and write them where
  the board is.
- A chat transcript records what each reply took: its time, and the tokens and cost the
  connector reported for that turn (`docs/kanban/.chats/<what it is about>.json`). A
  connector that reports neither leaves them out rather than writing a zero.
- `akb board archive` stamps an `archived:` date (`YYYY-MM-DD`) into the card's frontmatter
  on its way out — on the card and, for a group, on every subtask leaving with it. Optional,
  the way `last_run` is, so nothing already archived grows one and nothing is backfilled.
- `akb chat [<id>] --model <id>` and `akb chat [<id>] --agent <name>` set what one
  conversation runs on; `""` puts either back on the board's. The pick lives with the
  transcript, so a terminal and the board app read the same one, and every run still takes
  the board's own agent and model: `web/content/docs/chat.mdx`.
- A **spec agent** is one folder, not board code: the board ships `ui-design` and
  `technology-selection`, and a project adds its own under `docs/kanban/agents/<name>/AGENT.md`.
  Its frontmatter carries `name`, `description` and an `akb:` block saying which hook it plugs
  into — `kind: spec`, or `kind: write` on a marketing board and refused anywhere else — what
  part of a card's spec it owns, and which settings it offers; each setting's choice names one
  file inside the agent's folder, and only the chosen one reaches the run. `akb spec` lists them
  and, under them, anything wrong with one it found: `web/content/docs/agents.mdx`.
- The word changed from **skill** to **agent** in 0.9.0, and a board upgrades without moving a
  file: `docs/kanban/skills/` and `SKILL.md` are still read for one release, each hit listed with
  a line saying to move it; a section written as ``## By `x` skill`` is rewritten in place; and
  `akb guide spec-skill` still answers under its new name, `spec-agent`. `akb spec <agent> <id>`,
  `akb raw spec-write` and the `specAgents` setting never changed spelling.
- A repository can hold **more than one board**. `akb install --board <dir>` puts one anywhere;
  every command takes `--board <dir>` or reads `AI4KANBAN_BOARD`, and a command typed inside the
  board folder finds it. The flag beats the variable, both beat `--dir`, and with none of them the
  walk up for `docs/kanban` is exactly what it was. A named board's project is the nearest `.git`
  above it, so `.akb/` and the repo `.gitignore` stay shared; every pasteable hint and every
  printed flow spells that board's own path in place of `docs/kanban`: `cli/README.md`.
- A board says what its work IS in one `- **Solution**` line in its own `config.md` — `product`
  (a board with no line, which is every board made before this) or `marketing`. The solution
  picks the flow text `akb guide` and every `--print` hand over; each solution supplies its own
  overrides and additions.

- `akb telemetry status|on|off` reads and changes anonymous usage reporting for the machine,
  never prompting, so a terminal-only user can turn it off without opening the app. The answer
  is on when absent and lives beside the language in `~/.ai4kanban/settings.json`; turning it
  off drops what is queued and forgets the install id, and `status` prints that id while
  reporting is on. A settings file that exists but cannot be read stops reporting and refuses
  every write until it is fixed.
- A build can carry no card at all: the sentence sent from **Build now** is the delivery's
  approved requirements, its title and its prompt. It works in `.akb/worktrees/delivery/<id>`
  on `delivery/<id>`, runs with AI review and diff approval off, holds and archives no card,
  and reports nothing to Cloud. `akb delivery review|conflict|cancel` take the delivery
  itself. `akb guide implement` says what such
  a build does and does not leave behind.
- `akb propose` is gone, and typing it now answers "unknown command". Finding new work is one
  path: idea extraction from a source you name, and with none named it reads the **Planning
  sources** in `docs/kanban/config.md`. "What are we missing?" still asks for it:
  `web/content/docs/daily-loop.mdx`.
- The project goal is optional: setup no longer stops for it. Skipping it in the first run
  ticks the `goal` step and leaves `docs/kanban/memory/goal.md` empty, and setup runs to the
  end — `decisions`, `modules` and `tasks` read the repository (README, package files, the
  tree). A repository with nothing to read finishes setup with no seed card at all, leaving
  an empty board. `akb guide setup` says it step by step.
- The ready gate can start a build without you: `readyGate` in `ui.config.json`, off unless
  turned on. With it on, a card whose plan settles — `todo` → `ready`, and only that move —
  gets one `card gate <id>` run, which judges it by `akb guide gate` and either changes
  nothing (the board then opens the delivery, on the board's own delivery settings) or
  appends one `[user]` question, which takes the card back to `todo`. It takes one card per
  round in `akb guide next-card`'s order and never a blocked, recurring, group-root, in-flight
  or already-ready card; a gate run that fails or is stopped changes nothing. It is a planner
  flow, so it runs whatever runtime the planner is bound to.
- The decider answers a card's `[user]` questions for you: `decider` in `ui.config.json`, off
  unless turned on. It is a fourth role — the only switchable one — running one flow,
  `card decide <id>`, by `akb guide decide`: it chooses from `memory/goal.md`, the card's
  modules' `decisions.md` and each question's own recommendation, applies its answers the way
  `resolve` does, and records each choice in the card's `decided:` list. It writes no lasting
  decision anywhere. Two triggers and no scan: QA converging with only `[user]` questions left,
  and the run that leaves a delivery `stopped` or `held` on them. It passes a delivery's hold
  the way `resolve` does and joins no delivery, so `answeredReview` at its own close hands the
  delivery on. No round cap, nothing re-runs after a failure, and switching it off puts every
  card still carrying questions back to waiting on the user. `akb raw update-decided` writes
  the record; `akb card decide <id>` typed by hand runs whether or not the switch is on.
- The agent picker no longer lists DSH or Grok Build as lacking early-crash resume: both save
  the session as it opens, so a run that dies in its first seconds resumes under the id the
  board already recorded. ZCode still shows the gap — it names a session that early too, but
  keeps it in the running command until the first prompt, so an early crash loses it. The
  support grid is in `web/content/docs/connectors.mdx`.
- A **Build now** run writes its own card before it builds: `akb guide implement`'s "A build
  that writes its own card" is the shape — `raw create` with a generated title and the release
  the prompt names, the typed sentence as a fenced summary, the rest of the scaffold left
  alone, then the ordinary carded build. `adoptDirectCard` gives the run and its card-less
  delivery that id as the create lands, resting the card at `ready` and taking it to
  `implementing`; review and diff approval stay frozen off, because they were settled before
  any card existed. A run that ends before the create still leaves a card-less delivery, which
  is why every "a build with no card" path is still there.
- A **Build now** can be handed a plan instead of a sentence: `akb raw plan ask` now names three
  answers, and `akb guide implement`'s "A build that writes its own card" reads a plan's path as
  the requirement — the plan's own title, the plan's whole text as the fenced summary, and
  `## Source` naming that path as the card's last section. The delivery is titled and bounded by
  the file as the run is written down, so a plan with nothing in it is refused; a resume that
  never reached the card is given that frozen copy in full rather than a quoted sentence.
- The ready gate is an agent now: **Gater** is a role of its own, running `gate` alone, off by
  default, with its own rule file, its own connector and its own switch. It left the planner's
  flow list, so a gate run no longer carries the planner's rule. It and the Decider are the two
  roles that stand in for the user, so each is given the project's goal and every module's
  `decisions.md` and `rejected.md` on top of the card — the Gater also `akb guide writing`, the
  Decider also each question's own options — and neither writes a line of memory back. The
  switch keeps the `readyGate` key it always had, so a board that turned the gate on keeps it.
- `validate-on-reddit` is gone from the flows. No flow routed to it and it wrote outside the
  board, so `akb guide` lists one row fewer. Testing a move by posting is an ordinary card,
  repurposed through `channel`, with voice from `memory/writing/`.

- Pruning the memory is an agent, not a recurring card. `akb prune-memory` is a flow of its own
  — the Memory pruner's, over the project's memory, each module's and the agents' — and it names
  no card, writes no card and leaves no `verify:` line. The board starts one by itself only when
  recurring pruning is switched on with a cadence it can read, and a pass that failed is not
  fired again until the next window. A fresh board no longer seeds a "Prune the memory" card, and
  a board that has one loses it on the next `akb update`, its cadence kept beside the agent and
  switched off.

- A card is not a card to act on until the run that created it has finished. `akb raw create`
  inside a run attaches the new id to it, and until that run ends successfully every card
  action — implement, run, refine, resolve, edit, reject, archive, schedule — refuses with a
  line naming the run. A run that failed, was stopped or was cut off leaves the card
  unfinished until it is picked back up; a create typed by a person is complete at once, and a
  **Build now** card is being built rather than written. The creating run is the one caller
  those refusals let through, so it can still refine the card it just wrote.

- A desktop alert survives a Cloud read that failed. The socket hint carries an event id and the
  contents are read through the Worker; a read that did not get through is tried again a second
  later, then two and four, and a refusal Cloud will keep giving is given up on at once. The
  durable five-minute read now runs under a joined socket too, so a hint lost on the wire costs
  five minutes rather than waiting for a reconnect, and it raises the alert once. Signing out or
  quitting drops whatever was still waiting.
- Triage can sort itself. **Configuration → Agents → Triage** carries a switch, off by default
  and asking once before it goes on: with it on, every batch of new items — a pull, **Add** on
  the page, `akb triage add` — starts one sort, and that sort's close starts the next until
  nothing is waiting. A sort that judged nothing, one that failed, one that was stopped, and the
  switch going off each end the chain; switching it on sweeps nothing already waiting.
  `akb triage run` works either way: `web/content/docs/triage.mdx`.
- `ui-designer` answers with one design instead of A/B/C alternatives. Every page or state the
  card changes that is worth reviewing on its own is its own mockup, named for what it shows —
  one file per screen in a rendered screen, one `###` block per screen in a plain-text drawing —
  and no open question is left asking which layout to take: "Mockups on a card" in
  `kanban-ui/README.md`.
