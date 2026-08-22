---
title: Customize what a specialist agent produces, not just whether it runs
track: features
priority: med
roi: high
status: ready
release: 0.7.2
blocked_by: []
related: [256]
modules: [skill, local-ui]
questions: []
---

A specialist agent has one setting today: on, or off. Nothing about what it produces can be
changed. `ui-design` always answers with full mockup files — React screens that take a long
run to write and only draw inside the board's UI, so a user working from a terminal sees a
file name and no drawing. Let each specialist agent carry a few settings of its own, and give
`ui-design` the first one: draw the layout options in ASCII instead. This is a group task;
each piece is its own subtask in this folder.

## Worth noting
- **Only `ui-design` gets a setting here**: this task builds the frame — an agent may declare
  settings — and `technology-selection` runs exactly as it does today.
- **ASCII drawings were tried and dropped once, and come back here as a choice**: a picture
  of the screen is easier to judge than one drawn with characters. It stays off by default,
  and is there for a board that is read from a terminal.

<!-- agent -->

## Scope
- An agent says what it can be set to.
- The board keeps what the user picked, and hands it to the run.
- `ui-design` gets the first setting — **mockup style**: ASCII, or the full mockup it draws
  today.
- `technology-selection` gets no setting and runs exactly as it does today.
- An agent that declares no settings is untouched.
- Settings are picked in the board UI, in Configuration → Agents, beside the switch.
- `akb spec` prints each agent's settings and what they are set to.
- Nothing is set from a terminal.
- Everything is set with the board, not per machine, so a team shares one answer — the same
  as the switch today.
- A board that sets nothing runs exactly as it does now.
- Out: a third specialist agent.
- Out: which coding tool and model an agent runs on — that is #246 and #247.

## Todo
- [x] Let a specialist agent carry settings, not just a switch #255
- [ ] Draw a card's layout options in ASCII instead of a rendered screen #256
- [x] Set a specialist agent's settings where its switch is #257
