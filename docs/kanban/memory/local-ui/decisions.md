# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## Propose and add-task

- Propose runs on one module at a time. The picker is a single-module dropdown, never a
  multi-select.
- Picking a module is optional for both propose and add-task. With none picked, the agent
  chooses the focus itself.

## Auto-refine

- Refining is automatic only. There is no manual "Refine" button; with the switch off,
  nothing refines.
- The dispatcher refines one card at a time, highest priority first, and only while the
  switch is on.
- The background timer runs from server start. Refining does not wait for a browser tab to
  open the board.
- It answers a card's open questions itself, except the ones tagged `[user]`. It skips a
  card whose questions are all `[user]` — that one waits for the human.
- The switch shows one read-only label beside it in the Configuration dialog: "Refining
  #<id>", the card the background run is on right now. When no run is going there is no
  label at all — no "last refined", no "next up", no idle reason. The runs panel is the
  place to browse runs.
- **Does a paused dispatcher say so beside the switch?**: No. Even when a rate limit pauses
  background refining for hours, the switch stays silent — a failure is a run's business,
  and the failed run in the runs panel is where its reason is named.

## What a run leaves behind

- A run never commits. It leaves its changes in the working tree and the user reads
  `git diff` and commits. No branches, no worktrees, no pull requests — that is the model
  we point at vibe-kanban for.

## Seeing what changed

- The UI shows **uncommitted changes**, not "what this run changed". Nothing records which
  files a run wrote, so the view names the folder it read and shows that folder as it is
  right now. Never claim a file list belongs to one run.
- Every run gets that view, not only implement. A refine or resolve run writes card files,
  and those are changes worth reading too.
- The view is read-only in the strict sense: it never writes to git, so it can't disturb
  what the user has staged. It also never keeps a frozen copy — an old run shows today's
  files.

## Stopping a run

- Any running run can be stopped from the UI, whoever started it — a background auto-refine
  run and a create/propose/archive/reject too.
- Stopped is its own outcome. Done, failed and stopped are three different things; a stopped
  run is not a failure.
- Stop ends the agent only. A build or test the agent started is left to finish on its own.
- Stopping a background refine holds: the dispatcher does not pick that card again while its
  newest run is a stopped one.

## Continuing a run

- Only a run that **failed** can be continued. A run that passed has nothing to continue, so
  it shows no button at all. Continuing starts a new run and the live view stays a read-only
  log — nothing is ever typed into a running session.

## Group tasks

- A group is finished by finishing its subtasks, never by implementing the root directly.
- The Archive button appears on a group root once every subtask is resolved — done or
  rejected. A group whose subtasks were all rejected is closed with Reject instead.
- The root card shows each subtask's outcome, and done looks different from rejected.
- "Implement group" is one run owned by the root that keeps working until every subtask is
  done or rejected. Only Claude Code can do this; another connector falls back to one long
  run given the same instructions.
- A group run locks the root and every subtask. One log, shown on the root and on each
  subtask it covers — there is no separate log per subtask. Per-subtask progress is the
  root's subtask list ticking over while the run goes.

## The goal bar

- `goal.md` means the whole direction — the horizon and roadmap included, not just a
  short-term goal. There is no separate roadmap file; the bar asks for all of it in that
  one file.
- The bar can be dismissed; it is a nudge, not a gate.

## The progress view

- Daily progress opens from an icon button in the header, not a strip on the board. It
  shows a line chart like the site's throughput chart, not numbers alone.

## The queue view

- **Is a queue view the same as the rejected ready-only toggle?**: No. The toggle hid every
  card that wasn't `ready`; the queue view shows ready and not-ready side by side and hides
  nothing. A second way to group the whole board is fine — hiding cards is not.

## The memory view

- **Can the UI edit memory?**: No. Every memory file is read-only in the UI — you read a
  wrong line there and fix it in your own editor. Memory is plain unstructured text the
  user owns, like their code, and a text box in the board is no better than an IDE. The
  goal bar stays the one file the UI writes.

## Setting up a board from the UI

- **Does the setup screen ask you for the track list?**: No. The agent reads the repo and
  proposes the tracks. Setup asks the user nothing at all — not the tracks, not the project
  name, not the description.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide: what the buttons do, the Configuration
  dialog, group tasks. Any card that changes visible UI behavior updates that file.
- The skill's `references/local-ui.md` covers installation only — how to run it, the
  options, updating. It never describes using the UI.
