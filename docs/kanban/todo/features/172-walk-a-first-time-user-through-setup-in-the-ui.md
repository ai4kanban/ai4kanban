---
title: Walk a first-time user through setup in the UI
track: features
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui, skill]
questions: []
---

Setting a board up means copying a line into a coding agent and hoping it goes well. Too much can go wrong there for a first impression. Ask for what setup needs in the UI, one step at a time.

## Scope
- A board whose setup is unfinished opens on a short guided first run — one question a
  screen — instead of the board with a bar telling you to paste a line into a coding agent.
- It asks for what only the user knows: what the project is, the tracks work falls into,
  and the goal — with the goal advice on screen and a way to skip it for now.
- Every answer starts on a sensible default, so someone in a hurry can press through and
  still end up with a working board.
- It also asks which agent will do the work and where its key lives, and lets them check
  the agent answers before moving on, so the board can run something the moment setup ends.
- Each step shows what has been settled so far and can be gone back to.
- A user can leave halfway and pick up where they left off.
- Someone who prefers their coding agent can leave the flow at any step and hand the rest
  over — but nobody has to.

## Decided by the agent
- The UI used to be kept out of setup on purpose, with the bar handing the work to a
  coding agent. The 0.6.0 goal reverses that: the GUI is now the main way in and the skill
  is optional, so the UI asks for setup itself.
- The guided run takes the whole screen and replaces the setup bar on a board that has
  just been made. The bar stays for the two cases it still fits: a setup someone walked
  away from, and a board long set up whose goal has gone weak.
- Nobody's agent is configured until this flow asks for one, so the project and its tracks
  can't be proposed by an agent here. The flow offers plain defaults instead — the repo's
  own name, the standard tracks — and the user changes what's wrong.
- The steps that read the repo and think — the settled calls, the module map, the first
  cards — are not asked here. They run after this flow, in #173.

## Todo
- [ ] Show the guided first run in place of the board while setup is unfinished, with a way
      through to the board at any step.
- [ ] Ask for the project and its tracks, prefilled with defaults, and save them to the
      board's config.
- [ ] Ask for the goal, with the guidance beside the box and a way to skip it.
- [ ] Ask which agent does the work and where its key lives, reusing what the Configuration
      dialog already asks — its Test button included, so nobody leaves setup with an agent
      that can't run.
- [ ] Let the user go back a step, and let a half-finished setup carry on next time the
      board opens.
- [ ] Keep the setup bar for a setup someone left halfway and for a goal that goes weak
      later.
- [ ] Set a board up from scratch with nothing but the UI, and check the board it leaves
      behind is the same as the one a coding agent would have made.
- [ ] Update the UI's README and the setup guide.
