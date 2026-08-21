---
title: Open a card's page on the half a human has to read
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: [261]
related: [261]
modules: [local-ui]
questions:
  - question: "[user] Is the agent half folded shut when a card's page opens?"
    mode: single
    options:
      - shut, and it stays how you last left it — the page opens short, and a reader who wants the detail keeps it open
      - shut every time — the page opens the same way for everyone, every visit
      - open, but quieter — nothing is hidden, it just reads as secondary
    recommend: [1]
---

A card's page prints what the agent worked out at the same weight as what the user has to
decide, so reading one card means reading all of it. Show the human half; keep the agent
half on the same page, folded and quiet.

## Scope
- The card's human half (#261) sits at the top of the page and looks exactly as it does today.
- The agent half sits below it, behind one control saying what it holds — what the agent
  worked out — and how many sections.
- One click opens it in place. No tab, no dialog, no second page.
- Opened, it reads quieter than the human half — the softer ink the board already uses,
  no new colours.
- A card with no agent half shows no control at all.
- A card written before #261, with no boundary to split on, shows its whole body as it does
  today. Nothing is hidden.
- Nothing folded is something the user has to act on — where a mockup the user picks from
  sits is #261's call.
- Open questions, "check by hand", subtasks and the fields above the body do not move.
- The board's tiles and the chat rail are untouched.

## Todo
- [ ] Split the card body at the boundary #261 marks, and show the human half at the top,
      unchanged.
- [ ] Put the agent half below it behind one control that says what it holds.
- [ ] Make the opened agent half read quieter than the human half, using the board's own colours.
- [ ] Fall back to today's whole-body page for a card with no boundary.
- [ ] Update the UI guide, `kanban-ui/README.md`.
- [ ] Check it end to end: open a long card such as #56 and see what is on screen before
      scrolling, then open the agent half and confirm nothing was lost.
