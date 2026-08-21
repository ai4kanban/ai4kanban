---
title: Rewrite the daily-loop guide so each step leads with the button
track: distribution
priority: med
roi: med
status: todo
release: 0.7.1
blocked_by: [274, 275, 276]
related: [209]
modules: [docs]
questions: []
---

`docs/guides/daily-loop.md` teaches every step as a sentence you say to a coding agent. A
reader who arrived through the app has the board open in a window and is told to go back to
a terminal for work that is a button in front of them. Once the three missing buttons exist
(#274, #275, #276), every step has one, and the guide can lead with it.

## Scope
- Every step in the guide says both ways to do it: the button in the app, and the sentence
  for the coding agent.
- The app way reads first in each step, to match how a new user got here.
- Where `kanban-ui/README.md` already covers a screen, the guide points at it instead of
  describing the screen again.
- A reader who only has the app and never opens a terminal can do every step in the guide.
- The one thing that stays terminal-only is saving an API key, and the guide keeps saying
  why.

## Todo
- [ ] Go through each step of the guide and name the button that does the same thing.
- [ ] Reorder each step so the app way reads first.
- [ ] Point at `kanban-ui/README.md` where it already covers a screen, instead of repeating
      it.
- [ ] Read the guide as someone who only has the app, and check every step is doable.

## Decided by the agent
- **It waits for the three build cards**: a guide that leads with a button that does not
  exist is worse than the guide we have.
