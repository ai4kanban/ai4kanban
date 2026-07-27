---
title: "Track how clear goal.md is with a reviewed: strong|weak field"
track: skill
priority: med
roi: high
status: todo
blocked_by: []
related: []
modules: [skill]
questions:
  - "[user] What makes a goal strong? The agent needs a written test to apply (for example: it names who it is for, what changes for them, and what comes next). Without one, strong|weak is a guess."
  - "[user] Does the field apply to every goal.md — the board root and each module's copy — or only the board root?"
---

Record in `goal.md` whether the goal is clear enough to plan from, so a program can see a
weak goal instead of a human noticing it. Every proposal leans on the goal; a blank one
means the agent guesses the direction.

## Scope

- Add a frontmatter block to `goal.md` with one field: `reviewed: strong | weak`.
  `strong` means the goal is clear enough to plan from. `weak` means it is missing,
  still the seeded template, or too vague to judge a proposal against.
- A missing file, a missing field, or a bad value all read as `weak`. Never fail; the
  board keeps working with a weak goal.
- `init` and `memory-init` seed the file with `reviewed: weak`, because a fresh template
  is not a goal.
- The agent judges, the script writes. The judgement is a plain test the agent applies
  (the first open question); the value only reaches the file through a new script
  command, like every other frontmatter field.
- Add that command to `kanban.mjs`, e.g. `goal-review <module|--root> strong|weak`, and
  list it in `help`.
- Say in `SKILL.md` when a flow re-judges the goal. Start with the flows that already
  read `goal.md` — propose, and add-task — so the value stays honest without a new pass
  over the board.
- The user still owns the words. The agent never writes or rewrites the goal text; it
  only sets this one field.

## Todo

- [ ] Write the strong/weak test in plain words, once the first open question is answered.
- [ ] Add the `reviewed:` frontmatter to the `goal.md` template in `kanban.mjs`, seeded `weak`.
- [ ] Make `init` and `memory-init` write the field, and leave an already-set value alone.
- [ ] Add the script command that sets the field, with validation and a `help` entry.
- [ ] Make the reader treat missing file / missing field / bad value as `weak`.
- [ ] Add a re-judge step to the propose and add-task flows in `references/`.
- [ ] Document the field in `SKILL.md` under "The memory set".
- [ ] Add a line to `docs/guides/daily-loop.md` about what a weak goal means for the user.
