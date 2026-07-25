---
title: Stop a running agent from the UI
track: features
priority: high
roi: high
status: todo
blocked_by: []
related: [28]
modules: [local-ui]
questions:
  - "[user] A stopped run leaves half-finished edits in the working tree. Does the UI just say so and leave them, or is undoing them part of this card?"
  - "[agent] Does a stopped run read as failed in the runs panel, or as its own third outcome next to done and failed?"
  - "[agent] Can a background auto-refine run be stopped too, or only runs the user started by hand?"
---

Add a Stop button to a running run, so a run that goes wrong can be ended from the UI instead of hunting for the process in a terminal.

## Today
- Every button starts a run. Nothing ends one.
- While a run is live, its card is locked: `startSession` in `kanban-ui/lib/registry.ts` refuses a second run on the same card, and the card page turns its buttons off.
- So a run that spins, loops, or heads the wrong way holds its card until the process dies on its own. The user has to find the pid and kill it by hand.
- The registry already stores each run's `pid` and already uses `process.kill(pid, 0)` to ask whether it is alive. Ending it is the same call with a real signal.

## Scope
- A Stop button on a running run, in the global runs panel and on the live log view. Same look as the other quiet buttons.
- One confirm step, like every other action: it says the run stops where it is and its unfinished edits stay in the working tree.
- Stopping signals the run's process. The run then ends like any other run: its log file is closed, its duration is stamped, and the card's stage goes back to what it was before (`clearSessionStatus` already does this).
- The card unlocks the moment the run ends, so the user can start a new run on it.
- A run adopted after a UI restart can be stopped too — the UI is not its parent, but it has the pid.
- Stopping a run that already finished does nothing. The button is only on a running run.

## Scope out
- No pause and resume. A stopped run is over; continuing is card #28's job.
- No mid-run message to the agent. That channel stays rejected — see `docs/kanban/memory/local-ui/rejected.md`.

## Todo
- [ ] Add a stop path in `kanban-ui/lib/registry.ts` that signals a running run's process and closes out its record.
- [ ] Make sure the stopped run walks the normal end path: log closed, duration stamped, card stage restored, card unlocked.
- [ ] Add a server action for it in `kanban-ui/app/actions.ts`.
- [ ] Add the Stop button with its confirm dialog to the runs panel (`sessions.tsx`) and the live log view (`agent-shared.tsx`).
- [ ] Handle a run whose process is already gone: say the run has ended, don't show an error.
- [ ] Make an adopted run (one that outlived a UI restart) stoppable the same way.
- [ ] Update `kanban-ui/README.md` — Stop is a new user action, and the README's run section says nothing about ending a run.
