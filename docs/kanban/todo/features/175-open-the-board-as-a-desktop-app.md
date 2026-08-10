---
title: Open the board as a desktop app
track: features
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: []
related: [171, 177]
modules: [local-ui]
questions: []
---

The board only exists while a terminal is running a command, in a tab next to everything else. Ship it as an app you open, so the person making the calls does not have to keep a terminal alive to make them.

## Scope
- A downloadable app that opens the board. Nothing to install first — no Node, no npx, no
  terminal. Starting runs still needs your coding agent on the machine, same as today.
- The app finds your coding agent the way a terminal would, though nothing here was started
  from one. An agent installed in the normal place must not look missing. When it really
  isn't installed, the app names the command it looked for and how to get it.
- macOS, Windows and Linux all ship in this release, from one place to download.
- The Mac app is signed, so it opens with a double-click and no warning. Windows and Linux
  ship unsigned this release, and the download page says in one short step how to open
  them past the warning.
- It asks which repo to open the first time, remembers it, and lets the user switch to
  another one. Pick a folder with no board and it lands on the same make-a-board screen the
  browser shows, so the app is a fine place to start a project from nothing.
- Everything the browser version does, it does — including starting runs and watching their
  logs.
- Closing the window ends the board cleanly; nothing is left running behind the user's
  back.
- Wherever we tell people to open the board, the download is there — with which systems we
  tested and how to open the unsigned ones.
- It says when a newer version is out and where to get it, and never updates itself.

## Decided by the agent
- **How it is built**: Electron. The board is already a Node server behind a web page, and
  Electron carries both and builds all three systems from one config.
- **Where the download lives**: on the GitHub release for the version tag we already push.
  Homebrew can come later; npx is not a way to get the app.
- **Which builds ship**: macOS for Apple Silicon and Intel, Windows, and Linux as a
  single-file AppImage. macOS is the one we test this release — Windows and Linux are built
  and published untested, and the download page says so.
- **`npx ai4kanban-ui`**: stays published and keeps working, because pulling it would break
  the people already on it. Nothing advertises it as the way in any more.
- **Finding the agent**: the app reads the user's own login shell environment at startup
  and runs with it, rather than shipping a list of folders to guess at. A shell tells us
  where the agent is; a guess goes stale the day someone changes how they install things.
- **Switching repo is not a project list**: the app remembers the last folder it opened and
  nothing else, and shows one board at a time. We turned down a project switcher before;
  this is only how you point a window with no terminal at a folder.

## Todo
- [ ] Open the board in an app window, with the repo picked on first launch and
      remembered after.
- [ ] Let the user switch repo from inside the app.
- [ ] Make runs find the coding agent when the app was opened from the Dock, and say what
      is missing when it really isn't installed. Check it by opening the app from the Dock
      on a machine where the agent is installed under the user's home folder.
- [ ] Make closing the window end everything the app started.
- [ ] Tell the user when a newer version is out, and link to the download.
- [ ] Buy the Apple developer account the Mac signing needs ($99 a year).
- [ ] Build the app for all three systems, and check a run works end to end on macOS.
- [ ] Sign the Mac build so a fresh download opens with no warning, and check that on a
      machine that has never run the app.
- [ ] Publish the downloads with the release, and add how the app ships and gets signed to
      `PUBLISHING.md`.
- [ ] Add the download to the README and the site, say which systems are tested, and show
      how to open the unsigned Windows and Linux builds.
- [ ] Update the UI's README so getting the app is the first step.
