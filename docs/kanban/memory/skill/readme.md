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
