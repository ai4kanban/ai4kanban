# Configuration

- **Project** — AI4Kanban: AI project management that grows with you. You give it a vague
  idea; it breaks the idea down, settles what it can from memory, asks you the rest, and
  keeps going until the spec is clear enough to build. The board is plain markdown in git.
- **Tracks** — the buckets a task can live in, with a rough share of effort:
  - `features` 40% — new board behavior a user can see, in the skill or the local UI.
  - `skill` 30% — the skill itself: `SKILL.md`, `kanban.mjs`, the references, the flows.
  - `docs` 15% — the user guides in `docs/guides/` and the two READMEs.
  - `distribution` 15% — the landing site, launch posts, and anything else that puts the
    project in front of people.
- **Planning sources** — what to read when proposing new work:
  - the code: `skill/`, `kanban-ui/`, `web/`.
  - the board itself: `docs/kanban/todo/` and the memory in `docs/kanban/memory/`.
  - `README.md` for what we promise today, `docs/guides/` for what we teach.
- **Reference docs** — optional files the skill reads when they exist. Leave blank
  if you don't have them:
  - roadmap / direction: `docs/kanban/memory/goal.md`, plus the Roadmap section of `README.md`
  - user-facing docs the work should keep in sync: `docs/guides/`, `README.md`,
    `README-zh.md`, and the site copy in `web/`
  - anything else worth scanning each loop: `CLAUDE.md` (repo conventions), `web/design.md`
    (how the site is put together), `PUBLISHING.md` (how a release ships)
- **Preset** — an optional bundle of extra tracks and reviews for a specific kind of
  project: none.
  _(`references/presets/indie-hacker.md` adds growth / validation / building tracks,
  market-validation, and a moat test for a solo product launch.)_
