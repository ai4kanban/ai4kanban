---
title: Show what a card unblocks, so the ones holding up work go first
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: [skill, local-ui]
questions: []
---

A card says what it waits on, never what waits on it. So the one card holding up five
others looks the same as a card nobody needs, and it gets built last.

## Scope
- On a card page, list the cards this one is holding up.
- On the board and in the queue, mark a card that is holding up other work, with the
  count.
- Say the same thing in the script's card listing, so the agent sees it too.
- This is read from the blocked-by links already on the cards. Nothing new is stored and
  nothing is typed by hand.

## Todo
- [ ] Work out, from the blocked-by links, which cards each card is holding up.
- [ ] Show that list on the card page.
- [ ] Mark the cards holding up other work on the board and in the queue, with the count.
- [ ] Show it in the script's listing too.
- [ ] Cover it in the local UI docs.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; their 0.42 release added `--ready`
  and `--blocking` filters to find the work that unblocks the most other work.
