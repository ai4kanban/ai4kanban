# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The board and the flows

- The board format, script commands, and every flow: `skill/SKILL.md` (per-flow guides in
  `skill/references/`).
- The daily loop, as users drive it: `docs/guides/daily-loop.md`.
- Auto-refine — the agent answers a card's safe questions itself and refines not-ready
  cards on its own: `skill/references/auto-refine.md`.
- A question for the user with choices is written as options they tick, not as prose with
  the choices inside the line: `skill/references/resolve.md`.
- Source-to-task extraction treats articles, research, analyses, and user feedback as
  evidence, validates ideas by module, and skips work already supported or planned:
  `skill/references/extract-ideas.md`.
- A finished card is kept, not deleted — archive moves it to `docs/kanban/.archive/`,
  which stays in git: `docs/guides/daily-loop.md`.

## Setup and the goal

- Setup's agent steps follow one guide — config, goal, decisions, modules, first tasks, in
  order. It asks for nothing but the goal, settles the decisions from it before the module
  map, files each settled call under the module it belongs to, and leaves every call it
  can't settle as `[user]` questions on one card that tops the board:
  `skill/references/setup.md`.
- Setup keeps its own steps in `docs/kanban/setup-checklist.md` and ticks each box as it
  goes — while the file is there the skill creates no cards, and the last tick deletes it:
  "Setup" in `skill/SKILL.md`.
- Setup's first three boxes are the user's own — the project and its tracks, the goal, and
  the agent that runs the board — so a board can no longer tick every box without anything
  to run the work with. The board app asks for all three on its first run; a coding agent
  running setup fills them in itself: `skill/references/setup.md`.
- `goal.md` starts empty and carries a `reviewed: strong | good | pending | weak` field —
  the agent judges whether the goal is clear enough to plan from, and `pending` marks a
  goal written but not judged yet, so nothing asks for a goal that is already written:
  `docs/guides/daily-loop.md`.
- What a good goal covers, offered as one line the user can skip:
  `docs/guides/what-makes-a-good-goal.md`.

## Releases

- Say which release a card ships in — `create --release v1`, `update <id> --release v1`,
  `--release ""` to take it back out: "Releases" in `skill/SKILL.md` and
  `skill/references/releases.md`.
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
  `skill/references/plan-release.md`.
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
  `skill/references/update.md`.
- Every run the board can start is a command — `akb implement`, `refine`, `resolve`,
  `create`, `propose`, `archive`, `reject`, a recurring card and a release plan — so a card
  can be built from a terminal, over ssh or from a script, with no browser and no chat
  session: `cli/README.md`.
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

- Setup and updates are one command each — `npx ai4kanban install` copies the skill into
  the Claude Code and Codex folders and scaffolds the board; `npx ai4kanban update`
  refreshes the skill folders it finds and leaves the board alone:
  `skill/references/update.md`.
- The script runs from the skill's own installed folder, whether the agent loaded it from
  `.claude/`, `.agents/`, or a plugin: `skill/SKILL.md`.
- `kanban init` keeps `docs/kanban/.env` out of git on new boards and repairs the ignore
  rule on older ones, so hand-written API keys stay local: `kanban-ui/README.md`.
