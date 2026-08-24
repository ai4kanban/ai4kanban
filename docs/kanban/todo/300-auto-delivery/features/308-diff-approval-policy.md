---
title: Require diff approval on the cards that need it
track: features
priority: med
roi: med
status: todo
release: 0.8.0
blocked_by: [305, 306, 307]
related: [300]
modules: [local-ui, skill]
questions: []
---

The default policy lands reviewed code without a person reading the diff. Some work should not
work that way. Add the two controls that make a board stricter: a board-wide setting that requires
approval of the exact reviewed tree before landing, and a `critical` label that requires it on one
card plus every check the flow rules ask for.

## Worth noting
- **Is diff approval on by default?**: no. Requiring it on every card puts the user back in the
  loop for every change, which is what auto-delivery exists to remove.
- **What does an approval cover?**: one exact tree. A rebase, a correction, or any later change
  cancels it and asks again — otherwise "approved" would stop meaning anything.
- **Why a `critical` label as well?**: it makes one card stricter without changing the board's
  default. Strict where it matters, not everywhere.

<!-- agent -->

## Scope
- **Optional diff approval**: a board-level setting requiring approval of the exact reviewed tree
  before landing, off by default.
- **The approval is bound to that tree**: a rebase, a correction, or any later change cancels it.
- **`critical` label**: a card labelled `critical` requires diff approval and every check the flow
  rules require, whatever the board-level setting says.
- **A routine card keeps the default four-part review** — task summary, worth noting, open
  questions, worth noting after implementation.
- **The card page is where an approval is given**, next to the diff #305 shows.
- **Record each approval, the tree it covered, and each cancellation** on the delivery's audit
  record.

## Todo
- [ ] Add the board-level "require approval of the reviewed tree before landing" setting, off by
      default.
- [ ] Bind an approval to the exact reviewed tree, and cancel it on a rebase, a correction, or
      any later change.
- [ ] Add the `critical` label, and make it require diff approval plus every check the flow rules
      require.
- [ ] Hold a card in the landing queue until its approval is given.
- [ ] Put the approval on the card page, beside the diff.
- [ ] Record approvals, the tree each covered, and cancellations on the delivery's audit record.
- [ ] Document both controls in `kanban-ui/README.md`.

## Scope out
- **No requirement that every board use the strictest policy**: diff approval stays optional.

## Source
- `plan.md`, in commit `1127a91` — "Policy and risk levels", and "Non-goals".
