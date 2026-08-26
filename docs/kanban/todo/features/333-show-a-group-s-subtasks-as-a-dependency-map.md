---
title: Show a group's subtasks as a dependency map
track: features
priority: med
roi: med
status: todo
release: 0.8.0
blocked_by: []
related: []
modules: [local-ui, skill]
questions:
  - question: "[user] Which release should the subtask dependency map ship in?"
    mode: single
    options:
      - No release — 0.8.0 is auto-delivery and Cloud events, and nothing in it waits on this board-UI readability nicety
      - 0.8.0 — the group root's page is where auto-delivery is watched, so the map lands beside the work it helps read
    recommend: [1]
  - question: "[user] Which layout for the subtask dependency map? — see the `ui-design` section"
    mode: single
    options:
      - A — layer strips down the page, chips are the id alone; costs a glance at the list below to know what an id is, and a layer wide enough to overflow wraps inside its strip
      - B — layers as columns left to right, each chip carrying a short title; reads without the list, but repeats it and only fits about four layers before the columns close up
      - C — one subtask per row with the lines in a left gutter; never has to fit sideways, but the panel is then the subtasks list drawn twice
    recommend: [1]
---

A group root's page lists its subtasks as a column of rows, so the order the group gets built in is invisible — you open each subtask in turn and read its `blocked by` line to work out what waits on what. Add a small map above that list: one chip per subtask, lines from a blocker to what it blocks, so a group's shape reads at a glance.

## Worth noting
- **What does a group with no dependencies show?**: no panel at all. With no line to draw, the map would only repeat the list beneath it — #266's seven independent subtasks are the case that proves it.
- **What about a subtask waiting on a card outside the group?**: its chip is marked as waiting on something the map does not show, and the outside blocker gets no chip of its own. Drawing it would pull the rest of the board into a group's panel; saying nothing would let the map claim a subtask is startable when it is not.

## By `ui-design` agent

<Mockup src=".mockups/333/a.tsx" label="A" />

<Mockup src=".mockups/333/b.tsx" label="B" />

<Mockup src=".mockups/333/c.tsx" label="C" />

Recommended: **A**.

<!-- agent -->

## Scope
- **Where it sits**: a small panel on a group root's card page, above the existing subtasks list. The list stays as it is.
- **What a chip is**: the subtask's id and nothing else — `#123`. Clicking it opens that card's page, like every other id chip on the board.
- **What a line is**: one connection per `blocked by` entry naming another subtask in the same group, running from the blocker to the subtask it blocks, with the direction readable without hovering.
- **Who is in the map**: the group's own subtasks, one chip each. A `blocked by` id naming a card outside the group, or the subtask itself, draws no line and adds no chip.
- **Waiting on the outside**: a chip whose subtask names a blocker that no chip in the map matches carries a marker saying so. The blocker ids the panel already reads are enough to tell.
- **How it is laid out**: blockers before what they block, so the map reads in build order. A subtask nothing blocks and that blocks nothing still gets a chip.
- **When subtasks block each other**: a cycle leaves some subtasks that no layer can place — they go in one final layer with their lines drawn as they are, so the loop is visible and no chip is lost.
- **It is a picture, not a canvas**: no zoom, drag, collapse or selection. It fits the card page's column at its normal width.
- **When it is absent**: a group with no line to draw shows no panel at all — one subtask, or subtasks that name no blocker inside the group.

## Todo
- [ ] Carry each subtask's blocker ids into the UI's card data — `Subtask` in `cli/src/lib/view/types.ts` has no `blocked_by` today, and `read.ts` drops it when it builds the root's subtask list. Re-run `scripts/sync-format.mjs`, which kanban-ui's lint checks.
- [ ] Order the group's subtasks into layers in the UI from those edges: no blocker inside the group first, then everything that waits on the layer before it.
- [ ] Draw the panel on the group root's card page — chips in that order, the lines between them, the outside-blocker marker, and each chip a link to `/<id>`.
- [ ] Check it on a real group with a dependency chain (#325, where #330 must carry the marker for its outside blocker #327) and on one with none (#266, which must show no panel).

## Decided by the agent
- **Why the raw `blocked_by` ids rather than the board's cleared-blocker list?**: `openBlockers` is attached after the root's subtask list is already built, and a finished subtask has left the group folder, so the in-group rule drops it anyway.
- **Which drawing library?**: none. A group holds a handful of subtasks and the map never moves, so placed chips with SVG lines are enough — a graph library would add a runtime dependency to the shipped desktop app for a static picture.
