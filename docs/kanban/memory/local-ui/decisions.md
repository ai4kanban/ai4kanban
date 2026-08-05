# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## What the UI is and isn't

- The UI offers what the script offers. No action stays terminal-only because it feels
  rare or administrative; renaming and reordering releases are the exception, done by
  hand in `releases.md`.
- Memory files are read-only in the UI. You read a wrong line there and fix it in your own
  editor — each section's "more" menu copies the path for your editor or coding agent. The
  goal is the one file the UI writes.
- A run never commits. Its changes stay in the working tree and the user reads `git diff`
  and commits. No branches, no worktrees, no pull requests.
- Setup from the UI asks the user nothing — not the tracks, not the project name, not the
  description. The agent reads the repo and proposes them.

## Propose and add-task

- Propose runs on one module at a time; the picker is a single-module dropdown, never a
  multi-select. Picking a module is optional for both propose and add-task — with none
  picked, the agent chooses the focus itself.

## Auto-refine

- The switch governs background runs only. With it off nothing is refined on its own, but
  the card page's Refine button still works.
- The dispatcher takes cards highest priority first; how many at once is a user setting,
  default 1. The timer runs from server start — nothing waits for a browser tab.
- It answers a card's open questions itself except the ones tagged `[user]`, and skips a
  card whose questions are all `[user]`.
- One live label beside the switch, "Refining #<id>", and nothing else — no "last
  refined", no "next up", no idle reason, and no word about a rate limit that paused it.
  A failure is a run's business; the runs panel names its reason.
- Stopping a background refine holds: the dispatcher doesn't pick that card again while
  its newest run is a stopped one.

## Runs

- Stopped is its own outcome, not a failure, and any run can be stopped whoever started
  it. Stop ends the agent only — a build or test it started finishes on its own — and the
  half-finished edits stay in the working tree for git to undo.
- Stopping takes a confirmation beside the ✕. One click never ends a run.
- Only a failed run can be continued; a run that passed shows no button. Continuing starts
  a new run, and the live view stays a read-only log — nothing is typed into a running
  session.
- The model shown on a run is what the agent reported as it ran, not the model setting.
  Most people leave that setting empty, so reading it would leave most runs blank.

## Seeing what changed

- The view shows **uncommitted changes**, not "what this run changed" — nothing records
  which files a run wrote, so it names the folder it read and shows that folder as it is
  right now. Never claim a file list belongs to one run.
- Every run gets the view, not only implement; a refine or resolve writes card files too.
  It never writes to git, so it can't disturb what the user staged, and it keeps no frozen
  copy — an old run shows today's files.

## Connectors and keys

- **Which agents come next?**: Cursor, OpenClaw and OpenCode, after Claude Code and Codex.
  Anything past those four waits for users to ask for it.
- Each connector declares the settings it takes and the dialog draws them. Two shapes
  only: a box to type in, and a list to pick one from.
- Each connector keeps its own settings block beside its name, so switching loses nothing
  — one connector's model id or endpoint means nothing under another's name. A run reads
  the running connector's block and no other.
- Keys live in `docs/kanban/.env` and nowhere else. You type one into the dialog or write
  the line yourself; either way the board reads the same file, so a hand-written key shows
  as set. A key written into `ui.config.json` is ignored.
- The board keeps `.env` out of git through its own `docs/kanban/.gitignore`, never by
  editing the repo's root one.
- A saved key is never shown back — the box says it is set, with Replace and Clear.
- What `.env` names wins for a run; a variable it doesn't name is left alone, so a key
  already exported in the shell keeps working. Switching connector never touches the keys.

## Answering open questions

- A question with options keeps its text box, but the two ways don't mix: on a
  `single-option` question the user either ticks one option or types an answer.

## Group tasks

- A group is finished by finishing its subtasks, never by implementing the root. Archive
  appears on the root once every subtask is done or rejected; a group whose subtasks were
  all rejected is closed with Reject instead. The root shows each subtask's outcome, and
  done looks different from rejected.
- "Implement group" is one run owned by the root that keeps working until every subtask is
  done or rejected. It locks the root and every subtask and keeps one log, shown on all of
  them; progress is the root's subtask list ticking over. Only Claude Code can do this —
  another connector falls back to one long run with the same instructions.

## The goal

- `goal.md` is the whole direction — the horizon and roadmap included. There is no
  separate roadmap file.
- To someone reading the board the goal is a reminder, not a file they work in: a quiet
  header control opens the whole file, and editing sits one click in. The memory view
  never shows it — one file, one place.
- The nudge bar is a nudge, not a gate: it can be dismissed, it comes back if the goal
  turns weak again long after setup, and it stops as soon as the user writes anything.

## Notice bars

- One shared bar carries every condition the UI can't fix itself — the goal nudge,
  warnings, a card the dispatcher gave up on after repeated failed runs. It shows by
  default, stays while the condition holds, and a ✕ closes it without writing to the board.

## Views and filters

- The queue view regroups the whole board and hides nothing — it is a second way to group,
  not the rejected ready-only filter.
- The release dropdown is the one place the board hides cards, and only on a deliberate
  pick; All releases is the default. Blockers stay on screen whatever release is picked,
  since an unplanned blocker is usually blocking the version being planned.
- Ticking cards to move several in or out of a release is worth having beside the agent's
  fill pass, which only ever adds — a version planned too full needs a fast way back out.
- Daily progress opens from a header icon, not a strip on the board, and shows a line
  chart rather than numbers alone.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide: what the buttons do, the Configuration
  dialog, group tasks. Any card that changes visible UI behavior updates that file.
- The skill's `references/local-ui.md` covers installation only — how to run it, the
  options, updating. It never describes using the UI.
