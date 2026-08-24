---
title: Let a user add one rule to any flow
track: skill
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: [303]
related: [300]
modules: [skill, local-ui]
questions: []
---

Every board wants something slightly different from a flow — run these tests before landing, ask a
second model, install dependencies this way. Give each flow one rule the user writes in plain
words, appended to that flow's built-in prompt.

## Worth noting
- **What is a rule?**: plain words appended to a prompt, not a command the board runs. What it
  actually causes depends on the agent reading it.
- **What can a rule cost?**: a review rule can make failing checks block landing, and a rule that
  asks for too much makes every card slower and more likely to stop for a person.
- **Where do rules live?**: in files in the board, versioned in git, so a team shares them and can
  see them change.
- **Can a rule consult another model?**: yes, through that model's CLI. Its verdict can still be
  wrong.
- **Why only one rule per flow?**: custom shell commands and per-delivery approval would both
  break the one-click flow. User-written agent modules are a later card, and the rule format leaves
  room for them.

<!-- agent -->

## Scope
- **One rule per flow**: add-task, refine, revise, review, archive, split, and future flows each
  take one.
- **Stored with the board**: one file per flow, such as `docs/kanban/rules/review.md`, versioned
  in git. A missing or empty file means the flow runs unchanged.
- **Appended, never substituted**: a rule is added to that flow's built-in prompt.
- **Managed in Configuration**: a "Flow rules" section listing every flow with a text box.
- **Checks**: a review rule may require the independent reviewer to derive and run tests or other
  checks against the approved card.
- **Required failures, and clearly missing coverage, are sent back for correction**, and an
  unresolved failure blocks landing.
- **Run the existing test suite before landing**, and record the commands and their results on the
  delivery's audit record.
- **A non-blocking finding becomes a post-implementation note** instead.
- **Worktree setup**: the implement flow's rule is where a board says how to prepare a fresh
  worktree, such as installing dependencies.
- **Record which rules were in force** on the delivery's audit record, as part of its prompt
  version.

## Todo
- [ ] Add `docs/kanban/rules/<flow>.md`, one file per flow, and read it when that flow runs.
- [ ] Append the rule to the flow's built-in prompt; treat a missing or empty file as no rule.
- [ ] Add a "Flow rules" section to the Configuration dialog, listing every flow with a text box.
- [ ] Let a review rule make the reviewer derive and run checks against the approved card.
- [ ] Send required failures and clearly missing coverage back for correction; block landing on
      an unresolved failure.
- [ ] Run the existing test suite before landing, and record the commands and results on the
      delivery's audit record.
- [ ] Turn a non-blocking finding into a post-implementation note.
- [ ] Let the implement flow's rule prepare a fresh worktree.
- [ ] Record which rules were in force on the delivery's audit record.
- [ ] Document flow rules in the skill note and in `kanban-ui/README.md`.

## Scope out
- **No custom shell commands in a rule.**
- **No per-delivery approval of a rule.**
- **No user-authored agent modules yet.**

## Source
- `plan.md`, in commit `1127a91` — "Flow rules", and "Worktree setup" under "Parallel work with
  Git worktrees".
