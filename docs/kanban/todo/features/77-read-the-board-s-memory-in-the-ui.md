---
title: Read the board's memory in the UI
track: features
priority: med
roi: high
status: ready
blocked_by: []
related: []
modules: [local-ui]
questions: []
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
- The view always opens on the whole project's memory. A row of scope chips sits at the top
  — Project first, then one chip per module from the module map — and stays put while you
  read. Picking another chip starts you at the top of that scope.
- Below it, one scroll. Each scope shows its four files as sections in this order: what
  shipped, settled decisions, design mistakes, rejected ideas. The project scope puts the
  goal first, above them, because there is only one goal file and it lives at the board
  root.
- A section header names its file and sticks to the top while you scroll that section, so
  you always know which file you are reading.
- Files are rendered as markdown to read, the same way a card body is.
- Everything here is read-only. Memory is plain text the user owns, like their code, and a
  text box in the board is no better than the editor they already have. You read a wrong
  line here and fix it there.
- Each section has a small "more" menu with two items: **Copy path** and **Copy relative
  path**. That is how you get from a wrong line to the file that holds it — paste the path
  into your editor, or hand it to your coding agent and tell it what to change. The board
  does not open the file for you.
- A module with no memory folder yet says so plainly, and so does a file that isn't there.
- No agent run starts from this view. Compressing memory stays a flow you ask for.

## What the user does
- Opens Memory and reads what the agent decided, so the last three proposals stop looking
  arbitrary.
- Finds a settled decision that no longer holds, copies that file's path from the section
  menu, and gives it to their coding agent — or opens it in their editor — to fix the line.

## Decided by the agent
- One view for every scope, or one view per module? One view with a scope picker. Propose
  already works one module at a time, so the picker matches how memory is used.
- Add a button that asks the agent to compress memory? No. That rewrites what you wrote,
  and this card is about reading memory.
- Does a read-only view still show the goal? Yes, in the project scope. Reading it beside
  the memory is the point; the goal bar stays the only place the UI writes `goal.md`.
- Its own page or a dialog? A dialog from the header, like Daily progress and Runs.
- What do the two copy items copy? "Copy relative path" copies the path from the repo root,
  e.g. `docs/kanban/memory/local-ui/decisions.md` — the form you paste to an agent working
  in that repo. "Copy path" copies the full path on disk.
- Does the goal section get the menu too? Yes. Every section that shows a file has it.
- One scroll of sections, or tabs and a file list? One scroll. A scope is four short files,
  and a second switcher beside the scope chips is chrome the content does not need.
- Does a long file collapse to its headings? No, every section shows its whole file. Memory
  is one line per entry, the longest file on this board is 128 lines, and half of them have
  no headings to collapse to.
- Does the view remember the last scope you read? No, it opens on the project every time.
  The only view choice the UI remembers is the board layout; a chip inside a dialog is not
  that, and a remembered module goes stale the day you drop it from the map.
- Can you open a module's memory from a card that names it? No. The header button is the
  one way in. The module chips on a card stay read-only text, and memory belongs to a
  module, not to the card you happen to be reading.

## Todo
- [ ] Add the Memory button to the header and the view it opens.
- [ ] Show the project's four memory files, plus the goal, rendered as markdown.
- [ ] Add the scope chips and show a module's four files.
- [ ] Handle a module with no memory folder yet, and a file that does not exist.
- [ ] Give each section a "more" menu with Copy path and Copy relative path, and show that
      the copy worked.
- [ ] Update `kanban-ui/README.md` to describe the Memory view.
- [ ] Open the UI, switch between the project and a module, and check each file reads the
      same as it does on disk.
