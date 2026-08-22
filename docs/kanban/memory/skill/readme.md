# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The board and the flows

- The flows ship with the `akb` command, not with the project: `akb guide` lists them,
  `akb guide board` is how the board works at all, and a printed flow carries the ones its
  action needs in full. A project holds only a short note pointing there, so an update
  upgrades every flow at once: `skill/SKILL.md`.
- The manual a coding agent reads — every command it may call, when to call each, and the
  one line that fixes an ask that can't run: `akb help runs`.
- The daily loop as users drive it, including archiving a finished card into
  `docs/kanban/.archive/` where it stays in git, and the refine that follows every run —
  each as its own run, with a group's main card left alone when a subtask finishes:
  `docs/guides/daily-loop.md`.
- Refine is a loop, never one pass — the agent checks and rewrites the card, answers the
  safe questions it raised itself, and goes round again: `akb guide refine`.
- A question for the user with choices is written as options they tick, not as prose with
  the choices inside the line: `akb guide resolve`.
- A card reads in two halves: what a reviewer must read on top — the opening paragraph and
  `## Worth noting`, the calls a human could have made the other way — and everything a
  builder needs below a `<!-- agent -->` marker that never shows when the card is rendered.
  Refine repairs an older card into that shape without rewording it: `akb guide board` and
  `akb guide refine`.
- A card that changes a screen points at its mockups with one tag on a line of its own —
  `<Mockup src=".mockups/239/a.tsx" label="A" />` — and they live in
  `docs/kanban/.mockups/<card id>/`, one file each: a `.tsx` component styled with Tailwind, or
  a plain `.html` page. The folder is gitignored, so a drawing never travels with the card and
  what it settled has to be in the card's words. It is the only tag a card body may carry:
  `akb guide board`.
- A card that changes something users see and click is planned against the board's UI design
  reference, `akb guide ui-design`: the screen is matched to the ones the project already
  has, its colours and spacing come from the project, it says what it shows with nothing to
  show and when it fails, and a layout choice is put to the user as drawn options labelled
  `A`, `B`, `C` rather than in prose — so the question is one short line and the options are
  the labels. add-task, refine and revise each read it when the card has a screen in it, and
  no run pays for it otherwise.
- Source-to-task extraction treats articles, research, analyses, and user feedback as
  evidence, validates ideas by module, and skips work already supported or planned:
  `akb guide extract-ideas`.

- A finished build leaves what only the user can confirm on the card's own `verify:` field
  instead of as a fake open question — one short line each, written with
  `akb board update-verify <id> --append ".."` and taken off with `--drop`/`--clear`. A
  verify line is a note to read: nothing waits on it, and the card still reaches `ready`,
  still resolves, and still archives with the lines travelling into the archive. A decision
  only the user can make is still a `[user]` question, resolve moves a hand-check misfiled
  as one across, and `akb board list` counts them beside the open questions: "What the build
  leaves you to check" in `docs/guides/daily-loop.md`.

## Setup and the goal

- Setup follows one guide — config, goal, decisions, modules, first tasks, in order. Its
  first three boxes are the user's own (the project and its tracks, the goal, and the agent
  that does the work), it asks for nothing else, and it leaves every call it can't settle
  as `[user]` questions on one card that tops the board: `akb guide setup`.
- Setup keeps its steps in `docs/kanban/setup-checklist.md` and ticks each box as it goes —
  while the file is there the skill creates no cards, and the last tick deletes it:
  "Setup" in `skill/SKILL.md`.
- `akb setup` finishes a board in one run, starting at the first unticked box, so it can be
  run again after a failure; `--print` says what to do instead. It needs no installed skill
  and no `akb` on the PATH — the board's own copy of the command answers `guide` and
  `board` for exactly this reason: `akb help runs`.
- `goal.md` starts empty and carries a `reviewed: strong | good | pending | weak` field —
  the agent judges whether the goal is clear enough to plan from, and `pending` marks a
  goal written but not judged yet: `docs/guides/daily-loop.md`.
- What a good goal covers, offered as one line the user can skip:
  `docs/guides/what-makes-a-good-goal.md`.

## Releases

- Say which release a card ships in — `create --release v1`, `update <id> --release v1`,
  `--release ""` to take it back out: "Releases" in `skill/SKILL.md` and `akb guide releases`.
- Plan a version, say what it is for, and see every version in ship order with its card
  counts — `release new v1 --goal ".."`, `release goal v1`, `release list`, and `--fill`
  for the plain high-priority rule: "Plan a release" in `docs/guides/daily-loop.md`.
- Fill a version against its goal — say "plan release v1" and the agent moves in the open
  cards that ship the goal, writes the ones the board is missing, and reports what it
  moved, wrote and left out. It only adds, so it can be run again whenever the goal
  changes: `akb guide plan-release`.
- Close a shipped version or drop one that won't ship — both clear the release off the
  cards still open and take it off the list for good; close writes a summary, drop writes
  none and leaves an older one untouched: "Close a release" and "Drop a release" in
  `docs/guides/daily-loop.md`.

## Recurring tasks

- Run a job, give it a cadence (`30m`, `6h`, `1d at 09:30`) so the board runs it itself,
  and read when it last ran and when it comes round again: "Recurring tasks" in
  `kanban-ui/README.md`. From a terminal it is `akb run <id>`, which does one pass and
  stamps `last_run` into the card.
- Every new board starts with one recurring card, "Prune the memory", seeded with no
  cadence — setting a cadence prunes on that schedule, deleting the card opts out for good,
  and nothing puts it back. No published doc covers this yet.

## The command

- Every bookkeeping move is a command of `akb` — `create`, `update`, `update-questions`,
  `archive`, `reject`, `release`, `init` — listed by `akb board help`, with each move in
  full when named. They are the agent's to call, not the README's to teach.
- A board command works on any board: `--dir <path>` names one, and with none named it
  finds the board from the folder it was run in: `akb board help`.
- A refused move says why and exits 1 instead of ending whoever asked, and `--json` makes
  any move answer as one object a program can read: `akb board help`.
- Every run the board can start is a command — `akb implement`, `refine`, `resolve`,
  `create`, `propose`, `archive`, `reject`, `run`, `plan-release` — so a card can be built
  from a terminal, over ssh or from a script, with no browser and no chat session:
  `cli/README.md`.
- Every one of those takes `--print`: it starts nothing and prints the job filled in for
  this board instead, so an agent already in a session does the work there rather than
  starting a second agent. An agent inside a run always gets the printed flow, so a run
  can't spawn a copy of itself: `docs/guides/daily-loop.md` and `akb help runs`.
- A run outlives the command that started it: it keeps working after the terminal closes,
  and `akb runs`, `akb log --follow`, `akb stop` and `akb resume` reach any run from
  anywhere, whoever started it: `cli/README.md`.
- A run goes through the settings the board saved, never what your shell exported, and the
  same command changes them — which agent, its model, how hard it thinks, who pays, and the
  key — and says which agents it can run and what each takes: `cli/README.md`.
- A fifth agent runs the board: **DeepSeek Harness**, with `akb agent use dsh`. It needs
  `npm install -g @deepseek-ai/dsh` and then `npm install -g @openma/deepseek-harness-acp`
  — two commands, never one, since npm gives everything named together its own folder and
  the bridge would come out with no dsh under it. It then takes a model and a DeepSeek key,
  both optional, since an empty key uses the one dsh already saved: `cli/README.md` and
  "Running on DeepSeek Harness" in `kanban-ui/README.md`.
- A sixth agent runs the board: **ZCode**, with `akb agent use zcode`. Z.ai ships no
  terminal command, so it needs `npm install -g zcode-app-cli` — a community package, not
  Z.ai's — or ZCode Desktop with this agent's `command` pointed at the `zcode` inside it.
  Sign in with `zcode login`, or paste a Z.AI or BigModel Coding Plan key. A ZCode run is
  not fenced to the project: ZCode ships no sandbox: `docs/guides/connectors.md`.
- A dsh run is pinned to the dsh sitting beside the bridge, with `--dsh-path`. `dsh-acp`
  otherwise takes the first `dsh` on the PATH, and on a machine that has one that is a
  second copy of the same plugin system — every run then dies as it opens, on
  `agent-presets: refusing to compose an unscoped context`. No published doc covers this
  yet.
- One writer at a time on a board: a move waits its turn and says which process it is
  waiting on when it gives up. A lock left by a killed run is taken over the moment that
  process is gone, so there is never a folder to delete by hand. No published doc covers
  this yet.
- `akb board schedule <id> --action implement|refine` queues an action on a card that is
  waiting on another card, so the board runs it once that card is gone; `--clear` takes it
  off: "Queue a card that is waiting on another" in `docs/guides/daily-loop.md`.

## Installing and updating

- `akb` is a command you install — `npm install -g ai4kanban`, and
  `npm install -g ai4kanban@latest` for a newer one; `npx --yes ai4kanban@latest <command>`
  runs it without installing anything: "Quick start" in `README.md`.
- `akb install` scaffolds the board and writes nothing outside `docs/kanban/`. Letting a
  coding agent drive that board is a separate, optional step — `akb skill` says where it
  stands, `akb skill install` adds it or brings an older copy up to date, and `akb update`
  refreshes one that is already there without ever adding one: "Install into a project" and
  "Drive the board from your coding agent" in `cli/README.md`.
- Adding the skill writes one file, `SKILL.md`; the command it names stays where npm put
  it, so nothing generated lands in the user's git history: "The coding agent skill" in
  `cli/README.md`.
- A desktop user needs no npm: the app carries `akb` and installs it as one symlink, so
  updating the app updates the command, and after an install that answers it rewrites the
  open project's skill note to say `akb`: `desktop/README.md`.
- Updating is two lines and no third: a newer command, then `akb update` to repair the
  board. `akb update` can't replace the running command, so it checks npm and names the
  line when it is behind: `akb guide update`.
- `akb board init` keeps `docs/kanban/.env` out of git on new boards and repairs the ignore
  rule on older ones, so hand-written API keys stay local: `kanban-ui/README.md`.
- Every board action a button offers can be asked for in plain words from a coding agent —
  starting and stopping a build, reading a run's log, continuing a failed one, picking the
  agent and its model, testing the setup. An API key is the one thing handed back instead:
  the agent gives the user the line to type: `docs/guides/daily-loop.md`.
- A **spec agent** fills one part of a card's spec in a run of its own: `akb spec` lists
  them, `akb spec <name> <id>` puts one on a card. It starts clean — the card and a note,
  never the conversation that asked — writes one ``## By `<name>` agent`` section and
  nothing else, and rewrites that same section when it runs again. Asked for from inside a
  run, the board starts it once that run ends, so nothing waits for it: "Let a specialist
  fill part of the spec" in `docs/guides/daily-loop.md`, and `akb guide spec-agent` for the
  flow one follows.
- The `ui-design` spec agent answers with the screen drawn, not described: on a card that
  changes or adds a screen, it writes two or three mockup files under
  `docs/kanban/.mockups/<card id>/`, points at each from its own section with a `<Mockup>` tag
  and a line saying what that layout is good for and what it costs, and recommends one. The
  card page draws them, so the user picks a layout by looking. Run again on the same card it
  writes over its old mockups and deletes the ones its new answer dropped: "Let a specialist
  fill part of the spec" in `docs/guides/daily-loop.md`.
- The second spec agent is `technology-selection`: on a card that leans on an outside
  library, tool, or service, it comes back with two or three candidates, what each gives
  you and what it costs, and one recommended. Keeping what the project already uses and
  writing it yourself are candidates on the same terms, so a card doesn't come back with
  something new to install by default, and every name is looked up before it is written
  down — a renamed or abandoned package never reaches the card: "Let a specialist fill part
  of the spec" in `docs/guides/daily-loop.md`.
- The board asks for a spec agent by itself, so most spec runs are ones nobody typed: the
  flow that writes a card asks for the part it would otherwise guess at, a refine or a
  revise asks only when that part of the spec is still open, and propose and plan-release
  ask for none — each card's own refine does. A card that needs neither a screen nor a
  library goes through all of them without a spec run, and a second ask is turned down
  while that agent is still working the card: "When one shows up on its own" in
  `docs/guides/daily-loop.md`.
- `akb chat "…"` holds a conversation with the agent about the board, and `akb chat <id> "…"`
  about one card. The reply arrives as it is written, the next message lands in the same
  session so the agent still has everything said before, and `akb chat [<id>] --clear` starts
  fresh. Each conversation is picked up from any terminal and survives closing one; the
  board's and each card's are separate, kept under `docs/kanban/.chats/` and out of git. A
  chat is not a run — it never shows in `akb runs` and never holds a card — and it is offered
  only on an agent whose command takes a second message into its own session, which today is
  every agent the board ships: `cli/README.md`, "Talk to it about the board".
- A fresh conversation is only the configured harness's kanban-skill invocation plus the
  user's message: `/kanban` on Claude Code, `$kanban` on Codex, and a plain request on agents
  without direct syntax. Chat installs the one shared skill first and sends no copied board
  snapshot, command manual, environment rules, or separate chat flow:
  `cli/README.md`, "Talk to it about the board".
- Chat now behaves exactly like the kanban skill in a coding-agent conversation: `--print`
  does the flow here, omitting it starts a background run, and the user's explicit choice
  wins. The skill is the only maintained behavior source; there is no `akb guide chat`:
  `docs/guides/daily-loop.md`, "Talk it over, and let it do it".
- The board keeps `docs/kanban/record.csv` in git beside `metrics.csv`: one appended line per
  card created, archived or rejected, per question cleared, per set of the board's own calls
  that stood or was overruled, and per release closed. Board commands write it as they run —
  nothing new to type and nothing to edit by hand — and the setup questions card and the
  recurring cards are left out of it. Moving a question that turned out to be a hand-check
  into a card's `verify:` list is now one call, `akb board update-questions <id> --to-verify
  <n>`, and `akb board create --proposed` marks a card the board found rather than one a
  person asked for.

- `readScoreView` turns `docs/kanban/record.csv` into ready-to-draw release windows — every
  closed release in close order, then the window still open, each with the three planning
  scores, their counts, their evidence state and their contributing card ids. A window is the
  lines between one `release-closed` line and the one before it, in file order and never by
  date. Nothing saves a percentage: the figures are worked out from the evidence on each read.

- The board now scores its own planning, one set of numbers per release, and every board
  keeps its own. **Details settled** is the share of a card's questions the board answered
  itself instead of asking the user; **Decisions that stood** is the share of the calls it
  made on its own that the user did not overrule; **Proposals built** is the share of the
  cards it proposed, and that have since been decided, that shipped rather than being
  dropped. Nothing extra is typed or answered to collect them — creating a card, clearing
  its questions, archiving it, rejecting it and closing a release each leave the evidence
  behind. A release with too little evidence for a number shows its two counts and `not
  enough yet` rather than a percentage, and none of the three is a target:
  `kanban-ui/README.md`, "Insights".
