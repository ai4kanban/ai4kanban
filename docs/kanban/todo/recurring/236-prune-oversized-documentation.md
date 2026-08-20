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
last_run: 2026-08-20 09:35
questions:
  - The board's whole user guide lives in kanban-ui/README.md, the deprecated npm package's README, and most readers now arrive through the desktop app. Move it to docs/guides/ and leave the package README as a deprecation notice, or keep it where docs/kanban/memory/local-ui/decisions.md settled it?
---

Shrink this project's hand-written documentation back to what helps readers find setup and
everyday workflows.

## The documents

The set is small enough to keep listed here, so the pass starts from this table instead of
rediscovering it. Each row names the reader a document serves and the job it does; that is
the standard its rewrite is measured against.

| Document | Reader | Job |
| --- | --- | --- |
| `README.md`, `README-zh.md` | someone meeting the project on GitHub | say what AI4Kanban is, then send them to the download and the daily loop. The Chinese file mirrors the English one — change both together |
| `cli/README.md` | someone on the npm page | install and update the CLI, and say what the command owns |
| `kanban-ui/README.md` | anyone using the board's pages, in the app or in the deprecated npm package | the whole user guide to the board — what every column, panel, button and setting does. Open with the deprecation notice and the app download, then teach the pages |
| `desktop/README.md` | someone running the app | which build to download, and what it still needs on the machine |
| `docs/guides/daily-loop.md` | a user driving a board that already exists | the everyday rhythm — what to say, and which button does the same thing |
| `docs/guides/what-makes-a-good-goal.md` | a user writing `docs/kanban/memory/goal.md` | advice, not a format, on a goal the board can plan against |
| `PUBLISHING.md` | the maintainer cutting a release | what ships where, and in what order |
| `web/design.md`, `kanban-ui/design.md` | a contributor changing a page or a panel | the visual and interaction rules each app is held to |
| `AGENTS.md`, `CLAUDE.md` | an agent or contributor working in this checkout | the checks to run and the local conventions |

Out of scope: everything under `docs/kanban/`, since cards and memory have their own flows;
what the CLI ships to agents — the flow guides in `cli/src/guide/`, the skill note in
`skill/SKILL.md`, and the templates in `cli/src/templates/`; site copy and blog posts under
`web/public/` and `web/blogs/`; and generated files, vendored docs, changelogs, and API
references.

## Process

1. **Reconcile the table first**: confirm every listed document still exists, add a row for
   any new hand-written reader-facing one, and correct a job that no longer matches what
   the document does. Do this before touching prose.
2. **Rewrite against the stated job**: take the documents that have grown hard to scan and
   rewrite each as topics that give the shortest complete path through its common tasks,
   judged against its row. Merge repeated explanations so each behavior is explained once,
   in one place.
3. **Cut what no longer earns its place**: drop stale behavior, implementation detail,
   release history, and step-by-step stories. Replace detail with a link only after
   confirming the destination covers it. Keep unique user-facing behavior, runnable
   commands, prerequisites, compatibility notes, deprecation notices, and safety warnings.
4. **Move narrow material out, don't fragment it**: when a large block is genuinely needed
   but serves a narrower task or audience, give it its own reference document and leave a
   short, descriptive link in the README. Each reference gets one subject and keeps its
   prerequisites and context with it. Never split prose just to lower a README's line count.
   Before moving a document or a whole section to another file, check the owning module's
   `decisions.md` — where a document lives is often already settled there. If it is, leave
   it where it is and raise the move as a question instead.
5. **Verify and report**: check every changed link, heading anchor, and command example,
   then read the diff for requirements lost along the way. Report each document's
   before/after line count and what was merged, moved, or removed. Every document you
   touched should end materially shorter and easier to navigate, without making readers
   chase links for the common path.
