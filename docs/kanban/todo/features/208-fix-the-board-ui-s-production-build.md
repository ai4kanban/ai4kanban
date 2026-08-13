---
title: Fix the board UI's production build
track: features
priority: high
roi: high
status: todo
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

The board UI builds fine in dev, but the build that goes into a release fails: `next build`
ends with `TypeError: generate is not a function` and writes nothing. The desktop app packs
that build, so no app can be released until this is fixed — and nobody notices while
working, because typecheck, lint and the dev server are all happy.

## Scope
- The release build of the board UI finishes and produces the server the app carries.
- Building the desktop app end to end works again on a clean checkout.
- Whatever broke it is caught next time before a release: the build runs as part of the
  checks, not only when someone tries to ship.

## Todo
- [ ] Find what makes the release build fail and fix it.
- [ ] Build the desktop app end to end from a clean macOS checkout, open it, and make a
      board with it on a machine with nothing installed — the release path and the board the
      app carries, checked in one pass.
- [ ] Make the release build part of the checks, so a break like this shows up the day it
      lands.
