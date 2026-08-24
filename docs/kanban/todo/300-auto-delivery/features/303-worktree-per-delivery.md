---
title: Give each delivery its own git worktree, with the board kept out of it
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [300]
modules: [local-ui]
questions:
  - question: "[user] Cap how many deliveries hold a worktree at once? Each one is a full checkout plus whatever install its checks need — on this repo, three package managers — so clicking Implement on several cards costs real disk and setup time."
    mode: single
    options:
      - No cap — the board starts whatever the user clicks
      - A fixed cap of 3, with the rest queued
      - A number the user sets in Configuration, defaulting to 3
    recommend: [3]
---

Every session works in the repo root today, so two of them write the same files and their changes
mix with each other and with the user's own edits. Give each delivery its own git worktree on its
own branch, keep board files out of it, and add the one setting that turns the whole thing off for
someone who does not want the board committing.

## Worth noting
- **What does the board write here?**: branches and commits inside them. Nothing reaches the
  target branch on this card.
- **Can two cards touch the same files?**: yes. Cards without declared dependencies may be
  delivered at the same time, and that is only about scheduling — it does not mean their changes
  cannot overlap.
- **What if your own checkout is dirty?**: a delivery refuses to start. Uncommitted code is never
  copied into a worktree, so a delivery cannot build on top of work you have not committed. The
  board's own files changing does not count as dirty.
- **What if the project is not in git at all?**: it still delivers, in manual commit mode — there
  is nothing to branch from.
- **How is committing turned off?**: **Allow automatic Git commits**, one repository-level setting
  that is on by default. It is not a choice on each card, and a change applies only to deliveries
  started afterwards.
- **What does turning it off do?**: manual commit mode — a delivery changes your main project
  folder, only one at a time, and you commit after review.
- **Is a worktree ever removed automatically?**: not while it holds unfinished work. Discarding it
  is a button with a confirmation.

<!-- agent -->

## Scope
- **One worktree per delivery**: created with `git worktree add` on a new branch
  `card/<cardID>/<deliveryID>` at the fork commit, under `.akb/worktrees/<cardID>/<deliveryID>`.
- **The fork commit is the delivery's recorded `base`**, not a second field. Review already
  compares against it, so the worktree and the diff cannot disagree about where the card started.
- **Target branch**: the branch checked out in the user's main checkout when the delivery starts.
  Record it, the worktree path and the task branch on the delivery.
- **`.akb/worktrees/` is never committed**: `init` already writes `.akb/` into the repository's
  `.gitignore`, so check that line is there before making the first worktree and add it if a board
  set up earlier never got it.
- **Never overwrite an existing branch or worktree**: retrying an interrupted step reuses that
  delivery's worktree, and a requirements change makes a new delivery with a new worktree.
- **Board files stay out**: declare board-managed paths in one place — the list
  `lib/agent/candidate.ts` already excludes from a candidate's diff — and exclude them from task
  worktrees. The approved card is passed into the delivery, card updates are made in the repo
  root, and code changes stay in the worktree.
- **Reject a task commit that touches a board-managed path**: sparse checkout alone is not the
  enforcement boundary.
- **Commit the whole task change** and require a clean worktree before review, so the reviewed
  tree is the exact candidate for landing.
- **Uncommitted code in the user's checkout blocks a delivery from starting**, and is never copied
  into a worktree. Only tracked changes outside board-managed paths block it, the same test #304
  makes before landing — the board writes its own files while a delivery runs, so a check that
  counted those would refuse every delivery.
- **Manual commit mode also refuses to start on an untracked file** outside board-managed paths,
  because it works in the main checkout and review reads untracked files as the delivery's own
  work.
- **Worktree setup**: carry whatever setup a fresh worktree needs to typecheck and run the
  project's checks, driven by the implement flow's rule (#306).
- **A board outside a git repository still delivers**: with no git there is no worktree and no
  branch, so it takes the manual commit mode path — one delivery at a time in the project folder,
  under the same exclusive lock — and the card page says why.
- **Manual commit mode**: when **Allow automatic Git commits** is off, one delivery works in the
  main checkout under an exclusive lock instead of a worktree. Start from clean code, and save the
  reviewed diff and its hash before releasing the lock.
- **The delivery then waits for the user's commit**: mark it done only when that commit's code
  diff matches the reviewed snapshot, and otherwise review the changed result again.
- **Configuration**: show **Allow automatic Git commits** under Auto-delivery, on by default,
  explaining that it lets deliveries use separate worktrees, work in parallel, and land reviewed
  code.
- **Preserve unfinished work**: never remove a worktree for an active, paused, failed or unaudited
  delivery. The card page offers **Discard delivery**, says what will be lost, and asks for
  confirmation before removing the worktree and branch.
- **Repair stale worktree records**: on startup, report a delivery whose worktree or branch is
  missing rather than silently starting over. Run `git worktree prune` only to clear git metadata
  for paths that are already missing — it never decides that a delivery's directory is safe to
  delete.
- **Never delete the user's main checkout.**
- **Update what now says otherwise**: `docs/kanban/memory/local-ui/decisions.md`, which says runs
  use no branches and no worktrees, and the Vibe Kanban comparison copy in
  `web/public/vs-vibe-kanban.md` and its page, which tells readers we never spin up worktrees.

## Todo
- [ ] Add a worktree helper: create a delivery's worktree and branch from the fork commit, look
      one up, and remove one. Never force a delete over work still in it.
- [ ] Record the target branch, worktree path and task branch on the delivery, reusing its `base`
      as the fork commit.
- [ ] Put each delivery's worktree under `.akb/worktrees/`, checking the `.akb/` ignore line is in
      the repository's `.gitignore` first and adding it when it is missing.
- [ ] Exclude board-managed paths from task worktrees, from one declared list, and refuse a task
      commit that touches one.
- [ ] Spawn a delivery's sessions with their working directory in the worktree, and have them
      make card updates in the repo root.
- [ ] Prepare a fresh worktree so the project's checks can run in it, driven by the implement
      flow's rule.
- [ ] Fall back to manual commit mode outside a git repository, and say on the card page why.
- [ ] Commit every task change and require a clean worktree before review.
- [ ] Block a delivery from starting on a tracked change outside board-managed paths, and say so
      plainly. In manual commit mode block on an untracked file there too.
- [ ] Add the **Allow automatic Git commits** setting to Configuration → Auto-delivery, on by
      default, and apply a change only to later deliveries.
- [ ] Build manual commit mode: one card at a time in the main checkout under an exclusive lock,
      a clean start, and the reviewed diff plus its hash saved before the lock is released.
- [ ] Add **Discard delivery** to the card page: say what will be lost, confirm, then remove the
      worktree and branch.
- [ ] On startup, report a delivery whose worktree or branch is gone, and prune only git metadata
      for paths that are already missing.
- [ ] Update `docs/kanban/memory/local-ui/decisions.md` and the Vibe Kanban comparison copy.
- [ ] Update `kanban-ui/README.md` — where a delivery's code now lives, and what manual commit
      mode changes.

## Scope out
- **No landing and no cleanup after it**: this card makes worktrees, keeps them apart, and removes
  one on request (#304).

## Decided by the agent
- **Does an untracked file block a delivery?**: not one bound for a worktree, which cannot inherit
  it; in manual commit mode it does, because review would read it as the delivery's own work.
- **What happens with no git at all?**: the delivery takes the manual commit mode path rather than
  refusing. A board in an unversioned folder delivers today, and this card should not take that
  away.
- **Which branch is a delivery's target?**: the one checked out in the user's main checkout when
  the delivery starts, recorded on it. Reading it again at landing time would move the target under
  a card whose author only ever saw one branch.

## Source
- `plan.md`, in commit `1127a91` — "Parallel work with Git worktrees" and "Commit permission".
