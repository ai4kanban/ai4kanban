---
title: Run each test request twice — once with the board, once without
track: distribution
priority: med
roi: high
status: ready
release: 0.6.0
blocked_by: [203]
related: [202]
modules: [skill]
questions: []
---

If the two runs differ in anything but the board, the comparison proves nothing. Set up the
pair of runs so the board is the only difference, and keep everything they did.

## Scope
- Both runs start from the same pinned repo state, so work landing later cannot move the
  ground under a test.
- The **with** run has the board: the cards, the memory, and the skill installed.
- The **without** run has none of them — same repo, board and memory taken away.
- Same request, same agent, same settings, same starting prompt. Nothing else changes.
- Neither run's output is thrown away — the full transcript is kept for the scoring card.
- The whole set can be run again later and give a comparable result, so this is not a
  one-off script we delete afterwards.

## Todo
- [ ] pin the repo state both runs start from
- [ ] build the "without" copy — the same repo with the board, memory and skill removed
- [ ] run one request both ways end to end and confirm the two runs differ only by the board
- [ ] keep each run's full output
- [ ] write down how to run the whole set again from scratch

## Decided by the agent
- **The runs may change files** — each one works on a throwaway copy. Whether the agent
  starts writing the feature is the thing we are measuring, so a mode that only lets it talk
  about the work would hide the answer. Nothing a run does is kept beyond the record.
- **What the "with" side has** — the board files and the skill, as a normal user gets them.
  The board UI is not part of it: we are testing what the board does to a coding agent's
  work, not what a button does.
