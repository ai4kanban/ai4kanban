---
title: End setup by rebuilding the module map and splitting decisions into module memories
track: skill
priority: high
roi: high
status: todo
blocked_by: [84, 85]
related: [83]
modules: [skill]
questions: []
---

Give setup a closing step: look back at everything setup settled, rewrite `modules.md` to
match it, move each decision into the memory of the module it belongs to, and create the
first tasks from what is there.

## Today
- Setup settles the project-wide `decisions.md` before the module map is written (#84).
  At that moment there are no modules yet, so every call lands project-wide — even the
  ones that clearly belong to one module.
- Nothing revisits `modules.md` at the end. A map written in the middle of setup can
  disagree with what the later steps settled.
- The memory rule says a module's calls live in that module's `decisions.md`. So a board
  fresh out of setup already breaks the rule it will be planned by.

## Scope
- Add a closing step to the setup flow doc (#84's `references/setup.md`), after every
  other step: rewrite `modules.md` against everything setup learned — the code, the goal,
  and the decisions. Keep the map conservative, above all in a from-scratch repo: a
  simple single-purpose project is one module, and more lines come only as the code
  grows.
- Then split the project-wide `decisions.md`: each call that belongs to one module moves
  into that module's `decisions.md` (scaffold the module's memory first); the project-wide
  file keeps only whole-project calls. Moves, not copies — a call lives in one place.
- Then create the first 10 tasks, reading the goal, the decisions, and the fresh map —
  so the first cards are proposed with the memory already in the right place. These
  cards lay the foundation later work builds on; none of them is an improvement aimed
  at what the project hasn't built yet.
- This is the last box on the setup checklist (#85): ticking it is what ends setup and
  drops the setup bar.

## What the user sees
- A board fresh out of setup whose module map matches what they told setup, whose module
  memories already hold the calls about that module, and first cards ready to plan from.

## Decided by the agent
- Does this step replace the "propose the first tasks" ending or run before it? Replace.
  It ends by creating tasks itself; a separate propose step after it would double the
  cards.

## Todo
- [ ] Add the closing step to the setup flow doc: rewrite `modules.md` from everything
      setup settled.
- [ ] Write the decisions split into it: what makes a call one module's, where it moves,
      and what stays project-wide.
- [ ] Write the task-creation part: 10 foundation cards, read from the goal, the
      decisions, and the fresh map.
- [ ] Fold the conservative-module rule into `references/module-map.md`: a simple
      single-purpose project is one module; add lines only as the code grows.
- [ ] Make it the last box on the setup checklist (#85).
- [ ] Run full setup on a fresh repo and check `modules.md` matches the decisions, each
      module's memory holds its own calls, and the board has cards.
