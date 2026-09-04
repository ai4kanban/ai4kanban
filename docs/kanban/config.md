# Configuration

- **Setup gate** — while `docs/kanban/setup-checklist.md` sits next to this file, setup
  is unfinished: create no cards. `akb guide setup` says what to do instead.
- **Project** — AI4Kanban: AI project management that grows with you. You give it a vague
  idea; it breaks the idea down, settles what it can from memory, asks you the rest, and
  keeps going until the spec is clear enough to build. The board is plain markdown in git.
- **Planning sources** — what to read when proposing new work:
  - the code: `cli/` (the `akb` command, the board's rules, and the flows in `cli/src/guide/`),
    `skill/` (the short note installed into a project), `kanban-ui/`, `web/`.
  - the board itself: `docs/kanban/todo/` and the memory in `docs/kanban/memory/`.
  - `README.md` for what we promise today, `web/content/docs/` for what we teach.
- **Reference docs** — optional files the flows read when they exist. Leave blank
  if you don't have them:
  - roadmap / direction: `docs/kanban/memory/goal.md`, plus the Roadmap section of `README.md`
  - user-facing docs the work should keep in sync: `web/content/docs/`, `README.md`,
    `README-zh.md`, and the site copy in `web/`
  - anything else worth scanning each loop: `CLAUDE.md` (repo conventions), `web/design.md`
    (how the site is put together), `PUBLISHING.md` (how a release ships)
