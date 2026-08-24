---
title: Show a delivery's diff on the card, and keep the commit that landed
track: features
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: [303, 304]
related: [300]
modules: [local-ui]
questions: []
---

Once a delivery commits its work on its own branch, the card can show exactly what it changed.
Put that diff on the card page, keep it pointed at the right base after a rebase, and keep the
landed commit as the permanent record of what the card did.

## Worth noting
- **Does anyone have to read this?**: no. The default policy does not require it — the view is
  there for investigating a result, building trust in the board, and finding the commit to
  revert.
- **How is a card reverted?**: by reverting one commit, because landing squashes.
- **What does manual commit mode show?**: a clearly labelled snapshot of the workspace, because
  nothing has been committed yet.

<!-- agent -->

## Scope
- **Use the current base**: show `git diff <baseSHA>..<branch>`, where the base is the fork commit
  at first and the target branch's new tip after a rebase. Never diff against the original fork
  commit after a rebase — it would include other cards' changes.
- **After landing, show the landed commit**: that is the card's permanent audit diff, and the card
  reads **Landed as `abc123`** beside it.
- **Manual commit mode keeps a clearly labelled workspace snapshot** in place of a landing commit.
- **The diff sits on the card page, with the delivery**, so a result and the record of it are in
  one place.
- **A case the view cannot show — a binary file, a missing worktree — gets a plain line** rather
  than an error.

## Todo
- [ ] Add a server-side read that returns a delivery's diff against its current comparison base.
- [ ] Point the base at the target branch's new tip after a rebase, and at the landed commit
      after landing.
- [ ] Keep a labelled workspace snapshot instead, in manual commit mode.
- [ ] Show the diff on the card page, beside the delivery, with the landed commit named.
- [ ] Give a case the view cannot show a plain line rather than an error.
- [ ] Update `kanban-ui/README.md` — what the card page shows after a delivery finishes.

## Scope out
- **No committing, reverting or editing from this view**: it is a read.

## Source
- `plan.md`, in commit `1127a91` — "Diffs on the card".
