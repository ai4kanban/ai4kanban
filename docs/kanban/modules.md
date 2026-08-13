# Modules

If a line here disagrees with the repo you just read, fix the line.

- **skill** — ai4kanban itself: the board format, the `akb` command and the board's rules it carries, and the references the agent follows. `cli/` (the sources, built into the one `skill/kanban.mjs`), `skill/` (the words and that built file; installed in this repo via the `.claude/skills/kanban` symlink; packaged as a Claude Code plugin in `.claude-plugin/`).
- **local-ui** — the UI to drive the board from buttons: the browser app published as `ai4kanban-ui`, and the desktop app that wraps it. `kanban-ui/`, `desktop/`.
- **site** — the marketing and landing site, deployed to Cloudflare Pages. `web/`.
- **docs** — the user guides. `docs/guides/`.
