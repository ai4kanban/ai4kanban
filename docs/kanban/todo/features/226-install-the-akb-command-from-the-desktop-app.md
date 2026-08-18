---
title: Install the akb command from the desktop app
track: features
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [local-ui, skill]
questions:
  - question: "[user] No folder the app can write to is already on your PATH. What should the button do then?"
    mode: single
    options:
      - write ~/.local/bin anyway, show the one line that adds it to your PATH, and say the command won't work until you add it and open a new terminal
      - add that line to your shell profile for you — the app still won't see the command until you restart it
      - don't offer the button on that machine, and keep the typed npm install -g line
    recommend: [1]
---

A desktop user has no `akb` on their PATH, so their coding agent falls back to a longer
command every time. Let the app put the real one there, from a button.

## Scope
- Add a button to the Skill pane in Configuration, beside the one that adds the skill:
  **Install the `akb` command**.
- One press writes a small file that runs the copy of the command bundled inside the app.
- The file runs with the Node bundled inside the app.
- The button shows only in the app.
- In a browser the Skill pane keeps the `npm install -g ai4kanban@latest` line it gives the
  user today.
- The file goes in a folder the app can write to without a password, that is already on the
  PATH the app read from the user's login shell.
- It tries `~/.local/bin`, then `~/bin`, then the first other folder on that PATH.
- It skips a folder that belongs to one version of a tool, such as a Node version manager's.
- It never writes to a system folder.
- The pane names the folder before the press.
- The pane says which of three states this machine is in: not installed, installed at
  `<path>`, or installed but naming a copy of the app that isn't there any more.
- Pressing the button again writes the file afresh.
- The file says inside it which app wrote it.
- The button replaces only a file it wrote itself.
- An `akb` installed some other way is left alone, and the pane names it.
- When such an `akb` comes earlier on the PATH than ours, the pane says which one runs.
- macOS and Linux get a small shell script; Windows gets an `akb.cmd`.
- On macOS the button refuses to write while the app is running from the disk image or from
  Downloads, and says to move AI4Kanban into Applications first.
- Move or delete the app and the command stops working.
- Run it then and it prints one line: the app was moved or removed, open AI4Kanban and press
  the button again.
- After an install that worked, rewrite this project's skill note so the command it tells a
  coding agent to type is `akb`.
- Rewrite it only once `akb` answers in the same environment the board starts its runs in.
- The block under the Skill button that gives the user `npm install -g ai4kanban@latest`
  offers the press first.
- It keeps the typed line for the two cases a press can't fix: the browser, and an
  out-of-date `akb` installed some other way.
- The pane says that a newer app brings a newer `akb` with it.

## Decided by the agent
- **Two buttons, not one**: adding the skill and installing the command stay separate
  presses — one writes in the repo, the other outside it. Installing the command rewrites a
  skill note that is already there, so nobody has to press both in order.
- **No Remove button**: the command is one file and the pane names its path, so deleting it
  is the user's job and a second button isn't worth the room.
- **Nothing checks or repairs itself when the app opens**: every write outside
  `docs/kanban/` on this board happens because the user pressed something, and this one
  stays that way.
- **The lines that hand a command to a coding agent need no change**: the guided first run
  and the board's setup bar already print a command name they read from the board, so they
  print `akb` by themselves once it is on the PATH.
- **Skip a folder that belongs to one version of a tool**: a command written into a Node
  version manager's folder is gone the day the user switches versions.
- **Refuse to write from the disk image or Downloads**: macOS runs an app opened from either
  place out of a temporary folder, so the file would name a path that disappears.
- **The app's own Node runs the file**: the machine still needs no Node of its own, which is
  the whole promise of the app.
- **macOS is the one we test**: Windows and Linux ship untested, the same as the app itself.
- **Say that a newer app brings a newer `akb`**: otherwise a user goes looking for an npm
  update that doesn't apply to them.

## Todo
- [ ] Write the file the button installs: it runs the bundled command with the app's own
      Node and passes its arguments through, with a marker inside naming the app that wrote
      it.
- [ ] Add the Windows `akb.cmd` beside the macOS and Linux script.
- [ ] Pick the folder it goes in, and refuse to write from a disk image or a Downloads copy.
- [ ] Give it its own message for when the app has been moved or removed.
- [ ] Add the button and its state to the Skill pane, with the folder named before the press
      and nothing shown outside the app.
- [ ] Read the `akb` on the PATH again after a press, so the "your `akb` is behind" block
      goes once the command is in, and say when another `akb` comes first.
- [ ] Rewrite the skill note after an install that worked, so it names `akb`.
- [ ] Re-write the block under the Skill button that names a command to type by hand, so it
      offers the press first and keeps the typed line only for what a press can't do.
- [ ] Check it the way a user meets it: on a Mac with no `akb`, press the button, run
      `akb version` in a new terminal, then drive the board from a coding agent.
- [ ] Say in `kanban-ui/README.md`, and on the download page in all five languages, that the
      app can install the command.

## Pushback
Only worth it if the press is genuinely enough on its own. On a machine where no folder the
app can write to is already on the PATH, it isn't.
