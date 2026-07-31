---
title: Stop a running agent from the UI
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: []
modules: [local-ui]
questions: []
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
- Stop is a small ✕ on a running run. It sits in the log window's title bar, so it is there
  wherever that log opens: the card page, the board's log overlay, and the global runs panel.
- The ✕ never stops a run on its own. It opens a small confirmation popover right beside it —
  one line saying the run stops where it is and its unfinished edits stay in the working tree,
  then Cancel or Stop run. A stray click can't kill a run.
- One confirm is enough. Stop asks the run to end; a run still alive after a short grace is
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
- Stop never touches your files. Whatever the run half-wrote stays in the working tree, and
  undoing it is `git` in your own terminal — the board does not offer to revert.
- No pause and resume. A stopped run is over, so it offers no Resume button.
- No mid-run message to the agent. That channel stays rejected — see
  `docs/kanban/memory/local-ui/rejected.md`.
- Stop ends the agent only. A build or test it started is left to finish on its own.

## Todo
- [x] Add a stop path in `kanban-ui/lib/registry.ts`: signal the run's process, kill it
      after a short grace, close out its record.
- [x] Carry stopped as an outcome end to end — saved with the run record, read back after a
      restart, shown as its own dot and word in the runs panel and the log view.
- [x] Make the stopped run walk the normal end path: log closed, duration stamped, card
      stage restored, card unlocked — even if a leftover tool process still holds the
      output pipe open.
- [x] Add a server action for it in `kanban-ui/app/actions.ts`.
- [x] Add the ✕ with its confirmation popover to the log window's title bar
      (`agent-shared.tsx`), so it shows on the card page, the board overlay and the runs panel.
- [x] Skip a card in the auto-refine dispatcher when its newest run is a stopped one.
- [x] Handle a run whose process is already gone: say the run has ended, don't show an error.
- [x] Make an adopted run (one that outlived a UI restart) stoppable the same way.
- [x] Update `kanban-ui/README.md` — Stop is a new user action, and the README's run section
      says nothing about ending a run.

## Decided by the agent
- Where does the ✕ go? In the log window's title bar, the one piece of chrome every place
  that shows a run already has. One button, and it appears on the card page, the board's log
  overlay and the runs panel at once.
- Can a stopped run be resumed? No. Resume is for a run that stopped short on its own; a run
  you ended is over.
- What does a stopped run's dot look like? The neutral blue the board already uses for a
  signal that is neither good nor bad — not the green of done, not the peach of a failure.
