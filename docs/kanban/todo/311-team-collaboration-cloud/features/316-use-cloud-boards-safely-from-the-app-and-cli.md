---
title: Use Cloud boards safely from the app and CLI
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [315]
related: [311]
modules: [cloud, local-ui]
questions: []
---

Let the app and CLI work against Cloud without mistaking a stale screen for permission to write.

## Scope
- Hydrate the app from one whole-board snapshot and keep an asynchronous local cache.
- In v1, refresh only after successful mutations, rejected stale writes, or an explicit user refresh.
- Acquire the card lease before every mutation and renew it while the writer is active.
- Show the current writer and conflict clearly, but treat editor badges as hints only.
- If connectivity outlasts a lease, keep the draft local and compare the newest revision before continuing.
- Apply returned resources and snapshot cursors after successful mutations.
- Use the same authenticated Cloud endpoints from the app and CLI.
- Find a Cloud board from a checkout through its committed workspace pointer, and keep the
  machine's sign-in out of git (#311).
- Let the pointer win over board markdown left beside it: open the Cloud board and never
  read or write those files, so a stale local card cannot be edited by accident (#311).
- Tell a signed-in account that is not a member of the workspace the pointer names to ask an
  owner for an invite, rather than reporting a missing or broken board (#311).
- Read the board's configuration, tracks, modules, and per-flow rules from the workspace
  rather than from local files, so no two members run one board under different settings.
- When the preview refuses a write because it is over a free-tier limit, say so in those
  words and keep the user's edit, rather than reporting it as a conflict or a failure.

## Todo
- [ ] Open a Cloud board from a checkout's workspace pointer with the machine's own sign-in.
- [ ] Check a checkout holding both a pointer and leftover cards opens the Cloud board, and
      that no command reads or writes those files.
- [ ] Tell a non-member to ask an owner for an invite, in both clients.
- [ ] Open and render a Cloud workspace from a consistent snapshot.
- [ ] Drive every app and CLI mutation through the authenticated Cloud provider.
- [ ] Read board configuration and per-flow rules from the workspace in both clients.
- [ ] Acquire, renew, release, and recover card writer leases from both clients.
- [ ] Refresh the affected card and explain who holds it after a conflict.
- [ ] Keep disconnected drafts local and compare revisions before resuming.
- [ ] Explain a free-tier refusal without losing the edit behind it.
- [ ] Check stale caches cannot bypass server-side write rules.
