---
title: Flag a card that is too big to build in one run
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [118]
modules: [skill]
questions: []
---

A card can be perfectly clear and still be three days of work. Nothing catches that, so
it goes to an agent as one run, and the run comes back half done. Judge size while
refining, and split the card that is too big.

## Scope
- Refine gains one check: can one run finish this card? Count the todos, the surfaces it
  touches, and whether it names more than one deliverable.
- A card that fails it is turned into a group task — a root plus one subtask per piece —
  instead of being marked ready.
- When the split is not obvious, refine raises it as a question with the splits it would
  make, rather than guessing.
- Say the rule in plain words so a user can predict it and disagree with it.

## Todo
- [ ] Add the size check to the refine flow, with a plain rule for what counts as too big.
- [ ] Have a card that fails it become a group task, or a question naming the proposed
      split when the split is a judgment call.
- [ ] Let the split be made by the command: turn a card that is already open into a group
      root. Nothing today converts a card that exists.
- [ ] Make sure the check never fires on a card that is already a group subtask.
- [ ] Cover it in the daily-loop guide, so the user knows why a card became a group.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; their `analyze-complexity` scores
  every task 1-10 against a threshold and their docs make the resulting `expand` a normal
  step in the loop, not a rescue for a task that went stale.
