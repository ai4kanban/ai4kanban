---
title: Make the board UI the way in, in the README and on the site
track: distribution
priority: med
roi: high
status: todo
release: 0.6.0
blocked_by: [173, 174]
related: [185, 196]
modules: [site, docs]
questions:
  - question: "[user] The landing page's main button today says \"Start with one prompt\". Does it become the app download?"
    mode: single
    options:
      - Yes — Download the app is the main button, and the setup prompt becomes a plain link beside it
      - Show both as equal buttons, with the app first
      - Leave the main button alone; only the section further down changes
    recommend: [1]
---

Everything we publish still teaches the old first step: install the skill into your coding agent. Once the board sets itself up from the UI, that sends every new user down the harder path.

## Scope
- The first step everywhere becomes downloading the board app, not installing a skill.
- The skill moves to its own optional section further down: drive the same board from your
  coding agent. Nothing about it is deleted, and the setup prompt keeps working.
- The new first step leads straight into what a Mac user has to do on first open. The app
  is not signed yet, so that warning is now the first thing a new user meets, and it can't
  be a footnote.
- The pages this covers: `README.md`, `README-zh.md`, the landing page and its four other
  languages, the plain-Markdown copy of the landing page at `web/public/index.md`, and the
  npm page `cli/README.md`.
- Out of scope: the Claude plugin listing, whose reader is already inside a coding agent
  where the skill is the way in, and `kanban-ui/README.md`, whose reader already has the
  app open.

## Decided by the agent
- **Do the guides name the old first step?**: no. `daily-loop.md` starts once the board
  exists, and `what-makes-a-good-goal.md` installs nothing. There is nothing to rewrite
  there, only to re-read. That the daily loop is written as skill commands only is its own
  card.
- **Does the setup prompt go away?**: no. It becomes the optional path, and
  `INSTALL_PROMPT.txt` keeps working unchanged.
- **Which screenshots change?**: none of the ones we have — the board and queue shots stay.
  One new shot is added where the getting-started copy is: the guided first run, so a
  reader sees the screen the first step actually lands on.
- **Does the site still show one setup command?**: yes. The rule that the quick start shows
  one command and never a list of shell steps still holds. The command just stops being
  the first thing on the page.
- **Who owns what, next to #196 and #185**: this card owns which step comes first; #196
  owns which command a person types; #185 owns the download page and its languages. They
  touch the same files on different lines, so whichever lands second keeps the other's
  work.

## Todo
- [ ] Rewrite the getting-started step in `README.md` and `README-zh.md` so downloading the
      app comes first, and fix the line that still puts the command line ahead of the UI.
- [ ] Move the skill install into its own optional section in both READMEs, and say what it
      adds.
- [ ] Rewrite the landing page's getting-started section so the app leads and the setup
      prompt sits under it.
- [ ] Update the landing page's main button.
- [ ] Capture the guided first run and show it where the getting-started copy is.
- [ ] Bring the landing page's four other languages back in line.
- [ ] Update the plain-Markdown copy at `web/public/index.md` and the npm page
      `cli/README.md`.
- [ ] Re-read the guides now that the first step lives somewhere else.
- [ ] Walk the whole path on a clean machine — download, open, set up, first card — and
      check nothing still points at the old first step.
