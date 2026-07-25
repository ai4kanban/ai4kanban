---
title: Implement a whole group task in one goal-mode agent run
track: features
priority: low
roi: high
status: todo
blocked_by: []
related: [44, 16]
modules: [local-ui]
questions:
  - Does the configured agent (Claude Code / Codex) actually have a 'goal mode' that runs a multi-step task graph to the end in one session, and how is it invoked from the connector (today just 'claude -p')? If there is no such mode, is this just one long agent run told to build the subtasks in blocked_by order?
  - How does one graph-running session fit the UI's model of one session per card, a read-only log tail, and no mid-run human replies — does the root own a single session that edits many subtask files, and how are per-subtask progress and logs shown?
---

Add one action on a group root that hands the whole subtask graph to a single agent run, so the user does not click Implement on each subtask and wait for each one.

## Scope
- Today you implement a group one card at a time. You click Implement on a subtask, wait for it to finish, then start the next one in the `blocked_by` chain.
- This card adds a new root-level action, e.g. "Implement group". It gives the root's subtask graph to one agent run.
- That run walks the subtasks in dependency order on its own. The user does not wait or click per subtask.
- This sits next to the per-subtask Implement. It does not replace it, and it does not un-hide the Implement button that is hidden on a group root by design.
- It stays inside the current UI rules: a run is a read-only log tail, no mid-run replies. The agent raises open questions on cards instead of asking live.
- If a new connector command is needed for this mode, it goes in the Configuration (gear) dialog, not a new header control.
- The shape is not settled. The two frontmatter questions are open, so treat this as the feature's shape, not a chosen implementation.

## Todo
- [ ] Confirm whether the connector agent has a real "goal mode", or whether this is just one long run told to build subtasks in `blocked_by` order.
- [ ] Decide it sits alongside per-subtask Implement, not replacing it.
- [ ] Add a new `AgentAction`, a `buildPrompt` case, and a root-page button for "Implement group".
- [ ] Keep the run a read-only tail. Decide how per-subtask progress and logs are shown.
- [ ] Put any new connector setting in the Configuration dialog.

## Pushback
- This leans on an agent capability we have not proven. If there is no real goal mode, one long run building many files may drift or stall with no way to step in mid-run.
- Priority is low. Do the two open questions first and stop if the answer is weak.
