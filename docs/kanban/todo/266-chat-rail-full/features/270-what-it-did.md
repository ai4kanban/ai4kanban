---
title: Open up what the agent looked at, and say what the reply cost
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [266]
modules: [local-ui, skill]
questions:
  - "[user] Is the cost of a reply worth showing at all, or is it noise in a rail this narrow?"
---

While the agent hunts through the board, the rail shows a column of grey lines, each cut
off at the rail's width and none of them openable. And a reply says nothing about what it
cost, though every run on this board does.

## Today
- `blocksOf` in `kanban-ui/components/Chat.tsx` splits the stream on the `⏺ ` marker every
  connector puts in front of a tool call, and draws each as one truncated mono line whose
  only detail is a `title` tooltip.
- A long hunt is a wall of grey the user scrolls past.
- Harnesses declare what they report — `reports: ['cost','tokens','model']` in
  `cli/src/lib/agent/harnesses.ts` — and a run shows it. A chat records the model and
  nothing else.
- Scrolled up to read an older answer, there is no way back to the newest line but
  scrolling.

## Scope
- **A run of lookups folds into one line**: "looked at 6 things", opened with a click.
- **An opened lookup says what it was**: the file or card, and what came back, as far as
  the stream carries it.
- **A reply says what it cost**, quietly under it: elapsed, tokens and price, and only what
  this connector actually reports. A connector that reports none shows none.
- **A jump-to-latest button** appears when the reader has scrolled away from the foot, and
  says how many new lines are below.

## Scope out
- No diff view in the rail. What a run changed has its own view.
- Nothing is invented for a connector that does not report it.

## Todo
- [ ] Fold a run of lookups into one line that opens.
- [ ] Carry enough of each tool call through the transcript for the opened line to say
      something — check what each connector's stream already gives.
- [ ] Record a reply's elapsed, tokens and cost where the transcript is written, and show
      only what the connector reports.
- [ ] Add the jump-to-latest button, with the count of what is below.
- [ ] Cover both in `kanban-ui/README.md`.
