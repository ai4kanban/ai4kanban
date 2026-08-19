---
title: Mark the calls in a card that are not just common sense
track: skill
priority: med
roi: high
status: todo
release: 0.7.0
blocked_by: []
related: []
modules: [skill]
questions:
  - question: "[user] Where does the `### Worth noting` heading sit?"
    mode: single
    options:
      - Under `## Scope` — it may still be built, so it stays with the plan
      - Under `## Decided by the agent` — it is the agent's call, and that section is already the one a human overrules
    recommend: [2]
---

A card mixes the obvious calls with the ones a human would argue about, and both read the
same. Give the odd ones their own heading, so a reviewer sees in one pass what to check.

## Scope
- Add a `### Worth noting` heading to the card rules in `akb guide board`: a call the agent
  made that is not plain common sense goes under it, one short line each.
- The heading is only for the odd ones. A call anyone would have made the same way stays
  where it is.
- Add the three moves for a work item that drifted from what the card is about to the list
  of moves in `akb guide refine`, with when to pick each:
  - split it out as its own card, so `akb guide add-task` judges it on its own,
  - drop it, when it clearly has nothing to do with the card,
  - keep it, under `### Worth noting`, when it might belong and only the user can say.
- Example to carry with those moves in `akb guide refine`: a card about better onboarding
  grows an item saying users may pick an agent the board doesn't support. To a human that is
  a different feature; to the agent it looked related.
- Refine points at the `### Worth noting` heading by name instead of restating what goes
  under it.
- Refine checks it: a card holding a call that isn't obvious, with nothing marking it, is
  a problem refine has to fix.
- Refine's line against writing review notes into the card must not read as banning the new
  heading.

## Todo
- [ ] Write the `### Worth noting` rule into the card rules in `akb guide board`.
- [ ] Write the three moves for a drifted work item, and when to pick each, into the move
      list in `akb guide refine`, with the example.
- [ ] Add the check to the refine flow, so every refine looks for unmarked calls.
- [ ] Reword refine's line against writing review notes into the card, so a `### Worth
      noting` section is clearly allowed.
- [ ] Refine one card that carries a drifted item, and check the section comes out where
      the rule says.

## Decided by the agent
- **Where the drifted-item rule lives** — the heading goes in `akb guide board`, the three
  moves go in `akb guide refine`. Board owns what a card looks like and every flow reads it;
  refine owns which move a failed check turns into, and already lists two of the three
  ("Add a card", "Reject").
- **The example goes with the moves** — it shows a work item that drifted, not a heading, so
  it earns its space in `akb guide refine` and costs nothing in the file every flow reads.
