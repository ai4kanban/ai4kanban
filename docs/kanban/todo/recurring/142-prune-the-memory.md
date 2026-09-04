---
title: Prune the memory
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: []
last_run: 2026-08-29 19:10
questions: []
verify:
  - local-ui/decisions.md and rejected.md disagreed on ticking several cards into a release; the prune kept the newer rejection (2026-08-10) and dropped the older decision (2026-08-03). Confirm we still don't want multi-select.
  - readme.md prose was collapsed into pointers to kanban-ui/README.md sections. Cloud, the bell and Slack/Lark stayed as prose because that doc covers none of them — worth documenting them there.
  - The mockup tag and .mockups gitignore rules now live only in skill/decisions.md; local-ui keeps just how a .txt mockup is drawn.
---

Squeeze the memory files back down to what helps plan the next task. Delete this
card if you don't want the job — nothing puts it back.

## Process
1. Prune the project-wide memory at `docs/kanban/memory/` and each module's at
   `docs/kanban/memory/<module>/`, following `akb guide prune-memory`.
