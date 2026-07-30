---
title: Run several auto-refines at once, set by a parallelism setting
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: []
modules: [local-ui]
questions:
  - Two refines at once can both rewrite shared board files (the todo README index, memory notes). Do we need a guard, or is last-write-wins fine?
---

Auto-refine works one card at a time. On a big backlog that is slow. Let the user set
how many cards refine at once. The default stays 1, so nothing changes unless the user
raises it.

## Scope
- Add a parallelism number to the auto-refine settings in the UI. Default 1.
- The dispatcher keeps up to that many auto-refine runs going at once, never more.
- Each run still picks a different card — the same card is never refined twice at once.

## Todo
- [ ] Add the parallelism setting to the auto-refine configuration, with 1 as the default.
- [ ] Let the dispatcher launch auto-refines until that many are running.
- [ ] Set parallelism to 2, turn auto-refine on with several rough cards, and watch two refine at the same time on different cards.
- [ ] Update the auto-refine section of `kanban-ui/README.md` to cover the new setting.
