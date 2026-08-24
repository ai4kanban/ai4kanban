---
title: Require diff approval on the cards that need it
track: features
priority: med
roi: med
status: ready
release: 0.8.0
blocked_by: []
related: [300]
modules: [local-ui, skill]
questions: []
---

A delivery lands reviewed code on your branch without anyone reading the diff. That is right for
routine work and wrong for the code you cannot afford to get wrong. Add the two controls that make
a board stricter: a setting that holds every delivery until you approve the exact tree it would
land, and a `critical` mark that holds one card that way whatever the setting says.

## Worth noting
- **Is diff approval on by default?**: no. Requiring it on every card puts the user back in the
  loop for every change, which is what auto-delivery exists to remove.
- **What does an approval cover?**: one delivery's base commit and the tree built on it. A rebase
  moves the base, a correction moves the tree, and either one cancels the approval — otherwise
  "approved" would stop meaning anything.
- **Why mark a card `critical` as well?**: it makes one card stricter without changing the board's
  default. Strict where it matters, not everywhere.
- **Does `critical` also force extra checks?**: no. The plan pairs it with "every check the flow
  rules require", but review already runs the repository's checks and the board's review rule on
  every delivery, so there is nothing left for a mark to switch on.
- **Does any of this apply with automatic commits off?**: no. The board never commits in manual
  commit mode, so the user's own commit is the approval and neither control appears.

<!-- agent -->

## Scope
- **The setting**: **Require diff approval before landing**, in Configuration → Auto-delivery
  beside **Allow automatic Git commits**, off by default. On, every delivery waits for the user to
  approve the tree it would land.
- **The mark**: a card whose `critical` field is set requires diff approval whatever the setting
  says. It is set from the card page's meta box and with `akb board update <id> --critical
  yes|no`, and the board and the card page draw it as a chip.
- **The policy is frozen when a delivery starts**, the way its commit mode is: changing the
  setting or the mark applies to the next delivery, never one in flight.
- **An approval is bound to the delivery's base commit and the candidate's fingerprint** as they
  stand when it is given. Landing re-reads both immediately before it moves the target branch, and
  either one having moved cancels the approval and puts the delivery back to waiting — one check
  that covers a rebase, a correction and any other later change.
- **A delivery waiting on approval holds outside the landing queue**, taking no landing slot, so
  every other card still lands. The delivery pill's line on the card says what it waits on.
- **Approving on the card page**: the delivery block's **Approval** tab holds **Approve this
  tree** and one line saying what it covers. The block opens on **Diff** while a delivery waits,
  so the tree is the first thing read.
- **Approving from the terminal**: `akb approve <delivery|#card>`, beside `cancel` and `discard`.
- **On the delivery's record**: each approval with the base and fingerprint it covered, and each
  cancellation with which of the two moved.

## Todo
- [ ] Add the **Require diff approval before landing** setting to Configuration → Auto-delivery,
      off by default.
- [ ] Add the card's `critical` field: `akb board update --critical`, the card page's meta box,
      and the chip.
- [ ] Decide whether a delivery needs approval when it starts, and freeze it on the delivery.
- [ ] Bind an approval to the delivery's base commit and the candidate's fingerprint, and cancel
      it when either moves.
- [ ] Hold a delivery waiting on approval outside the landing queue, and say what it waits on.
- [ ] Add the **Approval** tab and **Approve this tree** to the delivery block, and open the block
      on **Diff** while a delivery waits.
- [ ] Add `akb approve <delivery|#card>`.
- [ ] Record approvals, what each covered, and cancellations on the delivery's audit record.
- [ ] Say what both controls do in `kanban-ui/README.md`, the landing section of
      `akb guide review`, and `akb help runs`.

## Scope out
- **No requirement that every board use the strictest policy**: diff approval stays optional.
- **No labels**: `critical` is one card field, not a general tagging system.
- **No acceptance-test approval**: the plan's other approval surface is a later card.

## Decided by the agent
- **Why a card field rather than a label list?**: the board has no labels, and one policy switch
  does not justify inventing them. `critical` joins priority and roi as a field, set the same way.
- **Why does landing re-read the base and the fingerprint instead of watching for a rebase?**: one
  check immediately before the branch moves covers every way the tree can change, including the
  ones nobody thought of.
- **Why "diff approval" and not "approved"?**: a delivery's `approved` already means the card it
  was approved to build, so the tree needs words of its own on every screen and in the record.

## Source
- `plan.md`, in commit `1127a91` — "Policy and risk levels", and "Non-goals".
