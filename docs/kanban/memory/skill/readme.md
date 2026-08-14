# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The board and the flows

- The flows ship with the `akb` command, not with the project: `akb guide` lists them,
  `akb guide board` is how the board works at all, and a printed flow carries the ones its
  action needs in full. What lands in a project is a short note pointing there
  (`skill/SKILL.md`), so an update upgrades every flow at once.
- `akb help runs` is the manual a coding agent reads: every command it may call — the card
  work, the runs, the agent settings — when to call each, and the one line that fixes an
  ask that can't run.
- The daily loop, as users drive it: `docs/guides/daily-loop.md`.
- Auto-refine — the agent answers a card's safe questions itself and refines not-ready
  cards on its own: `akb guide auto-refine`.
- Every refine follows a run: a command does its job and stops, and the board then refines
  each card that run wrote, changed, or set free — each as a run of its own. A group's main
  card is left alone when a subtask finishes: `docs/guides/daily-loop.md`.
- A question for the user with choices is written as options they tick, not as prose with
  the choices inside the line: `akb guide resolve`.
- Source-to-task extraction treats articles, research, analyses, and user feedback as
  evidence, validates ideas by module, and skips work already supported or planned:
  `akb guide extract-ideas`.
- A finished card is kept, not deleted — archive moves it to `docs/kanban/.archive/`,
  which stays in git: `docs/guides/daily-loop.md`.

## Setup and the goal

- Setup's agent steps follow one guide — config, goal, decisions, modules, first tasks, in
  order. It asks for nothing but the goal, settles the decisions from it before the module
  map, files each settled call under the module it belongs to, and leaves every call it
  can't settle as `[user]` questions on one card that tops the board:
  `akb guide setup`.
- Setup keeps its own steps in `docs/kanban/setup-checklist.md` and ticks each box as it
  goes — while the file is there the skill creates no cards, and the last tick deletes it:
  "Setup" in `skill/SKILL.md`.
- Setup's first three boxes are the user's own — the project and its tracks, the goal, and
  the agent that runs the board — so a board can no longer tick every box without anything
  to run the work with. The board app asks for all three on its first run; a coding agent
  running setup fills them in itself: `akb guide setup`.
- `goal.md` starts empty and carries a `reviewed: strong | good | pending | weak` field —
  the agent judges whether the goal is clear enough to plan from, and `pending` marks a
  goal written but not judged yet, so nothing asks for a goal that is already written:
  `docs/guides/daily-loop.md`.
- What a good goal covers, offered as one line the user can skip:
  `docs/guides/what-makes-a-good-goal.md`.

## Releases

- Say which release a card ships in — `create --release v1`, `update <id> --release v1`,
  `--release ""` to take it back out: "Releases" in `skill/SKILL.md` and
  `akb guide releases`.
- Plan a version — `release new v1`, with `--fill` to put the unplanned high-priority
  cards in on three tests, and `release list` to see every release in ship order with how
  many cards it holds and how many are ready: "Plan a release" in
  `docs/guides/daily-loop.md`.
- Say what a version is for — `release new v1 --goal ".."` when you make it, `release goal
  v1 ".."` to change it, `""` to clear it. It sits on the release's own line, `release
  list` prints it under each version, and it is never required: "Plan a release" in
  `docs/guides/daily-loop.md`.
- Fill a version against its goal — say "plan release v1" and the agent moves in the open
  cards that ship the goal, writes the ones the board is missing, and reports what it
  moved, wrote and left out. It only adds, so it can be run again whenever the goal
  changes; a version with no goal falls back to `--fill`'s rule:
  `akb guide plan-release`.
- Close a shipped version or drop one that won't ship — both clear the release off the
  cards still open and take it off the list for good; close writes its summary, while drop
  writes no summary file or section and leaves an older summary untouched: "Close a
  release" and "Drop a release" in `docs/guides/daily-loop.md`.

## Recurring tasks

- Running a job — `${KB} run <id>` does one pass and stamps `last_run` into the card, so
  the board can say when a job last ran without reading its run files. No published doc
  covers this yet.
- A recurring card carries a `cadence` (`30m`, `6h`, `1d at 09:30`) written by
  `create`/`update --cadence`, which says how often the job repeats and opts it into
  background runs. No published doc covers this yet.
- Every new board starts with one recurring card, "Prune the memory", seeded by the script
  with no cadence — setting its cadence prunes on that schedule, deleting it opts out for
  good, and nothing puts it back. No published doc covers this yet.

## The command

- Every bookkeeping move is a command of `akb` — `akb board create`, `update`,
  `update-questions`, `archive`, `reject`, `release`, `init` — listed by `akb board help`,
  with each move in full when named. They are the agent's to call, not the README's to
  teach.
- A board command works on any board: `--dir <path>` names one, and with none named it
  finds the board from the folder it was run in, so a skill folder no longer has to be
  installed to run the board: `akb board help`.
- A refused move says why and exits 1 instead of ending whoever asked, and `--json` makes
  any move answer as one object a program can read: `akb board help`.
- An installed skill folder holds the skill's words and one file that runs them —
  `kanban.mjs`, built from the CLI's TypeScript. No `lib/`, no `commands/`:
  `akb guide update`.
- Every run the board can start is a command — `akb implement`, `refine`, `resolve`,
  `create`, `propose`, `archive`, `reject`, a recurring card and a release plan — so a card
  can be built from a terminal, over ssh or from a script, with no browser and no chat
  session: `cli/README.md`.
- Every one of those commands also takes `--print`: it starts nothing and prints what to do
  instead, filled in for the board it was asked about — the card's own path, the steps it
  has left, the memory file its modules point at, the command that closes the job. It is how
  an agent already in a session does the job there instead of starting a second agent. An
  agent inside a run the board started always gets the printed flow, so a run can't spawn a
  copy of itself. When to use which: `docs/guides/daily-loop.md`, and `akb help runs`.
- A run outlives the command that started it: it keeps working after the terminal closes,
  and `akb runs`, `akb log --follow`, `akb stop` and `akb resume` reach any run from
  anywhere, whoever started it: `cli/README.md`.
- A run goes through the settings the board saved, never what your shell exported, and the
  same command changes them — which agent, its model, how hard it thinks, who pays, and
  the key — and says which agents it can run and what each one takes: `cli/README.md`.
- One writer at a time on a board: a move waits its turn behind whatever else is writing,
  and says which process it is waiting on when it gives up. A lock left behind by a killed
  run is taken over the moment that process is gone, so nothing waits on a writer that no
  longer exists and there is never a folder to delete by hand. No published doc covers this
  yet.

## Installing and updating

- `akb` is a command you install — `npm install -g ai4kanban`, and
  `npm install -g ai4kanban@latest` for a newer one; `npx --yes ai4kanban@latest <command>`
  runs it without installing anything: `README.md`, "Quick start".
- `akb install` scaffolds the board and writes nothing outside `docs/kanban/`. Letting a
  coding agent drive that board is a separate, optional step — `akb skill` says where it
  stands, `akb skill install` adds it or brings an older copy up to date, and `akb update`
  refreshes one that is already there without ever adding one: `cli/README.md`, "Install
  into a project" and "Drive the board from your coding agent".
- Updating is two lines and no third: a newer command, then `akb update` to repair the
  board. `akb update` can't replace the running command, so it checks npm and names the
  line when it is behind: `akb guide update`.
- The script runs from the skill's own installed folder, whether the agent loaded it from
  `.claude/`, `.agents/`, or a plugin: `skill/SKILL.md`.
- Every board action a button offers can be asked for in plain words from a coding agent —
  starting and stopping a build, reading a run's log, continuing a failed one, picking the
  agent and its model, testing the setup. An API key is the one thing handed back instead:
  the agent gives the user the line to type: `docs/guides/daily-loop.md`.
- `kanban init` keeps `docs/kanban/.env` out of git on new boards and repairs the ignore
  rule on older ones, so hand-written API keys stay local: `kanban-ui/README.md`.
- `akb board schedule <id> --action implement|refine` queues an action on a card that is
  waiting on another card, so the board runs it by itself once that card is gone;
  `--clear` takes it off: `docs/guides/daily-loop.md`, "Queue a card that is waiting on
  another".
- Adding the skill to a project writes one file, `SKILL.md`. The command it names stays
  where npm put it, so nothing generated lands in the user's git history, and an update
  clears the 350 kB copy older versions wrote beside the note: `cli/README.md`, "The
  coding agent skill".
- `akb setup` finishes setting a board up as one run — every step still unticked on the
  checklist, starting at the first one, so it can be run again after a failure without
  redoing what finished. `--print` says what to do instead, like every other run. It is the
  run the board app's **Finish setup** button starts, and it leans on no installed skill:
  a machine with no `akb` on its PATH is told to call the board's own copy of the command
  by path, which also answers `guide` and `board` for exactly this reason: `akb help runs`.
