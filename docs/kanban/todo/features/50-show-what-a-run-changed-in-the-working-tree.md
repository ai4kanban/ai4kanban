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
  - "[user] Where does the diff belong — a second tab in the runs panel next to the log, or a section on the card page under the run log?"
---

Show the files a run changed, right next to its log, so the user can see the work without
switching to a terminal.

## Today
- A run never commits. It leaves its changes in the working tree, and the user reads
  `git diff` and commits — that is the model, and it stays.
- The UI shows only the log. The log says what the agent thinks it did, not what landed on
  disk.
- So the one step that decides whether to keep the work happens outside the UI: click
  Implement, read the log in the browser, then open a terminal and type `git diff`.

## What the user sees

- A read-only view titled **Uncommitted changes**, sitting with the run so the log and the
  result are in one place. Under the title, one quiet line names the folder it read and says
  it was read just now.
- The file list: every changed file with how many lines it gained and lost. This list is
  never cut short, so the user always knows the size of what happened.
- Each file's diff opens and closes with a click. When the whole diff is 400 lines or less
  the files start open; above that they all start closed and the view opens as a short list.
  One file's diff stops at 500 lines, with a last line saying how many are left and that
  `git diff` has the rest.
- New and deleted files are in the list too. A file the agent created shows every line as an
  addition; a deleted one shows every line removed.
- The view shows the folder as it is right now — never frozen at the moment the run ended.
  Opening an old run shows today's files, and the folder line says so. A live run works the
  same way; its list just grows.
- Every run has this view — implement, refine, resolve, create, archive, reject. A board
  run's card edits are ordinary file changes, and "what did it write to my card" is most
  useful on a refine.
- Plain lines, never an error page: nothing uncommitted here, no git here, this file is
  binary, this diff is too long to show in full, this run's folder is gone.

## Rules to follow

- **No time filter — the view shows the whole working tree.** The registry records only when
  a run started and ended (`startedAt` / `endedAt` in `kanban-ui/lib/registry.ts`), never
  which files it wrote. A filter would have to guess from change times, and that guess is
  wrong both ways: a file written back with its old content looks changed when git says it
  is not, and a file the user edits after the run drops off the list while still uncommitted.
  Two runs also overlap in the same minutes.
- **The view never says "this run changed these files."** It cannot, for the same reason. Two
  runs reading the same folder show the same list, and the title has to stay true then.
- **The read never writes to git.** The usual shortcut for showing new files, `git add -N`,
  writes to the staged area — undoing it turns a staged rename into a delete plus an
  untracked file. A read-only view must not be able to do that to the user's work.
- Listing new files takes a second read: `git diff` and `git diff HEAD` both show a deleted
  file but neither lists an untracked one. `git status --porcelain -uall` names it, and
  `-uall` matters — without it a whole new folder collapses to one `newdir/` line.
- Ignored files never show, which keeps `node_modules`, the session logs and #48's
  `.worktrees/` out for free. An unstaged rename shows as one delete plus one new file, the
  same as `git status` already tells the user.
- Check the folder exists before asking git. Running git in a removed path fails with
  `fatal: cannot change to '...'`, which is not something to show the user.
- Reading is cheap enough to poll — the file list and full diff both came back in about 10ms
  on this repo — so a live run refreshes on the same beat as the log tail.

## Scope out
- No committing from the UI. The user still commits, as `decisions.md` settles.
- No revert or undo button.
- No per-file blame, history, or side-by-side editor. One plain unified diff is enough.

## With #48
- Card #48 gives an implement run its own git worktree. Then an implement run is read from
  its worktree and every other run still reads the repo root, because #48 keeps board work
  there. Keep the folder the view reads in one place, so switching it is a one-line change.
- A removed worktree gets one plain line — not the repo root, which holds the user's own
  edits and has nothing to do with that run. The line says the folder is gone and where the
  work went: merged into main, or the card archived or rejected with nothing left in it. #48
  reports the merge result on the card page; read it from wherever #48 ends up keeping it.

## Todo
- [ ] Get the user's call on where the view sits — a tab in the runs panel, or a section on
      the card page. That decides the layout, nothing else.
- [ ] Add a server-side read that returns the changed files and each file's diff for the
      folder a run worked in.
- [ ] Include new and deleted files, not only edited ones — `git status --porcelain -uall`
      alongside the diff, and never write to git while reading.
- [ ] Keep the folder it reads in one place, so #48's worktree can be swapped in later.
- [ ] Build the read-only view: the title, the folder line, the file list with lines gained
      and lost, and each file's diff opening and closing with a click.
- [ ] Apply the size rules: files start open under a 400-line total, each file's diff stops
      at 500 lines with a line saying how many are left.
- [ ] Make it refresh while a run is live, on the same poll the log tail already uses.
- [ ] Handle every plain case with a line, not an error: nothing uncommitted, no git, a
      binary file, a diff too long to show in full, and a run whose worktree is gone.
- [ ] Update `kanban-ui/README.md` — this changes what the user does after a run finishes.
