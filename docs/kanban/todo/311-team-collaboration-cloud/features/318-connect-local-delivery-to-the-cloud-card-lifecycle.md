---
title: Connect local delivery to the Cloud card lifecycle
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [315, 316]
related: [311]
modules: [skill, cloud]
questions: []
---

Finish Cloud cards from local execution nodes without letting Cloud touch the repository.

## Scope
- Acquire the writer lease and capture the current card revision before local work starts.
- Keep drafts, worktrees, agents, branches, commits, and credentials on the execution node.
- Upload and freeze the final card body before landing code locally.
- Confirm the prepared delivery with a commit reachable from the configured local main branch.
- Make confirmation idempotent, record the commit and attribution, mark the card delivered, and release the lease.
- Record the delivery in the workspace — the card as approved, the review outcome, the rules
  applied, how it ended, and the commit with who landed it — and leave worktree paths and
  branch names on the node (#311).
- Abort and restore the prior card state when landing fails.
- Leave an explicit pending attempt after a crash; the same node or an owner can confirm or abort it.
- Fence delayed confirmation after a newer attempt or an abort.

## Todo
- [ ] Start a local delivery from an authenticated leased Cloud card.
- [ ] Prepare and freeze the final card before git landing.
- [ ] Land through the existing local delivery workflow and verify the commit locally.
- [ ] Confirm delivery idempotently and release the card.
- [ ] Record each delivery in the workspace so a team reads one audit trail.
- [ ] Abort safely after failed landing.
- [ ] Recover or abort a pending delivery after a crash.
- [ ] Check Cloud never reads or changes the repository.
