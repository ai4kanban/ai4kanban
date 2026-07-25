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
- It never answers a card's open questions on its own — it skips a card that has them.
  Answering questions stays with the Resolve flow.

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
