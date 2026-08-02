---
title: Move a module's calls into its memory when the map gains that module
track: skill
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: [skill]
questions: []
---

When a board grows a new module, the notes about it stay in the old memory file. Planning
for that module then reads memory that says nothing about it. Move those notes across,
once, when the module line is added.

## Today
- Setup splits the memory into module memories once, at setup (#86). After that, nothing
  splits anything again.
- A module added later starts with an empty memory. Every earlier note about that part of
  the product is still sitting project-wide, or inside the module it was lumped into.
- So the longer a project runs, the less a module's memory says about it.

## Scope
- When a line is added to `modules.md`, scaffold the new module's memory, then read the
  memory it came out of — the project-wide set, and any module's set the new part was
  carved out of — and move the notes that are now clearly its own.
- It covers all four memory files, not just the settled calls: what shipped, what was
  settled, what was redesigned, what was rejected. A new module's memory should hold what
  is already known about that part.
- The same test as setup's split: a note belongs to the new module when a user would only
  meet it in that part of the product. A note that takes two modules to state stays where
  it is.
- Moves, not copies — a note lives in one place.
- On a rename the memory follows the module: the folder is renamed, and nothing moves
  between files, since it is the same part of the product under a new name.
- When a line is deleted, the module's notes are folded back into the project-wide memory
  and its folder goes away. The map no longer names that part, but nothing we learned about
  it is lost.
- Whoever adds the line does the move in the same run — the same rule that already makes
  them fix a stale map line.
- Today's update flow says the opposite — leave the project-wide notes alone, don't move
  them into module paths. That rule changes, so both docs end up saying the same thing.

## What the user sees
- A module they just added already has the memory about it, instead of an empty file that
  fills up only from new work.

## Decided by the agent
- Does the move cover the whole memory set or only the settled calls? The whole set. The
  reason for moving a call — a new module's memory should hold what is already known about
  that part — is just as true for shipped work, redesigns, and rejected ideas.
- Where do the notes come from? The project-wide memory and any existing module's memory.
  A new module is carved out of one of those two.
- Who runs the move? Whoever adds the map line, in the same run. A separate chore nobody
  triggers is how the memory went stale in the first place.
- Where does the rule live? In `references/module-map.md`, on the step that adds a line, so
  every flow that can add one picks it up without keeping its own copy.

## Todo
- [ ] Write the move into `references/module-map.md`, on the step that adds a line:
      scaffold the module's memory first, then move.
- [ ] Say which notes move and which stay, using setup's one-owner test, and that it covers
      all four memory files.
- [ ] Cover a rename: the memory folder follows the module.
- [ ] Cover a delete: fold the module's notes back into the project-wide memory, then drop
      the folder.
- [ ] Update the rule in `references/update.md` that says not to move notes into module
      paths, so the two docs agree.
- [ ] Check the setup flow doc doesn't still say a board that gains a module later keeps
      its calls where they are — #86 writes that line.
- [ ] Add a module to a real board and check its memory holds the notes about it.
