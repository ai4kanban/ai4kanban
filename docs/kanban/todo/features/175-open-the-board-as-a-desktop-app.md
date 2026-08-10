---
title: Open the board as a desktop app
track: features
priority: high
roi: high
status: todo
release: 0.6.0
blocked_by: []
related: [171, 177]
modules: [local-ui]
questions:
  - Does a signed and notarized Mac build still reach the coding agent's saved login? The unsigned build does — a Dock launch passed Test Connection in 6.2s. Claude Code keeps its login in the macOS keychain, and a keychain item is tied to the signing identity, so the first signed build has to be checked against a real run before it is handed out.
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
- It asks which repo to open the first time and remembers it, so the app reopens where the
  user left off. Opening and switching between several projects is #178.
- Everything the board does today, the app does — including starting runs and watching
  their logs.
- The app is the only way in we hand out. Starting the board yourself and opening it in a
  browser — `npx ai4kanban-ui` — is deprecated the day the app ships: it keeps working for
  the people already on it, but it says out loud that it is deprecated, and nothing new is
  built for it.
- The pages themselves stay — the app is those same pages in a window, and reaching the
  board from another device still needs them. What is deprecated is asking a person to
  start a server and open a browser.
- Closing the window ends the board cleanly; nothing is left running behind the user's
  back.
- Wherever we tell people to open the board, the download is there — with which systems we
  tested and how to open the unsigned ones — and the old browser way is marked deprecated
  in the same breath.
- It says when a newer version is out and where to get it, and never updates itself.

## Decided by the agent
- **How it is built**: Electron. The board is already a Node server behind a web page, and
  Electron carries both and builds all three systems from one config.
- **Where the download lives**: on the GitHub release for the version tag we already push.
  Homebrew can come later.
- **Which builds ship**: macOS for Apple Silicon and Intel, Windows, and Linux as a
  single-file AppImage. macOS is the one we test this release — Windows and Linux are built
  and published untested, and the download page says so.
- **What deprecating `npx ai4kanban-ui` means**: marked deprecated on npm and frozen at its
  last version. Installing or running it warns and points at the app; the page it serves
  says the same. It is not pulled, so a board someone opens tomorrow still works — but no
  release lands there again.
- **Why it is deprecated now, with Windows and Linux untested**: keeping a second way in
  alive as a safety net is how we end up with two things to teach and two to maintain. An
  app build that doesn't open on Windows or Linux is a bug to fix on the app; until it is
  fixed the frozen package is still installable for anyone stuck.
- **Finding the agent**: the app reads the user's own login shell environment at startup
  and runs with it, rather than shipping a list of folders to guess at. A shell tells us
  where the agent is; a guess goes stale the day someone changes how they install things.
- **What this card owns about folders**: pointing the window at one repo and reopening it
  next time. The app shows one board at a time; keeping a list of projects and moving
  between them is #178.
- **Where the download page lives**: `ai4kanban.dev/download`, in all five languages. One
  page says which builds are signed and tested and how to get past each system's warning,
  and everything that hands out the board — the READMEs, the skill, the CLI, the board's
  own deprecation line — points at it rather than repeating it.
- **What the app adds to the board, and nothing else**: which project is open, finding the
  agent, ending cleanly, and saying a newer version is out. The rest is the board UI
  itself, carried inside the app, so a fix there is a fix here and neither can drift.
- **The app picks its own port**: the board runs on a loopback port the system hands out,
  so a board someone already has open in a terminal never clashes with the app's.
- **Where the user is told about a newer version**: a line above the board, not a dialog on
  launch, with a ✕ that stops it mentioning that version again. An app that never updates
  itself has no reason to interrupt.

## Todo
- [x] Open the board in an app window, with the repo picked on first launch and
      remembered after.
- [x] Let the user switch repo from inside the app.
- [x] Make runs find the coding agent when the app was opened from the Dock, and say what
      is missing when it really isn't installed. Check it by opening the app from the Dock
      on a machine where the agent is installed under the user's home folder.
- [x] Make closing the window end everything the app started.
- [x] Tell the user when a newer version is out, and link to the download.
- [ ] Buy the Apple developer account the Mac signing needs ($99 a year).
- [ ] Build the app for all three systems, and check a run works end to end on macOS.
- [ ] Sign the Mac build so a fresh download opens with no warning, and check that on a
      machine that has never run the app.
- [x] Say in the board served in a browser that this way is deprecated, and where to get
      the app instead.
- [ ] Mark the npm package deprecated, so installing or running it prints where to get the
      app, and stop shipping releases to it.
- [x] Write in `PUBLISHING.md` how the app ships, how it gets signed, and that the npm
      package is frozen.
- [ ] Publish the downloads with the release.
- [x] Add the download to the README and the site, say which systems are tested, and show
      how to open the unsigned Windows and Linux builds.
- [x] Mark the browser way deprecated everywhere it is taught — `README.md`, `README-zh.md`,
      the guides, the site, the UI's own README, and the skill's setup and install pages —
      with getting the app as the first step.
