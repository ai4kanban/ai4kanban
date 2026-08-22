---
title: Set a specialist agent's settings where its switch is
track: features
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: [255]
related: [254, 247]
modules: [local-ui]
questions: []
---

Configuration → Agents gives each specialist agent a name, two lines, and one switch. Once an
agent carries settings of its own (#255), that row is where they are set.

## Scope
- **Each row draws that agent's settings**, from the list `akb` hands the pane.
- **The pane keeps no list of its own**: not the agents, not the settings, not the choices.
- **A choice says what it costs**, in the words the agent declared.
- **The settings are set on the row itself**, so nobody leaves the list to change one.
- **An agent with no settings looks exactly as it does today.**
- **A setting saves the moment it is picked**, like the switch.
- **A failed save puts the control back**, and the message goes across the top of the dialog,
  where its errors already appear.
- **A switched-off row still shows its settings**, greyed with the rest of the row.
- **A board whose `akb` is too old to declare settings** keeps the note the section shows
  today, and draws no control.
- Out: setting anything per card, or per run.
- Out: which coding tool and model an agent runs on — that is #247, and it ships separately.

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

## Decided by the agent
- **Do this card and #247 ship as one redraw of the row?**: no. #247 waits on #246, which
  still has questions only the user can answer, and folding them together would hold this
  card behind them. This card ships first and sets the row's shape; #247 fits into it.
- **Does this card need a drawing of the pane of its own?**: no. #247's `ui-design` section
  already drew these same agent rows three ways. This card follows the one the user picks
  there, and the recommended one while that pick is open.
