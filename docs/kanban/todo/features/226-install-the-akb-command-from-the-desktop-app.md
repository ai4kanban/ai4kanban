---
title: Install the akb command from the desktop app
track: features
priority: med
roi: high
status: todo
release: 0.6.1
blocked_by: []
related: []
modules: [local-ui, skill]
questions: []
---
A desktop user has no `akb` on their PATH, so the note the app writes for a coding agent
names the copy of the command buried inside the app instead — a
`node /Applications/AI4Kanban.app/…/ai4kanban.mjs` line. That needs Node, which is the very
thing the app saves the user from installing. Do what Cursor does for its own `cursor`
command: the app already carries the command, and installing only points the system at it.

## Scope
- The command lives inside the app package, as a small launcher script.
- Installing writes one symlink — a file that only points at another file — named `akb`,
  pointing at that launcher.
- The symlink goes in the first of the user's own bin folders that the PATH already
  reads: `~/.local/bin`, then `~/bin`. Writing there needs no password.
- When the PATH reads neither, it goes at `/usr/local/bin/akb`.
- The install never edits a shell startup file to put a folder on the PATH.
- Nothing is copied out of the app.
- Updating the app updates the command.
- The Skill pane says the command updates with the app.
- The install creates the folder it writes into when that folder isn't on disk.
- The app asks for the administrator password with the system's own dialog only when the
  folder needs one — that is `/usr/local/bin`, never a folder of the user's own.
- The pane and the first-launch offer mention the password only when it will be asked.
- The command works wherever the app lives, not only in Applications.
- The command works on a machine that has no Node of its own.
- `akb runs`, `akb help` and every other action behave exactly as they do when `akb` comes
  from npm.
- Typed with no action at all, it opens the app.
- It opens the app on the current folder when that folder has a board.
- Otherwise it opens the app on the project the app had open last.
- The app refuses to install while it is running from a place it won't be next time: a
  disk image, the Downloads folder, or the temporary copy macOS runs an app from when it
  was never moved out of Downloads.
- It then says to move AI4Kanban into Applications first.
- Linux gets no button at all.
- The Linux pane keeps the `npm install -g ai4kanban@latest` line a browser gets.
- Windows gets no symlink.
- On Windows the installer puts the app's own `bin` folder, which holds `akb.cmd`, on the
  user's PATH.
- Uninstalling the app on Windows takes that folder off the PATH again.
- The Windows button repairs that PATH entry when it has gone missing.
- The Windows pane says a new PATH entry only reaches terminals opened after it.
- When writing needs no password, the app installs the command on its own at the first
  launch that finds no `akb` on the PATH — no dialog, the way Cursor's command appears.
- A link of ours that has stopped working is repaired the same silent way when no
  password is needed.
- Only a write that needs the administrator password is offered as a dialog first.
- That happens as soon as the board is on screen — install and offer alike.
- It never waits for the user to press something else first.
- Someone updating from an older app that never installed it gets the same first launch.
- Declining the dialog leaves a button in the Skill pane in Configuration, next to the one
  that adds the skill: **Install the `akb` command**.
- After a decline, the offer comes back only when an `akb` this app installed stops
  working.
- The button shows only in the app.
- In a browser the Skill pane keeps the `npm install -g ai4kanban@latest` line it gives
  the user today.
- Before the press, the pane names the path the button would write.
- The pane says which of these this machine is: nothing installed; installed at `<path>`;
  installed but pointing at an app that is no longer there; or that path is held by an
  `akb` the app didn't put there.
- The button only ever replaces a symlink pointing at an AI4Kanban app.
- When anything else holds that path, the button is switched off.
- The pane then names what is holding that path.
- When that path is `/usr/local/bin/akb`, it says there that an `akb` installed from npm
  lands at that same path.
- An install that already exists — working or pointing at an app that is gone — is
  reported and rewritten at its own path, even when a preferred folder has since appeared.
- When another `akb` comes earlier on the PATH than ours, the pane says which one runs.
- Move or delete the app and the command stops working: the shell says "no such file".
- The app adds no message of its own to that.
- The next launch of the app spots that dead symlink and offers the install again.
- After an install that worked, the app rewrites the open project's skill note so the
  command it hands a coding agent is `akb`.
- It rewrites that note only after checking that the installed `akb` answers.
- The Skill pane's paragraph about `npm install -g ai4kanban@latest` points at the button
  first.
- It keeps that typed line for the two cases the button can't fix: the board in a browser,
  and an `akb` that came from somewhere else.

## Decided by the agent
- **Copy Cursor's mechanics**: `/usr/local/bin/cursor` is a symlink to a script inside
  `Cursor.app` that runs the app's own binary as Node. `akb` copies it.
- **A symlink, not a copied script**: nothing outside the app can go stale, so an app
  update is the whole update and no second press is ever needed.
- **A user-owned folder first**: the user chose no password over Cursor's way. A folder the
  PATH already reads needs no shell file edited, and `/usr/local/bin` stays as the fallback
  so every machine still gets the command. The dialog is the system's; the app never runs
  as root itself.
- **A repair goes where the link is**: rewriting a dead link at its own path means a
  preferred folder appearing later never strands an old install.
- **One rule for refusing, not a list of folders**: a symlink is only as good as the path
  it points at, and that one rule covers the disk image, Downloads and Linux at once.
- **Linux gets no button**: the Linux build is an AppImage — one file that unpacks itself
  into a new temporary folder every run — so there is no lasting path to point at.
- **First launch is when it happens**: the user wanted the command there from the moment
  the app is installed, but dragging an app out of a disk image runs no code of ours — the
  first open is the earliest moment there is. With no password to ask for, there is
  nothing to ask, so it just installs.
- **The install waits for the board to be on screen**: it is still the first launch's
  move, and the one dialog that can remain — the password offer — would look like it came
  from nowhere with no window behind it.
- **Chromium retells a second launch's arguments**: switches reach the running app
  reordered and split from their values, so the folder `akb` was typed in rides on the
  single-instance lock's data and is never parsed from the second-instance `argv`.
- **Typed alone, it opens the current folder**: `code` and `cursor` open the folder you
  are standing in, and someone typing `akb` in a project means that project.
- **A dead command gives the shell's own error**: a symlink can't print a friendly
  message, and Cursor lives with the same.
- **An `akb` from npm still prints help when typed alone**: it has no app to open.
- **Two buttons, not one**: the button that adds the skill writes in the repo, this one
  writes outside it. Pressing them in either order works.
- **Only the open project's note is rewritten**: writing in a repo nobody is looking at is
  not ours to do. Other projects get `akb` the next time their skill is added or
  refreshed.
- **No Remove button**: the command is one symlink and the pane names its path, so
  deleting it is a one-line job for the user.
- **The app's own Node runs it**: the machine still needs no Node of its own, which is the
  whole promise of the app.
- **The guided first run and the setup strip need no change**: they ask the board what the
  command is called, so they say `akb` on their own once it is on the PATH.
- **macOS is the one we test**: Windows ships untested, the same as the app itself.
- **The launcher says how it was typed**: it passes `AI4KANBAN_COMMAND=akb` to the command
  inside the app, so what the command prints back can be pasted into the same terminal
  rather than naming the copy buried in the app bundle.
- **Opening the app clears `ELECTRON_RUN_AS_NODE`**: a shell that already exports it — the
  app's own `npm start` does — would otherwise start the app as a bare Node process and no
  window would ever appear.
- **A new command, `akb skill refresh`**: rewrites a skill that is already in a project and
  writes none that isn't. The app runs it after an install; `skill install` would have given
  a project a skill it never asked for.
- **One piece of code edits the Windows PATH**: the installer, the uninstaller and the
  repair button all run the same script, so the three can't disagree.
- **The offer asks once per breakage**: a dead link that the user declines to repair doesn't
  ask again every launch. A launch that finds `akb` working again forgets it, so a later
  break is asked about afresh.
- **A skill note names the command this machine has**: `skill/SKILL.md` carries the markers
  the installer swaps, so a note written after an install says `akb` instead of the general
  answer.

## Todo
- [x] Write the launcher inside the app: it finds its own app, runs the bundled command
      with the app's own Node, passes every argument through, and opens the app when typed
      alone — on the current folder when that folder has a board.
- [x] Add the Windows `akb.cmd`, and have the Windows installer put the app's `bin` folder
      on the user's PATH.
- [x] Write the install: the `/usr/local/bin/akb` symlink, the folder when it isn't there,
      the password dialog when it is needed, and the refusal from an app whose own path
      won't last.
- [x] Add the first-launch offer, and the button and its four states to the Skill pane.
- [x] Have a launch spot a symlink pointing at an app that is gone, and offer the install
      again.
- [x] Read the PATH again after a press, so the notice about a missing or old `akb` goes
      once the command is in, and so the pane can say when another `akb` comes first.
- [x] Rewrite the open project's skill note after an install that worked, so it names
      `akb`.
- [x] Rewrite the paragraph under the Skill button that hands over a command to type, so
      it points at the button first and keeps the typed line only for what a press can't
      fix.
- [x] Check the password path on a packaged app on a Mac with no `akb`: the first-launch
      offer appeared over the board, the password dialog named the app and the path, the
      symlink landed at `/usr/local/bin/akb`, and `akb version` answered in a terminal
      that was already open.
- [x] Fix `akb` typed alone not opening the app on the folder it was typed in: the folder
      now rides on the single-instance lock's data instead of being parsed from the
      second-instance arguments, which Chromium reorders.
- [x] Say in `kanban-ui/README.md`, `desktop/README.md`, and on the download page in all
      five languages, that the app installs the command.
- [x] Write the symlink into the first of the user's own bin folders the PATH already
      reads (`~/.local/bin`, then `~/bin`) with no password, keeping `/usr/local/bin` and
      the password dialog for machines without one. The offer and the pane mention the
      password only when it will be asked, keep the npm note only for `/usr/local/bin`,
      and repair an existing link at its own path.
- [x] Install without asking when no password is needed: the first launch that finds no
      `akb` writes the user-folder symlink on its own, with no dialog, and repairs a dead
      link of ours the same way. Only the `/usr/local/bin` password case still asks.
- [x] Check on a real build that `akb` typed alone opens the app on the folder it was
      typed in — proven both ways between two projects — and that a coding agent drives a
      board through the installed `akb` (`akb runs`, `akb agent` answered against another
      project's board).
- [x] Check what is still unproven on a real build: the silent user-folder install on a
      machine with no `akb` (delete the old `/usr/local/bin/akb` first, then reopen the
      app), the skill note rewritten to `akb` in a project whose skill is a real folder
      rather than this repo's symlink to the source, and the pane's dangling and foreign
      lines. All proven: the launch wrote `~/.local/bin/akb` with no dialog, rewrote both
      skill notes of the open project to `akb`, repaired a dead link of ours silently on
      the next launch, and the pane showed the dangling line with a working Repair button
      and the foreign line with the button switched off.
- [x] Capitalize the two blocked reasons that started lowercase ("This is a build from
      source…", "The Linux build…") — they double as the pane's headline.

## Pushback
On a machine where the PATH reads none of the user's own bin folders, the password dialog
remains, and some users won't type an administrator password into an app they just
downloaded — this release the app is still unsigned. They can decline — the npm line still
works, and the offer doesn't come back until the command breaks.
