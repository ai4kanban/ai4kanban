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

Memory is kept per module as well as for the whole project. Let the Memory view switch
between them, so you can read what the agent remembers about the part you are working on.

Part of #77.

## Today
- The Memory view (#129) shows the project's four files only. The four files each module
  keeps are still invisible.
- Proposals are made one module at a time, so the memory that shaped the last proposal is
  usually a module's, not the project's.

## Scope
- A row of scope chips at the top of the Memory view: Project first, then one chip per
  module from the module map. It stays put while you read.
- The view opens on Project. Picking another chip shows that scope's four files and starts
  you at the top.
- A module's files read exactly like the project's — same sections, same order, same "more"
  menu with Copy path and Copy relative path.
- A module with no memory folder yet says so plainly instead of showing four missing files.

## What the user does
- Reads what the agent remembers about the module the card they are holding belongs to.

## Todo
- [ ] Add the scope chips, built from the module map, with Project first.
- [ ] Show a module's four files when its chip is picked.
- [ ] Say so plainly when a module has no memory folder yet.
- [ ] Say the scope chips exist in `kanban-ui/README.md`.
- [ ] Open the UI, switch between the project and a module, and check each file reads the
      same as it does on disk.

## Decided by the agent
- **One view with a scope picker, not one view per module.** Propose already works one
  module at a time, so the picker matches how memory is used.
- **The view does not remember the last scope you read.** It opens on Project every time.
  The only view choice the UI remembers is the board layout, and a remembered module goes
  stale the day you drop it from the map.
- **You cannot open a module's memory from a card that names it.** The header button is the
  one way in. Memory belongs to a module, not to the card you happen to be reading.
