---
title: Make a board from the UI, with no command to type
track: features
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui, skill]
questions: []
---

Open the board on a repo that has none and it tells you to go back to a terminal and run an install command. That is the first thing a new user meets. Let them make the board right there, with a button.

## Scope
- On a repo with no board, the page offers to make one instead of naming a command to run.
- It says which folder it will create the board in, and lets the user point at another
  folder before pressing.
- A folder that already has a board is opened, not made again. That is also the answer to
  "this is not the repo you meant", which the page says today and has no button for.
- Pressing it creates the board and lands the user on it, ready for the next step. The
  board it makes is the same one the install command makes today.
- The UI makes the board itself, with nothing to fetch: it works offline, on a machine
  with no skill folder, and with no second terminal window.
- From then on the UI shows the board in the folder the user chose — one board at a time,
  and nothing about that choice is remembered once the UI stops.

## Decided by the agent
- Making a board from the UI was turned down before, on the grounds that the UI shows the
  instruction and the coding agent does the work. The 0.6.0 goal reverses that, so the UI
  makes the board itself.
- The new board gets the default tracks. Asking the user which tracks they want belongs to
  the guided first run (#172).
- The skill is not installed with the board. Adding it stays an optional step of its own
  (#174).
- **What makes the board?** The UI carries the board maker with it, so pressing the button
  downloads nothing and works with no network — the same has to hold in the desktop app
  (#175), which has no terminal to fall back on.
- **Which board does it drive after the user points at another folder?** That one. The
  running board follows the folder it just made or opened, and shows one board at a time —
  still no project list. Nothing about the choice is written down, so starting again from
  the old folder offers to make a board there, exactly as before.

## Todo
- [ ] Replace the "run this command" screen with a screen that offers to make the board.
- [ ] Show the folder the board will go in, and let the user change it.
- [ ] Ship the board maker with the UI, so the button works offline and on a repo with no
      skill folder.
- [ ] Make the board and open it, without a page the user has to reload by hand.
- [ ] Open the board instead when the folder already has one.
- [ ] Show the board in the folder the user chose, for as long as the UI runs.
- [ ] Say plainly what went wrong when the folder cannot be written.
- [ ] Try it with the network off, on an empty repo, on a repo that already has a board,
      and on a folder that is not a repo at all.
- [ ] Update the UI's README so the first step is opening the UI, and the install guide so
      it no longer says the UI needs a board already there.
