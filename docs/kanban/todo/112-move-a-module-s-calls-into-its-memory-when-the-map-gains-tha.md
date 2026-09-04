---
title: Move a module's calls into its memory when the map gains that module
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: []
modules: [skill]
questions: []
---

When a board grows a new module, the notes about it stay in the old memory file. Planning
for that module then reads memory that says nothing about it. Move those notes across,
once, when the module line is added.

<!-- agent -->

## Today
- Setup splits the memory into module memories once, at setup (#86). After that, nothing
  splits anything again.
- A module added later starts with an empty memory. Every earlier note about that part of
  the product is still sitting project-wide, or inside the module it was lumped into.
- So the longer a project runs, the less a module's memory says about it.

## Scope
The rule lives in `akb guide module-map`, in the part that repairs the map — the one place
a line is added, renamed, or deleted — so every flow that can touch the map picks it up.

- **A line is added**: scaffold the new module's memory (`akb board memory-init <module>`),
  then read the memory it came out of — the project-wide set, and the set of any module the
  new part was carved out of — and move the notes that are now clearly its own.
- **All four memory files, not just the settled calls**: what shipped, what was settled,
  what was redesigned, what was rejected. A new module's memory should hold what is already
  known about that part.
- **Which notes move**: setup's one-owner test — a note belongs to the new module when a
  user would only meet it in that part of the product. A note that takes two modules to
  state stays where it is.
- **Moves, not copies**: a note lives in one place.
- **A line is renamed**: the memory folder is renamed with it. Nothing moves between files,
  and no folder is left behind under the old name — same part of the product, new name.
- **A line is deleted**: the module's notes fold back into the project-wide memory, then the
  folder goes. The map no longer names that part, but nothing we learned about it is lost.
- **Only for a map that already exists**: writing a map from scratch doesn't trigger this.
  Setup splits the memory itself at its `modules` step, and an update that writes a board's
  first map does the same — this rule is for a map that gains, renames, or loses a line later.
- **Whoever touches the map does the move in the same run** — the same rule that already
  makes them fix a stale map line.
- **The update flow says the opposite today**: "don't move notes into the module paths"
  goes. In its place — when the update hands you a blank `modules.md` to write, split the
  memory into the new map the way setup's `modules` step does. The rule against hand-adding
  `modules:` lines to cards stays.

## What the user sees
- A module they just added already has the memory about it, instead of an empty file that
  fills up only from new work.
- A board updated from an older version splits its memory the first time it gets a map,
  instead of leaving everything project-wide for good.

## Todo
- [ ] Write the move into `akb guide module-map`, where a line is added: scaffold the
      module's memory first, then move.
- [ ] Say which notes move and which stay, using setup's one-owner test, and that it covers
      all four memory files.
- [ ] Cover a rename: the memory folder follows the module.
- [ ] Cover a delete: fold the module's notes back into the project-wide memory, then drop
      the folder.
- [ ] Say the rule doesn't fire when a map is written from scratch — setup and update split
      the memory themselves.
- [ ] Replace the rule in `akb guide update` that says not to move notes into module paths:
      a blank `modules.md` you write gets the memory split into it, the way setup's
      `modules` step does.
- [x] Check the setup flow doc doesn't still say a board that gains a module later keeps
      its calls where they are — #86 writes that line.
- [ ] Add a module to a real board and check its memory holds the notes about it.

## Decided by the agent
- Does the move cover the whole memory set or only the settled calls? The whole set. The
  reason for moving a call — a new module's memory should hold what is already known about
  that part — is just as true for shipped work, redesigns, and rejected ideas.
- Where do the notes come from? The project-wide memory and any existing module's memory.
  A new module is carved out of one of those two.
- Who runs the move? Whoever adds the map line, in the same run. A separate chore nobody
  triggers is how the memory went stale in the first place.
- Where does the rule live? In `akb guide module-map`, in its repair part — the one place
  a line is added, renamed, or deleted — so every flow that can touch the map picks it up
  without keeping its own copy.
- Does a map written from scratch trigger the move? No. Setup already splits the memory at
  its `modules` step, and an update writing a board's first map does the same job. A second
  rule firing there would double the work.
- What replaces the update flow's "don't move notes into module paths"? Writing a board's
  first map is the same situation setup handles, so update points at that split. Leaving it
  out is what keeps an updated board's memory project-wide for good.
- Which user docs does this touch? None. It gives the user no new action, setting or step —
  the memory just fills itself.
