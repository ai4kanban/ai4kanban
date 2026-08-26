---
title: Remember which language the app and the agent work in
track: features
priority: med
roi: high
status: ready
release: 0.8.0
blocked_by: []
related: [332]
modules: [local-ui, skill]
questions: []
---


The app has no idea what language its user reads, so nothing else in this group can be
built. Hold one answer on the machine, offer a switcher that changes it, and make it
reachable everywhere it is needed — every screen the board UI draws, and the desktop menu
that lives outside the page. Translating those words is #336; carrying the answer into an
agent run is #337.

## Worth noting
- **Where does the switcher sit?**: a **Language** section in Configuration, below the
  divider beside Cloud — everything above that line settles this board, and this settles
  the machine. It is the wrong place for anyone who expects a language to be a board
  setting, which is exactly the point.
- **What does a project with older rules show?**: English. The board UI reads this setting
  through the project's own copy of the board's rules, so a project that has not updated
  draws in English until it does. Failing to draw instead would take the whole app down
  over a preference.

<!-- agent -->

## Scope
- **One file on the machine**: `~/.ai4kanban/settings.json`, beside the Cloud session and
  honouring `AI4KANBAN_HOME` the way `cloudHome()` already does. It holds the language and
  nothing else yet, and the helper that names that folder moves out of `cloud/` so a file
  that is not Cloud's does not reach into it.
- **The command owns it**: read and written through the board's rules, the way the Cloud
  session is, so the desktop app, the browser app and a bare `akb` in a terminal all reach
  one answer. It never lands in `docs/kanban/`.
- **Two values, `en` and `zh`**: the spelling `web/lib/i18n.ts` already uses, so the site,
  the copy module #335 builds and the language #337 sends into a run all name it the same
  way.
- **English when there is no answer**: a missing file, an unreadable one, or a value this
  build does not know reads as English rather than failing.
- **Optional in the UI's view of the rules**: `kanban-ui` loads the rules from the
  project's own `cli/dist/kanban.mjs`, so the accessors are optional there like
  `readFlowRules?()` and a project predating them draws in English.
- **Every screen has it from the first paint**: read on the server in `app/layout.tsx` and
  held in a context below it, so all six pages reach it without threading a prop and none
  of them draws English first. `<html lang>` follows it too, as `en` or `zh-Hans` — the
  tags `web/lib/i18n.ts` uses.
- **The switcher**: two entries, English and 中文, each labelled in its own name the way
  the site's footer does. Changing it re-renders the app immediately, with no reload.
- **The desktop menu follows**: the page tells the main process over a channel declared in
  `desktop/src/shared/bridge.ts`, and `buildMenu` runs again — now taking the language as
  an option, though every label it draws is still English until #336. The menu is already
  rebuilt when the projects list changes and on every navigation, so there is nothing new
  to invent.
- **The first menu is right too**: the main process reads the setting at startup, through
  the copy of the rules it already hands the board server as `AI4KANBAN_CLI`. Waiting for
  the page to report would leave an English menu bar up for as long as the board takes to
  load, on every launch.
- **Nothing is translated here**: this card ships the setting and the switcher. The app
  still renders English until #336 lands.

## Todo
- [ ] Hold the language in `~/.ai4kanban/settings.json`, and export a read and a write from
      the board's rules.
- [ ] Read it on the server in `app/layout.tsx` and hold it in a context every component
      can reach, falling back to English when the project's rules do not know it.
- [ ] Add the Language section to Configuration, below the divider, and make a change take
      effect without a reload.
- [ ] Give `buildMenu` the language, tell the desktop main process when it changes, and
      have the main process read the setting at startup so the first menu is right.
- [ ] Say in `kanban-ui/README.md` what the Language setting does and where it lives, and
      in `kanban-ui/design.md` how a component reads it.

## Decided by the agent
- **Why not `docs/kanban/ui.config.json`?**: the harness settings live there because they
  are the board's, tracked in git and inherited by everyone who clones it. A language is a
  fact about the reader, so it follows the person into every project instead.
- **Why not the desktop app's own `settings.json`?**: `akb` cannot read Electron's
  user-data folder, and a run started from a terminal has to reach the same answer as one
  started from a button.
- **Why the desktop plumbing lands here and not in #336?**: the channel, the option on
  `buildMenu` and the startup read all carry an answer that exists nowhere else yet. #336
  only fills English labels in with Chinese ones.
- **Is there an `akb` command to set it?**: no — the switcher is the app's. What the
  command prints stays English either way (#332), so a terminal-only user has nothing to
  read in Chinese; a run started from a terminal still reads the setting and writes the
  board in it.
