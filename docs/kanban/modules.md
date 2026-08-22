# Modules

If a line here disagrees with the repo you just read, fix the line.

- **skill** — ai4kanban itself: the board format, the `akb` command, and the rules and flows it carries. `cli/` (the sources — `src/guide/` are the flows, `src/templates/` the blank config, all built into the one `cli/dist/kanban.mjs`, which is not in git), `skill/` (`SKILL.md` alone: the one file a project gets, inlined into that build; installed in this repo via the `.claude/skills/kanban` symlink; packaged as a Claude Code plugin in `.claude-plugin/`).
- **local-ui** — the UI to drive the board from buttons: the browser app published as `ai4kanban-ui`, and the desktop app that wraps it. `kanban-ui/`, `desktop/`.
- **site** — the marketing and landing site, deployed to Cloudflare Pages. `web/`.
- **docs** — the user guides. `docs/guides/`.
- **telemetry** — the service that takes in usage events from the app and the site, and where those events are stored and read. No code yet.
