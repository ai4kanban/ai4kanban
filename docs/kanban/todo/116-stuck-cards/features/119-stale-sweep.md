---
title: Sweep the stuck cards on a schedule
track: features
priority: low
roi: med
status: todo
release: next
blocked_by: [118]
related: [116, 64]
modules: [skill]
questions: []
---

Stuck cards should be found by the board, not by a human rereading it. Run the unstick
flow on a cadence.

Part of #116. One run lists the stuck cards (#117) and works the stalest few through
the unstick flow (#118).

## Scope
- A recurring card under `todo/recurring/`: list the stuck cards, unstick the stalest
  few.
- A few cards per run, stalest first — a sweep that rewrites half the board in one day
  helps nobody. The cap lives in the card's process, so a run can tune it.
- The run's proposals land as open questions and board changes the user can review,
  like any other agent work.
- With a cadence set, the dispatcher runs the sweep in the background (#64). Without
  one, the user runs it by hand.

## Todo
- [ ] Create the recurring sweep card with its process: list the stuck cards, run the
      unstick flow on the stalest few, capped.
- [ ] Do one full run by hand and fold what breaks back into the process.
