---
title: Run each card in its own git worktree, with the board kept out of it
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [301]
related: [300]
modules: [local-ui]
questions: []
---

Every run works in the repo root today, so two runs write the same files and their changes mix
with each other and with the user's own edits. Give each run its own git worktree on its own
branch, keep board files out of it, and add the one setting that turns the whole thing off for
someone who does not want the board committing.

## Worth noting
- The board creates branches and commits inside them. Nothing reaches the target branch here —
  that is #304's job.
- Cards without declared dependencies may run at the same time. That is only about scheduling;
  it does not mean their changes cannot overlap.
- Uncommitted code in your own checkout blocks a run from starting. It is never copied into a
  worktree, so a run cannot build on top of work you have not committed.
- **Allow automatic Git commits** is one repository-level setting, on by default. It is not a
  choice on each card.
- With it off — **Manual commit mode** — runs change your main project folder, only one runs at
  a time, and you commit after review.
- A setting change applies only to runs started afterwards.
- A worktree that still holds unfinished work is never removed automatically. Discarding it is a
  button with a confirmation.

<!-- agent -->

## Scope
- **One worktree per run**:
  `git worktree add -b card/<cardID>/<runID> .akb/worktrees/<cardID>/<runID> <forkSHA>`.
- Record the target branch, fork commit, worktree path, task branch and run id on the run.
- Worktrees live under `.akb/worktrees/`, which is ignored in git and never committed.
- Retrying an interrupted step reuses that run's worktree. A requirements change makes a new run
  and a new worktree. Never overwrite an existing branch or worktree.
- A card has at most one active run.
- **Board files stay out**: declare board-managed paths such as `docs/kanban/` and exclude them
  from task worktrees. Pass the approved card into the run, route card updates through the board
  writer, and keep code changes in the worktree.
- Reject a task commit that touches a board-managed path. Sparse checkout alone is not the
  enforcement boundary.
- **Commit the whole task change** and require a clean worktree before review, so the reviewed
  tree is the exact candidate for landing.
- **Protect local code**: uncommitted code in the user's checkout blocks a run from starting. It
  is never copied into a worktree.
- **Worktree setup**: the implement flow's rule may tell the agent how to prepare the worktree —
  installing dependencies, for example. Carry whatever setup a fresh worktree needs to typecheck
  and run the project's checks.
- **Manual commit mode**: when **Allow automatic Git commits** is off, run one card in the main
  checkout under an exclusive lock instead of a worktree. Start from clean code; save the
  reviewed diff and its hash before releasing the lock.
- The run then waits for the user's commit. Mark it done only when that commit's code diff
  matches the reviewed snapshot; otherwise review the changed result again.
- **Configuration**: show **Allow automatic Git commits** under Auto-delivery, on by default,
  explaining that it lets runs use separate worktrees, run in parallel, and land reviewed code.
- **Cleanup is #304's**, after landing. This card only makes worktrees, keeps them apart, and
  removes one on request.
- **Preserve unfinished work**: never remove a worktree for an active, paused, failed or
  unaudited run. CardPage offers **Discard run**, says what will be lost, and asks for
  confirmation before removing the worktree and branch.
- **Repair stale records**: on startup, continue or report an interrupted rebase or squash. Run
  `git worktree prune` only to clear git metadata for paths that are already missing — it never
  decides that a run's directory is safe to delete.
- Never delete the user's main checkout.
- Update `docs/kanban/memory/local-ui/decisions.md`, which today says runs use no branches and no
  worktrees, and the Vibe Kanban comparison copy in `web/public/vs-vibe-kanban.md` and its page,
  which tells readers we never spin up worktrees.

## Todo
- [ ] Add a worktree helper: create a run's worktree and branch from the fork commit, look one
      up, and remove one. Never force a delete over work still in it.
- [ ] Record the target branch, fork commit, worktree path, task branch and run id on the run.
- [ ] Put each run's worktree under `.akb/worktrees/`, and keep that path out of git.
- [ ] Exclude board-managed paths from task worktrees, and refuse a task commit that touches one.
- [ ] Spawn the run with its working directory in the worktree, and route its card updates to the
      board writer in the repo root.
- [ ] Prepare a fresh worktree so the project's checks can run in it, driven by the implement
      flow's rule.
- [ ] Commit every task change and require a clean worktree before review.
- [ ] Block a run from starting while the user's own code is uncommitted, and say so plainly.
- [ ] Add the **Allow automatic Git commits** setting to Configuration → Auto-delivery, on by
      default, and apply a change only to later runs.
- [ ] Build manual commit mode: one card at a time in the main checkout under an exclusive lock,
      a clean start, and the reviewed diff plus its hash saved before the lock is released.
- [ ] Add **Discard run** to CardPage: say what will be lost, confirm, then remove the worktree
      and branch.
- [ ] On startup, continue or report an interrupted rebase or squash, and prune only git metadata
      for paths that are already gone.
- [ ] Update `docs/kanban/memory/local-ui/decisions.md` and the Vibe Kanban comparison copy.
- [ ] Update `kanban-ui/README.md` — where a run's code now lives, and what manual commit mode
      changes.

## Source
- `plan.md`, in commit `1127a91` — "Parallel work with Git worktrees" and "Commit permission".
