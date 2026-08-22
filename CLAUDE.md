# Quick Dev Notes

## Writing Style

- Add minimal, only necessary information to SKILL.md, design.md, `cli/src/guide/*.md`, or `references/*.md`. The context is precious.
- When writing bullet points, it's recommended to use `- **bold title**: one liner` format to make the requirements scannable.
- Always use a professional and comprehensible language.
- **UI text**: assume that readers have ZERO patience. Use clean UI philosophy. The UI must be extremely intuitive and glanceable.

## The public site

`web/design.md` describes how the site in `web/` looks and is put together.

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

## The `akb` command in this repo

There is no `akb` on PATH here — `.claude/skills/kanban` is a symlink to `skill/`, so the
skill note gives the general answer. In this checkout `akb` means `node cli/bin/ai4kanban.mjs`.
Use that instead of `npx`, and never install the command globally.

## Long conversation

If the current session is long and all about a plan, when we finalize the plan, write a HANDOFF.md file so we can implement it in a fresh session.

## Git worktree

Don't use worktree/branching. Keep everything in the main branch.

## Code Style

When you see a lengthy comment, trim it down aggressively to key notes for future writers, or just remove it. Code is enough to explain itself. Add comments only when necessary.
