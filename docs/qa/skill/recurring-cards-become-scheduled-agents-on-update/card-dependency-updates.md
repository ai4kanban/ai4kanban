Keep the project's dependencies from falling months behind: look once a week, and open a card for each upgrade worth doing.

## Run state

- Last checked: never
- Skipped on purpose: see `docs/kanban/todo/recurring/dependency-notes/ignore.md`

## Process

1. Run `npm outdated` and drop every package listed in `docs/kanban/todo/recurring/dependency-notes/ignore.md`.
2. For each major upgrade left, create one card with `akb raw create`.
3. Write today's date under "Last checked" in `## Run state`.
