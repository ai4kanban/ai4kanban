---
title: Install the Mac app with one Homebrew command
priority: low
roi: med
status: ready
release: ""
blocked_by: [182]
related: []
modules: [local-ui]
questions: []
---

Getting the Mac app today means finding the download page, picking the right file, and
dragging it into Applications. Let a Mac user install it with one command instead, and get
new versions the same way.

## Scope
- `brew install --cask ai4kanban/tap/ai4kanban` installs the app on a Mac that has never
  had it. It lands in Applications and opens with a double-click.
- `brew upgrade` moves the app to a newer version, so a user who installed this way never
  goes back to the download page.
- `brew uninstall --cask ai4kanban` removes the app.
- Both Apple Silicon and Intel Macs get the right build from the same command.
- Publishing a release adds the new version to the tap. Nobody should have to remember a
  hand-written step after a release, or the tap goes stale and Homebrew users sit on an old
  app.
- The download page and the READMEs offer the Homebrew command as the first way in for a
  Mac, with the direct download kept right below it for people who don't use Homebrew.
- Windows and Linux are out of scope. Their own package managers are a separate call, made
  when users ask.

## Decided by the agent
- **Our own tap, not the main Homebrew cask list**: the official list only takes projects
  past a popularity bar and reviews every change. A tap we own — the `homebrew-tap` repo
  under the `ai4kanban` org — works from day one and we publish to it ourselves. Moving to
  the official list later is a follow-up, once the project is well known enough to qualify.
- **The app does not need to know it came from Homebrew**: the "a newer version is out" line
  already points at the download page, and that page tells a Homebrew user to run
  `brew upgrade` next to the direct download. One page answers both, so the app carries no
  extra logic.
- **After the Mac build is signed (#182)**: Homebrew's promise is that one command gets you
  a working app. An unsigned app installed this way still stops with a warning the user has
  to click past in System Settings, which is worse than the download page, since the page at
  least explains the steps.

## Todo
- [ ] Create the tap repo and publish the app there, so one Homebrew command installs it on
      a Mac.
- [ ] Check it the way a user meets it: on a Mac that has never had the app, install with
      the command, open the app, and start a run end to end.
- [ ] Make a release update the tap on its own, and check that a release with no extra
      manual step leaves Homebrew users on the newest version.
- [ ] Check that upgrading and removing the app both work from Homebrew.
- [ ] Put the Homebrew command on the download page in all five languages, in `README.md`
      and `README-zh.md`, with the direct download kept below it.
- [ ] Add the tap to `PUBLISHING.md` — what it is, where it lives, and what a release does
      to it.
