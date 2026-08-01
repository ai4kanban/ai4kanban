---
title: End setup by rebuilding the module map and splitting decisions into module memories
track: skill
priority: high
roi: high
status: ready
blocked_by: [84]
related: [83]
modules: [skill]
questions: []
---

Give setup a closing step: write `modules.md` from everything setup settled, and move each
decision into the memory of the module it belongs to. The first tasks are created from
that memory, once it sits in the right place.

## Today
- Setup settles the project-wide `decisions.md` before the module map is written (#84).
  At that moment there are no modules yet, so every call lands project-wide — even the
  ones that clearly belong to one module.
- Setup writes `modules.md` in the middle, before anything reads it, and nothing checks
  that map against what the later steps settled.
- The memory rule says a module's calls live in that module's `decisions.md`. So a board
  fresh out of setup already breaks the rule it will be planned by.

## Scope
- Add a closing step to the setup flow doc (#84's `references/setup.md`), after every step
  that settles something and right before the one that creates the first tasks. It writes
  `modules.md` from everything setup learned — the code, the goal, and the decisions. No
  earlier step writes a map, so setup never plans from a draft.
- The map covers a repo with no code too: with nothing to read, it comes from `goal.md`
  and `decisions.md`.
- Keep the map conservative, above all in a from-scratch repo: a simple single-purpose
  project is one module, and more lines come only as the code grows.
- Then split the project-wide `decisions.md`. A call belongs to one module when a user
  would only meet it in that part of the product — the same test that tags a card with a
  module. Exactly one owner means the call moves into that module's `decisions.md`
  (scaffold the module's memory first).
- A call that takes two modules to state stays project-wide. If it splits cleanly into a
  half per module, write each half in its own module — never the same line in two files.
  Moves, not copies: a call lives in one place.
- One module on the map means every call moves into it and the project-wide file is left
  near-empty. That is right — planning reads that module's memory from then on.
- The project-wide memory files stay at the board root even when they end up empty. A card
  that names no module still writes its notes there, and a board that grows a second
  module needs them back.
- The first cards come after this step: they are read from the goal, the decisions, and
  the fresh map. So this step's job is to put the memory in the right place before
  anything is planned from it. They are plain cards — setup never sorts them into a
  release.
- This step runs once, at setup, and never again on a board that is already set up. A
  board that gains a module later keeps its calls where they are; the new module's memory
  starts empty and fills from the cards that name it. Keeping the map itself honest stays
  what it is today — whoever reads it and finds it wrong fixes it there and then.

## What the user sees
- A board fresh out of setup whose module map matches what they told setup, and whose
  module memories already hold the calls about that module.

## Decided by the agent
- Does this step replace the "propose the first tasks" ending or run before it? Before.
  It leaves the memory in place, and the first cards are created from it afterwards — a
  separate propose step on top of either would double the cards.
- Does setup write the map twice, once in the middle and again here? No, once, here.
  Nothing between the decisions step and this one changes what the map is built from, so
  an earlier map is only a draft that can go stale.
- What makes a call one module's? A user would only meet it in that part of the product.
  Exactly one owner means it moves.
- Where does a call that spans two modules go? It stays project-wide. The same line kept
  in two files drifts apart, and the project-wide file is exactly for calls no single
  module owns.
- What if the map has one module? Every call still moves into it. Planning reads that
  module's memory from then on, and the project-wide files stay for the cards that name no
  module.
- Does this step get its own box on the setup checklist? No. The checklist already has one
  box for the module map in this slot; it keeps the box and widens its wording. One step,
  one box.
- Do the project-wide memory files go away on a one-module board? No. A card that names no
  module still writes there, and a board can grow a second module later.
- Does a module added later re-split the calls this step moved? No. They stay put, and the
  new module's memory fills from the cards that name it. Moving old lines is a job nothing
  on the board does today.
- Does this step run again on an existing board? No, setup only. Setup's checklist is
  deleted when setup ends and is never written again, and the map already has an owner
  after setup.

## Todo
- [ ] Make the closing step in the setup flow doc write `modules.md`, and drop the earlier
      module-map step so the map is written once.
- [ ] Cover the repo with no code in that step: the map comes from the goal and the
      decisions.
- [ ] Write the decisions split into it: one owner moves the call, no single owner keeps
      it project-wide, and the same line never lives in two files.
- [ ] Say what the split does when the map has one module: every call moves into it, and
      the project-wide memory files stay even when they end up empty.
- [ ] Say in the closing step that it runs once, at setup: a board that gains a module
      later keeps its calls where they are.
- [ ] Fold the conservative-module rule into `references/module-map.md`: a simple
      single-purpose project is one module; add lines only as the code grows.
- [ ] Widen the setup checklist's module box to cover this whole step — write the map,
      then move each decision into its module's memory. It keeps its place, right before
      the step that creates the first tasks.
- [ ] Run full setup on a repo with no code and check the map was written once at the end,
      matches the decisions, and each module's memory holds its own calls.
- [ ] Run setup on a one-module repo and check the project-wide memory files are still
      there, and a card that names no module still writes to them.
