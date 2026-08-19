---
title: Prune oversized documentation
track: recurring
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: []
questions: []
---

Shrink this project's hand-written documentation back to what helps readers find setup and
everyday workflows. Repeat the pass so README files and guides do not quietly grow into
thousands of lines again.

## Process

1. Inventory the hand-written, reader-facing Markdown, starting with root and package
   README files and guides under `docs/`. Always review `kanban-ui/README.md`. Ignore
   generated files, vendored docs, changelogs, API references, and everything under
   `docs/kanban/` — cards and memory have their own flows.
2. For each document that has grown hard to scan, state who it is for and what job it does,
   then rewrite it as topics with the shortest complete path through its common tasks.
   Merge repeated explanations and keep one canonical explanation of each behavior.
3. Drop stale behavior, implementation detail, release history, and step-by-step stories.
   Replace detail with a link only after confirming that its destination covers it. Keep
   unique user-facing behavior, runnable commands, prerequisites, compatibility notes,
   deprecation notices, and safety warnings.
4. When a necessary large block serves a narrower task or audience, move it into a focused
   reference document and leave a concise, descriptive link in the README. Give each
   reference one clear subject and keep its prerequisites and context with it. Do not split
   prose into fragments merely to make the README's line count look smaller.
5. Check every changed link, heading anchor, and command example. Review the diff for lost
   requirements, and report each document's before/after line count plus what was merged,
   moved, or removed. Every selected document should end materially shorter and easier to
   navigate without making readers chase links for the common path.
