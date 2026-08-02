---
title: Split setup's decisions into module memories before the first tasks
track: skill
priority: high
roi: high
status: ready
release: 0.5.0
blocked_by: []
related: [83, 112]
modules: [skill]
questions: []
---

Setup settles every call into one project-wide file, then writes the module map. Move each
call into the memory of the module it belongs to, so the first tasks are planned from
memory that already sits in the right place.

## Today
- The map half of this card already shipped. Setup's `modules` step writes `modules.md`
  once, right before the step that creates the first tasks, and covers a repo with no code
  (`references/setup.md`). Nothing left to do there.
- The split has not. The `decisions` step runs before the map exists, so every call lands
  project-wide — even the ones that clearly belong to one module — and nothing moves them
  afterwards.
- That order stays. A repo with no code has nothing to read a map from, so the map can only
  be built from what the decisions settled. The move comes after.
- The memory rule says a module's calls live in that module's `decisions.md`. So a board
  fresh out of setup already breaks the rule it will be planned by.

## Scope
- Setup keeps its step order — `decisions`, then `modules`, then `tasks`. Nothing moves
  earlier.
- Widen setup's `modules` step: once the map is written and every module has its memory
  path, move each project-wide decision into the module it belongs to. Same step, same
  place in the order — right before the first tasks are created.
- A call belongs to one module when a user would only meet it in that part of the product —
  the same test that tags a card with a module. Exactly one owner means the call moves.
- A call that takes two modules to state stays project-wide. If it splits cleanly into a
  half per module, write each half in its own module — never the same line in two files.
  Moves, not copies: a call lives in one place.
- One module on the map means every call moves into it and the project-wide file is left
  near-empty. That is right — planning reads that module's memory from then on.
- The project-wide memory files stay at the board root even when they end up empty. A card
  that names no module still writes its notes there, and a board that grows a second
  module needs them back.
- Keep the map conservative, above all in a from-scratch repo: a simple single-purpose
  project is one module, and more lines come only as the code grows. This belongs in
  `references/module-map.md`, not in the setup flow.
- The split runs at setup and never again. What happens when a board gains a module later
  is #112's rule, written on the step that adds a map line — don't restate it here.

## What the user sees
- A board fresh out of setup whose module memories already hold the calls about that
  module, instead of one project-wide pile the first tasks are planned from.

## Decided by the agent
- What makes a call one module's? A user would only meet it in that part of the product.
  Exactly one owner means it moves.
- Where does a call that spans two modules go? It stays project-wide. The same line kept
  in two files drifts apart, and the project-wide file is exactly for calls no single
  module owns.
- What if the map has one module? Every call still moves into it. Planning reads that
  module's memory from then on, and the project-wide files stay for the cards that name no
  module.
- Do the project-wide memory files go away on a one-module board? No. A card that names no
  module still writes there, and a board can grow a second module later.
- Does the split get its own box on the setup checklist? No. The checklist's `modules` box
  sits in exactly this slot; it keeps the box and widens its wording. One step, one box.
- Does the split need a step of its own to scaffold each module's memory? No. The `modules`
  step already re-runs `init`, which gives every module on the map its memory path.

## Todo
- [ ] Add the split to setup's `modules` step in `references/setup.md`: after the map is
      written and every module has its memory path, move each call into its module's
      memory.
- [ ] Say which calls move and which stay — one owner moves it, no single owner keeps it
      project-wide, and the same line never lives in two files.
- [ ] Say what the split does when the map has one module: every call moves into it, and
      the project-wide memory files stay even when they end up empty.
- [ ] Say the split runs at setup only, and leave what a later module gets to #112's rule
      on the step that adds a map line.
- [ ] Fold the conservative-module rule into `references/module-map.md`: a simple
      single-purpose project is one module; add lines only as the code grows.
- [ ] Widen the checklist's `modules` box so it covers both halves — write the map, then
      move each decision into its module's memory.
- [ ] Update the setup paragraph in `README.md` so it says setup files each call under the
      module it belongs to, not into one pile.
- [ ] Run full setup on a repo with no code and check each module's memory holds its own
      calls and the project-wide file keeps only what no single module owns.
- [ ] Run setup on a one-module repo and check the project-wide memory files are still
      there, and a card that names no module still writes to them.
