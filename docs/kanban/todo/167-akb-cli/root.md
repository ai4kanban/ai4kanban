---
title: Make akb the one way to run the board
track: skill
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: []
related: [168, 169, 170, 192, 194, 195, 196]
modules: [skill, local-ui]
questions: []
---

The board is driven three ways today, and each way carries its own copy of the rules. Make
one command, `akb`, do every board action — the agent run and the bookkeeping either side
of it — and let the UI and the skill both go through it. This is a group task; each piece
is its own subtask in this folder.

## Today
- The skill folder holds the rules for a card and the UI holds a second copy. They drift,
  and the UI quietly does nothing when no skill folder is installed.
- The only way to press Implement is to open a browser. Nothing runs the board from a
  terminal, over ssh, or on another machine.
- Each flow is a page of prose telling the agent which command to run at which step. Skip
  one and the board is left wrong — an id taken but no card written, a finished task never
  archived.
- A fixed flow only reaches a project when someone re-installs the skill there.

## Scope
- `akb` runs the board actions a person actually means: implement a card, run a recurring
  one, refine, resolve, create, propose, archive, reject, plan a release — plus seeing what
  is running, reading a run's log, and stopping one.
- An action does the whole job. The bookkeeping before and after the agent run belongs to
  the command, not to something the agent has to remember at the end.
- Every action also has a second mode that prints the flow instead of starting an agent —
  for an agent already working, with this board's own tracks, paths and memory files filled
  in. A generic reference page can't do that.
- The board UI stops keeping its own copy of the rules and drives its runs through the same
  command.
- The skill shrinks to a short note: the board lives here, `akb` owns it, ask it what to do.
  The flows ship with the command, so a fix lands in every project on upgrade.
- The board's own bookkeeping stays available as commands — the printed flow ends by naming
  the one to run. They are for the agent to call, not something we teach a person to type.
- Out of this group: the board files are untouched. Same cards, same folders, same markdown.

## Todo
- [ ] Move the board script inside the CLI #192
- [ ] Start, watch, stop and resume an agent run from the CLI #168
- [ ] Let the board UI do its work through the CLI #169
- [ ] Let the CLI print a board flow instead of running it #194
- [ ] Shrink the skill to a pointer at the CLI #195
- [ ] Let the skill do everything the UI can #170
- [ ] Simplify install and update, and teach akb in the docs #196

## Decided by the agent
- **Which commands a person is taught** — the ones the UI's buttons already stand for.
  Nobody wants to type "set card 12's priority to high"; that is the agent's move, mid-flow,
  and it stays out of the README.
- **Why the same word can't mean both things** — archive, create and reject each name a
  bookkeeping move *and* an agent run that ends in one. Teaching only the run keeps `akb
  archive 12` unambiguous.
- **What we publish it as** — the package keeps the name `ai4kanban` and puts `akb` on the
  path; `npx ai4kanban <command>` stays the one-off way. `akb` on npm belongs to a stranger,
  so `npx akb` is never taught anywhere.
- **What happens to the old spelling** — `ai4kanban` keeps working as a second name for the
  same command, so nothing installed today breaks.
