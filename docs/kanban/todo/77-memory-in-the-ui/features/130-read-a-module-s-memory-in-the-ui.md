---
title: Read a module's memory in the UI
track: features
priority: med
roi: med
status: ready
release: 0.6.1
blocked_by: [129]
related: [77]
modules: [local-ui]
questions: []
---

Memory is kept per module as well as for the whole project. Put the modules in the Memory
panel too, so you can read what the agent remembers about the part you are working on.

Part of #77.

## Today
- The Memory panel carries the project's four files only (#129). The four files each module
  keeps stay invisible.
- The agent proposes work one module at a time, so the memory that shaped the last proposal
  is usually a module's, not the project's.

## Scope
- **A row per module** under the project's four, built from the module map
  (`docs/kanban/modules.md`), in the order the map lists them.
- **A module the map does not name gets no row**, even if it has a memory folder.
- **A module row expands under itself** into that module's four files — same four names,
  same order, indented.
- **Clicking one of those files opens it in the body exactly like a project file**, with
  the same "more" menu for copying its path.
- **Two labels split the panel**, Project over the four and Modules over the rest, in the
  rail's own section-label look.
- **The labels appear only on a board whose map names at least one module.**
- **Any number of modules can be open at once.** The panel scrolls once it is as tall as it
  is allowed to get — half the rail (#129).
- **Modules start closed on every load**, except the one holding the file you landed on.
- **A module with no memory folder yet** shows one line saying so, instead of four rows
  that lead nowhere. A module whose folder is missing one file keeps all four rows, the
  same as the project does (#129).

## What the user does
- Reads what the agent remembers about the module the card they are holding belongs to.
- Compares a module's decisions with the project's without leaving the rail.

## Todo
- [ ] Add a row per module under the project's four, built from the module map.
- [ ] Expand a module row under itself into its four files, and open a file in the body
      when its row is clicked.
- [ ] Label the two halves of the panel — Project and Modules — when the map names a
      module.
- [ ] Say so plainly when a module has no memory folder yet.
- [ ] Open the module holding the file you landed on, so its row is highlighted after a
      reload.
- [ ] Say in `kanban-ui/README.md` that the panel carries the modules too.
- [ ] Open the UI, read a module's file, and check it reads the same as it does on disk.

## Decided by the agent
- **A tree in the panel, not a scope picker.** Four modules times four files is twenty
  rows. Opening one module at a time keeps the panel short, and a tree is what the rail
  already reads like.
- **Modules start closed, and nothing remembers which were open.** The only view state the
  board keeps is its chrome — the rail's width, the panel being open — and a remembered
  module goes stale the day you drop it from the map. The one exception is the module
  holding the file you landed on: a memory file is a page of its own (#129), so a reload
  can land inside a module, and its row has to be on screen to be highlighted.
- **You cannot open a module's memory from a card that names it.** The panel is the one
  way in. Memory belongs to a module, not to the card you happen to be reading.
