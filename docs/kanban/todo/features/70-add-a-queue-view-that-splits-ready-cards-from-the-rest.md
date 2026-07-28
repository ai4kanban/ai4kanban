---
title: Add a queue view that splits ready cards from the rest
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: []
modules: [local-ui]
questions:
  - "Where do implementing cards sit in queue view: in the ready half, their own strip, or hidden?"
  - Should the chosen view persist across reloads (per project), and if so where?
  - Do blockers and recurring cards appear in queue view, and on which half?
---

Add a second way to look at the board: a queue view that puts ready cards on one side
and everything not ready on the other. The kanban view groups by track; the queue view
answers a different question — "what can I build right now?"

## Scope
- A switch button in the header toggles between the kanban view and the queue view.
- The queue view splits the screen into two halves:
  - one half: cards with status `ready` — the queue of work you can start.
  - the other half: cards that are not ready — still `todo`, carrying open
    questions, or blocked.
- Each half lays cards out in a flexible grid that wraps to fill the width,
  not the one-column-per-track layout the kanban view uses.
- The split is by the card status the UI already computes
  (`kanban-ui/lib/types.ts` — `todo | ready | implementing`); no new board data.

## Todo
- [ ] Add the view switch to the header and thread the chosen view down to the board.
- [ ] Build the queue view: two halves, ready cards on one side, the rest on the other.
- [ ] Lay out cards in each half as a wrapping grid, reusing the existing card component.
- [ ] Label each half plainly (e.g. "Ready to build" / "Needs work") and show a count.

## Decided by the agent
- What to call the new view? "Queue" — the ready half reads as a queue of
  buildable work; the user is open to a better name if one comes up.
