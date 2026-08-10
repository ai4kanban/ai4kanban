---
title: Put every board command in one CLI
track: skill
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: []
related: [61]
modules: [skill, local-ui]
questions: []
---

The rules for a card live in two places — the script in the skill folder and a copy inside the UI — so the two can drift apart, and the UI silently does nothing when no skill folder is installed. Make one command own every board action, and let everything else ask it.

## Scope
- One published command, `ai4kanban`, does every board action: read a card and write one,
  create, change a card's fields, answer questions, list and search, archive, reject,
  releases, the goal, the module map, memory, setup, metrics. Today that command only
  installs and updates.
- `install`, `update`, `version` and `help` keep meaning exactly what they mean today, so
  no one's install breaks. Every board action sits under the thing it acts on, for example
  `ai4kanban card update 12 --priority high`.
- It works on any repo. It never needs a skill folder under `.claude/` or `.agents/` to be
  there first.
- `npx ai4kanban <command>` stays the way a person runs one command by hand. A program that
  asks the board over and over can carry its own copy instead, so an action costs no
  download and works with no network.
- Each command can answer in plain words for a person and in a form another program can
  read.
- The board script that ships inside the skill keeps working exactly as it does now — same
  commands, same output — so an installed board does not break.
- One copy of the rules sits behind both, so the same board never gives two different
  answers to the same action.

## Decided by the agent
- **What shape does the merged command take?**: `install`, `update`, `version` and `help`
  keep today's meaning — repointing a published word breaks the people already using it.
  Board actions go under the thing they act on, the way `release new` already reads:
  `ai4kanban card update 12`.
- **How does someone get the board commands?**: both ways. `npx ai4kanban <command>` for a
  one-off by hand, and a copy inside the UI and the desktop app, because the UI asks the
  board on every click and the app has to work with no terminal and no network.
- **Does this card take over #61?**: it takes the commands — reading a card, searching card
  text, writing a card body. #61 keeps the rest, moving the skill's own flows off reading
  files directly, which waits on the parked storage work.

## Todo
- [ ] Add the board actions the command does not have yet, so it covers everything the UI
      and the skill can do to a board today — reading a card, searching card text and
      writing a card body included.
- [ ] Group the board actions under the thing they act on, and leave `install`, `update`,
      `version` and `help` exactly as they are.
- [ ] Give every command an output another program can read.
- [ ] Make the skill's board script and the CLI run the same code, so there is one copy of
      the rules.
- [ ] Make the command usable as a copy a program ships with it, so something calling the
      board on every click never downloads anything and works with no network.
- [ ] Check every command on a repo that has a board but no skill folder installed.
- [ ] Run the skill's board script through its commands and check it answers exactly as it
      does today, so an installed board is untouched.
- [ ] Teach the new commands in `README.md`, `README-zh.md` and `cli/README.md`.
