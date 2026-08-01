---
title: Show what changed on the board since you last looked
track: features
priority: low
roi: med
status: todo
release: next
blocked_by: []
related: [124]
modules: [skill, local-ui]
questions: []
---

You pull, and the board changed under you. Say what happened, without making anyone
read a diff.

Part of #124.

## Scope
- One view answers "what changed since I last looked": cards created, finished,
  rejected, questions asked and answered — in card language, not file paths.
- Since-when comes from git. The last time you wrote to the board yourself is a fine
  default.
- Works in the terminal through the script, and as a view in the local UI.

## Todo
- [ ] Build the change summary from the board's git history between two points.
- [ ] Add a script command that prints it since your last write.
- [ ] Show the same summary in the local UI when the board files changed underneath it.
- [ ] Try it on this repo's real history and check it reads like a note, not a diff.
