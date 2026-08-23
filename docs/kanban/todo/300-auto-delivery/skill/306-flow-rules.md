---
title: Let a user add one rule to any flow
track: skill
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: [301, 303]
related: [300]
modules: [skill, local-ui]
questions: []
---

Every board wants something slightly different from a flow — run these tests before landing, ask
a second model, install dependencies this way. Give each flow one rule the user writes in plain
words, appended to that flow's built-in prompt. This is the only extension point: no custom shell
commands, and no per-run approval, because both would break the one-click flow.

## Worth noting
- A rule is plain words appended to a prompt, not a command the board runs. What it actually
  causes depends on the agent reading it.
- A review rule can make failing checks block landing. A rule that asks for too much makes every
  card slower and more likely to stop for a person.
- Rules are files in the board, versioned in git, so a team shares them and can see them change.
- Consulting another model's CLI is possible through a rule. Its verdict can still be wrong.
- User-written agent modules are not this card. The rule format should leave room for them later.

<!-- agent -->

## Scope
- **One rule per flow**: add-task, refine, revise, review, archive, split, and future flows each
  take one rule.
- **Stored with the board**: one file per flow, such as `docs/kanban/rules/review.md`, versioned
  in git.
- **Managed in Configuration**: a "Flow rules" section listing every flow with a text box. Empty
  means the flow runs unchanged.
- A rule is appended to that flow's built-in prompt. It never replaces it.
- **Checks**: a review rule may require the independent reviewer to derive and run tests or other
  checks against the approved card.
- Required failures, and clearly missing coverage, are sent back for correction. An unresolved
  failure blocks landing.
- Run the existing test suite before landing. Record the commands and their results on the run's
  audit record.
- A non-blocking finding becomes a post-implementation note instead.
- **Worktree setup**: the implement flow's rule is where a board says how to prepare a fresh
  worktree — installing dependencies, for example.
- Record the prompt version, including which rules were in force, on the run's audit record.

## Todo
- [ ] Add `docs/kanban/rules/<flow>.md`, one file per flow, and read it when that flow runs.
- [ ] Append the rule to the flow's built-in prompt; treat a missing or empty file as no rule.
- [ ] Add a "Flow rules" section to the Configuration dialog, listing every flow with a text box.
- [ ] Let a review rule make the reviewer derive and run checks against the approved card.
- [ ] Send required failures and clearly missing coverage back for correction; block landing on
      an unresolved failure.
- [ ] Run the existing test suite before landing, and record the commands and results on the
      audit record.
- [ ] Turn a non-blocking finding into a post-implementation note.
- [ ] Let the implement flow's rule prepare a fresh worktree.
- [ ] Record which rules were in force on the run's audit record.
- [ ] Document flow rules in the skill note and in `kanban-ui/README.md`.

## Scope out
- No custom shell commands in a rule.
- No per-run approval of a rule — it would break the one-click flow.
- No user-authored agent modules yet.

## Source
- `plan.md`, in commit `1127a91` — "Flow rules", and "Worktree setup" under "Parallel work with Git
  worktrees".
