---
title: "Onboarding: from install to a board ready to plan"
track: skill
priority: high
roi: high
status: ready
release: next
blocked_by: []
related: [86, 108]
modules: [skill, local-ui, site, docs]
questions: []
---

Track everything between "I installed this" and "I have a board I can plan on". This is a
group task; each piece is its own subtask in this folder.

## Scope
- Installing and updating is one command the user approves once, not a list of shell
  steps (#81).
- `goal.md` keeps no fixed shape: setup asks the user to write it in their own words and
  moves on. What a good goal covers is advice in a guide setup links
  (`docs/guides/what-makes-a-good-goal.md`), never a
  format the agent enforces. The seed text is one wording in the script and the UI, and a
  goal is judged weak only when the file is missing or still that seed — anything the
  user wrote passes (#108).
- Setup drills that goal into `decisions.md` before the module map is written, so the
  board's memory starts filling before the first proposals. Every call it can't settle
  waits as a `[user]` question on one card setup creates with the first tasks; answering
  that card through the normal resolve flow writes the answers into `decisions.md`, and
  the card archives when its list is empty. Built — the flow lives in the skill's
  `references/setup.md`.
- Setup keeps a checklist of its own steps in `setup-checklist.md` and ticks each box as
  it goes; the UI shows one bar until every box is ticked (#85). That bar is the whole
  onboarding UI, and it stays simple: for a step the agent must run it shows the line to
  copy into the coding harness, and for the goal it opens the editor. The UI never runs
  setup itself.
- Setup closes by rewriting `modules.md` from everything it settled and moving each
  decision into its module's memory (#86), then creating the first tasks. Those first
  tasks are plain cards. Setup never plans a release: a project that wants one creates it
  later from the release work (#100), and a project that doesn't never sees the question.
- The goal is the only thing setup asks for. Nothing asks about timing: the board does
  not support deadlines for now, so every settled call lands in `decisions.md` alike.
- Order: the setup flow doc (`references/setup.md`) is written; #86 widens its
  module-map step, which sits right before the first tasks. The guide is written and setup
  links it; #108 points the seed wording at the same link.

## Todo
- [x] Install and update by running one script, not a list of shell commands #81
- [x] Settle decisions.md from goal.md in setup, before the module map #84
- [x] Track setup with a checklist and show a bar until it's done #85
- [ ] End setup by rebuilding the module map and splitting decisions into module memories #86
- [x] Write a guide on what makes a good goal, and point setup at it #107
- [ ] Make the goal.md seed one wording and the weak test simple #108
