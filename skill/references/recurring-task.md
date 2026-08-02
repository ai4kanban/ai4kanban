# Recurring task

A recurring task is a card that gets run over and over and isn't archived when a run
finishes. It has no end state: never archive it, and never write it into `readme.md` as
shipped behavior.

## Add one

Same as any other card (`references/add-task.md`), with `--track recurring`:

```
${KB} create --title "Prune the memory" --track recurring \
             --priority med --roi med --modules skill
```

It lands in `docs/kanban/todo/recurring/`.

## The card shape

```
---
title: …
track: recurring
priority: …
roi: …
blocked_by: []
related: []
last_run: 2026-07-10 09:31
questions: []
---

<what the job is for and why it repeats, in a line or two>

## Process
```

Don't edit frontmatter by hand.

## `## Process` — one run, in order

Nobody watches a run, and the agent doing it knows nothing about the job beyond this
section. It is the whole instruction set: a numbered list, one action per step, plain
imperative sentences.

- **Put the exact command in the step** when there is one — the command as typed, not
  "run the pruner".
- **No step may wait for an answer.** If a step needs a decision, write it so the run
  decides for itself: take the choice that is easiest to undo, then leave the call on the
  card for the user to confirm later —

  ```
  ${KB} update-questions <id> --append ".."
  ```

  Leave it untagged: a run doesn't decide who answers. `references/resolve.md` does that
  later — it settles what it can itself under `## Decided by the agent` and hands the
  user only the rest. Write the question the way that guide says to: one plain line,
  answerable at a glance.

## Run one

1. Do the `## Process` steps in order.
2. Hand the card and its untagged questions to a subagent, which resolves them with a
   fresh context following `references/resolve.md`. Nothing else on the board resolves a
   recurring card, so a question left here is one nobody triages.
