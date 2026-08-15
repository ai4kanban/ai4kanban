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

Let the user read what the agent remembers — what shipped, what was settled, what was
turned down — without opening files in an editor. Memory gets a foldable panel at the
bottom of the rail: the strip down the left of the window that lists the cards you have
open. This is a group task; each piece is its own subtask in this folder.

## Today
- Memory is what makes the board self-evolving. Every proposal is judged against it, every
  answer the agent settles by itself leans on it, and every idea you turned down stays
  turned down because it is written there.
- The UI shows none of it but the goal. The rest of memory has never been on screen.
- So the agent's memory is invisible to the person it works for. A wrong line in
  `decisions.md` keeps steering every future card, and nobody notices until a card comes
  back wrong.

## Scope
- A **Memory** panel pinned to the bottom of the rail, collapsed by default.
- The panel lists memory files as rows. Clicking one opens that file in the body — the wide
  area to the right, where a card is drawn.
- An open memory file is a page of its own, the way a card is.
- The project's four memory files — what shipped, settled decisions, design mistakes,
  rejected ideas (#129).
- Then one expandable row per module, holding that module's four files (#130).
- Memory is read-only in the UI.
- The goal keeps its own header button and gets no row in the panel.
- Memory is the only panel the rail gets. Runs and Daily progress stay in the dialogs their
  header buttons open today.
- No agent run starts from any of this.

## What the user does
- Glances at the rail and opens what the agent decided, so the last three proposals stop
  looking arbitrary.
- Keeps a memory file open beside the cards they are reading, and switches back to a card
  by clicking its row.

## Todo
- [x] Open the whole goal from a header button #128
- [ ] Read the project's four memory files #129
- [ ] Read a module's four memory files #130

## Decided by the agent
- **The rail, not another header dialog.** A dialog covers the board you were reading and
  closes the moment you look away. Memory is read beside cards, not instead of them, and
  the rail is on screen the whole time.
- **The file opens in the body, not inside the rail.** The rail is a couple of hundred
  pixels wide and the longest memory file on this board is close to 200 lines. The body is
  the widest surface and the one that scrolls.
- **Read-only.** Memory is plain text the user owns, like their code, and a text box in the
  board is no better than the editor they already have. The goal is the exception — it is
  the user's own words, and the header button that writes it is already shipped.
- **No button that asks the agent to compress memory.** That rewrites what the user wrote,
  and this group is about reading.
