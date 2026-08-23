---
title: Land reviewed code on the target branch, one card at a time
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [302, 303]
related: [300]
modules: [local-ui]
questions: []
---

Reviewed work sits on its own branch and goes no further. Landing is the last step: a
repository-wide queue takes one card at a time, rebases it onto the current target branch if that
branch moved, runs review and the required checks again, and adds the result as one squash
commit.

## Worth noting
- Only one card lands at a time, however many are being built. A card that is ready waits its
  turn.
- A branch that moved underneath a card is rebased and reviewed again before it lands. That costs
  another review, and it is the only way the reviewed tree is the tree that lands.
- Landing adds one squash commit per card, so the target branch keeps one commit per card rather
  than a run's internal steps.
- Uncommitted code in your own checkout blocks landing, the same way it blocks starting. The
  card waits safely on its branch.
- Two cards touching the same files is a warning, not a refusal. Landing goes ahead; a real
  conflict is handled below.
- A conflict is resolved as new work by an agent, and that result is reviewed from scratch. If it
  stays unclear, the card gets an open question explaining the conflict.

<!-- agent -->

## Scope
- **Landing** is adding the reviewed code to the target branch as its final commit.
- **One at a time**: a repository-wide coordinator queues landings. Several cards may be in
  implementation or review at once; landing is serialized.
- Before landing, verify the target branch and commit. The index must be clean, and only
  board-managed paths may carry local changes. Board changes stay unstaged.
- Path overlap with another card is a warning, not a reason to refuse landing.
- Stage only the task's changes. Never `git add -A`.
- **Rebase before landing**: if the target branch moved, rebase onto its new tip, save that tip
  as the new comparison base, and run review and every required check again.
- Land the result as one squash commit and record its SHA on the run.
- **Uncommitted local code blocks landing.** It is never included by the rebase. Commits the user
  made while the run was going are picked up by that rebase.
- **Conflicts are new work**: a conflict agent may inspect both cards, both diffs and the
  checkout. Review its result from scratch. If the conflict stays unclear, add an open question
  that explains it.
- **Cleanup after landing**: once the landing commit and the audit record are saved, verify the
  run's worktree is clean, `git worktree remove` it, delete its task branch, and remove the empty
  `.akb/worktrees/<cardID>/` directory.
- Never remove a worktree for an active, paused, failed or unaudited run, and never touch the
  user's main checkout.
- Record the landing commit, the comparison base at the time, the checks that ran and their
  results on the run's audit record.

## Todo
- [ ] Add the repository-wide landing queue: one card lands at a time, others wait.
- [ ] Verify the target branch and commit before landing — clean index, local changes only in
      board-managed paths, board changes unstaged.
- [ ] Warn on path overlap with another card instead of refusing.
- [ ] Stage only the task's changes.
- [ ] Rebase onto the target branch's new tip when it moved, save that tip as the new comparison
      base, and re-run review and every required check.
- [ ] Land as one squash commit and record its SHA on the run.
- [ ] Block landing while the user's own code is uncommitted, and leave the card waiting on its
      branch.
- [ ] Add the conflict step: an agent resolves it from both cards, both diffs and the checkout,
      and its result goes through review from scratch.
- [ ] Raise an open question that explains the conflict when it cannot be resolved.
- [ ] Clean up after a landed run — verify clean, remove the worktree, delete the branch, remove
      the empty card directory.
- [ ] Record the landing commit, comparison base, checks and results on the audit record.
- [ ] Update `kanban-ui/README.md` — how a card's code gets onto the target branch.

## Source
- `plan.md`, in commit `1127a91` — "Parallel work with Git worktrees" (land one card at a time,
  rebase before landing, resolve conflicts as new work, protect local code changes, automatic
  cleanup after landing).
