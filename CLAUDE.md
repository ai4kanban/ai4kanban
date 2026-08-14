# Quick Dev Notes

## Skill Writing

The words live in two places and nowhere else: `skill/SKILL.md` — the short note installed
into a project, which only says the board is here and that `akb` owns it — and
`cli/src/guide/*.md`, the flows, which ship with the command. Add minimal, only necessary
information to either. The context is precious.
When writing a flow, it's recommended to use `- **bold title**: one liner` format to make the requirements scannable.

## The public site

`web/design.md` describes how the site in `web/` looks and is put together — the color
tokens, the panel, where the styling goes, and where the copy lives. It is about design
only; routing lives in comments in the files that own it. Read it before changing a page.

## Pre-commit Checks
- **Python**: `uv run pre-commit run --all-files`
- **JavaScript/Typescript**: run in whichever app you touched — `web/` (the public site),
  `kanban-ui/` (the local board UI) and `cli/` (the `akb` command and the board's rules)
  each have their own checks. Don't use `pnpm build`.
  - `cd web && pnpm typecheck && pnpm run lint`
  - `cd kanban-ui && pnpm typecheck && pnpm run lint`
  - `cd cli && npm run lint` — typechecks `src/`. The rules build to `cli/dist/kanban.mjs`,
    which is a build product and not in git: `npm install` in `cli/` makes it, and there is
    nothing to commit or keep in sync.

## Long conversation

If the current session is long and all about a plan, when we finalize the plan, write a HANDOFF.md file so we can implement it in a fresh session.

## Git worktree

Don't use worktree/branching. Keep everything in the main branch.
