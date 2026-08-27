# Recurring task

A recurring task is a card that gets run over and over and isn't archived when a run
finishes. It has no end state: never archive it, and never write it into `readme.md` as
shipped behavior.

## Add one

Evaluate it with `akb guide evaluate-task`, then follow "Add one task idea" in
`akb guide add-task` and create it with `--track recurring`:

```
akb board create --title "Prune the memory" --track recurring \
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

<one short paragraph: what the job is for and why it repeats>

<!-- agent -->

## Process
```

The paragraph is the card's human half and `## Process` its agent half — the same two
halves every card has (`akb guide writing`).

Don't edit frontmatter by hand.

## `## Process` — one run, in order

Nobody watches a run, and the agent doing it knows nothing about the job beyond this
section. It is the whole instruction set: a numbered list, one action per step, plain
imperative sentences.

- **Put the exact command in the step** when there is one — the command as typed, not
  "run the pruner".
- **No step may wait for an answer.** When an unexpected choice appears, make a safe,
  reversible call when evidence supports one. If it genuinely needs the user, skip only
  the dependent work and leave a `[user]` question —

  ```
  akb board update-questions <id> --append "[user] .." \
    --recommended-option ".." --option ".."
  ```

  Apply "Decide what survives" from `akb guide qa-loop`; include two or more options and a
  recommendation, and make it answerable at a glance.

## Run one

1. Do the `## Process` steps in order.
2. Leave any `[user]` question open for the user; `akb resolve` applies their answer later.
