---
title: Read the board's memory in the UI
track: features
priority: med
roi: high
status: ready
release: 0.6.1
blocked_by: []
related: [129, 130]
modules: [local-ui]
questions: []
---

Let the user read what the agent remembers — the goal it plans against, what shipped, what
was settled, what was turned down — without opening files in an editor. This is a group
task; each piece is its own subtask in this folder.

## Today
- Memory is what makes the board self-evolving. Every proposal is judged against it, every
  auto-refine answer leans on it, and every idea you turned down stays turned down because
  it is written there.
- The UI shows none of it. `goal.md` shows up only while the agent judges the goal weak —
  once the goal reads fine, it drops off the board and there is no way back to it.
- So the agent's memory is invisible to the person it works for. A wrong line in
  `decisions.md` keeps steering every future card, and nobody notices until a card comes
  back wrong.

## Scope
- A quiet icon in the header opens the whole goal, and lets the user edit it. Shipped.
- The four project-wide memory files, read in the UI — what shipped, settled decisions,
  design mistakes, rejected ideas (#129).
- The same four files per module, picked from a row of scope chips (#130).
- Order: #129 next, then #130.
- Memory is read-only in the UI. You read a wrong line here and fix it in your own editor.
  The goal is the exception — it is the user's own words, and the UI already writes it.
- No agent run starts from any of this. Compressing memory stays a flow you ask for.

## What the user does
- Glances up from the board and remembers where the project is headed.
- Reads what the agent decided, so the last three proposals stop looking arbitrary.
- Finds a settled decision that no longer holds, copies that file's path, and gives it to
  their coding agent — or opens it in their editor — to fix the line.

## Todo
- [x] Open the whole goal from a header button #128
- [ ] Read the project's four memory files #129
- [ ] Read a module's four memory files #130

## Decided by the agent
- **The goal gets its own place, not a section inside the memory view.** It is one file,
  it is read far more often than the rest, and it is the only one the UI writes. Two
  renderers for one file buy nothing, so #129 shows the four memory files and the goal
  line owns the goal.
- **The goal ships first and alone.** It is a small piece of work against a file every
  board has, while the memory view is a dialog with scopes and empty states. Shipping the
  goal first puts the direction back on screen without waiting for the rest.
