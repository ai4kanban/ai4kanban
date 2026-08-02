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

- Auto-refining runs on its own in the background, and the user can also start one on a card
  from its page. The switch governs only the background runs — with it off, no card is
  refined on its own, but the card page's Refine button still works.
- The dispatcher refines cards highest priority first, and only while the switch is on. How
  many at once is a user setting; the default is 1.
- **Do two refines at once need a guard on the files they share?**: No. Last write wins —
  no lock, no queue. Only create, propose, archive and reject stay one-at-a-time.
- The background timer runs from server start. Refining does not wait for a browser tab to
  open the board.
- It answers a card's open questions itself, except the ones tagged `[user]`. It skips a
  card whose questions are all `[user]` — that one waits for the human.
- The switch shows one read-only label beside it in the Configuration dialog: "Refining
  #<id>", the card a refine is on right now, background or user-started. When no run is going there is no
  label at all — no "last refined", no "next up", no idle reason. The runs panel is the
  place to browse runs.
- **Does a paused dispatcher say so beside the switch?**: No. Even when a rate limit pauses
  background refining for hours, the switch stays silent — a failure is a run's business,
  and the failed run in the runs panel is where its reason is named.

## Answering open questions

- **Can the user still type a free answer when a question has options?**: yes, the text box
  stays. But the two ways to answer don't mix: on a `single-option` question the user either
  ticks one option or types an answer, never both.

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

## Connector settings

- Each connector declares the settings it takes and the Configuration dialog draws them.
  Two shapes only: a box to type in, and a list to pick one from.
- The settings file keeps one block for the picked connector — its name and its settings
  together — not one block per connector. Switching connector clears it, as it does today.
  Keeping every connector's settings across a switch is not worth a new file shape while
  there is one connector.

### API keys

- **Does the dialog write the key, or is the file hand-edited only?**: both. You type it in
  the Configuration dialog and it lands in `docs/kanban/.env`, or you write the line in that
  file yourself. Either way the board reads the same file, so a hand-written key shows in the
  dialog as set.
- The box hides what you type, the way a password field does. A saved key is never shown
  back — the box says it is set, with Replace and Clear.
- Keys live in `docs/kanban/.env` and nowhere else — never `ui.config.json`. A key hand-written
  into `ui.config.json` is ignored, not used.
- The board keeps `.env` out of git itself, through its own `docs/kanban/.gitignore` — never
  by editing the repo's root one. `kanban init` writes that file, so a key written by hand is
  covered on a board that never opens the dialog; saving a key from the dialog makes sure of
  it too.
- What `.env` names wins for a run; a variable it doesn't name is left alone, so a key already
  exported in the shell keeps working.
- Switching connector clears the connector's settings but never the keys. A key belongs to
  the variable it is written under, not to whoever was picked when it was typed.
- **Which variable does a gateway key go out under?**: `ANTHROPIC_AUTH_TOKEN` only, with
  `ANTHROPIC_API_KEY` sent explicitly empty. Sending the same key both ways to suit whichever
  header a gateway prefers is not allowed: Claude Code reads a key in `ANTHROPIC_API_KEY` as
  its own login and switches the user's claude.ai connectors off for the run. A run carries
  one auth source, the one its provider names.

## Which model a run used

- **Where does the model shown on a run come from?**: what the agent reports as it runs, not
  the model field in the Configuration dialog. Most people leave that field empty and let the
  agent pick, so reading the setting would leave most runs blank.

## Stopping a run

- Any running run can be stopped from the UI, whoever started it — a background auto-refine
  run and a create/propose/archive/reject too.
- Stopped is its own outcome. Done, failed and stopped are three different things; a stopped
  run is not a failure.
- Stop ends the agent only. A build or test the agent started is left to finish on its own.
- Stopping a background refine holds: the dispatcher does not pick that card again while its
  newest run is a stopped one.
- **Does stopping undo the run's half-finished edits?**: No. They stay in the working tree
  and the user undoes them with git — the same as any other run's changes.
- **How is a stop confirmed?**: the control is a small ✕, and pressing it opens a
  confirmation popover beside it. One click never ends a run.

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
- **Does the bar come back if the goal turns weak again long after setup?**: yes, with
  that one item on it. Proposals are judged against the goal, so the nudge outlives
  setup — even though the setup checklist is gone by then.
- **What does the UI's goal box show when `goal.md` isn't written yet?**: the same seed
  wording the script writes into the file — one text, never two.
- **When does the bar stop nagging?**: as soon as the user writes anything. A goal counts
  as weak only when the file is missing or still the seed, so a written goal is never
  nagged about again.

### The goal on the board

- **What is the goal to a user reading the board?**: a reminder of the horizon, not a file
  they work in. It is written once and reread now and then, so the UI shows it as one quiet
  line above the board that opens the whole file on click. Editing stays possible but sits
  one click in.
- **Does the memory view show the goal too?**: no. The goal has its own line above the
  board; the memory view is the four memory files. One file, one place.

## Notice bars

- **How does the UI tell the user about a condition it can't fix itself?**: with one shared
  bar — the goal nudge and warnings both use it. It shows by default and stays while the
  condition holds; a ✕ closes it and writes nothing to the board files.
- A card the dispatcher gave up on after repeated failed runs says so in that bar, on the
  card's own page.

## The progress view

- Daily progress opens from an icon button in the header, not a strip on the board. It
  shows a line chart like the site's throughput chart, not numbers alone.

## The queue view

- **Is a queue view the same as the rejected ready-only toggle?**: No. The toggle hid every
  card that wasn't `ready`; the queue view shows ready and not-ready side by side and hides
  nothing. It is a second way to group the whole board, not a filter.

## The release dropdown

- **Does picking a release hide the other releases' cards?**: Yes. The dropdown filters —
  you see one release at a time, with an All releases entry to get the whole board back. A
  dropdown that hides nothing does nothing.
- This is the one place the board hides a card, and it takes a deliberate pick to do it.
  Layouts still hide nothing: the queue view regroups the whole board, and All releases is
  the default.
- **Does picking a release also filter the blockers?**: No. Every blocker stays on screen
  whatever release is picked, in both views. The blockers track exists so a blocker is never
  out of sight, and an unplanned blocker is usually blocking the version being planned.

## Moving cards into a release

- **Is a hand-picked bulk move worth building next to the agent's fill-a-release pass?**:
  Yes, build it. The agent's pass only adds cards to a release and never takes any out, so a
  version planned too full needs a fast way to take several cards back out of the release. Ticking
  cards on the board is that way, and it works in both directions.

## The memory view

- **Can the UI edit memory?**: No. Every memory file is read-only in the UI — you read a
  wrong line there and fix it in your own editor. Memory is plain unstructured text the
  user owns, like their code, and a text box in the board is no better than an IDE. The
  goal bar stays the one file the UI writes.
- **How do you get from a wrong line to fixing it?**: Each section has a "more" menu with
  Copy path and Copy relative path. You copy the path and hand it to your coding agent or
  your editor. The UI never opens the file for you, and what you do with the path is your
  business.

## Setting up a board from the UI

- **Does the setup screen ask you for the track list?**: No. The agent reads the repo and
  proposes the tracks. Setup asks the user nothing at all — not the tracks, not the project
  name, not the description.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide: what the buttons do, the Configuration
  dialog, group tasks. Any card that changes visible UI behavior updates that file.
- The skill's `references/local-ui.md` covers installation only — how to run it, the
  options, updating. It never describes using the UI.
