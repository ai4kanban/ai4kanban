# Quick Dev Notes

## Writing Style

- Add minimal, only necessary information to SKILL.md, design.md, `cli/src/guide/*.md`, or `references/*.md`. The context is precious. Trim them while you add new rules. Don't just pile up.
  - You can assume agents today perform better if you give them short and generic requirement instead of very specific, lengthy rules.
- When writing bullet points, it's recommended to use `- **bold title**: one liner` format to make the requirements scannable.
- Always use a professional and comprehensible language.
- **UI text**: assume that readers have ZERO patience. Use clean UI philosophy. The UI must be extremely intuitive and glanceable. No explanation notes unless actually necessary.

## Answering

- Just answer what I ask, in a minimal language. If you make a mistake, admit and correct it. Don't argue what you already know your're wrong.
- Use ascii diagram if the thing you're explaining is complex.

## System Design

We discourage over-design.

## Branches

- **`legacy`**: the frozen v0.11.2 code — the old apps (`kanban-ui/`, `web/`, `desktop/`, `cloud-ui/`, `telemetry/`) live only there; look there for them. Never commit to it. All development happens on `main`.

## Pre-commit Checks

- **Python**: `uv run pre-commit run --all-files`
- **JavaScript/Typescript**: run in whichever app you touched. Don't use `pnpm build`.
  - `cd cli && npm run lint` — typechecks `src/`. The rules build to `cli/dist/kanban.mjs`,
    which is a build product and not in git: `npm install` in `cli/` makes it, and there is
    nothing to commit or keep in sync.
  - `cd cloud && npm run lint && npm test`

## The `akb` command in this repo

There is no `akb` on PATH here — `.claude/skills/kanban` is a symlink to `skill/`, so the
skill note gives the general answer. In this checkout `akb` means `node cli/bin/ai4kanban.mjs`.
Use that instead of `npx`, and never install the command globally.

## Code Style

When you see a lengthy comment, trim it down aggressively to key notes for future writers, or just remove it. Code is enough to explain itself. Add comments only when necessary.
