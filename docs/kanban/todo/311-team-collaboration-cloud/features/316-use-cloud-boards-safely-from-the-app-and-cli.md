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

## Todo
- [ ] Open and render a Cloud workspace from a consistent snapshot.
- [ ] Drive every app and CLI mutation through the authenticated Cloud provider.
- [ ] Acquire, renew, release, and recover card writer leases from both clients.
- [ ] Refresh the affected card and explain who holds it after a conflict.
- [ ] Keep disconnected drafts local and compare revisions before resuming.
- [ ] Check stale caches cannot bypass server-side write rules.
