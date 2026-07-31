---
title: "Onboarding: from install to a board ready to plan"
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [81, 84, 85, 86, 87, 91]
modules: [skill, local-ui, site]
questions:
  - "[user] Do we write a best-practices guide for goal.md instead of a template? The guide would say what a good goal covers — the business goal, the long horizon, a roadmap, a direction — as advice, not a format. (a) Write it as a page in docs/guides/ that setup points the user at. (b) Write it as a few lines in the goal.md seed itself, so it is there when the file is opened. (c) Write nothing for now. Recommend (a): a guide the user can read once and ignore keeps the file free-form, which is the point of dropping #82."
  - "[user] With no fixed format, what makes the agent call a goal 'strong', 'good' or 'weak'? (a) Only 'weak' when the file is missing or still the seed text; anything the user wrote is at least 'good'. (b) The agent judges the content — can it tell a good proposal from a bad one by reading this? Recommend (a): judging free-form prose against no format is guesswork, and a nagging bar on a goal the user did write is worse than no bar."
  - "[user] The script's goal.md seed and the local UI's starting text say different things today. Do we still make them one wording? (a) Yes — same words in both places, kept short and free-form. (b) No, leave them. Recommend (a): the two disagreeing is a plain bug even with no format to enforce."
---

Track everything between "I installed this" and "I have a board I can plan on". This is a
group task; each piece is its own subtask in this folder.

## Scope
- One script does the mechanical install and update, so setup is one approval, not four
  (#81).
- ~~Setup ends with a real `goal.md` in the user's words, not a placeholder (#82).~~
  We don't fix a shape for `goal.md`; setup asks the user to write it and moves on.
- Setup drills that goal into `decisions.md` before the module map is written, so the
  board's memory starts filling before the first proposals (#84).
- Setup keeps a checklist of its own steps in `setup-checklist.md` and ticks each box as
  it goes; the UI shows one bar until every box is ticked — the weak-goal bar today,
  generalized to the whole setup (#85). That checklist bar is the onboarding UI. It can
  stay simple at first: for a step the agent must run, the bar shows the instruction to
  copy into the coding harness — like `/kanban setup the current board` — and moves when
  the step ticks. The UI does not run setup itself; a one-button in-UI setup was dropped
  for this (see rejected).
- Setup closes by rewriting `modules.md` from everything it settled and moving each
  decision into its module's memory (#86), then creating the first tasks as two group
  tasks — **v1**, what the first release must include, and **vnext**, everything else
  (#91). A later release is a slice moved out of vnext, not a fresh guess.
- Setup also asks if the work has a deadline; if it does, calls about work that can wait
  move into `decisions-v2.md`, to merge back by hand once v1 ships (#87). A special
  case — kept deliberately simple.
- Order: #81 first — it rewrites the install prompt the later steps lean on.
  #85 lists the steps #84 fixes, #86 is second-to-last
  on that list and #91 is the last box, so they come after #84 in that order. #87 rides
  on #84's setup doc and can land any time after it.

## Todo
- [ ] Install and update by running one script, not a list of shell commands #81
- [ ] Settle decisions.md from goal.md in setup, before the module map #84
- [ ] Track setup with a checklist and show a bar until it's done #85
- [ ] End setup by rebuilding the module map and splitting decisions into module memories #86
- [ ] End setup by creating the v1 and vnext group tasks #91
- [ ] Ask for a deadline in setup and move decisions that can wait to decisions-v2.md #87
