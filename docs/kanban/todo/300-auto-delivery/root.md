---
title: Build, review and land an approved card from one click
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [301, 302, 303, 304, 305, 306, 307, 308, 309]
modules: [local-ui, skill]
questions: []
---

Today a run writes code into your working tree and stops. You read the diff, decide whether it
matches the card, fix what drifted, and commit — every time, for every card. Make the board do
that part: one click on an approved card implements it, reviews the result against the card in a
fresh session, corrects clear mistakes, and lands it on the target branch. This is a group task —
it tracks the whole job; each piece is its own subtask in this folder.

## Worth noting
- The board starts writing to git. It creates branches, commits inside them, and adds a squash
  commit to the target branch. Nothing is deployed anywhere.
- A user who does not want that turns off **Allow automatic Git commits**. Runs then work in the
  main folder, one at a time, and stop after review for the user to commit — what happens today,
  plus a review.
- The default policy does not ask a human to read the diff. It asks them to approve the card:
  what it should achieve, what to weigh, the open questions, and anything found while building.
  A board that wants diff approval turns it on.
- Several cards can be in progress at once, so more than one branch exists at a time. Only one
  card lands at a time.
- This reverses two settled calls in `docs/kanban/memory/local-ui/decisions.md`: that runs never
  commit, and that they use no branches or worktrees. The comparison copy on the site says the
  same thing and changes with it.
- The plan replaces three cards that are now rejected — a worktree per implement run, the
  working-tree diff view, and the auto-implement switch. Their useful detail moved onto the
  subtasks here.

<!-- agent -->

## Today
- Every run spawns in the repo root, so two runs write the same working tree and their changes
  mix.
- A run's only record is a log. Nothing says what it was asked to build, what it changed, or
  whether anyone checked it.
- Nothing reviews a run's output. "Done" means the agent said so.
- Board files and code sit in the same tree, so an agent editing a card and an agent editing code
  race each other.

## Scope
- Build the nine pieces below in dependency order. Each is its own card; this root only tracks
  them.
- `plan.md`, in commit `1127a91`, is the full specification. Every subtask quotes the part it
  owns; read that file when a subtask leaves something unsaid.

## Todo
- [ ] Give every run a record, and the board one writer #301
- [ ] Review a run's work against the approved card, and send clear mistakes back #302
- [ ] Run each card in its own git worktree, with the board kept out of it #303
- [ ] Land reviewed code on the target branch, one card at a time #304
- [ ] Show a run's diff on the card, and keep the one that landed #305
- [ ] Let a user add one rule to any flow #306
- [ ] Make one Implement click carry a card all the way to landed #307
- [ ] Require diff approval on the cards that need it #308
- [ ] Link a bug back to the run that introduced it #309

## Scope out
- No deploy. Landing puts the change on the target branch and stops there.
- No promise about defect rates or coverage. The promise is that the checks a board turns on are
  the checks that run.
- No user-written agent modules. A flow takes one rule in plain words, not a shell command.
- Nothing here starts a card without a click. Anything that does needs limits on concurrent runs,
  card count and spend first.

## Source
- `plan.md`, in commit `1127a91` — the full auto-delivery specification this group builds.
