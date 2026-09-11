---
name: kanban
description: Manage the file-based task board with akb. Use for creating and planning tasks, revising or implementing cards, planning releases, and managing background runs; also for "what's next" and "what's running".
---

# Kanban board

Use `akb` as the source of truth. Load the relevant command's instructions instead of
reconstructing workflows from memory.

<!-- command -->
Use `akb` in the commands below. If it is not on `PATH`, use `npx --yes ai4kanban@latest`
instead, state that once, and never install the command globally.
<!-- /command -->

- **Board**: default to `docs/kanban/`. For an explicitly named board, pass `--board <dir>` on every command; never guess another board.
- **Discovery**: use `akb help`, `akb <command> --help`, and `akb guide` for commands, arguments, and workflows.
- **Setup**: if no board exists, run `akb install`. If `setup-checklist.md` remains, finish `setup` first.

## Execution mode

Use `--print` for the in-session actions below and follow the complete printed flow,
including its closing steps. Direct commands execute immediately; do not add `--print`.
For all other agent work, choose the execution mode as appropriate; default to a separate
session without `--print`. Explicit user requests take precedence.

| Command (after `akb`) | Mode |
| --- | --- |
| `card revise <id> <what>` | In-session (`--print`) |
| `card resolve <id> [note]` | In-session (`--print`) |
| `card archive <id>` | In-session (`--print`) |
| `card reject <id> <why>` (`--discard` to drop it with no memory) | In-session (`--print`) |
| `spec <agent> <id> [note]` | In-session (`--print`); continue the parent workflow afterward |
| `guide <topic>`, `help`, `spec`, `agent`, `raw …` | Direct |
| `run list`, `run log`, `run stop`, `run resume` | Direct; resume restarts a separate run |
| `delivery approve`, `delivery cancel`, `delivery discard` | Direct |

## Route ambiguous requests

- **"What's next?"**: follow `akb guide next-card`; choose existing work.
- **"What are we missing?" or sources to mine**: follow `akb guide extract-ideas`; find new work.
- **Refine / resolve / revise**: clarify the plan / apply answers / change requirements. When two fit, choose the smaller change.

## Boundaries

- **Metadata**: edit card bodies directly; change frontmatter only through `akb raw` commands.
- **Agent rules**: follow the board's rules supplied with the flow. Edit those rules only when the user asks.
- **Credentials**: do not read or write API keys; have the user configure them with `akb agent set apiKey`.
