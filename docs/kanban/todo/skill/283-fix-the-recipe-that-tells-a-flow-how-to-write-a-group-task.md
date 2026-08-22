---
title: Fix the recipe that tells a flow how to write a group task
track: skill
priority: med
roi: high
status: todo
release: 0.7.2
blocked_by: []
related: [157]
modules: [skill]
questions: []
---

A group task is a root card with its pieces as subtasks. The board's own rules tell a flow
to start one by allocating the ids with `akb board create --count <N>`, but nothing can
give those ids to a card — writing a card allocates a fresh id of its own. Every flow that
follows the recipe burns the ids it was told to reserve, and the user sees the numbers on
their board jump for no reason.

## Scope
- Rewrite the "Group task" recipe in `akb guide board` so it says the steps that work today:
  write the root card first, then each piece related to it, then put the files in the
  group's folder.
- Drop `akb board create --count <N>` from the recipe.
- `akb guide add-task` points at that recipe, so check the line that sends a reader there
  still reads right.
- Out: a command that writes a whole group in one move. This card only makes the written
  rule match what the command can do.

## Todo
- [ ] Rewrite the group recipe in `akb guide board` to the steps that work, without
      `--count`.
- [ ] Check the flows that point at the recipe still read right.
- [ ] Build a group task by following the new recipe, and check no id was burnt.

## Decided by the agent
- **Why not add the command instead**: a command that writes a group in one move is a
  bigger change and was part of a card the user turned down. This card only stops the rules
  telling a flow to do something that does not work.
