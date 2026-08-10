---
title: Say how a card will be checked before it counts as done
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [16]
modules: [skill]
questions: []
---

A card is done when the agent that built it says so. Nobody checks. The moment the board
builds cards on its own, "done" has to mean something the user can trust.

## Scope
- A card carries how it will be checked — what to run, or what to look at, to know the
  work is really there.
- Refine writes it while the plan is still being shaped, so it is agreed before the build,
  not invented after.
- The check is written for the user, not the coding agent: what the user should be able to
  do, in plain words. Not a test file name.
- Archiving runs the check first and says what it found. A card that fails it stays on the
  board with the reason.
- A card with nothing worth checking says so in one line rather than carrying an empty
  section.

## Todo
- [ ] Give the card a place to say how it will be checked.
- [ ] Have refine fill it in as part of shaping the plan.
- [ ] Run the check when a card is archived, and keep a failing card on the board with the
      reason.
- [ ] Cover it in the daily-loop guide.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; their autopilot ships an autonomous
  TDD workflow with full state management, so a task only advances once its check passes.
  Ours advances on the word of the agent that did the work.
