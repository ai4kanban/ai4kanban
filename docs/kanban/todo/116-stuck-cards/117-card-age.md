---
title: Show how long each card has sat untouched
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [116]
modules: [skill]
questions: []
---

The board cannot say how long a card has sat. Read it from git, so a stuck card is
visible before it is ancient.

Part of #116.

## Scope
- For every open card: the date of the last commit that touched its file. No new
  frontmatter, no hand-kept dates.
- A script command lists the cards untouched past the threshold, stalest first, with
  the days each has sat.
- The threshold is one number in `config.md`, default 30 days.
- A blocked card counts too, but the listing says what it waits on — stuck behind a
  blocker reads differently from forgotten.
- Recurring cards stay out. They repeat by design and carry their own `last_run`.

## Todo
- [ ] Read each open card's last-touched date from git history.
- [ ] Add a script command that lists the stuck cards, stalest first.
- [ ] Put the threshold in `config.md` with a 30-day default.
- [ ] Mark blocked cards in the listing with the card they wait on.
- [ ] Say the command exists in one line in `SKILL.md`.
