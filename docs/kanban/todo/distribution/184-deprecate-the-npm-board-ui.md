---
title: Mark the npm board UI deprecated on the registry
track: distribution
priority: med
roi: med
status: todo
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

The desktop app is the way in now, and everything we ship already says so — except npm. Someone who runs `npx ai4kanban-ui` today gets no sign from the registry that this way is retired. Mark it, so the package itself points at the app.

## Scope
- The `ai4kanban-ui` package is marked deprecated on npm, with a line that points at
  `ai4kanban.dev/download`.
- The package is not pulled. Anyone already on it keeps working — they just get told where
  the app is.
- No release lands on the package again. It stays at the version that is out.
- The app itself and the browser board already print the deprecation; this is the registry
  saying the same thing.

## Todo
- [ ] Deprecate `ai4kanban-ui` on npm, with the line pointing at the download page.
      `PUBLISHING.md` already carries the exact command and how to authenticate for it.
- [ ] Install the package in a throwaway folder and check the deprecation line shows,
      and that running it still works.
