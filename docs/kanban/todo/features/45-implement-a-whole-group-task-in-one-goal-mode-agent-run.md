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
  - How much should one Implement group run be allowed to spend before it is cut off, and should the user have to confirm before starting an unattended run that can build a whole group?
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

## Decided by the agent
- **Is there a real goal mode, and how is it invoked?** Yes. Claude Code has `/goal <condition>`: it keeps working until the condition holds, and it runs non-interactively. The connector already spawns `claude -p ... --output-format stream-json --verbose`, which is exactly the shape goal mode needs. So "Implement group" is one goal-mode run whose condition is "every subtask on this root is done or rejected".
- **What the run is told.** The whole prompt string becomes the goal condition (4000 characters max), so the usual `/kanban.` prefix cannot lead it. The condition names the root card file, says to follow `blocked_by` order, and points at the kanban skill by name.
- **Non-Claude connectors.** Only Claude Code has this. If the configured command is not `claude`, the action falls back to one long plain run given the same instructions.
- **The goal loop has no built-in stop.** A run needs a spend cap so it cannot run forever.
- **It needs the group-done rule from #44.** The condition has to be checkable from files — every subtask line in the root's `## Todo` ticked or struck. That rule is card #44's, so this card waits on it.
- **The root owns the run.** One session, one log, one running badge — the same as any other run. A group run is not a new kind of session.
- **It locks the root and every subtask.** Today a run locks one card. A group run has to lock the root plus every subtask id, or the user can open a subtask page and start a second agent on a file the group run is writing.
- **Auto-refine is not the risk here.** The background refiner only looks at board cards, and subtasks are not board cards. The risk is a human clicking Implement or Reject on a subtask page mid-run.
- **One log, shown in more than one place.** The root page shows the live read-only tail. A subtask page shows the same run and the same log, not one of its own. There are no per-subtask logs.
- **Per-subtask progress is the root's subtask list.** The run ticks or strikes each subtask on the root as it finishes it, and the root page already draws that list. What is missing is a live re-read: the page only refreshes when a run ends or the tab regains focus, so the list does not move during the run.

## Pushback
- This leans on an agent capability we have not proven. If there is no real goal mode, one long run building many files may drift or stall with no way to step in mid-run.
- Priority is low. Do the two open questions first and stop if the answer is weak.
