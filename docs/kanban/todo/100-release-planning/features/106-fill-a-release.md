---
title: Fill a release with the urgent work in one go
track: features
priority: low
roi: med
status: todo
release: next
blocked_by: [104]
related: [100]
modules: [skill, local-ui]
questions: []
---

Filling a release card by card is the slow part of planning one. Let the agent do the first
pass: read the backlog, put the urgent, short-term work into the release, and leave the
rest at `next`.

## Scope
- The user picks a release and asks the board to fill it. The agent reads the cards sitting
  at `next` and moves the ones that pass.
- **A card passes on three tests**: its priority is high, nothing open is blocking it, and
  it is not a group root. Nothing else. The pass never reads a card to judge how big it is
  — the rule is the same for everyone, and the user can predict what a run will do before
  starting it.
- A subtask passes on its own, so a group's urgent piece can go into a version even though
  its root can't.
- It never empties a release or moves work out of one. This pass only adds.
- The user can cap how many cards it moves. Without a cap every card that passes goes in.
- It says what it moved, one line per card, so the user can undo any of it by moving the
  card back. It also names the high-priority cards it left at `next` and which test they
  failed, so nothing is dropped silently.
- A flow the skill owns, so it works from a terminal too, and one action in the UI that
  starts it, sitting on the release the dropdown (#104) is showing.
- Cards that a human already put in a release are left alone. A hand-made plan is not
  second-guessed.

## Todo
- [ ] Write the fill-a-release flow in the skill: what it reads, the three tests a card has
      to pass, and what it leaves alone.
- [ ] Make it report the cards it moved and the high-priority cards it skipped, one line
      each, with the test a skipped card failed.
- [ ] Let the user cap how many cards it moves, and say which cards win the cap.
- [ ] Add the action in the UI that starts the run, and show its log like every other run.
- [ ] Write it into `README.md`, `README-zh.md` and `kanban-ui/README.md`.
- [ ] Check it by hand on a board with a mixed backlog: run it, read every line, and see
      nothing was moved out of a release someone filled by hand.

## Decided by the agent
- **A card that still needs refining can go in.** A release says what ships, not what is
  ready to build today — and `release list` already prints the ready count beside the card
  count, so the user can see how much of the version still needs a refine.
- **A cap takes the highest roi first, then the oldest card.** Priority is already the same
  for every candidate, so roi is what is left to rank on, and the older card has waited
  longer.
- **The skipped cards are part of the report.** A high-priority card left behind is the one
  thing the user would want to argue with, and a run that only lists what it moved hides it.