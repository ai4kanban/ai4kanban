---
title: Customize what a specialist agent produces, not just whether it runs
track: features
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [255, 256, 257]
modules: [skill, local-ui]
questions:
  - question: "[user] Does `technology-selection` get a setting of its own in this group?"
    mode: single
    options:
      - no — ship `ui-design`'s mockup style alone and see whether the shape holds
      - yes — give it one too, so the settings pane is not a list of one
    recommend: [1]
---

A specialist agent has one setting today: on, or off. Nothing about what it produces can be
changed. `ui-design` always answers with full mockup files — React screens that take a long
run to write and only draw inside the board's UI, so a user working from a terminal sees a
file name and no drawing. Let each specialist agent carry a few settings of its own, and give
`ui-design` the first one: draw the layout options in ASCII instead. This is a group task;
each piece is its own subtask in this folder.

## Scope
- An agent says what it can be set to. The board keeps what the user picked and hands it to
  the run.
- `ui-design` gets the first setting — **mockup style**: ASCII, or the full mockup it draws
  today.
- Settings sit with the switch, in Configuration → Agents.
- Everything is set with the board, not per machine, so a team shares one answer — the same
  as the switch today.
- A board that sets nothing runs exactly as it does now.
- Out: a third specialist agent.
- Out: which coding tool and model an agent runs on — that is #246 and #247.

## Todo
- [ ] Let a specialist agent carry settings, not just a switch #255
- [ ] Draw a card's layout options in ASCII instead of a rendered screen #256
- [ ] Set a specialist agent's settings where its switch is #257
