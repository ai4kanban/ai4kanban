---
title: Plan UI tasks so the screen is agreed before it is built
track: skill
priority: med
roi: med
status: todo
release: 0.7.0
blocked_by: []
related: [137, 138]
modules: [skill, local-ui]
questions: []
---

A card that changes a screen is planned in prose like any other card, so the user only
sees the layout once it is code. Give the board a way to handle these cards: the agent
plans them against a short design reference, and a question about a screen shows the
layout instead of describing it. This is a group task; each piece is its own subtask in
this folder.

## Today
- Nothing tells the planning flows that a card touches a screen, so a UI card is planned
  the same way a script card is.
- A question about a layout is prose. "Does the sketch sit beside the board or under it?"
  takes three sentences and the user still has to picture it.
- A card body already shows a fenced block as a mono block in the UI. A question's text
  does not — it is drawn as one inline line, so a sketch inside a question would collapse.

## Scope
- A question can carry a rough ASCII sketch, shown as a block on the card page and in the
  Resolve dialog (#138).
- A short UI design reference in the skill, read by the flows that write or reshape a card
  when the card changes something users see and click (#137).
- Order: #138 first, then #137. The reference tells the agent to draw sketches into
  questions, and until a question can show a block those sketches read as one broken line.
- Out of this group: checking a built screen against the sketch it was agreed from. Worth
  doing, and its own card once these two land.

## Todo
- [ ] Let an open question carry an ASCII sketch of the UI #138
- [ ] Add a short UI design reference that UI features go through #137

## Decided by the agent
- **Only questions need the sketch work.** A card body is rendered as markdown already, so
  a fenced sketch in the plan shows as a block today. The gap is the question list and the
  Resolve dialog, which draw a question as one line of text.
- **The group stops at planning.** Getting the screen agreed is one job; checking the built
  screen against it is another, with its own machinery. Keeping them apart keeps this group
  finishable.
