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
server catches up with durable requests, claims the approved revision, and runs it on the
machine that owns the board and repository.

## Worth noting
- **A board attaches exactly one server**: the machine that holds the board is the one that
  runs its work, so a request never has to be routed and a second machine never races for it.
  The cost is that a board whose server is off waits for that machine and no other; routing
  across several servers is a later version's work.
- **A board's server is the machine, not a process**: one shared module makes the desktop app
  and a terminal `akb` act as the same server, at the cost of one lifecycle that must work in
  both long- and short-lived processes.
- **The approved revision is binding**: if the local task changed after its message was
  created, the request is refused rather than implementing a specification the user did not
  approve. The cost is an approval that can be wasted by an edit made a moment later.
- **A killed server leaves work to finish by hand**: the claim runs on a lease, and an expired
  lease reads as interrupted and stays on that server rather than passing to another. The cost is
  that a crashed machine's delivery waits for the user to resume or cancel it; the alternative
  would rerun a build on a repository the first server may already have written to.

<!-- agent -->

## Scope
- Attach exactly one authenticated server to the user's local board and repository, and refuse
  a second attachment rather than routing between them.
- Let the user disable a server, and stop a server claiming anything once it is disabled or the
  machine signs out; the local board is unchanged either way.
- Catch up through the Worker on startup and reconnection, then use private Supabase Realtime
  request hints while the local process remains active.
- Turn one accepted **Implement** action from #319 into one claimable execution request.
- Let only the board's own server claim the request, and prevent a retry or a second local
  process from starting the same delivery.
- Re-read the local task before starting and require the approved revision to remain `ready`.
- Run the existing build, review, correction, and landing flow inside its local repository
  boundary.
- Hold the claim on a lease the running server renews, so a server that is killed, put to sleep,
  or cut off stops looking like it is still working.
- Read an expired lease as `interrupted` wherever the request is read or written, rather than
  waiting for a sweep or for the dead server to say so: the expiry is in the row, and the server
  that would have reported is the one that is gone.
- Keep an interrupted request bound to the server that claimed it, and let no other server claim
  it, because local changes may already exist in that repository.
- Report the same state names #319 fixed — waiting for server, running, completed, failed,
  cancelled, interrupted — to Cloud while task files, repository content, credentials,
  branches, and worktrees stay on the local machine.
- Recover or cancel an interrupted request as the same delivery rather than creating another.

## Todo
- [ ] Attach one server to the local board, and refuse a second attachment.
- [ ] Let the user disable a server, and refuse a claim from a disabled server or a signed-out
      machine.
- [ ] Add durable request catch-up through the Worker and private Realtime wake-up hints to
      the desktop app and `akb`.
- [ ] Turn an accepted current-revision approval into one claimable request.
- [ ] Refuse stale, duplicate, cancelled, and already-claimed requests.
- [ ] Start the existing local delivery flow from a valid request.
- [ ] Renew the claim's lease while the delivery runs, and read an expired lease as
      `interrupted` on every read and write of the request, without freeing it for another server.
- [ ] Report meaningful delivery states and the final outcome to Cloud, under #319's state
      names.
- [ ] Recover or cancel an interrupted request under its original delivery ID.
- [ ] Check that Cloud receives only request state and execution outcomes while local files
      and credentials remain on the machine.
- [ ] Check that killing the server mid-delivery leaves exactly one interrupted request, and
      that a disabled server claims nothing.

## Decided by the agent
- **What tells Cloud a server has died**: the lease expiring, not a report. A killed server sends
  nothing, so a claim with no expiry would show the user `running` forever.
- **What turns `running` into `interrupted`**: whoever next reads or writes the request,
  comparing the stored expiry. Cloud runs no sweep, and the only process that could report is
  the one that died — so a state nobody derives is a state nobody ever sees.
- **Why `unknown` is not a tenth state**: an expired lease already means we do not know what
  the server finished, and the user's next move — resume or cancel — is the same either way.
  #319 fixes nine names, and a tenth would be one the desktop and Slack cannot render.
- **Why disablement sits here rather than in #326**: signing out belongs to the account, but a
  server is a machine registered against a board, and this card is what registers one.
