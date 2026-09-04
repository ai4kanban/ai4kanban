# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The board and the flows

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
  the project and its tracks, the goal, and the agent that works, and leaving every call it
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

- `akb board create --track recurring` writes `Run state` and `Process` into the card;
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
- Every delivery leaves one JSON file under `docs/kanban/deliveries/`, tracked in git and
  kept after the card is archived, including every review verdict and why one stopped:
  `akb guide board`.
- A board can add **one rule of its own to any flow** — plain words in
  `docs/kanban/rules/<command>.md`, appended to the end of that flow's instructions, tracked
  in git. A delivery freezes the rules of its four flows when it starts, so editing one
  changes the next delivery and never one in flight: `akb guide board`.
- A rough card gets `schedule: refine` when it first becomes blocked; `akb board schedule
  <id> --action implement|refine` replaces it and `--clear` cancels it for that episode:
  "Queue a card that is waiting on another" in `web/content/docs/daily-loop.mdx`.
- One writer at a time on a board: a move waits its turn and says which process it is
  waiting on. A lock left by a killed run is taken over the moment that process is gone. No
  published doc covers this yet.
- The board keeps `docs/kanban/record.csv` in git beside `metrics.csv` — one appended line
  per card created, archived or rejected, per question cleared, per call that stood or was
  overruled, and per release closed — written by board commands as they run.
- The board scores its own planning from that record, one set per release: **Details
  settled**, **Decisions that stood**, **Proposals built**, worked out on each read, with
  `not enough yet` instead of a percentage where the evidence is thin, and none of the three
  a target: "Insights" in `kanban-ui/README.md`.

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
- **A board names its runtimes and says what each one runs as** — all of it in
  `ui.config.json`, so every checkout runs the same thing with nothing to set up per machine.
  One home per runtime: the global one is `harness`/`harnessSettings`, every other is an
  entry under `runtimes.agents`. A runtime with no entry runs the board's agent, and its
  settings are that agent's block with its own overrides on top. `akb agent runtimes`,
  `runtime add|remove|global|for|rename` and `bind` are the whole of it: "Which tool each
  flow runs on" in `web/content/docs/runs.mdx`.
- Renaming a runtime carries everything held under the old name, including what it runs as.
  Making another one global swaps the two homes so both go on running what they ran.
  Removing one clears the spec agents that named it as well as the flows.
- A run that stops producing any output ends by itself after the board's silence limit —
  10 minutes unless the board says otherwise, and `0` switches it off — whatever agent it
  runs on. It ends as a failure, so the card keeps its work and Resume picks it up:
  `web/content/docs/connectors.mdx`.

## Spec agents

- A **spec agent** fills one part of a card's spec in a run of its own: `akb spec` lists
  them, `akb spec <name> <id>` puts one on a card. It starts clean, writes one
  ``## By `<name>` agent`` section and nothing else, and rewrites that section when it runs
  again: `web/content/docs/spec-skills.mdx`, `akb guide spec-agent`.
- The board asks for one itself, so most spec runs are ones nobody typed: the flow writing a
  card asks for the part it would otherwise guess at, a refine or revise asks only when that
  part is still open, and propose and plan-release ask for none.
- A spec agent can carry settings of its own — what it produces, not only whether it runs —
  chosen in the board UI and saved with the board, so every card that agent runs on gets the
  same answer: "The spec agents" in `kanban-ui/README.md`.
- `ui-design` answers with the screen drawn, not described: one layout labelled `A` by
  default, alternatives only when explicitly asked, and nothing written under a drawing. Its
  setting picks
  **Rendered screen** (a `.tsx`/`.html` file per option) or **ASCII drawing** (written into
  the card, travelling through git, a much shorter run): "Picking a layout by looking at it"
  in `web/content/docs/spec-skills.mdx`.
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
  `<!-- agent -->` boundary, the `[user]` tag, track and module names and filenames stay
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
- A **spec skill** is an Agent Skill directory, not board code: the board ships `ui-design` and
  `technology-selection`, and a project adds its own under `docs/kanban/skills/<name>/SKILL.md`.
  Its frontmatter carries `name`, `description` and an `akb:` block saying what part of a card's
  spec it owns and which settings it offers; each setting's choice names one file inside the
  skill, and only the chosen one reaches the run. `akb spec` lists them and says why any skill it
  found can't be used: `web/content/docs/spec-skills.mdx`.
