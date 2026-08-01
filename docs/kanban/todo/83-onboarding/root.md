---
title: "Onboarding: from install to a board ready to plan"
track: skill
priority: high
roi: high
status: ready
release: next
blocked_by: []
related: [84, 86, 87, 107, 108]
modules: [skill, local-ui, site, docs]
questions: []
---

Track everything between "I installed this" and "I have a board I can plan on". This is a
group task; each piece is its own subtask in this folder.

## Scope
- Installing and updating is one command the user approves once, not a list of shell
  steps (#81).
- `goal.md` keeps no fixed shape: setup asks the user to write it in their own words and
  moves on. What a good goal covers is advice in a guide setup links (#107), never a
  format the agent enforces. The seed text is one wording in the script and the UI, and a
  goal is judged weak only when the file is missing or still that seed — anything the
  user wrote passes (#108).
- Setup drills that goal into `decisions.md` before the module map is written, so the
  board's memory starts filling before the first proposals (#84).
- Setup keeps a checklist of its own steps in `setup-checklist.md` and ticks each box as
  it goes; the UI shows one bar until every box is ticked (#85). That bar is the whole
  onboarding UI, and it stays simple: for a step the agent must run it shows the line to
  copy into the coding harness, and for the goal it opens the editor. The UI never runs
  setup itself.
- Setup closes by rewriting `modules.md` from everything it settled and moving each
  decision into its module's memory (#86), then creating the first tasks. Those first
  tasks are plain cards. Setup never plans a release: a project that wants one creates it
  later from the release work (#100), and a project that doesn't never sees the question.
- The goal is the only thing setup asks for. A deadline is part of the goal's horizon, so
  setup reads it there; if there is one, calls about work that can wait move into
  `decisions-v2.md`, to merge back by hand once v1 ships (#87). A special case — kept
  deliberately simple.
- Order: #84 first — it grows `references/setup.md` into the setup flow doc that #86 and
  #87 both write into. #86 is the checklist's last box, so it comes after #84; #87 can
  land any time after it. #107 writes the guide, then #108 points the seed wording at it.

## Todo
- [x] Install and update by running one script, not a list of shell commands #81
- [ ] Settle decisions.md from goal.md in setup, before the module map #84
- [x] Track setup with a checklist and show a bar until it's done #85
- [ ] End setup by rebuilding the module map and splitting decisions into module memories #86
- [ ] Read the deadline from goal.md and move decisions that can wait to decisions-v2.md #87
- [ ] Write a guide on what makes a good goal, and point setup at it #107
- [ ] Make the goal.md seed one wording and the weak test simple #108
