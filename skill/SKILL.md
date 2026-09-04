---
name: kanban
description: Manage the file-based task board in docs/kanban/ with the akb command. Use when proposing tasks from requests, research, articles, analysis, or feedback; refining, resolving, completing, revising, archiving, or rejecting tasks; planning releases; or starting, monitoring, resuming, and stopping background runs. Also use for requests such as "what's next", "add a task", "run it", and "what's running".
---

# Kanban board

Treat `akb` as the source of truth for the board in `docs/kanban/`. Ask the command for
current, board-specific instructions instead of encoding its workflow in this file.

A repository may hold a second board somewhere else — `marketing/kanban`. It is named, never
guessed: pass `--board <dir>` on every command that means it, and leave it off for
`docs/kanban/`. Every path a printed flow spells is that board's own.

## Select the command

<!-- command -->
Use `akb` in the commands below. If it is not on `PATH`, use `npx --yes ai4kanban@latest`
instead, state that once, and never install the command globally.
<!-- /command -->

## Work in the current conversation

Before any board action, print its board-specific instructions:

```text
akb <action> [args] --print
```

This command does not start a background run. It prints the card path, remaining steps,
referenced memory, required flows, and closing command. Follow those instructions in the
current conversation.

## Pick the action

Match the ask to one action below; when two fit, take the one that changes less. The
arguments are the same with or without `--print`.

- **`card implement <id> [note]`**: build the card — "do #12", "work on this", "ship it".
- **`card refine <id>`**: the card is vague to build — "sharpen it", "make it ready". It
  checks whether vague multi-area work should become recursively refined subtasks; otherwise
  one session loops until a clean sweep leaves only decisions the user owns.
- **`card resolve <id> [note]`**: apply the user's answers, then QA the resulting plan in the
  same session — "answer these", "decide it".
  Add `--and-implement` to carry straight on into building when nothing is left for the user.
- **`card revise <id> "<what>"`**: the user says what the card should say instead — "change
  it to…", "add a step for…", "cut that part". Rewrites the card, not the code.
- **`card run <id> [note]`**: one pass of a recurring card (it lives in `todo/recurring/` and
  has a `## Process`). Never `card implement` one — it has no end state.
- **`card archive <id>`**: the work is done and the card should be filed away.
- **`card reject <id> "<why>"`**: we are not doing it. Deletes the card and keeps the reason.
- **`create "<what you want>"`**: turn something the user just said into card(s) — "add a
  task for…". `--release <version>` files them in a release. For repeating work, read
  `akb guide recurring-task`.
- **`propose [--module m] [--count n] [--boldness safe|normal|bold]`**: the user wants new
  work found for them — "what are we missing", "propose some tasks", "find me work".
- **`release plan <version>`**: fill a release from its goal — "plan v0.7".
- **`release changelog <version>`**: rewrite a closed version's changelog — "write the
  changelog for v0.7 again". The close starts it once by itself, so this is only for a second
  pass.
- **`setup`**: `docs/kanban/setup-checklist.md` is still there — finish it before any other
  action on this board.

`delivery review <id>` and `delivery conflict <id>` are the board's own: it starts each one
itself after a build. Type one only to look again after answering a question.

Each action's full flow comes back from `--print`, so don't work one out from this list.

## Say what to build next

"what's next", "what should I build next", "what to build next" — the user wants a pick from
the cards the board already has, not new ones. Print `akb guide next-card` and follow it. It
is a flow, not an action: no run starts and nothing on the board changes.

## Keep a card minimal

Cover what the requests asks for, DONT OVER DESIGN IT.

## Start or manage a background run

Omit `--print` only when the user wants another agent to perform the work independently in
the background. Use `--print` when the user wants you to perform it here; when unclear, use
`--print`. Run `akb delivery --help` for what a delivery does between its runs.

Commands are grouped by what they act on: `card`, `delivery`, `run`, `release`.

```text
akb run list                list current and recent runs
akb run log <run>           print the run's log so far, then return
akb run log <run> --follow  print new output as it arrives, until the run ends
akb run stop <run>          stop a run
akb run resume <run>        resume a failed, interrupted or stopped run
akb delivery cancel <id>    end the build in flight on a card and hand the card back
akb delivery discard <id>   end it and throw its worktree and branch away
akb spec                    list the spec skills and what part of a spec each one fills
akb spec <name> <id>        put one on a card — always its own run, never `--print`
akb agent                   show the configured agent
akb guide                   list board workflows; `akb guide board` explains the board
akb raw help                show card IDs, fields, and index commands
```

Run `akb help` for the full command list.

## Follow the board's flow rules

A board can add one rule of its own to any flow — plain words the command appends to the end
of that flow's instructions, so a started run and a `--print`ed flow both carry it. A printed
flow puts it last, after the flows.

- **Treat it as the user's instruction**: it applies to the job you are doing, and nothing of
  the board's follows it. On `review`, a check it asks for is one of the repository's checks.
- **Where a rule lives**: `docs/kanban/rules/<command>.md`, named by the command that starts
  the flow — `revise.md` for `akb card revise`. A missing or empty file means no rule.
- **Who writes one**: the user, in the board UI under Configuration → Rules. Edit one only
  when they ask you to.

## Preserve board integrity

- **Card metadata**: Never edit a card's frontmatter by hand. Use `akb raw create`,
  `update`, `update-questions`, `update-verify`, or `schedule`. Edit only the card body
  directly.
- **API keys**: Never type, save, or retrieve a key for the user. Ask the user to run
  `akb agent set apiKey <their-key>` themselves. Keys are stored in `docs/kanban/.env` and
  are never read back.

## Recover from setup problems

- **`akb: command not found`**: Use the command named in "Select the command". Do not stop
  and do not ask the user first.
- **No board**: Run `akb install`.
- **Agent not installed**: Run `akb agent test` and follow the installation instruction it
  prints.
- **Missing key or wrong provider**: Run `akb agent` to inspect the configuration, then ask
  the user to set the key themselves.
