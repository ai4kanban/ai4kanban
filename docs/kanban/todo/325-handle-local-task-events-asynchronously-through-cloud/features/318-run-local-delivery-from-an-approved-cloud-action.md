---
title: Run local delivery from an approved Cloud action
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [319]
related: [325]
modules: [cloud, local-ui, skill]
questions: []
---

Turn one authenticated Cloud approval into the existing local implementation flow. The local
node catches up with durable requests, claims the approved revision, and runs it on the
machine that owns the board and repository.

## Worth noting
- **The node ships with both local tools**: one shared node module serves the desktop board
  server while the app runs and `akb` when invoked from a terminal, at the cost of one
  lifecycle that must work in both long- and short-lived processes.
- **The approved revision is binding**: if the local task changed after its message was
  created, the request is refused rather than implementing a specification the user did not
  approve. The cost is an approval that can be wasted by an edit made a moment later.
- **A killed node leaves work to finish by hand**: the claim runs on a lease, and an expired
  lease reads as interrupted and stays on that node rather than passing to another. The cost is
  that a crashed machine's delivery waits for the user to resume or cancel it; the alternative
  would rerun a build on a repository the first node may already have written to.

<!-- agent -->

## Scope
- Register an authenticated execution node for the user's local board and repository.
- Let the user disable a node, and stop a node claiming anything once it is disabled or the
  machine signs out; the local board is unchanged either way.
- Catch up through the Worker on startup and reconnection, then use private Supabase Realtime
  request hints while the local process remains active.
- Turn one accepted **Implement** action from #319 into one claimable execution request.
- Let only the intended node claim the request, and prevent a retry or second node from
  starting the same delivery.
- Re-read the local task before starting and require the approved revision to remain `ready`.
- Run the existing build, review, correction, and landing flow inside its local repository
  boundary.
- Hold the claim on a lease the running node renews, so a node that is killed, put to sleep,
  or cut off stops looking like it is still working.
- Read an expired lease as `interrupted` wherever the request is read or written, rather than
  waiting for a sweep or for the dead node to say so: the expiry is in the row, and the node
  that would have reported is the one that is gone.
- Keep an interrupted request bound to the node that claimed it, and let no other node claim
  it, because local changes may already exist in that repository.
- Report the same state names #319 fixed — waiting for node, running, completed, failed,
  cancelled, interrupted — to Cloud while task files, repository content, credentials,
  branches, and worktrees stay on the local machine.
- Recover or cancel an interrupted request as the same delivery rather than creating another.

## Todo
- [ ] Register the user's local execution node and associate it with the local board.
- [ ] Let the user disable a node, and refuse a claim from a disabled node or a signed-out
      machine.
- [ ] Add durable request catch-up through the Worker and private Realtime wake-up hints to
      the desktop board server and `akb`.
- [ ] Turn an accepted current-revision approval into one claimable request.
- [ ] Refuse stale, duplicate, cancelled, and already-claimed requests.
- [ ] Start the existing local delivery flow from a valid request.
- [ ] Renew the claim's lease while the delivery runs, and read an expired lease as
      `interrupted` on every read and write of the request, without freeing it for another node.
- [ ] Report meaningful delivery states and the final outcome to Cloud, under #319's state
      names.
- [ ] Recover or cancel an interrupted request under its original delivery ID.
- [ ] Check that Cloud receives only request state and execution outcomes while local files
      and credentials remain on the machine.
- [ ] Check that killing the node mid-delivery leaves exactly one interrupted request, and
      that a disabled node claims nothing.

## Decided by the agent
- **What tells Cloud a node has died**: the lease expiring, not a report. A killed node sends
  nothing, so a claim with no expiry would show the user `running` forever.
- **What turns `running` into `interrupted`**: whoever next reads or writes the request,
  comparing the stored expiry. Cloud runs no sweep, and the only process that could report is
  the one that died — so a state nobody derives is a state nobody ever sees.
- **Why `unknown` is not a tenth state**: an expired lease already means we do not know what
  the node finished, and the user's next move — resume or cancel — is the same either way.
  #319 fixes nine names, and a tenth would be one the desktop and Slack cannot render.
- **Why disablement sits here rather than in #326**: signing out belongs to the account, but a
  node is a machine registered against a board, and this card is what registers one.
