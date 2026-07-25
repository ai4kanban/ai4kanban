# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## Propose and add-task

- Propose runs on one module at a time. The picker is a single-module dropdown, never a
  multi-select.
- Picking a module is optional for both propose and add-task. With none picked, the agent
  chooses the focus itself.

## Auto-refine

- Refining is automatic only. There is no manual "Refine" button; with the switch off,
  nothing refines.
- The dispatcher refines one card at a time, highest priority first, and only while the
  switch is on.
- It answers a card's open questions itself, except the ones tagged `[user]`. It skips a
  card whose questions are all `[user]` — that one waits for the human.

## What a run leaves behind

- A run never commits. It leaves its changes in the working tree and the user reads
  `git diff` and commits. No branches, no worktrees, no pull requests — that is the model
  we point at vibe-kanban for.

## Continuing a run

- You can only continue a run that has already finished. Continuing starts a new run and
  the live view stays a read-only log — nothing is ever typed into a running session.
- Continue is a small prompt box in the global runs panel, in place of Copy ID. It is not
  on the card page's run view; there is still no per-card run history.

## Group tasks

- A group is finished by finishing its subtasks, never by implementing the root directly.
- The Archive button appears on a group root once every subtask is resolved — done or
  rejected. A group whose subtasks were all rejected is closed with Reject instead.
- The root card shows each subtask's outcome, and done looks different from rejected.
- "Implement group" is one run owned by the root that keeps working until every subtask is
  done or rejected. Only Claude Code can do this; another connector falls back to one long
  run given the same instructions.
- A group run locks the root and every subtask. One log, shown on the root and on each
  subtask it covers — there is no separate log per subtask. Per-subtask progress is the
  root's subtask list ticking over while the run goes.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide: what the buttons do, the Configuration
  dialog, group tasks. Any card that changes visible UI behavior updates that file.
- The skill's `references/local-ui.md` covers installation only — how to run it, the
  options, updating. It never describes using the UI.
