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
  - "[user] How much should one Implement group run be allowed to spend before it is cut off, and is that a fixed built-in default or a field in the Configuration dialog?"
---

Add one action on a group root that hands the whole subtask graph to a single agent run, so the user does not click Implement on each subtask and wait for each one.

## Scope
- Today you implement a group one card at a time. You click Implement on a subtask, wait for it to finish, then start the next one in the `blocked_by` chain.
- This card adds a new root-level action, e.g. "Implement group". It gives the root's subtask graph to one agent run.
- That run walks the subtasks in dependency order on its own. The user does not wait or click per subtask.
- This sits next to the per-subtask Implement. It does not replace it, and it does not un-hide the Implement button that is hidden on a group root by design.
- It stays inside the current UI rules: a run is a read-only log tail, no mid-run replies. The agent raises open questions on cards instead of asking live.
- If a new connector command is needed for this mode, it goes in the Configuration (gear) dialog, not a new header control.

## What the user does
- The user opens a group root that has subtasks left to build. Next to Archive there is a new button, "Implement group".
- Clicking it opens the same one-step dialog every other button opens. It says in plain words that this is one unattended run that builds every subtask, and it says how many subtasks it will touch. Cancel, or confirm.
- The root card then shows the running badge, and its page shows the live read-only log.
- While it runs, the root's subtask list ticks over as each subtask finishes, so the user can watch progress without reading the log.
- Every subtask page is locked for the duration. It shows the same running badge and the same log, and its buttons are off.
- The run ends when every subtask is done or rejected. The root is then archiveable, exactly as card #44 defines.

## Todo
- [x] Confirm whether the connector agent has a real "goal mode" — yes, `/goal` (see below).
- [x] Decide it sits alongside per-subtask Implement, not replacing it.
- [x] Wait for #44 — shipped. This card reuses its group detection and its done/rejected rule.
- [ ] Add a new `AgentAction` for "Implement group", its prompt, and the root-page button.
- [ ] Give a run a list of the cards it covers — the root plus every subtask — so all of them lock, show the badge, and open the same log.
- [ ] Make the root page re-read the card while a covered run is live, so the subtask list moves during the run.
- [ ] Fall back to one long plain run when the configured command is not Claude Code.
- [ ] Add the spend cap once the open question is answered.
- [ ] Smoke-test that the cap actually stops a run on a subscription plan.
- [ ] Document the new button in `kanban-ui/README.md`.

## Decided by the agent
- **Is there a real goal mode?** Yes. Claude Code has `/goal <condition>`: it keeps working until the condition holds, and it runs non-interactively. The connector already spawns `claude -p ... --output-format stream-json --verbose`, which is the shape goal mode needs. So this is one goal-mode run whose condition is "every subtask on this root is done or rejected".
- **What the run is told.** The whole prompt string becomes the goal condition, capped at 4000 characters, so the usual `/kanban.` prefix cannot lead it. The condition names the root card file, says to follow `blocked_by` order, and points at ai4kanban by name.
- **Non-Claude connectors.** Only Claude Code has this. If the configured command is not `claude`, the action falls back to one long plain run given the same instructions. Never send `/goal` to a command that is not Claude Code.
- **It needs #44 first.** The condition has to be checkable from files — every subtask line in the root's `## Todo` ticked or struck. That rule is card #44's, so this card is now blocked by it.
- **The root owns the run.** One session, one log, one running badge, the same as any other run. A group run is not a new kind of session.
- **It locks the root and every subtask.** Today a run locks one card. A group run has to lock the root plus every subtask, or the user can open a subtask page and start a second agent on a file the run is writing. Background auto-refine is not the risk — it only looks at board cards, and subtasks are not board cards. The risk is a human clicking Implement or Reject mid-run.
- **One log, shown in more than one place.** The root page shows the live tail. A subtask page shows the same run and the same log, not one of its own. There are no per-subtask logs.
- **Per-subtask progress is the root's subtask list.** The run ticks or strikes each subtask on the root as it finishes it, and the root page already draws that list. What is missing is a live re-read: the page only refreshes when a run ends or the tab regains focus, so today the list would not move during the run.
- **No extra confirmation.** Nothing in this UI has a second "are you sure" gate, not even Reject, which deletes a card. Follow the house pattern: warn inside the one dialog, then allow.
- **How a cap would work.** `claude -p` takes `--max-budget-usd`. That is the only cap flag this version has — there is no turn limit. The number and where it is set is the open question below.

## Pushback
- This is one long unattended run with no way to step in mid-run. If it drifts, the user's only move is to let it finish or kill it.
- The goal loop has no built-in stop, so the spend cap is not optional. Do not ship without it.
- `--max-budget-usd` is documented as capping API calls. It is unverified on a subscription plan, which is what the Configuration dialog says this connector is. Test it before trusting the run unattended.
- Priority is low. There is no rush.
