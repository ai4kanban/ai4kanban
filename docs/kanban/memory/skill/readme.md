# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- The board format, script commands, and every flow: `skill/SKILL.md` (per-flow guides in `skill/references/`).
- The daily loop, as users drive it: `docs/guides/daily-loop.md`.
- Updating an installed skill: `skill/references/update.md`.
- Auto-refine — the agent answers a card's safe questions itself and refines not-ready cards on its own: `skill/references/auto-refine.md`.
- A finished card is kept, not deleted — archive moves it to `docs/kanban/.archive/`, which stays in git: `docs/guides/daily-loop.md`.
- A question for the user with choices is written as options they tick, not as prose with the choices inside the line — `--option "a" --option "b" [--recommended-option "c"] [--mode single|multi]`: `skill/references/resolve.md`.
- `goal.md` carries a `reviewed: strong | weak` field — the agent judges whether the goal is clear enough to plan from and writes the field itself: `docs/guides/daily-loop.md`.
- Setup and updates are one command each — `npx ai4kanban install` copies the skill into the Claude Code and Codex folders and scaffolds the board; `npx ai4kanban update` refreshes the skill folders it finds and leaves the board alone: `skill/references/update.md`.
- Setup keeps its own steps in `docs/kanban/setup-checklist.md` and ticks each box as it goes — while the file is there the skill creates no cards, and the last tick deletes it: "Setup" in `skill/SKILL.md`.
- `kanban init` keeps `docs/kanban/.env` out of git on new boards and repairs the ignore rule on older boards, so hand-written API keys stay local: `kanban-ui/README.md`.
- Say which release a card ships in — `create --release v1`, `update <id> --release v1`, `--release next` to take it back out; a card that names none is `next`: "The release a card ships in" in `skill/SKILL.md`.
- Plan a version — `release new v1` puts it on the list in `docs/kanban/releases.md`, `release list` shows every release in ship order with how many cards it holds and how many are ready, `next` last: "Plan a release" in `docs/guides/daily-loop.md`.
- Close a shipped version — `release close v1` writes what it held to `docs/kanban/.release-summaries/v1.md`, sends the cards still open back to `next`, and takes the release off the list for good: "Close a release" in `docs/guides/daily-loop.md`.
- Run the Kanban script from the skill's own installed folder, whether the agent loaded it from `.claude/`, `.agents/`, or a plugin: `skill/SKILL.md`.
