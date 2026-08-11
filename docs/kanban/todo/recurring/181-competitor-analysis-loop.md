---
title: Competitor analysis loop
track: recurring
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: []
questions:
  - Should the six /vs-* comparison pages be generated from the competitor checklists instead of kept by hand?
  - dist0's competitors.list runs against a dist0 project — is there one for AI4Kanban, or does this loop keep working from the six hand-picked competitors?
---

Keep one feature checklist per competitor, so we can see at a glance what they offer that
we already ship, what a card is building, and what nobody has touched. This is our own run
of the recipe we publish at `web/public/recipes/competitor-analysis-loop.md`.

## Process

1. Run the loop written in `web/public/recipes/competitor-analysis-loop.md` — that file is
   the full instruction set, read it first. Steps 2–6 below are the only things that differ
   for this board.
2. **Where the files live.** The index is
   `docs/kanban/todo/recurring/competitor-analysis/result.md`; each checklist is
   `docs/kanban/todo/recurring/competitor-analysis/competitors/<slug>.md`.
3. **What counts as a real competitor.** It plans, tracks, or manages development work for
   someone who builds with a coding agent — a solo developer or a small team running Claude
   Code or similar. A product that only runs agents, only chats, or only hosts code is a
   false positive.
4. **What counts as shipped** (the rule for ticking a box): it is in
   `docs/kanban/memory/readme.md` or any `docs/kanban/memory/<module>/readme.md`, or in
   `README.md`, `README-zh.md`, `docs/guides/`, or the site copy under `web/`.
5. **Keep the comparison pages honest.** Six competitors have a hand-written page on the
   site (`/vs-task-master`, `/vs-github-issues`, `/vs-hermes-kanban`, `/vs-vibe-kanban`,
   `/vs-linear`, `/vs-multica`). When a fresh checklist contradicts one of those pages —
   a feature they have gained, one they no longer have, or one we now ship — file a card to
   update that page.
6. Record the run: `node .claude/skills/kanban/kanban.mjs run 181`.
