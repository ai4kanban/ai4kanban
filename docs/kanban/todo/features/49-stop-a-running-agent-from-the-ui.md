---
title: Stop a running agent from the UI
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: []
modules: [local-ui]
questions:
  - "[user] A stopped run leaves half-finished edits in the working tree. Does the UI just say so and leave them, or is undoing them part of this card?"
---

Add a Stop button to a running run, so a run that goes wrong can be ended from the UI
instead of hunting for the process in a terminal.

## Today
- Every button starts a run. Nothing ends one.
- While a run is live its card is locked: `startSession` in `kanban-ui/lib/registry.ts`
  refuses a second run, and the card page turns its buttons off. A run that spins or heads
  the wrong way holds its card until the process dies on its own.
- The registry already stores each run's `pid` and already calls `process.kill(pid, 0)` to
  ask whether it is alive. Ending it is the same call with a real signal.

## Scope
- A Stop button on a running run, in the global runs panel and on the live log view. Same
  look as the other quiet buttons.
- One confirm step: it says the run stops where it is and its unfinished edits stay in the
  working tree.
- One press is enough. Stop asks the run to end; a run still alive after a short grace is
  killed.
- The run then ends like any other: log closed, duration stamped, card stage restored
  (`clearSessionStatus` already does this), card unlocked.
- Stopped is its own outcome, next to done and failed — a neutral dot and its duration. It
  is saved with the run record, so it still reads stopped after a UI restart.
- Every running run can be stopped: create, propose, archive, reject, and background
  auto-refine alike. The board script runs one short command at a time, so the worst
  leftover is an id with no card, which the next script run fixes on its own.
- Auto-refine skips a card whose newest run was stopped, so it does not start refining that
  card again a minute later. Any later run on the card clears the skip.
- A run adopted after a UI restart can be stopped too — the UI is not its parent, but it
  has the pid.
- Stopping a run that already finished does nothing. The button is only on a running run.

## Scope out
- No pause and resume. A stopped run is over; continuing is card #28's job.
- No mid-run message to the agent. That channel stays rejected — see
  `docs/kanban/memory/local-ui/rejected.md`.
- Stop ends the agent only. A build or test it started is left to finish on its own.

## Todo
- [ ] Add a stop path in `kanban-ui/lib/registry.ts`: signal the run's process, kill it
      after a short grace, close out its record.
- [ ] Carry stopped as an outcome end to end — saved with the run record, read back after a
      restart, shown as its own dot and word in the runs panel and the log view.
- [ ] Make the stopped run walk the normal end path: log closed, duration stamped, card
      stage restored, card unlocked — even if a leftover tool process still holds the
      output pipe open.
- [ ] Add a server action for it in `kanban-ui/app/actions.ts`.
- [ ] Add the Stop button with its confirm dialog to the runs panel (`sessions.tsx`) and the
      live log view (`agent-shared.tsx`).
- [ ] Skip a card in the auto-refine dispatcher when its newest run is a stopped one.
- [ ] Handle a run whose process is already gone: say the run has ended, don't show an error.
- [ ] Make an adopted run (one that outlived a UI restart) stoppable the same way.
- [ ] Update `kanban-ui/README.md` — Stop is a new user action, and the README's run section
      says nothing about ending a run.
