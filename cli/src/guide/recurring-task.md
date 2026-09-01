# Recurring task

A recurring task is a card that gets run over and over and isn't archived when a run
finishes. It has no end state: never archive it, and never write it into `readme.md` as
shipped behavior.

## Add one

Evaluate it with `akb guide evaluate-task`, then create it with `--track recurring`:

```
akb board create --title "Prune the memory" --track recurring \
             --priority med --roi med --modules skill
```

It lands in `docs/kanban/todo/recurring/`.

Leave `--cadence` off unless the user explicitly asks for an automatic schedule. With no
cadence the card runs only when someone asks; `board create` omits the field entirely.

## The card shape

```
---
title: …
track: recurring
priority: …
roi: …
blocked_by: []
related: []
questions: []
---

<one short paragraph: what the job is for and why it repeats>

## Run state
<only what the next run needs; update in place after each run, or write "None">

## Process
1. <one pass, in order>
```

`last_run` appears after the first successful run; the command owns it.

Don't edit frontmatter by hand.

## `## Run state` — what survives between runs

Keep only information the next run must know, such as the last item processed, remaining
inputs, or a compact source index. Update it in place; it is not an append-only run history.
Write `None` when the job is stateless.

Do not create a sibling log, ledger, or history file for ordinary run state. A separate
artifact belongs in the process only when that artifact is an explicit output of the job.

## `## Process` — one run, in order

Nobody watches a run, and the agent doing it knows nothing about the job beyond this
section. It is the whole instruction set: a numbered list, one action per step, plain
imperative sentences.

- **Put the exact command in the step** when there is one — the command as typed, not
  "run the pruner".
- **Leave run bookkeeping out of the process.** Do not add a step that calls `akb run` or
  stamps `last_run`; the run flow records a successful pass itself.
- **No step may wait for an answer.** Classify an unexpected decision with `akb guide
  update-questions`. Make a safe, reversible call when evidence supports one. If classification
  leaves a `[user]` question, skip only the dependent work and leave it open.

## Run one

1. Read `## Run state`, then do the `## Process` steps in order.
2. Update `## Run state` in place with only what the next run needs.
3. Leave any `[user]` question open for the user; `akb resolve` applies their answer later.
