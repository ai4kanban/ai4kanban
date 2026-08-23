---
title: Read a closed version's changelog in the board UI
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: [local-ui]
questions:
  - question: "[user] Where in the board should a shipped version be read — a list of every closed version, or only the one just closed?"
    mode: single
    options:
      - A shipped-versions list, opened from the release dropdown, holding every version that has closed
      - Only the version just closed, shown on the board right after the close, and gone on the next reload
    recommend: [1]
---

A version that has closed leaves a plain-words changelog in a file under `docs/kanban/.release-summaries/`, and nothing in the app can show it. Give the board a place to read it, so what a version changed can be read where the work was planned.

## Worth noting
- The changelog itself is already written when a release closes. This card only adds the place to read it, and changes nothing about how it is written.
- The board reads that file and never writes it. A wrong line is still fixed in your own editor.

<!-- agent -->

## Scope
- Show a closed version's changelog inside the board, without opening an editor or git.
- Read it from the newest dated section of `docs/kanban/.release-summaries/<version>.md`.
- Show what the version was for, and the cards it shipped, beside the changelog.
- Say plainly when a closed version has no changelog yet, rather than showing an empty panel.
- Never write to the summary file from the board.

## Todo
- [ ] Decide where a shipped version is read from, once the open question is answered.
- [ ] Read a closed version's summary file and hand the board its changelog, its goal and its shipped cards.
- [ ] Draw the changelog on screen, with the version and the date it closed.
- [ ] Say when a closed version has no changelog yet.
- [ ] Check it against a version closed end to end, with and without a changelog.

## Decided by the agent
- **Why is this its own card?** The user asked for the reading place to be split out of the card that writes the changelog, which has since shipped: the board shows the run that writes it, never the text.
- **Which release does it ship in?** None yet. It was split out of a card in 0.7.2 rather than asked for in it, so promising it to a version is the user's call.
