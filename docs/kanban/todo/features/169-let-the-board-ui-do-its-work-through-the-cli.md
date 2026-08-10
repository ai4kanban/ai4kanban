---
title: Let the board UI do its work through the CLI
track: features
priority: high
roi: high
status: todo
release: 0.6.0
blocked_by: [167, 168]
related: []
modules: [local-ui, skill]
questions: []
---

The UI keeps its own copy of the board's rules and reaches into `.claude/skills/kanban/` to write a card's fields — so it quietly does nothing when that folder is not there, and the two copies can disagree about the same board. Point the UI at the CLI instead.

## Scope
- Every board change the UI makes goes through the CLI: creating, editing, questions,
  archiving, rejecting, releases, the goal, setup.
- Every run the UI starts goes through the CLI too.
- The UI drops its own copies of the board rules, so a rule is written once and both sides
  read the same answer.
- The UI works on a repo with no skill folder installed. Nothing it offers depends on a
  coding agent being set up.
- Nothing a user can see changes shape — the same buttons do the same things.

## Todo
- [ ] Replace the UI's own board reading and writing with CLI calls.
- [ ] Replace the UI's own agent handling with CLI calls.
- [ ] Delete the copied rules left behind in the UI.
- [ ] Run the board in a repo with no skill folder and check every button still works.
- [ ] Walk the whole board once — make a card, refine it, answer a question, plan a
      release, build it, archive it — and check nothing changed for the user.
