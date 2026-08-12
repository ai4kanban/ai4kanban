---
title: Ship the ui-design agent, which draws the screen a card needs
track: skill
priority: med
roi: high
status: ready
release: ""
blocked_by: [187]
related: [186, 137]
modules: [skill]
questions: []
---

The first agent. On a card that changes a screen, it comes back with the screen drawn — a
few options, not one — so the layout is agreed before anyone builds it.

## Scope
- Write the `ui-design` prompt: read the card, work out what the user has to see and do,
  and draw the screen.
- It answers with two or three options, each an ASCII sketch of the layout, each with one
  line on what it is good for and what it costs. One of them is recommended.
- Layout only — where things sit, what the user clicks. No colors, no fonts, no code.
- It reads the board's own UI design reference when the project has one (#137), and
  matches the screens the project already has.
- Its options are shaped so a flow can turn them straight into a question for the user,
  with the sketch shown as a block (#138).
- It writes its `## By \`ui-design\` agent` section and nothing else.

## Todo
- [ ] Write the `ui-design` prompt: what it reads, what it draws, what it must not touch.
- [ ] Make it answer in two or three sketched options with one recommended.
- [ ] Point it at the project's UI design reference when there is one.
- [ ] Run it on a real card that changes a screen and check the sketches read clearly in
      the card file and on the card page.
- [ ] Document what the ui-design agent fills in.

## Decided by the agent
- **ASCII, not images** — a sketch has to read the same in the card file, in a terminal,
  and in the browser, and the board already settled on ASCII for UI questions (#137).
- **Options, not one answer** — the point of asking a design agent is to see the choice.
  One layout handed down is the same guess the planning pass would have made.
