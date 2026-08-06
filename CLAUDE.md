# Quick Dev Notes

## Skill Writing

Add minimal, only necessary information to SKILL.md and references/*.md. The context is precious.

## The public site

`web/design.md` describes how the site in `web/` looks and is put together — the color
tokens, the panel, where the styling goes, and where the copy lives. It is about design
only; routing lives in comments in the files that own it. Read it before changing a page.

## Pre-commit Checks
- **Python**: `uv run pre-commit run --all-files`
- **JavaScript/Typescript**: run in whichever app you touched — `web/` (the public site)
  and `kanban-ui/` (the local board UI) each have their own checks. Don't use `pnpm build`.
  - `cd web && pnpm typecheck && pnpm run lint`
  - `cd kanban-ui && pnpm typecheck && pnpm run lint`

## Long conversation

If the current session is long and all about a plan, when we finalize the plan, write a HANDOFF.md file so we can implement it in a fresh session.

## Git worktree

Don't use worktree/branching. Keep everything in the main branch.
