---
title: Show what a run changed in the working tree
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [48]
modules: [local-ui]
questions:
  - "[agent] A run does not record which files it touched. Should the view show the whole working tree diff, or only the files whose change time falls inside the run?"
  - "[user] Where does the diff belong — a second tab in the runs panel next to the log, or a section on the card page under the run log?"
  - "[agent] How much of a big diff is shown before it is cut off, and can each file be collapsed?"
---

Show the files a run changed, right next to its log, so the user can see the work without switching to a terminal.

## Today
- A run never commits. It leaves its changes in the working tree, and the user reads `git diff` and commits — that is the model, and it stays.
- But the UI shows only the log. The log says what the agent thinks it did. It does not show what actually landed on disk.
- So the loop is: click Implement, read the log in the browser, then open a terminal and type `git diff` to check the real result. The one step that decides whether to keep the work happens outside the UI.

## Scope
- A read-only view of what changed: the list of changed files, and each file's diff.
- It sits with the run, so the log and the result are in one place.
- It works for a finished run and for a live one — a live run's changes grow as it goes.
- Plain empty state: a run that changed nothing says so.
- The diff is read from git, read-only. No staging, no commit, no revert, no editing from this view.
- A run whose repo has no git, or a file too large to diff, degrades to a plain line saying so — not an error page.

## Scope out
- No committing from the UI. The user still commits, as `decisions.md` settles.
- No revert or undo button.
- No per-file blame, history, or side-by-side editor. One plain unified diff is enough.

## Note on #48
Card #48 gives each run its own git worktree. If that ships first, "what changed" is read from that run's worktree instead of the repo root. Keep the diff read behind one function so switching the directory it reads is a one-line change.

## Todo
- [ ] Add a server-side read that returns the changed files and their diffs for a run.
- [ ] Keep the directory it reads in one place, so #48's worktree can be swapped in later.
- [ ] Build the read-only view: file list, each file's unified diff, plain empty state.
- [ ] Make it refresh while a run is live, on the same poll the log tail already uses.
- [ ] Handle no-git and unreadable-file cases with a plain line, no error.
- [ ] Update `kanban-ui/README.md` — this changes what the user does after a run finishes.
