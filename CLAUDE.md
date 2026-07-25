# Quick Dev Notes

## Skill docs don't know their caller

A skill doesn't care who calls it. Files under `skill/` never mention the local-UI
dispatcher, `ui.config.json`, or `claude -p` — how a skill gets invoked is the caller's
concern, documented on the caller's side.

## Pre-commit Checks
- **Python**: `uv run pre-commit run --all-files`
- **JavaScript/Typescript**: `cd web && pnpm typecheck && pnpm run lint`

## Long conversation

If the current session is long and all about a plan, when we finalize the plan, write a HANDOFF.md file so we can implement it in a fresh session.
