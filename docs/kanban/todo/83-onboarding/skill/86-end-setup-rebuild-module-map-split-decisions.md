---
title: End setup by rebuilding the module map and splitting decisions into module memories
track: skill
priority: high
roi: high
status: todo
blocked_by: [84, 85]
related: [83]
modules: [skill]
questions:
  - Does setup write modules.md once, here at the closing step, instead of writing it mid-setup (#84) and rewriting it here?
  - What makes a settled call one module's rather than the whole project's, and where does a call that spans two modules go?
  - On a project the conservative rule maps to a single module, does the split still move the calls into that module's memory, or do they stay project-wide?
---

Give setup a closing step: look back at everything setup settled, rewrite `modules.md` to
match it, and move each decision into the memory of the module it belongs to. The first
tasks come right after, in #91.

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
- The first cards come after this step, not in it: #91 creates the v1 and vnext group
  tasks, reading the goal, the decisions, and the fresh map. So this step's job is to put
  the memory in the right place before anything is planned from it.

## What the user sees
- A board fresh out of setup whose module map matches what they told setup, and whose
  module memories already hold the calls about that module.

## Decided by the agent
- Does this step replace the "propose the first tasks" ending or run before it? Before.
  It leaves the memory in place, and #91 creates the first cards from it — a separate
  propose step on top of either would double the cards.

## Todo
- [ ] Add the closing step to the setup flow doc: rewrite `modules.md` from everything
      setup settled.
- [ ] Write the decisions split into it: what makes a call one module's, where it moves,
      and what stays project-wide.
- [ ] Fold the conservative-module rule into `references/module-map.md`: a simple
      single-purpose project is one module; add lines only as the code grows.
- [ ] Put it second-to-last on the setup checklist (#85), right before the step that
      creates the first cards (#91).
- [ ] Run full setup on a fresh repo and check `modules.md` matches the decisions and
      each module's memory holds its own calls.
