---
title: Ask for a spec agent when a card is written, not only when it is refined
track: skill
priority: med
roi: med
status: ready
release: 0.7.1
blocked_by: []
related: [265]
modules: [skill]
questions: []
---

A card that changes a screen only gets the `ui-design` agent if someone refines it — the
add-task flow never asks. #265 changes the chat rail and went to `ready` with no agent
section and nobody noticing. The refine flow already has the step; add-task doesn't.

## Scope
- `cli/src/guide/add-task.md` gains one step after the body is written: run `akb spec` and
  put on any agent whose part of the spec the card leaves open.
- The step is two or three lines, matching "4. Fill open parts of the spec" in
  `cli/src/guide/refine.md` — the agent starts after this run, don't wait, don't change
  the card's status.
- Line 81's "read `akb guide ui-design`" stays: it is how the body is written, not who
  fills it in.
- `technology-selection` is covered by the same step — the flow names no agent, it reads
  `akb spec`.

## Scope out
- The agents themselves, and the wording of what each is called on.

## Todo
- [ ] Add the spec-agent step to `cli/src/guide/add-task.md`.
- [ ] Keep it under four lines — the flow is read on every card written.
