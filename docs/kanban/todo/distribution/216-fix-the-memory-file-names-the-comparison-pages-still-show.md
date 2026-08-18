---
title: Fix the memory file names the comparison pages still show
track: distribution
priority: low
roi: low
status: ready
release: ""
blocked_by: []
related: [228]
modules: [site]
questions: []
---

The Hermes comparison page tells readers the board's memory is `archive.md` and
`memory.md`. The board writes neither, so a reader comparing us to a competitor is reading
a made-up file list. Every comparison page also has a plain-Markdown copy under
`web/public/`. The Multica page itself already names the right files; its plain-Markdown
copy does not.

## Scope
- The Hermes page names only the files the board writes: `readme.md`, `decisions.md`,
  `rejected.md`, and `redesign.md`.
- It says those four sit in one folder per module — the board keeps its own set for each
  part of the project.
- It says `goal.md` sits on its own at the top of the memory folder.
- Each of the four keeps a short note saying what it holds:
  - `readme.md` — what shipped.
  - `decisions.md` — the calls that were settled, and why.
  - `rejected.md` — what we turned down, and why.
  - `redesign.md` — design mistakes not to repeat.
- English (`en.ts`) and the four translations (`zh`, `es`, `ja`, `fr`) change in one pass.
- A page's plain-Markdown copy says the same as the page.

## Todo
- [ ] Rewrite the memory paragraph in `web/i18n/vs-hermes-kanban/en.ts` and the `zh`,
      `es`, `ja`, `fr` files beside it.
- [ ] Fix the memory section of `web/public/vs-hermes-kanban.md`, that page's
      plain-Markdown copy.
- [ ] In `web/public/vs-multica.md`, replace the `memory.md` line with `decisions.md` —
      the calls that were settled, and why — so it matches the Multica page.
- [ ] Check that no other comparison page or plain-Markdown copy names a memory file the
      board doesn't write.

## Decided by the agent
- Does the Multica page itself still need rewriting? No. All five language files already
  name `decisions.md`, `rejected.md`, and `redesign.md`. Only its plain-Markdown copy is
  stale.
- `web/public/recipes/daily-kanban-maintenance.md` names `memory.md` too — is it part of
  this? No. That whole recipe is written for an older board, which is more than a rename.
  #228 owns it.
- Which file replaces `memory.md`? `decisions.md` — the old line meant the record of
  settled calls, and that record is now `decisions.md`. `readme.md` replaces `archive.md`.
- Why change all five languages together? A page left in the old wording still tells its
  reader the wrong thing.
