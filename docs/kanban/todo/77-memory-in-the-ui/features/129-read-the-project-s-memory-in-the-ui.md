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

Add a Memory panel at the bottom of the rail — the strip down the left of the window that
lists the cards you have open — so you can read what the agent remembers about the project:
what shipped, what was settled, what was turned down, without opening files in an editor.

Part of #77.

## Today
- Every proposal is judged against memory, every answer the agent settles by itself leans
  on it, and every idea you turned down stays turned down because it is written there.
- None of it is on screen. A wrong line in `decisions.md` keeps steering every future card,
  and nobody notices until a card comes back wrong.

## Scope
- **A Memory panel at the bottom of the rail**, below the open cards. It stays put while
  the cards above it scroll.
- **Collapsed by default**: one row — an arrow and the word Memory, styled like the rail's
  other section labels.
- **The whole row is the button**, and it can be reached and opened from the keyboard.
- **Expanding turns the arrow down and shows the rows.** The panel is as tall as its rows
  need, up to half the rail; past that it scrolls on its own.
- **The panel remembers whether it was left open**, the same way the rail remembers the
  width it was dragged to.
- **Four rows, in this order**: what shipped, settled decisions, design mistakes, rejected
  ideas.
- **Hovering a row names the file it opens**, e.g. `docs/kanban/memory/decisions.md`.
- **Clicking a row opens that file in the body** — the wide area to the right, where a card
  is drawn.
- **The open file's row is highlighted**, the same way the row of the card you are on is.
- **An open memory file is a page of its own.** It has its own address, so Back, Forward
  and a reload all keep you on it, the way they keep you on a card.
- **A two-finger swipe goes back from a memory page in the desktop app**, as it does from a
  card page.
- **Landing on a memory file opens the panel**, whatever it was left at, so the highlighted
  row is on screen however you got there — a reload, Back, a pasted address.
- **The body shows the row's name as the heading** — Settled decisions — with the file's
  path from the repo root under it.
- **Under that, the whole file**, rendered as markdown the same way a card body is.
- **The body keeps up with the file on its own.** It re-reads when a run finishes and when
  you come back to the window, the same way a card page does.
- **A file that has not been written keeps its row** and says so plainly when opened.
- **Copy the path from the body**: a small "more" menu with **Copy path** and **Copy
  relative path**, and it says when the copy worked.
- **The board never opens the file for you.** Reading and copying the path is all it does.
- **Everything is read-only.**
- **On a phone-width window the rail is hidden, and memory goes with it** — like the rail's
  search box. A memory file you are already on still reads; there is no panel to open.
- **The goal is not in this panel.** It keeps the header button it has today.
- **No agent run starts from here.**

## What the user does
- Opens Memory from the rail and reads what the agent decided, so the last three proposals
  stop looking arbitrary.
- Leaves it open while working through cards, and jumps between a card and a memory file
  by clicking rows in the same rail.
- Finds a settled decision that no longer holds, copies that file's path, and gives it to
  their coding agent — or opens it in their editor — to fix the line.

## Todo
- [ ] Add the Memory panel to the bottom of the rail: collapsed by default, expandable,
      and remembering whether it was left open.
- [ ] List the project's four memory files as rows, in order.
- [ ] Open a file in the body when its row is clicked, and highlight that row while it is
      open.
- [ ] Show the file whole, rendered as markdown, headed by the row's name and the file's
      repo-relative path.
- [ ] Say so plainly when a file has not been written yet.
- [ ] Give the body a "more" menu with Copy path and Copy relative path, and show that the
      copy worked.
- [ ] Give an open memory file its own address, so Back, Forward and a reload keep you on
      it.
- [ ] Open the panel by itself when the page is a memory file, so the highlighted row is on
      screen after a reload.
- [ ] Re-read the open file when a run finishes and when the window is focused again.
- [ ] Let the desktop app's two-finger swipe go back from a memory page.
- [ ] Describe the Memory panel in `kanban-ui/README.md`.
- [ ] Open the UI and check each file reads the same as it does on disk.
- [ ] Open a memory file, have an agent run rewrite it, and check the body catches up
      without clicking the row again.

## Decided by the agent
- **Is an open memory file a page of its own, or a view forgotten on reload?** A page. The
  rail highlights a row from the address you are on, so a view with no address could not be
  highlighted at all, and Back would step over the file you were reading.
- **An unwritten file keeps its row.** The four rows then never change shape from one board
  to the next, so the panel reads the same everywhere.
- **Does the body update on its own when a run rewrites the file?** Yes, on the same two
  triggers a card page uses: a run finishing, and the window being focused again. The app
  has no file watcher, so a file the user edits themselves also catches up when they come
  back to the window. Asking them to click the row again would leave one page in the app
  that goes stale.
- **The desktop swipe covers a memory page.** It was left off the board because the board's
  columns scroll sideways and would fight it. Nothing on a memory page scrolls sideways, so
  the reason does not apply and back is what the gesture means there.
- **The row's name is the heading, not the file name.** The panel calls the row Settled
  decisions, and a body headed `decisions.md` would read as a different thing. The path
  under it carries the file name anyway.
- **The file opens in the body, not inside the panel.** A rail row is a couple of hundred
  pixels wide and these files run close to 200 lines.
- **Half the rail is the panel's ceiling.** A panel that can grow to fill the rail hides
  the cards you were reading, and one hard cap needs no second rule about a minimum
  card list.
- **What the two copy items copy.** "Copy relative path" copies the path from the repo
  root, e.g. `docs/kanban/memory/decisions.md` — the form you paste to an agent working in
  that repo. "Copy path" copies the full path on disk. Pasting a path is how the user gets
  from a wrong line to the file that holds it.
- **No collapsing long files to their headings.** Memory is one line per entry, the longest
  file on this board is close to 200 lines, and half of them have no headings to collapse
  to.
