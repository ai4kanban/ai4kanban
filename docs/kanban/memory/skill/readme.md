# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- The board format, script commands, and every flow: `skill/SKILL.md` (per-flow guides in `skill/references/`).
- The daily loop, as users drive it: `docs/guides/daily-loop.md`.
- Updating an installed skill: `skill/references/update.md`.
- Auto-refine — the agent answers a card's safe questions itself and refines not-ready cards on its own: `skill/references/auto-refine.md`.
- A finished card is kept, not deleted — archive moves it to `docs/kanban/.archive/`, which stays in git: `docs/guides/daily-loop.md`.
- A question for the user with choices is written as options they tick, not as prose with the choices inside the line — `--option "a" --option "b" [--recommended-option "c"] [--mode single|multi]`: `skill/references/resolve.md`.
- Setup's goal step offers a guide on what a good goal covers, as one line the user can skip: `docs/guides/what-makes-a-good-goal.md`.
- `goal.md` starts empty and carries a `reviewed: strong | good | pending | weak` field — the agent judges whether the goal is clear enough to plan from at the `goal` setup step and on every propose run, and `pending` marks a goal written but not judged yet, so nothing asks for a goal that is already written: `docs/guides/daily-loop.md`.
- Setup and updates are one command each — `npx ai4kanban install` copies the skill into the Claude Code and Codex folders and scaffolds the board; `npx ai4kanban update` refreshes the skill folders it finds and leaves the board alone: `skill/references/update.md`.
- Setup keeps its own steps in `docs/kanban/setup-checklist.md` and ticks each box as it goes — while the file is there the skill creates no cards, and the last tick deletes it: "Setup" in `skill/SKILL.md`.
- `kanban init` keeps `docs/kanban/.env` out of git on new boards and repairs the ignore rule on older boards, so hand-written API keys stay local: `kanban-ui/README.md`.
- Say which release a card ships in — `create --release v1`, `update <id> --release v1`, `--release ""` to take it back out; a card that names none is in no release: "The release a card ships in" in `skill/SKILL.md`.
- Plan a version — `release new v1` puts it on the list in `docs/kanban/releases.md`, `release list` shows every release in ship order with how many cards it holds and how many are ready, the cards in no release counted last: "Plan a release" in `docs/guides/daily-loop.md`.
- Close a shipped version — `release close v1` writes what it held to `docs/kanban/.release-summaries/v1.md`, clears the release off the cards still open, and takes the release off the list for good: "Close a release" in `docs/guides/daily-loop.md`.
- Run the Kanban script from the skill's own installed folder, whether the agent loaded it from `.claude/`, `.agents/`, or a plugin: `skill/SKILL.md`.
- Setup's agent steps follow one guide — config, goal, decisions, modules, first tasks, in order; the agent settles `decisions.md` from the goal before the module map, asks for nothing but the goal, and leaves every call it can't settle as `[user]` questions on one card that tops the board: `skill/references/setup.md`.
- Fill a new release as it is made — `release new v1 --fill` puts the high-priority cards with no release in on three tests (high priority, nothing open blocking, not a group root), one line per card moved or left: "Plan a release" in `docs/guides/daily-loop.md`.
- Drop a release that will not ship — `release drop v1` takes the version off the list with no shipped record, clears the release off its open cards, and a remade id never re-claims the cards an earlier close or drop listed: "Drop a release" in `docs/guides/daily-loop.md`.
- `kanban run <id>` stamps `last_run: YYYY-MM-DD HH:MM` into the recurring card's frontmatter, so the board can say when a job last ran without reading its run files: `skill/references/recurring-task.md`.
- Setup files each settled call under the module it belongs to — the `modules` step writes the map, then moves each call into that module's memory and leaves project-wide only what no single module owns: `skill/references/setup.md`.
- A recurring card carries a `cadence` (`30m`, `6h`, `1d at 09:30`) written by `create`/`update --cadence`, which is what says how often the job repeats and opts it into background runs: `skill/references/recurring-task.md`.
- Every new board starts with one recurring card, "Prune the memory", that squeezes the memory set back down; it ships with no cadence, setting its cadence to `1d` makes it prune once a day on its own, and deleting it opts out for good. The script seeds the card on the fresh scaffold and nothing puts it back, so it is never the agent's to create: `skill/lib/recurring.mjs`.
