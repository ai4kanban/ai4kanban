# Configuration

This file adapts ai4kanban to your project. `akb board init` seeds it here at
`docs/kanban/config.md`; the install step fills in the `{{PLACEHOLDERS}}` below from your
repo. Until they're filled, the default in each note applies.

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
  {{PLANNING_SOURCES}}
  _(default: the codebase, `docs/`, and the board itself.)_
- **Reference docs** — optional files the flows read when they exist. Leave blank
  if you don't have them:
  - roadmap / direction: {{ROADMAP_DOC}}
  - user-facing docs the work should keep in sync: {{DOCS_DIR}}
  - anything else worth scanning each loop: {{EXTRA_SOURCES}}
- **Preset** — an optional bundle of extra tracks and reviews for a specific kind of
  project: {{PRESET}}
  _(default: none. `akb guide preset-indie-hacker` adds growth / validation /
  building tracks, market-validation, and a moat test for a solo product launch.)_
