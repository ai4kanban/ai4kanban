---
title: Read the board's memory in the UI
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: []
modules: [local-ui]
questions:
  - "[user] Memory is view-only, so how do you get from a wrong line to fixing it? (a) each section shows its file path as plain text you copy into your editor; (b) the path is a link that opens the file in your editor. Recommend (a) — (a) already tells you where to go, and a link that launches an app works on some machines and not others."
---

Add a Memory view to the UI, so you can read what the agent remembers — what shipped, what
was settled, what was turned down — without opening files in an editor.

## Today
- Memory is what makes the board self-evolving. Every proposal is judged against it, every
  auto-refine answer leans on it, and every idea you turned down stays turned down because
  it is written there.
- The UI shows none of it. The one piece you can see is `goal.md`, through the goal bar.
- So the agent's memory is invisible to the person it works for. A wrong line in
  `decisions.md` keeps steering every future card, and nobody notices until a card comes
  back wrong.

## Scope
- A Memory button in the header, next to Daily progress, Runs and the gear.
- The view opens on the whole project's memory. A picker switches to one module, listing
  the modules from the module map.
- Each scope shows its four files as sections: what shipped, settled decisions, design
  mistakes, rejected ideas. The project scope also shows the goal, because there is only
  one goal file and it lives at the board root.
- Files are rendered as markdown to read, the same way a card body is.
- Everything here is read-only. Memory is plain text the user owns, like their code, and a
  text box in the board is no better than the editor they already have. You read a wrong
  line here and fix it there.
- A module with no memory folder yet says so plainly, and so does a file that isn't there.
- No agent run starts from this view. Compressing memory stays a flow you ask for.

## What the user does
- Opens Memory and reads what the agent decided, so the last three proposals stop looking
  arbitrary.
- Finds a settled decision that no longer holds, sees which file holds it, and fixes that
  line in their own editor.

## Decided by the agent
- One view for every scope, or one view per module? One view with a scope picker. Propose
  already works one module at a time, so the picker matches how memory is used.
- Add a button that asks the agent to compress memory? No. That rewrites what you wrote,
  and this card is about reading memory.
- Does a read-only view still show the goal? Yes, in the project scope. Reading it beside
  the memory is the point; the goal bar stays the only place the UI writes `goal.md`.
- Its own page or a dialog? A dialog from the header, like Daily progress and Runs.

## Todo
- [ ] Add the Memory button to the header and the view it opens.
- [ ] Show the project's four memory files, plus the goal, rendered as markdown.
- [ ] Add the module picker and show that module's four files.
- [ ] Handle a module with no memory folder yet, and a file that does not exist.
- [ ] Point at where each section's file lives, in the form the open question settles on.
- [ ] Update `kanban-ui/README.md` to describe the Memory view.
- [ ] Open the UI, switch between the project and a module, and check each file reads the
      same as it does on disk.
