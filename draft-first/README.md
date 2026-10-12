<h1><img src="https://cdn.ai4kanban.dev/draft-first/logo-v1.svg" alt="draft-first" height="48"></h1>

A skill for coding agents — Claude Code, Codex, Cursor, OpenCode and any agent that reads
`.claude/skills/` or `.agents/skills/`. Use it instead of plan mode or writing a spec: before
building, the agent drafts only the key parts of the task, you review them in your browser, and
the agent builds from what you confirmed. Everything else it just builds.

```sh
npx draft-first install
```

Run it in your project. Running it again updates the skill.

## How it works

- **Key parts**: a part is key when a helper covers it. Six ship with the skill — screen
  mockups (`ui-designer`), prompts (`prompt-writer`), copy (`copywriting`), images
  (`illustrator`), library picks (`tech-stack-advisor`) and competitor comparisons
  (`competitor-research`).
- **Review**: the agent opens a local page. Delete the drafts you don't want, leave notes, and
  confirm. Export the page as an image or as one HTML file anyone can open.
- **Contract**: what you confirmed is written to `.draft-first/<task>.md`, and the agent builds
  from it. Below its `<!-- agent -->` line are the calls the agent made on its own — folded on
  the page, and open to notes too.

## Your own helpers

A helper is a Markdown file whose `description` says what it covers, and whose body says how
to draft it. Put yours in `.draft-first/helpers/`: a new name adds a helper, and a shipped name
replaces the shipped one.

```md
---
description: A new database table or column.
---

The table as a SQL `CREATE TABLE`, with one sample row per state the task adds.
```

## Going further

Drafts use the same format as [AI4Kanban](https://ai4kanban.dev) cards, so they move onto a
board as they are — where they gain memory, parallel runs and follow-ups.

More: [ai4kanban.dev/draft-first](https://ai4kanban.dev/draft-first)
