---
title: Run local delivery from an approved Cloud action
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [319]
related: [325]
modules: [skill, cloud]
questions: []
---

Turn one authenticated Cloud approval into the existing local implementation flow. Today a
remote decision can be recorded, but nothing safely hands it back to the machine that owns
the board and repository.

## Worth noting
- **Approval dispatches local work**: Cloud records and routes the decision; the execution
  node still reads the board, runs the agent, reviews the result, and lands the code.
- **The approved revision is binding**: if the local task changed after its message was
  created, the request is refused instead of implementing a specification the user did not
  approve.

<!-- agent -->

## Scope
- Register an authenticated execution node for the user's local board and repository.
- Turn one accepted **Implement** action from #319 into one claimable execution request.
- Let only the intended node claim the request, and prevent a retry or second node from
  starting the same delivery.
- Re-read the local task before starting and require the approved revision to remain `ready`.
- Run the existing build, review, correction, and landing flow without changing its local
  repository boundary.
- Report waiting, running, delivered, failed, and cancelled outcomes to Cloud without
  uploading task files, repository content, credentials, branches, or worktrees.
- Recover or cancel an interrupted request as the same delivery rather than creating another.

## Todo
- [ ] Register the user's local execution node and associate it with the local board.
- [ ] Turn an accepted current-revision approval into one claimable request.
- [ ] Refuse stale, duplicate, cancelled, and already-claimed requests.
- [ ] Start the existing local delivery flow from a valid request.
- [ ] Report meaningful delivery states and the final outcome to Cloud.
- [ ] Recover or cancel an interrupted request without duplicating delivery.
- [ ] Check that no board files, repository content, or execution credentials reach Cloud.
