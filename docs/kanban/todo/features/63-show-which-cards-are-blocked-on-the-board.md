---
title: Show which cards are blocked on the board
track: features
priority: med
roi: high
status: ready
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

Mark blocked cards on the board, so nobody starts a card whose blockers are still open.

A card's `blocked_by` shows only on its own page. On the board every card looks the
same, so the order the work must run in is invisible.

## Scope
- On the board, a card whose `blocked_by` names a card that is still open gets a small
  "blocked" marker. The card stays visible — never hide it.
- A blocker id that is no longer on the board counts as cleared: that task was archived
  or rejected, so it no longer blocks anything.
- A blocker that points at a recurring card, or at the card itself, doesn't count: a
  recurring card never closes, so it would block forever.
- On the card page, when a blocker is still open, say so next to the Implement button
  and link to the blocking card. The button keeps working — the note is a nudge, not
  a gate.

## Decided by the agent
- Hide the Implement button on a blocked card, or warn? Warn beside it and keep the
  button working — this board nudges, it never gates or hides.
- Can a recurring card block another card? No — it never closes, so the block would
  never clear. Skip recurring ids and the card's own id when checking blockers.

## Todo
- [ ] Work out for each board card whether any `blocked_by` id is still open, skipping
  recurring ids and the card's own id.
- [ ] Show a small "blocked" marker on those cards in the board columns.
- [ ] On the card page, the Blocked-by ids already show as links; add a note next to
  the Implement button when any of them is still open.
- [ ] Update `kanban-ui/README.md` to describe the marker.
