# Kanban Skill

![Kanban Skill](https://cdn.kanbanskill.cc/og-image.jpg)

**A local, agentic task board in Markdown.**

Not a tracker you update — a workspace you and your agents plan and review together.
Claude Code does the project management: it proposes the next work, writes the cards,
refines rough ideas into concrete ones, and archives what ships. You steer in plain language
and review before anything is built. The board itself is plain Markdown in `docs/kanban/` —
local, in git, no database, no MCP.

- **The agent works the board** — say "propose new tasks" and it walks your code, board,
  and notes to draft fresh cards for work nobody's planned; from there you refine, review,
  and archive in plain language
- **Built for how agents work** — cards are files, so the agent greps them in one local
  call instead of paging a remote API; any file-reading agent can drive it, Cursor and
  Codex included
- **Remembers your decisions** — what shipped and why ideas were rejected stay on the
  board, so the agent never re-proposes done or dead work

## Quick start

From your project root, tell Claude Code (or any coding agent that can run shell commands):

```
Set up the kanban skill for this project. Read
https://kanbanskill.cc/INSTALL_PROMPT.txt and follow it.
```

The agent gets the skill into your project, reads your codebase to fill in the
configuration, scaffolds the board under `docs/kanban/`, and proposes your first three
tasks. Both your config and your board live in `docs/kanban/` — the skill folder holds only
generic code. From then on you just talk to the board.

Prefer plugins? `/plugin marketplace add dist0com/kanban-skill` then
`/plugin install kanban@kanban` makes the skill available; from there, `kanban init` plus
filling in `docs/kanban/config.md` is the whole setup — nothing to copy in. The install
prompt above walks either path.

If your agent can't fetch URLs, open [`INSTALL_PROMPT.txt`](web/public/INSTALL_PROMPT.txt) and paste
its contents instead — same result. The only requirement is Node.js 18+ — the script has
no dependencies, so there's nothing to install.

## Using the board

Drive it in plain language — the skill triggers on these:

| You say | Claude does |
| --- | --- |
| "propose new tasks" | walks one focus area and drafts new cards for work nobody's planned |
| "add a task: …" | reviews the idea, writes a card, adds it to the index |
| "refine #4" | reviews card #4 and makes it one step more concrete |
| "resolve #4" | works through card #4's open questions with you |
| "review the board" | checks cards for clarity, duplication, done-ness |
| "#4 is done" | updates the docs the change touched, removes the card |

This repo uses the skill on itself: `docs/kanban/` is a real board tracking the skill's
own development, so you can see exactly what a filled-in setup looks like.

### Web UI (optional)

A local board over the same Markdown files — read a card in full and act on it with a
click instead of a prompt:

```bash
npx kanban-skill-ui        # http://localhost:7420
```

![The board view in the web UI](https://cdn.kanbanskill.cc/kanban-skill-ui-v2.jpg)

![Card detail view in the web UI](https://cdn.kanbanskill.cc/kanban-skill-ui-detail-v2.jpg)

Localhost only — no hosting, no login. See [kanban-ui/](kanban-ui/README.md) for options.

## Updating

One prompt — the update guide ships with the skill, so there's nothing to fetch first:

```
Update the kanban skill in this project. Read
.claude/skills/kanban/references/update.md and follow it.
```

Updates overwrite only the generic skill folder (`SKILL.md`, `kanban.mjs`, the references).
Your config and your board both live in `docs/kanban/`, so they're never touched.

## License

[Apache License 2.0](LICENSE). Free to use, modify, and redistribute. Contributions
welcome.
