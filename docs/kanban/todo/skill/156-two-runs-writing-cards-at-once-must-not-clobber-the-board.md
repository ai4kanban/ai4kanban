---
title: Two runs writing cards at once must not clobber the board
track: skill
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: [48]
modules: [skill]
questions: []
---

The board already runs up to five refines at once, and auto-implement and worktrees will
add more. Two runs that create a card at the same moment can take the same id and
overwrite each other's line in the board index. Make the board safe to write from two
runs at once.

## Scope
- Allocating an id is one step that cannot be split: two runs asking at the same moment
  get different ids, never the same one.
- Writing the board index is the same: two runs adding a card both end up in it.
- The same holds for the metrics file and for two runs editing the same card.
- A run that has to wait says so and waits; it never fails and never half-writes a file.
- Add a test that runs several creates at once and checks every id and every index line
  survived.

## Todo
- [ ] Make id allocation safe when two runs ask at the same moment.
- [ ] Make the board index, the metrics file, and card writes safe the same way.
- [ ] Make a waiting run wait rather than fail, and never leave a half-written file.
- [ ] Add a test that fires several creates at once and checks nothing was lost.
- [ ] Drop the propose flow's workaround of routing every create through one agent, if it
      is no longer needed.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; their 0.42 release ships atomic
  read-modify-write for the tasks file and calls out race conditions in multi-process
  access as the bug it fixes. We have the same shape of bug: `next-id` and the board index
  are both read-then-write, with five refines already running at once.
