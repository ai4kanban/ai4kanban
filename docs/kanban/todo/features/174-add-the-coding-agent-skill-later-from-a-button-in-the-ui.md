---
title: Add the coding agent skill later, from a button in the UI
track: features
priority: med
roi: med
status: todo
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui, skill]
questions: []
---

The skill stops being the first step and becomes an extra: drive the same board from your coding agent, if you want to. Offer it where the user already is, instead of sending them back to a terminal.

## Scope
- The UI has one place that says what the skill adds — driving this board from your coding
  agent — and a button that installs it.
- It says which agent folders it wrote, and offers the same button as an update when a
  newer skill ships.
- It is plainly optional. Nothing about the board stops working without it.
- Someone who already installed the skill sees that it is there, not an install button.

## Todo
- [ ] Decide where this sits in the UI and what it says.
- [ ] Install the skill from the button, and report the folders it wrote.
- [ ] Show the state a user is in — not installed, installed, or an update available.
- [ ] Update it from the same place when a newer version is out.
- [ ] Try it on a repo with no skill, one with an old skill, and one already up to date.
- [ ] Update the UI's README and the install guide.
