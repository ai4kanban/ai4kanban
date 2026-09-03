# Configuration

This file adapts ai4kanban to your project. `akb raw init` seeds it at
`docs/kanban/config.md`; setup fills in the project and tracks. Edit the defaults whenever
the project needs something different.

The board's flows read these values — when one says "your tracks", "your planning
sources", or "your reference docs", it means what's set here.

**This file lives with your board, at `docs/kanban/config.md`, and carries your project's
settings — it's yours.** The skill folder (`SKILL.md`, `kanban.mjs`) is generic and owned
by upstream, so an update overwrites it wholesale; this file is never touched. See
`akb guide update`.

- **Setup gate** — while `docs/kanban/setup-checklist.md` sits next to this file, setup
  is unfinished: create no cards. `akb guide setup` says what to do instead.
- **Project** — {{PROJECT_NAME}}: {{PROJECT_GOAL}}
  _(default: this repository; its goal is whatever the README states.)_
- **Tracks** — the buckets a task can live in, with a rough share of effort:
  {{TRACKS}}
  _(default: `feature` 60%, `bug` 25%, `research` 15%. A track is just a folder
  under `docs/kanban/todo/`.)_
- **Planning sources** — what to read when proposing new work:
  the README and package manifests, the codebase, project documentation, and board memory.
- **Reference docs** — optional files the flows read when they exist:
  - roadmap / direction: none
  - user-facing docs the work should keep in sync: `docs/` when it contains project docs
  - anything else worth scanning each loop: none
- **Preset** — none. `akb guide preset-indie-hacker` adds growth, validation, and building
  tracks plus launch-focused reviews.
