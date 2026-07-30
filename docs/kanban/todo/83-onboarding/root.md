---
title: "Onboarding: from install to a board ready to plan"
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [81, 82, 84, 85, 86, 87]
modules: [skill, local-ui, site]
questions: []
---

Track everything between "I installed this" and "I have a board I can plan on". This is a
group task; each piece is its own subtask in this folder.

## Scope
- One script does the mechanical install and update, so setup is one approval, not four
  (#81).
- Setup ends with a real `goal.md` in the user's words, not a placeholder (#82).
- Setup drills that goal into `decisions.md` before the module map is written, so the
  board's memory starts filling before the first proposals (#84).
- Setup keeps a checklist of its own steps in `setup-checklist.md` and ticks each box as
  it goes; the UI shows one bar until every box is ticked — the weak-goal bar today,
  generalized to the whole setup (#85). That checklist bar is the onboarding UI. It can
  stay simple at first: for a step the agent must run, the bar shows the instruction to
  copy into the coding harness — like `/kanban setup the current board` — and moves when
  the step ticks. The UI does not run setup itself; a one-button in-UI setup was dropped
  for this (see rejected).
- Setup closes by rewriting `modules.md` from everything it settled, moving each decision
  into its module's memory, and creating the first tasks from them (#86).
- Setup also asks if the work has a deadline; if it does, calls about work that can wait
  move into `decisions-v2.md`, to merge back by hand once v1 ships (#87). A special
  case — kept deliberately simple.
- Order: #81 and #82 first — they rewrite the install prompt the later steps lean on.
  #84 needs the goal step from #82. #85 lists the steps #84 fixes, and #86 is the last
  box on that list, so they come after #84 in that order. #87 rides on #84's setup doc
  and can land any time after it.

## Todo
- [ ] Install and update by running one script, not a list of shell commands #81
- [ ] Define what goal.md looks like so a fresh board starts with a usable goal #82
- [ ] Settle decisions.md from goal.md in setup, before the module map #84
- [ ] Track setup with a checklist and show a bar until it's done #85
- [ ] End setup by rebuilding the module map and splitting decisions into module memories #86
- [ ] Ask for a deadline in setup and move decisions that can wait to decisions-v2.md #87
