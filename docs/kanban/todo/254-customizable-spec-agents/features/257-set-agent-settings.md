---
title: Set a specialist agent's settings where its switch is
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: [255]
related: [254, 247]
modules: [local-ui]
questions:
  - question: "[user] #247 puts a harness and a model on this same row. Do the two ship as one redraw of it?"
    mode: single
    options:
      - no — keep them apart, and whichever ships second fits the layout the first one set
      - yes — fold #247 into this card and draw the row once, with everything on it
    recommend: [1]
---

Configuration → Agents gives each specialist agent a name, two lines, and one switch. Once an
agent carries settings of its own (#255), that row is where they are set.

## Scope
- **Each row draws that agent's settings**, from what the command declares — the pane keeps no
  list of agents, settings or choices of its own.
- **A choice says what it costs** in the same words the agent declared, so nobody picks blind.
- **An agent with no settings looks exactly as it does today.**
- **A setting saves as it is picked**, like the switch.
- **A failed save puts the control back** and shows the error where the page already shows
  them.
- **A switched-off row still shows its settings**, greyed with the rest of the row.
- **A board whose command is too old to declare settings** keeps the note the section shows
  today and draws no control.
- **#247 adds a harness and a model to this same row.** Whichever ships second fits into the
  layout the first one set — the row is drawn once, not twice.
- Out: setting anything per card, or per run.

## Todo
- [ ] Read each agent's settings, choices and current values from the command's spec agent
      list.
- [ ] Draw them on the row in `kanban-ui/components/SpecAgents.tsx`.
- [ ] Save a pick through a server action beside `setSpecAgentAction` in
      `kanban-ui/app/actions.ts`.
- [ ] Put the control back and surface the error when a save fails.
- [ ] Keep the row readable while it is switched off.
- [ ] Keep a row with no settings as it is today.
- [ ] Update `kanban-ui/README.md` where it describes the Agents section.
- [ ] Update `docs/guides/daily-loop.md` where it says a specialist agent has one switch.
- [ ] Check the desktop app draws it the same as the browser one.
