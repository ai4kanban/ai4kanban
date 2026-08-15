---
title: Read the project's memory in the UI
track: features
priority: med
roi: high
status: ready
release: 0.6.1
blocked_by: []
related: [77]
modules: [local-ui]
questions: []
---

Add a Memory view, so you can read what the agent remembers about the project — what
shipped, what was settled, what was turned down — without opening files in an editor.

Part of #77.

## Today
- Every proposal is judged against memory, every auto-refine answer leans on it, and every
  idea you turned down stays turned down because it is written there.
- None of it is on screen. A wrong line in `decisions.md` keeps steering every future card,
  and nobody notices until a card comes back wrong.

## Scope
- A Memory button in the header, next to Daily progress, Runs and the gear. It opens a
  dialog.
- The dialog shows the project's four memory files as sections, in this order: what
  shipped, settled decisions, design mistakes, rejected ideas. One scroll, no tabs.
- A section header names its file and sticks to the top while you scroll that section, so
  you always know which file you are reading.
- Files are rendered as markdown, the same way a card body is. Every file is shown whole.
- A file that isn't there says so plainly.
- Everything is read-only. Memory is plain text the user owns, like their code, and a text
  box in the board is no better than the editor they already have. You read a wrong line
  here and fix it there.
- Each section has a small "more" menu with two items: **Copy path** and **Copy relative
  path**, and it says when the copy worked. That is how you get from a wrong line to the
  file that holds it — paste the path into your editor, or hand it to your coding agent
  and tell it what to change. The board does not open the file for you.
- The goal is not in this view. It already has its own button in the header, which opens
  the whole file and lets the user edit it.
- No agent run starts from here. Compressing memory stays a flow you ask for.

## What the user does
- Opens Memory and reads what the agent decided, so the last three proposals stop looking
  arbitrary.
- Finds a settled decision that no longer holds, copies that file's path from the section
  menu, and gives it to their coding agent — or opens it in their editor — to fix the line.

## Todo
- [ ] Add the Memory button to the header and the dialog it opens.
- [ ] Show the project's four memory files as sections, rendered as markdown, with sticky
      section headers.
- [ ] Say so plainly when a file is not there.
- [ ] Give each section a "more" menu with Copy path and Copy relative path, and show that
      the copy worked.
- [ ] Describe the Memory view in `kanban-ui/README.md`.
- [ ] Open the UI and check each file reads the same as it does on disk.

## Decided by the agent
- **A dialog, not a page.** Like Daily progress and Runs.
- **What the two copy items copy.** "Copy relative path" copies the path from the repo
  root, e.g. `docs/kanban/memory/decisions.md` — the form you paste to an agent working in
  that repo. "Copy path" copies the full path on disk.
- **No collapsing long files to their headings.** Memory is one line per entry, the longest
  file on this board is about 200 lines, and half of them have no headings to collapse to.
- **No button that asks the agent to compress memory.** That rewrites what you wrote, and
  this card is about reading.
