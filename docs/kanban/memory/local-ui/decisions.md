# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## What the UI is and isn't

- Renaming and reordering releases are the one thing the UI leaves to the terminal — they
  are hand edits in `releases.md`.
- Memory files are read-only in the UI. You read a wrong line there and fix it in your own
  editor — each section's "more" menu copies the path. The goal is the one file the UI
  writes.
- A run never commits. Its changes stay in the working tree and the user reads `git diff`
  and commits. No branches, no worktrees, no pull requests.
- Setup runs in the UI, as a guided first run that asks the user what only they know — the
  project, its tracks, the goal, and which agent does the work. Defaults are offered so it
  can be pressed through. The steps that read the repo and think run after it.
- Where the board's rules live: in the command, not in the UI. The UI keeps its buttons and
  panels and drives its runs through the command, rather than holding a second copy of how
  a card is written and how a run is started.

## How the board is run

- **Which systems the desktop app ships on?**: macOS, Windows and Linux together, from the
  first release that has an app. macOS is the one we test each release; the other two are
  built and shipped untested until someone reports otherwise.
- **How does a user get the board?**: the desktop app is the way in. Homebrew may come
  later; npx is not how the app is handed out.
- **What happens to the browser way?**: deprecated the day the app ships, and said so out
  loud — a warning from npm, a notice in the page, and no doc teaching it any more. The
  package is frozen, not pulled. The pages live on inside the app; only starting a server
  and opening a browser goes away.
- **What do we pay to sign the app?**: the Mac app only, eventually — macOS is the one we
  test. Windows stays unsigned; revisit a Windows certificate when users ask. Signing never
  holds a release back: the app ships unsigned and the download page says what to click
  past.
- **Is the coding agent skill part of getting a board?**: no — a new board arrives without
  it, and it is added later from a button in the Configuration dialog. Driving the board
  from a coding agent is an extra you turn on, not the way in.

## Propose and add-task

- Propose runs on one module at a time; the picker is a single-module dropdown, never a
  multi-select. Picking a module is optional for both propose and add-task — with none
  picked, the agent chooses the focus itself.

## Refining on its own

- A refine follows the run that touched the card, as a run of its own. Nothing hunts the
  backlog, so there is no switch, no "cards at once" budget, and no timer for it.
- It answers a card's open questions itself except the ones tagged `[user]`, and skips a
  card whose questions are all `[user]`.
- Stopping a background refine holds: the dispatcher doesn't pick that card again while
  its newest run is a stopped one.

## Runs

- Stopped is its own outcome, not a failure, and any run can be stopped whoever started
  it. Stop ends the agent only — a build or test it started finishes on its own — and the
  half-finished edits stay in the working tree for git to undo. It takes a confirmation
  beside the ✕; one click never ends a run.
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
  It never writes to git, and it keeps no frozen copy — an old run shows today's files.

## Connectors and keys

- **Which agents come next?**: Cursor and OpenCode, after Claude Code and Codex. OpenClaw
  was dropped — it is a chat-app assistant, not a coding CLI. Anything past those four
  waits for users to ask.
- **What does an agent have to do to ship?**: stream its log as it works, and resume a run
  that stopped short. An agent that only prints a summary at the end isn't offered — a
  blank box for the whole run reads as a hang, and no Resume means a failure is unfinished
  work the user has to redo by hand.
- **How does the board reach an agent?**: by starting a command and reading what it prints,
  and no other way. An agent whose live view only exists in a browser app of its own is not
  offered — talking to a server would change how every agent is wired.
- Each connector declares the settings it takes and the dialog draws them. Two shapes
  only: a box to type in, and a list to pick one from. Each keeps its own settings block
  beside its name, so switching loses nothing and a run reads the running connector's
  block and no other.
- Keys live in `docs/kanban/.env` and nowhere else, kept out of git through the board's own
  `docs/kanban/.gitignore` rather than the repo's root one. Type one into the dialog or
  write the line yourself; either way the board reads the same file, and a key written into
  `ui.config.json` is ignored. A saved key is never shown back — the box says it is set,
  with Replace and Clear.
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
  them. Only Claude Code can do this — another connector falls back to one long run with
  the same instructions.

## The goal

- `goal.md` is the whole direction — the horizon and roadmap included. There is no
  separate roadmap file.
- To someone reading the board the goal is a reminder, not a file they work in: a quiet
  header control opens the whole file, and editing sits one click in. It gets no row in the
  Memory panel — one file, one place, and it is read far more often than the rest.
- The nudge bar is a nudge, not a gate: it can be dismissed, it comes back if the goal
  turns weak again long after setup, and it stops as soon as the user writes anything.

## Notice bars

- One shared bar carries every condition the UI can't fix itself — the goal nudge,
  warnings, a card the dispatcher gave up on after repeated failed runs. It shows by
  default, stays while the condition holds, and a ✕ closes it without writing to the board.

## Views and filters

- The queue view regroups the whole board and hides nothing — it is a second way to group,
  not the rejected ready-only filter.
- The release dropdown is the one place the board hides cards. Its entries are the open
  versions plus **No release** — the first entry and the default; there is no whole-board
  view, since a card already in a version is reviewed in that version. Blockers stay on
  screen whatever release is picked, since an unplanned blocker is usually blocking the
  version being planned.
- Ticking cards to move several in or out of a release is worth having beside the agent's
  fill pass, which only ever adds — a version planned too full needs a fast way back out.
- The New release dialog picks the kind of release with two tabs, **From a goal** and **No
  goal**, not with a switch that means different things. On the goal tab the goal box is
  the whole choice, and the release can't be made without it. A goal can be added later
  from the release's ⋯ menu.
- Daily progress opens from a header icon, not a strip on the board, and shows a line
  chart rather than numbers alone.
- **Which sections live in the rail as foldable panels?**: Memory only. Runs and Daily
  progress keep their header dialogs until we have seen how the Memory panel reads.
- **Does the rail's search reach archived cards?**: no — open cards only. The rail is about
  what you are working on now.

## Moving around the app

- **Do a mouse's back and forward buttons work in the desktop app?**: yes, wherever the
  system tells the app they were pressed — Windows and Linux today.
- **Which pages does the two-finger swipe move between?**: the card pages only. The board's
  columns are scrolled sideways with the very same gesture, so a board that answered the
  swipe would either stop scrolling or navigate when the user meant to scroll. From the
  board, Back and Forward are the menu's.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide: what the buttons do, the Configuration
  dialog, group tasks. Any card that changes visible UI behavior updates that file.
- The skill's `akb guide local-ui` covers installation only — how to run it, the
  options, updating. It never describes using the UI.
