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

## What the user sees
- A view titled **Uncommitted changes**, with one quiet line under it naming the folder it read
  and saying it was read just now.
- The file list: every changed file, with how many lines it gained and lost. This list is never
  cut short.
- Each file's diff opens and closes with a click. A small change starts open. A big one starts
  closed, so the view opens as a short list.
- New files and deleted files are in the list too, not just edited ones.
- Every run has this view — implement, refine, resolve, create, archive, reject. Most board runs
  will show one or two card files.
- It shows the folder as it is right now. Opening an old run shows today's files, not a picture
  from when the run ended.
- Plain lines, never an error page: nothing uncommitted, no git here, this file is binary, this
  diff is too long to show in full, this run's folder is gone.

## Scope out
- No committing from the UI. The user still commits, as `decisions.md` settles.
- No revert or undo button.
- No per-file blame, history, or side-by-side editor. One plain unified diff is enough.

## Note on #48
Card #48 gives an implement run its own git worktree. If that ships first, an implement run is
read from its worktree; every other run still reads the repo root, because #48 keeps board work
there. Keep the folder the view reads in one place, so switching it is a one-line change.

One thing #48 still owes this card: when a worktree is removed, the view wants to say whether the
work merged or the card was just archived. #48 reports the merge result on the card page, but it
does not yet say where that fact is kept. Whoever builds #48 should settle it there, not here.

## Todo
- [ ] Get the user's call on where the view sits — a tab in the runs panel, or a section on the
      card page. That decides the layout, nothing else.
- [ ] Add a server-side read that returns the changed files and each file's diff for the folder a
      run worked in.
- [ ] Include new files and deleted files, not only edited ones — and never write to git while
      reading, so a read can't touch what the user has staged.
- [ ] Keep the folder it reads in one place, so #48's worktree can be swapped in later.
- [ ] Build the read-only view: the title, the folder line, the file list with lines gained and
      lost, and each file's diff opening and closing with a click.
- [ ] Make it refresh while a run is live, on the same poll the log tail already uses.
- [ ] Handle every plain case with a line, not an error: nothing uncommitted, no git, a binary
      file, a diff too long to show in full, and a run whose worktree is gone.
- [ ] Update `kanban-ui/README.md` — this changes what the user does after a run finishes.

## Decided by the agent

- **Show the whole working tree, no time filter** — the view lists every uncommitted change in
  the folder the run worked in, the same list `git diff` gives the user today. It is labelled
  for what it is: the working tree right now.
  A time filter is not possible to do honestly. The registry only records when a run started and
  ended (`startedAt` / `endedAt` in `kanban-ui/lib/registry.ts`), never which files it wrote, so
  the filter would have to guess from each file's change time.
  That guess is wrong both ways — tested. A file written back with its old content has a fresh
  change time while git reports no change at all, so it would show up as a change that isn't one.
  And a file the agent changed that the user then edits after the run gets a change time past the
  run's end, so it would drop off the run's list while the change still sits uncommitted.
  Two runs also share the same minutes — a background refine and an implement can overlap — so
  the clock cannot say who wrote what.
  Card #48 makes the filter pointless anyway: an implement run gets its own worktree, and nothing
  else writes there, so the whole tree in it is that run's work.

- **Every run gets the view** — implement, refine, resolve, create, archive and reject. A board
  run's card edits are ordinary file changes: `git diff` in this repo right now lists the three
  card files a refine run wrote.
  The UI already treats all runs alike — one registry, one runs panel, one log shape — so a rule
  that only implement gets a diff would be a new exception for no gain, and a refine run is the
  case where "what did it write to my card" is most useful.
  The folder it reads differs, not the view. With #48 an implement run reads its worktree; every
  other run reads the repo root, because #48 keeps board runs there.
  A run that changed nothing shows the plain empty state, which is the common case for a run that
  only read files.

- **New files and deleted files both show** — a file the agent created is listed with every line
  as an addition, and a file it deleted is listed with every line removed.
  Git needs two reads for this, tested here. `git diff` and `git diff HEAD` both list a deleted
  file with its removed lines, but neither lists a newly created file at all — it is untracked.
  `git status --porcelain -uall` is the one that names it. `-uall` matters: without it a whole new
  folder collapses to one `newdir/` line instead of its files.
  The view never writes to git. The usual shortcut for showing new files, `git add -N`, writes to
  the staged area — tested, and undoing it turned a staged rename into a delete plus an untracked
  file. A read-only view must not be able to do that to the user's work.
  Files git ignores never show — tested. That keeps `node_modules`, the session logs and #48's
  `.worktrees/` out for free.
  A rename the user has not staged shows as one delete and one new file. That is what `git status`
  tells them too, so it matches what they already see.

- **The view shows the tree as it is now** — it is live, never frozen at the moment the run ended.
  Opening an old run shows today's working tree, and the view says so.
  Nothing is stored to freeze. A run never commits, so the only copy of what it wrote is the file
  on disk; the registry keeps the log and the timestamps and nothing else. Freezing would mean
  saving a second copy of the work that can disagree with the real files.
  Live is also the useful one. The next thing the user does is commit, so they have to read what
  they are about to commit, not a picture from an hour ago. A live run works the same way, its
  list just grows.
  With #48 this stops being a worry for implement: the run's worktree is written by that run
  alone, so "now" and "what this run did" are the same thing there.

- **The file list is never cut, each file's diff is** — every changed file is listed with how many
  lines it gained and lost. That list always shows in full, so the user always knows the size of
  what happened.
  Each file opens and closes with a click. When the run's whole diff is 400 lines or less the
  files start open, so the normal small change is readable with no clicking. Above that they all
  start closed and the view opens as a short list.
  One file's diff stops at 500 lines, with a last line saying how many lines are left and that
  `git diff` has the rest. A binary file gets one line instead of a diff — git already answers
  `Binary files a/bin.dat and b/bin.dat differ`, tested — which is the same plain degrade the
  scope asks for.
  Reading is cheap enough to poll: on this repo the file list came back in 10ms and the full diff
  in 11ms, so a live run can refresh on the same beat as the log tail.

- **Call it "Uncommitted changes", and name the folder under it** — the view is titled for what
  it holds, not for the run. Under the title one quiet line says which folder was read and that
  it was read just now: the repo root for a board run, and with #48 the run's own worktree path
  for an implement run. The empty state says "nothing uncommitted here".
  The view never says "this run changed these files". It cannot: the registry keeps only the
  start and end time of a run, never a file list (`kanban-ui/lib/registry.ts`). So two runs that
  read the same folder show the same list, and the title has to stay true when they do.
  These are the words the product already uses. `kanban-ui/README.md` says a run "leaves its
  changes in your working tree; you read `git diff` and commit", and `decisions.md` says the
  same. "Uncommitted" is also what the user does next — commit — so the title names the thing
  they are about to act on.
  The card's own title is not what the user reads. It stays as it is; only the screen has to be
  honest.
  With #48 nothing about the title changes, and it stops being a compromise for implement: that
  worktree is written by one run only, so the folder line already says whose work it is.

- **A run whose worktree is gone shows one plain line** — not the repo root, and not a blank
  view. The line says the folder that run worked in is gone, and where the work went: merged
  into main, or the card was archived or rejected with nothing left in it.
  There is nothing to show, by #48's own rule: a worktree is only removed when it is clean or
  its work has merged, and one that still holds work is kept. Tested here — after merging a
  worktree's branch and removing the worktree, `git worktree list` no longer names the folder,
  the folder is gone, and `git status --porcelain -uall` in the repo root prints nothing.
  Reading the repo root instead would be a lie. That folder holds the user's own uncommitted
  edits, which have nothing to do with that run.
  A blank view is worse than the line. The user opened a finished implement run and needs to
  know why there is no diff, and "it merged" is good news, not an error.
  It also has to be checked before git is asked. Tested: running git in the removed path fails
  with `fatal: cannot change to '...': No such file or directory`, which is not something to
  show the user.
  This only ever happens to an implement run. Every other run reads the repo root, which never
  goes away.
