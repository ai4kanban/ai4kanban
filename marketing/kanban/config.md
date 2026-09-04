# Configuration

This file adapts ai4kanban to this board. `akb raw init --solution marketing` seeds it;
edit the defaults whenever the work needs something different.

The board's flows read these values — when one says "your planning sources", it means what's
set here.

- **Solution** — marketing
  _(what this board's work is. It picks the flow text every run reads; don't change it
  without moving the board's files to match.)_
- **Project** — AI4Kanban: AI project management that grows with you. An open-source,
  local-first kanban board that a coding agent runs — it proposes the work, clarifies a
  vague idea into a build-ready spec, and asks the human only what needs taste.
- **Planning sources** — what to read when proposing new topics:
  the product board's `docs/kanban/memory/goal.md` and `memory/readme.md` (what shipped →
  what to launch), the site's own docs, and this board's `memory/published.md` and
  `memory/rejected.md`.
- **Reference docs** — optional files the flows read when they exist:
  - the voice: `memory/writing.md` and everything under `memory/writing/`
  - what is already out: `memory/published.md`
  - anything else worth scanning each loop: none
