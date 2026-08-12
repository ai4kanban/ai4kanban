---
title: Walk a first-time user through setup in the UI
track: features
priority: high
roi: high
status: todo
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui, skill]
questions:
  - "[user] The 0.6.0 line asks for install and configuration through the GUI, but goal.md keeps Onboarding as its own unticked item. Should this card be the full guided onboarding, or only enough to get a board configured?"
---

Setting a board up means copying a line into a coding agent and hoping it goes well. Too much can go wrong there for a first impression. Ask for what setup needs in the UI, one step at a time.

## Scope
- A new board opens on a short guided first run instead of a bar with a line to copy.
- It asks for what only the user knows: what the project is, the tracks work falls into,
  and the goal — with the goal advice on screen and a way to skip it for now.
- It also asks which agent will do the work and where its key lives, so the board can run
  something the moment setup ends.
- Each step shows what has been settled so far and can be gone back to.
- A user can leave halfway and pick up where they left off.
- Someone who prefers their coding agent can still hand the rest over — but nobody has to.

## Decided by the agent
- The UI used to be kept out of setup on purpose, with the bar handing the work to a
  coding agent. The 0.6.0 goal reverses that: the GUI is now the main way in and the skill
  is optional, so the UI asks for setup itself.

## Todo
- [ ] Design the first-run steps and what each one asks for.
- [ ] Ask for the project and its tracks, and save them to the board's config.
- [ ] Ask for the goal, with the guidance beside the box and a way to skip it.
- [ ] Ask which agent does the work and where its key lives, reusing what the settings
      dialog already asks.
- [ ] Let the user go back a step, and let a half-finished setup carry on later.
- [ ] Set a board up from scratch with nothing but the UI, and check the board it leaves
      behind is the same as the one a coding agent would have made.
- [ ] Update the UI's README and the setup guide.
