---
title: Fix the memory file names the comparison pages still show
track: distribution
priority: low
roi: low
status: todo
release: ""
blocked_by: []
related: [215]
modules: [site]
questions: []
---

The Hermes and Multica comparison pages tell readers the board's memory is `memory.md` and
`archive.md`. The board has neither. A reader comparing us to a competitor is reading a
made-up file list.

## Scope
- The memory files a page names are the ones the board writes: `readme.md`, `decisions.md`,
  `rejected.md`, `redesign.md`, and `goal.md` at the board root.
- The Hermes page says the memory is per module, which is how the board stores it.
- Fix the English copy and the four translations together, so no language is left behind.

## Todo
- [ ] Rewrite the memory paragraph in `web/i18n/vs-hermes-kanban/en.ts` and the `zh`, `es`,
      `ja`, `fr` files beside it.
- [ ] Rewrite the memory line in the Multica page copy.
- [ ] Update the plain-Markdown mirrors `web/public/vs-hermes-kanban.md` and
      `web/public/vs-multica.md` to match.
- [ ] Search the rest of `web/` for `memory.md` and `archive.md` and fix what is left.
