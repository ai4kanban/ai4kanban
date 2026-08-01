---
title: "Onboarding: from install to a board ready to plan"
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [84, 86, 87, 107, 108]
modules: [skill, local-ui, site]
questions: []
---

Track everything between "I installed this" and "I have a board I can plan on". This is a
group task; each piece is its own subtask in this folder.

## Scope
- One script does the mechanical install and update, so setup is one approval, not four
  (#81).
- `goal.md` keeps no fixed shape: setup asks the user to write it in their own words and
  moves on. What a good goal covers is advice in a guide setup links (#107), never a
  format the agent enforces. The seed text is one wording in the script and the UI, and a
  goal is judged weak only when the file is missing or still that seed — anything the
  user wrote passes (#108).
- Setup drills that goal into `decisions.md` before the module map is written, so the
  board's memory starts filling before the first proposals (#84).
- Setup keeps a checklist of its own steps in `setup-checklist.md` and ticks each box as
  it goes; the UI shows one bar until every box is ticked — the old weak-goal bar,
  generalized to the whole setup. Shipped. That checklist bar is the onboarding UI. It can
  stay simple at first: for a step the agent must run, the bar shows the instruction to
  copy into the coding harness — like `/kanban setup the current board` — and moves when
  the step ticks. The UI does not run setup itself; a one-button in-UI setup was dropped
  for this (see rejected).
- Setup closes by rewriting `modules.md` from everything it settled and moving each
  decision into its module's memory (#86), then creating the first tasks. Those first
  tasks are plain cards. Setup never plans a release: a project that wants one creates it
  later from the release work (#100), and a project that doesn't never sees the question.
- Setup also asks if the work has a deadline; if it does, calls about work that can wait
  move into `decisions-v2.md`, to merge back by hand once v1 ships (#87). A special
  case — kept deliberately simple.
- Order: #81 first — it rewrites the install prompt the later steps lean on.
  The checklist already lists the steps #84 fixes, and #86 is the last box on that list,
  so it comes after #84. #87 rides on #84's setup doc and can land any time after it. #107 and #108 are independent — the
  guide only needs a link from #84's setup doc once both exist.

## Todo
- [x] Install and update by running one script, not a list of shell commands #81
- [ ] Settle decisions.md from goal.md in setup, before the module map #84
- [x] Track setup with a checklist and show a bar until it's done #85
- [ ] End setup by rebuilding the module map and splitting decisions into module memories #86
- [ ] Ask for a deadline in setup and move decisions that can wait to decisions-v2.md #87
- [ ] Write a guide on what makes a good goal, and point setup at it #107
- [ ] Make the goal.md seed one wording and the weak test simple #108
