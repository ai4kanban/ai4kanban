---
title: Auto-prune the memory daily as a background run
track: features
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

Prune the board's memory once a day in the background, so the memory files stay short without the user asking.

## Scope
- A new **Auto-prune** switch in the Configuration dialog, beside Auto-refine. Off by default, like Auto-refine.
- With the switch on, the UI runs the skill's prune flow (`references/prune-memory.md`) through the picked agent connector, as a background run — the same way auto-refine runs.
- It runs once a day. The cadence is fixed — no setting for it.
- The run shows in the runs panel like any other background run: the user can watch it, read what it did, and stop it. Like every run, it never commits — the pruned files sit in the working tree for the user to review.

## Todo
- [ ] Add the Auto-prune switch to the Configuration dialog, off by default.
- [ ] While the switch is on, run the prune once a day as a background run through the agent connector.
- [ ] Show the run in the runs panel like any other background run.
- [ ] Update `kanban-ui/README.md` with the switch and what the daily prune does.
- [ ] Check end to end: turn the switch on, make a prune fire, then read the memory files and the run log.

## Decided by the agent
- Its own switch, or under the Auto-refine switch? Its own, beside it — a settled decision says further autonomy levels sit next to that switch as siblings, not inside it.
- What does "daily" mean when the UI server isn't always up? The board remembers when it last pruned; a prune starts when the UI is running and the last one is more than a day old.
- Which memory copies? All of them — the project-wide copy and each module's, as the prune flow already says.
