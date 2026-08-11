---
title: Put every board command in one CLI
track: skill
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: []
related: []
modules: [skill, local-ui]
questions: []
---

The rules for a card live in two places — the script in the skill folder and a copy inside the UI — so the two can drift apart, and the UI silently does nothing when no skill folder is installed. Make one command own every board action, and let everything else ask it.

## Scope
- One command, `akb`, does every board action: read a card and write one, create, change a
  card's fields, answer questions, list and search, archive, reject, releases, the goal,
  the module map, memory, setup, metrics. Today that command only installs and updates,
  and it is spelled `ai4kanban`.
- The published package keeps its name, `ai4kanban`. Installing it puts `akb` on the
  user's path. The old spelling `ai4kanban` keeps working as a second name for the same
  command, so no one's install breaks.
- `install`, `update`, `version` and `help` keep meaning exactly what they mean today.
  Every board action sits under the thing it acts on, for example `akb card update 12
  --priority high`.
- It works on any repo. It never needs a skill folder under `.claude/` or `.agents/` to be
  there first, and `--dir` points it at a board outside the current folder.
- `npx ai4kanban <command>` stays the way a person runs one command with nothing
  installed. A program that asks the board over and over can carry its own copy instead,
  so an action costs no download and works with no network.
- Each command can answer in plain words for a person and, with `--json`, in a form
  another program can read.
- The board script that ships inside the skill keeps working exactly as it does now — same
  commands, same output — so an installed board does not break.
- One copy of the rules sits behind both, so the same board never gives two different
  answers to the same action.

## Commands

Every command takes `--json` for a machine-readable answer and `--dir <path>` to work on a
board somewhere else. Commands marked **new** don't exist anywhere today.

**Setup and the tool itself** — unchanged from today
- `akb install [--tracks a,b]` — put the skill in this repo and scaffold the board
- `akb update` — pull a newer skill into a repo that already has one
- `akb version` — the installed version
- `akb help` — this list

**The board**
- `akb board init [track...]` — scaffold `docs/kanban/`; re-run to repair an older board
- `akb board status` — how far setup got and which step comes next
- `akb board setup-done <step>` — tick one setup step: install, config, goal, decisions, modules, tasks
- `akb board migrate [--dry-run]` — convert old bold-header cards to frontmatter
- `akb board metrics` — the daily counts of completed, created, rejected
- `akb board next-id` — the next free id, without taking it

**Cards**
- `akb card new --title ".." --track <track> [--priority --roi --release --blocked-by --related --modules --slug --cadence --question --option --recommended-option --mode --no-body]` — write one card
- `akb card ids [--count N]` — take N ids without writing cards, for a group task
- `akb card show <id>` — print one card, fields and body — **new**
- `akb card write <id> --body-file <file>` (or `--body -` to read stdin) — replace a card's body — **new**
- `akb card update <id> [--title --priority --roi --status --release --track --slug --blocked-by --related --modules --cadence]` — change a card's fields
- `akb card list [--module m] [--track t] [--status s]` — the open cards at a glance
- `akb card find "<text>"` — search card titles and text — **new**
- `akb card archive <id>` — finish a card
- `akb card reject <id>` — drop an idea; the receipt prints the card first
- `akb card run <id>` — record one run of a recurring card

**Open questions on a card**
- `akb question add <id> ".." [--option ".." --recommended-option ".." --mode single|multi]`
- `akb question set <id> <n> ".."` — rewrite question n whole
- `akb question drop <id> <n[,n...]>` — remove answered ones
- `akb question clear <id>` — remove them all
- `akb question tag <id> <n[,n...]> user|none` — mark a question as the human's call

**Releases**
- `akb release new <id> [--goal ".."] [--fill]`
- `akb release goal <id> ".."` — change what a version is for
- `akb release list` — the versions in ship order, with what each holds
- `akb release close <id>` — the version shipped; write its summary and clear it off open cards
- `akb release drop <id>` — the version will not ship

**Memory, goal, modules**
- `akb memory init <module>` — scaffold a module's four memory files
- `akb memory show [<module>]` — print one memory set, or the project-wide one — **new**
- `akb goal show` — print the long-term goal — **new**
- `akb goal reviewed <strong|good|pending|weak>` — record how clear the goal is to plan from — **new**
- `akb module list` — the module map — **new**

## Decided by the agent
- **What shape does the merged command take?**: `install`, `update`, `version` and `help`
  keep today's meaning — repointing a published word breaks the people already using it.
  Board actions go under the thing they act on, the way `release new` already reads:
  `akb card update 12`.
- **Does the name change break `npx`?**: `akb` is already taken on npm by an unrelated
  package, so `npx akb` would run a stranger's code. The package we publish keeps the name
  `ai4kanban`; `npx ai4kanban <command>` stays the one-off path we teach, and `akb` is the
  short name you get once the package is installed. Never teach `npx akb` anywhere.
- **How does someone get `akb` on their path?**: `npm i -g ai4kanban`. `npx ai4kanban
  <command>` covers anyone who does not want to install.
- **What happens to the old spelling?**: `ai4kanban` stays a second name for the same
  command, with the same commands under it. Nothing that works today stops working.
- **How does someone get the board commands?**: both ways. `npx ai4kanban <command>` for a
  one-off by hand, and a copy inside the UI and the desktop app, because the UI asks the
  board on every click and the app has to work with no terminal and no network.
- **Does the CLI have to make the flows stop reading files?**: no. It adds the commands —
  reading a card, searching card text, writing a card body — so anything that wants them
  has them. Making every flow go through them was turned down: it changes nothing a user
  sees on a file board.

## Todo
- [ ] Name the command `akb`, and keep `ai4kanban` working as a second name for the same
      thing.
- [ ] Add the board actions the command does not have yet, so it covers everything the UI
      and the skill can do to a board today — the ones marked **new** above.
- [ ] Group the board actions under the thing they act on, exactly as the command list
      above reads, and leave `install`, `update`, `version` and `help` as they are.
- [ ] Give every command a `--json` answer another program can read, and a `--dir` that
      points it at a board outside the current folder.
- [ ] Make the skill's board script and the CLI run the same code, so there is one copy of
      the rules.
- [ ] Make the command usable as a copy a program ships with it, so something calling the
      board on every click never downloads anything and works with no network.
- [ ] Check every command on a repo that has a board but no skill folder installed.
- [ ] Run the skill's board script through its commands and check it answers exactly as it
      does today, so an installed board is untouched.
- [ ] Teach `akb` and the new commands in `README.md`, `README-zh.md` and `cli/README.md`,
      and say there that `npx ai4kanban` still works.
