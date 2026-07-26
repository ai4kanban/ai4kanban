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

## Decided by the agent

- **Does a stopped run read as failed?** No. Stopped is its own outcome, next to done and
  failed. It gets a neutral dot and shows its duration like any finished run.
- **Can a background auto-refine run be stopped?** Yes. Every running run can be stopped, no
  matter who started it — including create, propose, archive and reject.
- **Does stopping a background refine hold?** Yes. The dispatcher skips a card whose newest
  run is a stopped one, so it does not start refining that card again a minute later. Any
  other run on the card clears the skip.
- **Does the stop survive a UI restart?** Yes. The stopped mark is saved with the run record,
  so after a restart the run still reads stopped and the card is still skipped. There is no
  separate store for it — it fades when that run ages out of the kept 30.
- **What if the run does not end?** One press is enough. Stop asks the run to end, and a run
  still alive after a short grace is killed. No second press, no second dialog.
- **Does a stopped adopted run read as stopped or as unknown?** As stopped. "Unknown" means
  we never saw why a run ended; here the UI ended it itself, so it knows.
- **Does Stop reach the tools a run started?** No. Stop ends the agent. A build or test it
  started is left to finish on its own — it holds nothing.
- **Is Stop offered on create, propose, archive and reject?** Yes, with the same confirm. The
  board script runs one short command at a time, so stopping the agent never cuts a script
  mid-write. The worst leftover is an id allocated with no card, which the next script run
  fixes on its own.
- **Can a stopped run be continued?** This card decides nothing there. A stopped run is a
  finished run, so it gets whatever the runs panel gives a finished run — Copy ID today,
  Continue when #28 ships.

### What this adds to the work

- Stopped is a new outcome to carry end to end: set when the signal is sent, saved with the
  run record, read back after a restart, and shown as its own dot and word in the runs panel
  and the log view.
- The dispatcher has to skip a card whose newest run is stopped, or it restarts the refine a
  minute later and the stop looks like it did nothing.
- A run whose leftover tool process holds the output pipe open must still close out the
  moment the agent exits — the card unlocks then, and the board-index lock releases once.
