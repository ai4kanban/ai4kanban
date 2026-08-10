# ai4kanban

Set up and update [AI4Kanban](https://ai4kanban.dev/) in one command.

AI4Kanban is AI project management that grows with you: you give the agent a vague idea, it
breaks the idea down, settles what it can on its own, asks you the rest, and keeps going
until the spec is clear enough to build. The board is plain Markdown in `docs/kanban/`,
versioned in git.

This package is the setup command. The board and the skill are the product.

## Install

From your project root:

```bash
npx ai4kanban install
```

That copies the skill into `.claude/skills/kanban/` (Claude Code) and
`.agents/skills/kanban/` (Codex), then scaffolds `docs/kanban/` — the track folders, the
board index, the memory set, and a blank `config.md`.

Pass the tracks your project actually splits into:

```bash
npx ai4kanban install --tracks feature,bug,research
```

Normally you don't run this by hand. You paste the install prompt from
<https://ai4kanban.dev/INSTALL_PROMPT.txt> and your agent reads the repo, picks the tracks,
runs this command, and fills in the config afterwards.

## Update

```bash
npx ai4kanban update
```

Overwrites every skill folder it finds with this version, repairs a board written by an
older release, and prints which version you moved from and to with a link to everything
that changed in between. Your cards, config, and memory are never touched.

## What it won't do

Reading your repo, filling in `docs/kanban/config.md`, writing the module map, proposing
tasks — all of that needs a judgement call, so it stays the agent's job. When this command
hits something it can't decide, it prints it under **Needs your attention** and leaves it
alone.

Both commands are safe to run twice.

## Also

- The board app: <https://ai4kanban.dev/download> — the same Markdown files, in a window.
  (`npx ai4kanban-ui` still serves it in a browser, but that way is deprecated.)
- Source and docs: <https://github.com/ai4kanban/ai4kanban>

Node 18+. No dependencies.
