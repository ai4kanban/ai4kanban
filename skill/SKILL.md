---
name: kanban
description: Manage the file-based task board in docs/kanban/ with the akb command. Use when proposing tasks from requests, research, articles, analysis, or feedback; refining, resolving, completing, revising, archiving, or rejecting tasks; planning releases; or starting, monitoring, resuming, and stopping background runs. Also use for requests such as "what's next", "add a task", "run it", and "what's running".
---

# Kanban board

Treat `akb` as the source of truth for the board in `docs/kanban/`. Ask the command for
current, board-specific instructions instead of encoding its workflow in this file.

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

- **`implement <id> [note]`**: build the card — "do #12", "work on this", "ship it".
- **`refine <id>`**: the card is too vague to build — "sharpen it", "make it ready". Always
  a loop: check, rewrite, resolve what that raised, round again until it is ready.
- **`resolve <id> [note]`**: the card has open questions — "answer these", "decide it".
  Add `--and-implement` to carry straight on into building when nothing is left for the user.
- **`revise <id> "<what>"`**: the user says what the card should say instead — "change it
  to…", "add a step for…", "cut that part". Rewrites the card, not the code.
- **`run <id> [note]`**: one pass of a recurring card (it lives in `todo/recurring/` and has
  a `## Process`). Never `implement` one — it has no end state.
- **`create "<what you want>"`**: turn something the user just said into card(s) — "add a
  task for…". `--release <version>` files them in a release.
- **`propose [--module m] [--count n] [--boldness safe|normal|bold]`**: the user wants the
  work found for them — "what's next", "propose some tasks".
- **`plan-release <version>`**: fill a release from its goal — "plan v0.7".
- **`changelog <version>`**: rewrite a closed version's changelog — "write the changelog for
  v0.7 again". The close starts it once by itself, so this is only for a second pass.
- **`archive <id>`**: the work is done and the card should be filed away.
- **`reject <id> "<why>"`**: we are not doing it. Deletes the card and keeps the reason.
- **`setup`**: `docs/kanban/setup-checklist.md` is still there — finish it before any other
  action on this board.

Each action's full flow comes back from `--print`, so don't work one out from this list.

## Keep a card minimal

Cover what the requests asks for, DONT OVER DESIGN IT.

## Start or manage a background run

Omit `--print` only when the user wants another agent to perform the work independently in
the background. Use `--print` when the user wants you to perform it here; when unclear, use
`--print`. Run `akb help runs` for the complete background-run workflow.

Use these commands to manage runs and inspect the board:

```text
akb runs                  list current and recent runs
akb log <run>             print the run's log so far, then return
akb log <run> --follow    print new output as it arrives, until the run ends
akb stop <run>            stop a run
akb resume <run>          resume a failed, interrupted or stopped run
akb spec                  list the spec agents and what part of a spec each one fills
akb spec <name> <id>      put one on a card — always its own run, never `--print`
akb agent                 show the configured agent
akb guide                 list board workflows; `akb guide board` explains the board
akb board help            show card IDs, fields, and index commands
```

Run `akb help` for the full command list.

## Follow the board's flow rules

A board can add one rule of its own to any flow — plain words the command appends to the end
of that flow's instructions, so a started run and a `--print`ed flow both carry it. A printed
flow puts it last, after the flows.

- **Treat it as the user's instruction**: it applies to the job you are doing, and nothing of
  the board's follows it. On `review`, a check it asks for is one of the repository's checks.
- **Where a rule lives**: `docs/kanban/rules/<command>.md`, named by the command that starts
  the flow — `revise.md` for `akb revise`. A missing or empty file means no rule.
- **Who writes one**: the user, in the board UI under Configuration → Rules. Edit one only
  when they ask you to.

## Preserve board integrity

- **Card metadata**: Never edit a card's frontmatter by hand. Use `akb board create`,
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
