---
title: Add the coding agent skill later, from a button in the UI
track: features
priority: med
roi: med
status: todo
release: 0.6.0
blocked_by: []
related: [167]
modules: [local-ui, skill]
questions: []
---

The skill stops being the first step and becomes an extra: drive the same board from your coding agent, if you want to. Offer it where the user already is, instead of sending them back to a terminal.

## Scope
- Installing scaffolds the board and nothing else. The folders a coding agent reads are
  left alone, so a board made in the app — or from a terminal — starts without the skill.
  This button is the only thing that adds it.
- A project that already has the skill keeps it. Updating still refreshes a folder that is
  there, so nothing anyone installed before disappears under them.
- One place in the UI says what the skill adds — driving this board from your coding agent —
  and a button there installs it.
- The button runs the board's own install and reports what it wrote, folder by folder. It
  holds no idea of its own about what a skill folder contains, so changing that never
  touches this screen.
- The same move is one command in a terminal, so a person who never opens the UI can still
  add the skill.
- It shows which state the project is in — nothing installed, installed, or older than what
  the app carries — and the same button brings an older project up to date.
- The button writes files in the project and nothing else. When the `akb` on the user's
  PATH is older than the copy the app carries, or missing, it also shows the one line that
  gets a newer one, ready to copy — it never runs it. The flows the coding agent works by
  come from that command, so an old command means old flows.
- Where the board already hands over a line to paste into a coding agent — the setup run and
  the strip it leaves behind — that line only fires with the skill installed. Those places
  say so and reach this button when nothing is there.
- It is plainly optional. Nothing about the board stops working without it.

## Todo
- [ ] Stop writing the skill when a board is installed — scaffold the board, leave the
      agent folders alone, and say so where install reports what it did.
- [ ] Add the skill from one terminal command too, and keep updating an installed one
      working as it does today.
- [ ] Put the panel and its button in the configuration dialog, as a section of its own.
- [ ] Install from the button, and report the folders it wrote.
- [ ] Show the state a user is in — not installed, installed, or out of date.
- [ ] Bring an out-of-date project up to date from the same place.
- [ ] Show the copyable line for a newer `akb` when the one on the user's PATH is behind
      the app's copy, or missing.
- [ ] Point the setup handover at this button when the skill isn't installed there, and fix
      the line the "this board can't be read" screen hands over.
- [ ] Try it on a repo with nothing installed, one with an older skill folder, and one
      already up to date.
- [ ] Update the UI's README and the pages that teach installing.

## Decided by the agent
- **What install stops writing, exactly**: the two files that make up a skill folder — the
  note and the command beside it. Install leaves both agent folders untouched; the board
  itself carries everything a run needs. The button writes them.
- **Why update still refreshes an installed skill**: a user who has the skill asked for it,
  and an update that silently took it away is the opposite of this card. Install is what
  stops adding it; update keeps what is already there current.
- **A board opened outside the app with no skill**: the screen that says the board can't be
  read hands over a command today. That command has to become the one that adds the skill,
  since install no longer does — otherwise the only way out of that screen is a folder the
  user writes by hand.
- **Where it sits**: the configuration dialog behind the header's gear, as its own section
  beside Agent. That dialog is the board's one settings home and grows by gaining a section,
  and setup's agent step already tells the user to come back to the gear later.
- **What "installed" and "out of date" mean**: whatever the board's own install and update
  report. The UI asks the command and shows the answer rather than reading a skill folder
  itself, so where those files live can move (#213 moves them) without this screen knowing.
- **Does the button also put a newer `akb` on the PATH?** No — it refreshes the project's
  files and hands over the line to copy (`npm install -g ai4kanban@latest`) when the app
  carries a newer command than the PATH does. A global install is the user's line to type,
  the same way `akb update` names it instead of replacing itself. Saying nothing would be
  worse: the note points the agent at `akb`, so an old command would quietly serve old
  flows in a project the button just refreshed.
