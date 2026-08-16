---
title: Prune the memory
track: recurring
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: []
last_run: 2026-08-16 10:11
questions:
  - question: "[user] The seeded \"Prune the memory\" card is in no published doc — cadence and `akb run` now are, in `kanban-ui/README.md`. Write it up?"
    mode: single
    options:
      - no — leave it undocumented for now
      - yes — add a card to document it
    recommend: [1]
---

Squeeze the memory files back down to what helps plan the next task. Delete this
card if you don't want the job — nothing puts it back.

## Process
1. Prune the project-wide memory at `docs/kanban/memory/` and each module's at
   `docs/kanban/memory/<module>/`, following `akb guide prune-memory`.

## Decided by the agent
- **Do the readme files keep topic headings instead of one flat list?**: yes. `akb guide
  prune-memory` asks for every memory file to be rewritten as topics with takeaways under
  each, so the shape is what the flow wants, not a drift from it.
- **Are recurring cadence and `akb run` still undocumented?**: no, they are covered now —
  "Recurring tasks" and "A cadence runs the job for you" in `kanban-ui/README.md`, and the
  `run #4` row in `README.md`. Only the seeded prune card has no write-up.
