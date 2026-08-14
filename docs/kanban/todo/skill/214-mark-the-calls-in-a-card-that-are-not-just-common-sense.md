---
title: Mark the calls in a card that are not just common sense
track: skill
priority: med
roi: high
status: todo
release: ""
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
  - Does the rule for a drifted work item — split it out, drop it, or mark it — live beside the heading rule in `akb guide board`, or in `akb guide refine`, where the drift is found?
---

A card mixes the obvious calls with the ones a human would argue about, and both read the
same. Give the odd ones their own heading, so a reviewer sees in one pass what to check.

## Scope
- Add a `### Worth noting` heading to the card rules: a call the agent made that is not
  plain common sense goes under it, one short line each.
- The heading is only for the odd ones. A call anyone would have made the same way stays
  where it is.
- Example to carry in the rule: a card about better onboarding grows an item saying users
  may pick an agent the board doesn't support. To a human that is a different feature; to
  the agent it looked related.
- Say the three moves for a work item like that, and when to pick each:
  - split it out as its own card, so `akb guide add-task` judges it on its own,
  - drop it, when it clearly has nothing to do with the card,
  - keep it, under `### Worth noting`, when it might belong and only the user can say.
- Refine checks it: a card holding a call that isn't obvious, with nothing marking it, is
  a problem refine has to fix.

## Todo
- [ ] Write the `### Worth noting` rule into the board's card rules, with the example.
- [ ] Write the three moves for a drifted work item into the same rule.
- [ ] Add the check to the refine flow, so every refine looks for unmarked calls.
- [ ] Refine one card that carries a drifted item, and check the section comes out where
      the rule says.
