---
title: Add a worked example to the guides
track: docs
priority: med
roi: med
status: ready
blocked_by: []
related: []
modules: [docs]
questions: []
---

New users get the idea faster from one real example than from a spec. Add a short
walkthrough that shows the board before and after a full loop: propose, add, refine,
finish.

## Scope
- Write a guide under `docs/guides/` that walks one task from proposed to archived.
- Show the actual commands and the files that change at each step.

## Todo
- [ ] Draft the walkthrough using this repo's own board as the example.
- [ ] Show the `create` / `archive` commands and the README/board diffs.
- [ ] Link it from the README.

## Decided by the agent

- **Live board vs frozen example?** Use one small, self-contained example task and
  freeze its commands and diffs at writing time. Ground it in this repo's real
  `kanban.mjs` commands and real card / README formats — so it reads as real — but don't
  wire it to the live board, which changes daily and would rot the guide. "This repo's
  own board" means real tools and formats, not a live mirror.
- **How it differs from `daily-loop.md`?** `daily-loop.md` tells you what to *say* at
  each step. This guide *shows* the actual files and diffs one task produces, end to end
  — the concrete counterpart to the rhythm guide, so the two complement rather than
  repeat.
- **The guide's shape** — one task, idea → archived:
  1. Start: the board before — the `todo/README.md` line, nothing there yet.
  2. Add: run `create --title .. --track ..`; show the scaffolded card file and the new
     README entry (diff).
  3. Refine: show the card body go from rough to a concrete plan and pick up the `ready`
     pill.
  4. Finish: run `archive <id>`; show the card file removed, the README entry stripped,
     the shipped note recorded, and the `metrics.csv` row bump.
  5. Recap: the handful of file changes at a glance.
- **Example task:** pick a small, self-contained one (e.g. a minor local-ui tweak) so
  the whole loop stays short and every diff fits on screen.
- **README link:** add a short "Guides" list to the README and link the new guide there;
  list the existing `daily-loop.md` in the same spot too — it isn't linked today.
- **Modules:** tagged `docs`.
