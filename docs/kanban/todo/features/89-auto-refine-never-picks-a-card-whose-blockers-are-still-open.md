---
title: Auto-refine never picks a card whose blockers are still open
track: features
priority: high
roi: med
status: todo
blocked_by: []
related: [88]
modules: [local-ui]
questions: []
---

Refining a blocked card is wasted work: its plan depends on a card that is not built
yet. The auto-refine picker must skip any card with open blockers, and pick it up only
after every blocker is done.

## Scope
- The picker skips a card whose `blocked_by` list still points at an open card.
- A blocker that is archived or rejected no longer blocks — once all of a card's
  blockers are gone from the board, the card becomes pickable again.

## Todo
- [ ] Make the auto-refine picker skip cards with open blockers.
- [ ] Give one card a blocker, turn auto-refine on, and check it is skipped; archive the blocker and check it now gets picked.
- [ ] Update the auto-refine section of `kanban-ui/README.md` to say blocked cards wait for their blockers.
