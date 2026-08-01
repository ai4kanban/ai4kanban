---
title: Fill a release with the urgent work in one go
track: features
priority: low
roi: med
status: todo
blocked_by: [104]
related: [100]
modules: [skill, local-ui]
questions:
  - "[user] What counts as urgent and short-term work for this pass? The board has priority and roi, but nothing that says how big a card is. (a) High priority, nothing blocking it, not a group root. (b) The same, plus the agent reads each card and drops the ones it judges too big for one release. Recommend (b): size is the point of short-term, and only reading the card can tell."
---

Filling a release card by card is the slow part of planning one. Let the agent do the first
pass: read the backlog, put the urgent, short-term work into the release, and leave the
rest at `next`.

## Scope
- The user picks a release and asks the board to fill it. The agent reads the cards sitting
  at `next` and moves the ones that belong in this version.
- It never empties a release or moves work out of one. This pass only adds.
- It says what it moved and why, one line per card, so the user can undo any of it by
  moving the card back.
- The user can say how many cards to aim for. Without a number the agent picks what fits.
- A flow the skill owns, so it works from a terminal too, and one action in the UI that
  starts it, sitting on the release the dropdown (#104) is showing.
- Cards that a human already put in a release are left alone. A hand-made plan is not
  second-guessed.

## Todo
- [ ] Write the fill-a-release flow in the skill: what it reads, what it picks, and what it
      leaves alone.
- [ ] Make it report each move with a one-line reason.
- [ ] Let the user cap how many cards it moves.
- [ ] Add the action in the UI that starts the run, and show its log like every other run.
- [ ] Write it into `README.md`, `README-zh.md` and `kanban-ui/README.md`.
- [ ] Check it by hand on a board with a mixed backlog: run it, read every reason, and see
      nothing was moved out of a release someone filled by hand.