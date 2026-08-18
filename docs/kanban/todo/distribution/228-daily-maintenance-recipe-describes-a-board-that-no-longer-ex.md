---
title: The daily maintenance recipe describes a board that no longer exists
track: distribution
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [216]
modules: [site]
questions: []
---

The recipe at `/recipes/daily-kanban-maintenance` publishes a prompt written for an older
board. It tells the reader to read `docs/kanban/memory.md`, park open questions in
`docs/kanban/open-questions.md`, and run `.claude/skills/kanban/quickview.mjs`. None of
those exist. Someone who copies the recipe onto their own board gets a routine that fails
on its first step.

## Scope
- The steps read the memory files the board writes today: `readme.md`, `decisions.md`,
  `rejected.md`, and `redesign.md` — one set for each part of the project — plus `goal.md`
  on its own.
- A question the run can't settle goes in the card's own `questions` field, not in a
  separate file.
- Every move the recipe does by hand — changing a card's priority, filing a card away,
  counting a run — is an `akb` command instead.
- The recipe keeps the same purpose, the same once-a-day rhythm, and the same steps in the
  same order.
- The short blurb on the recipes page and the recipe's one line in `llms.txt` say the same
  as the rewritten recipe.

## Todo
- [ ] Rewrite `web/public/recipes/daily-kanban-maintenance.md`.
- [ ] Update the recipe's blurb and step list in `web/components/recipes/recipes-content.ts`
      and its line in `web/public/llms.txt`.
- [ ] Follow the rewritten recipe once, top to bottom, on this repo's board, and fix any
      step that doesn't work.
- [ ] Run the recipe's landing copy through the `verify-recipe` skill before it goes out.

## Decided by the agent
- Rewrite the steps, or drop the recipe and write a new one? Rewrite. The routine it
  teaches is still the one we want; only the files and commands it names are out of date.
- Is this part of #216, which fixes the same wrong file names on the comparison pages? No.
  There the fix is a rename; here the whole recipe is written for a board we don't have.
