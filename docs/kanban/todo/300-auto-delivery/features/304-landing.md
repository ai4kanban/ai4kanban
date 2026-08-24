---
title: Land reviewed code on the target branch, one card at a time
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [303]
related: [300]
modules: [local-ui]
questions: []
---

Reviewed work sits on its own branch and goes no further. Landing is the last step: a
repository-wide queue takes one card at a time, rebases it onto the current target branch if that
branch moved, runs review and the required checks again, and adds the result as one squash commit.

## Worth noting
- **How many cards land at once?**: one, however many are being built. A card that is ready waits
  its turn.
- **What if the target branch moved?**: the card is rebased and reviewed again before it lands.
  That costs another review, and it is the only way the reviewed tree is the tree that lands.
- **What does the target branch end up with?**: one commit per card, rather than every step the
  delivery took to get there. The card reads **Landed as `abc123`**.
- **What if your own checkout is dirty?**: landing is blocked, the same way starting is. The card
  waits safely on its branch.
- **Do two cards touching the same files block each other?**: no, that is a warning. Landing goes
  ahead, and a real conflict is resolved as new work by an agent whose result is reviewed from
  scratch. If it stays unclear, the card gets an open question explaining the conflict.

<!-- agent -->

## Scope
- **Landing**: adding the reviewed code to the target branch as its final commit.
- **One at a time**: a repository-wide coordinator queues landings. Several cards may be in
  implementation or review at once; landing is serialized.
- **Verify before landing**: check the target branch and commit. The index must be clean, only
  board-managed paths may carry local changes, and board changes stay unstaged.
- **Path overlap with another card is a warning**, not a reason to refuse landing.
- **Stage only the task's changes**: never `git add -A`.
- **Rebase before landing**: if the target branch moved, rebase onto its new tip, save that tip as
  the new comparison base, and run review and every required check again.
- **Land as one squash commit** and record its SHA on the delivery.
- **Uncommitted local code blocks landing** and is never included by the rebase. Commits the user
  made while the delivery was going are picked up by that rebase.
- **Conflicts are new work**: a conflict agent may inspect both cards, both diffs and the
  checkout. Review its result from scratch, and add an open question explaining the conflict when
  it stays unclear.
- **Clean up after landing**: once the commit and the audit record are saved, verify the
  delivery's worktree is clean, remove it, delete its task branch, and remove the empty
  `.akb/worktrees/<cardID>/` directory.
- **Never remove a worktree for an active, paused, failed or unaudited delivery**, and never touch
  the user's main checkout.
- **Repair an interrupted landing**: on startup, continue or report a rebase or squash that a
  crash left half-done, rather than leaving the delivery's worktree in a state nothing owns.
- **Record on the audit record**: the landing commit, the comparison base at the time, and the
  checks that ran with their results.

## Todo
- [ ] Add the repository-wide landing queue: one card lands at a time, others wait.
- [ ] Verify the target branch and commit before landing — clean index, local changes only in
      board-managed paths, board changes unstaged.
- [ ] Warn on path overlap with another card instead of refusing.
- [ ] Stage only the task's changes.
- [ ] Rebase onto the target branch's new tip when it moved, save that tip as the new comparison
      base, and re-run review and every required check.
- [ ] Land as one squash commit and record its SHA on the delivery.
- [ ] Block landing while the user's own code is uncommitted, and leave the card waiting on its
      branch.
- [ ] Add the conflict step: an agent resolves it from both cards, both diffs and the checkout,
      and its result goes through review from scratch.
- [ ] Raise an open question that explains the conflict when it cannot be resolved.
- [ ] Clean up after a landed delivery — verify clean, remove the worktree, delete the branch,
      remove the empty card directory.
- [ ] On startup, continue or report a rebase or squash that was interrupted mid-way.
- [ ] Record the landing commit, comparison base, checks and results on the audit record.
- [ ] Update `kanban-ui/README.md` — how a card's code gets onto the target branch.

## Source
- `plan.md`, in commit `1127a91` — "Parallel work with Git worktrees" (land one card at a time,
  rebase before landing, resolve conflicts as new work, protect local code changes, automatic
  cleanup after landing).
