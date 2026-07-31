---
title: Set how hard the model thinks
track: features
priority: low
roi: med
status: todo
blocked_by: [93]
related: [92]
modules: [local-ui]
questions: []
---

A run can be quick and cheap or slow and careful. Let the user say which, once, for the
connector they picked.

## Scope
- One more declared setting (#93): a reasoning level, picked from a list the connector
  names. It is a list, not free text — unlike a model id, the levels come from the agent
  and don't change between releases.
- Empty means the connector's own default. The board never invents a level.
- Claude Code's levels are the ones its CLI takes on `--effort`: low, medium, high, xhigh,
  max. Another connector names its own, so the wording can differ.
- One level for every run — the same rule the model setting already follows. A level per
  card action (cheap refines, careful implements) is a different card and nobody has asked
  for it.
- A level the picked model doesn't support is the agent's problem, not the board's. The run
  fails and its log says why, same as a wrong model id.

## Todo
- [ ] Let a connector name its reasoning levels, and show them as a list in the
      Configuration dialog.
- [ ] Pass the picked level to Claude Code, and pass nothing when the setting is empty.
- [ ] Update `kanban-ui/README.md`: the setting, the levels, and that empty means the
      agent's own default.
- [ ] Run a card on the lowest level and on the highest, and check the log shows the run
      took the level it was given.
