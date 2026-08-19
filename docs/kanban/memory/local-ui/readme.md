# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note. Everything below is covered by `kanban-ui/README.md`,
except where another doc is named.

## Running the board

- Open the board as a desktop app, downloaded from `ai4kanban.dev/download` — nothing to
  install first, it picks the repo on first launch and reopens there, finds your coding
  agent, and says when a newer version is out. macOS, Windows and Linux all ship unsigned
  and the download page says how to get past each system's warning.
- Open any project from the app: **Open Folder** picks a folder, the projects opened before
  are a click away, and a folder with no board starts onboarding there. One project is open
  at a time, a run keeps going in the project it started in, and the list marks the projects
  that have one running. The **×** takes a project off the list without touching its folder.
- Go back and forward between the views you opened in the app: `desktop/README.md`.
- Run the board from a browser with `npx ai4kanban-ui`: `akb guide local-ui`. Deprecated
  the day the app shipped — it keeps working, and npm says so and points at the download.
- Started where there is no board, the page says so, names the folder it searched, and
  gives what to run — instead of a crash screen.
- Set a board up in the app itself: a board whose setup is unfinished opens on a short
  guided run that asks for the project and its tracks, the goal, and which agent does the
  work — one to a screen, everything prefilled, and the agent step ending on a test that
  passed. Leaving it for the board keeps a way back in: "The first run".
- Finish the rest of setup without opening a coding agent: **Finish setup**, on the guided
  run's closing screen and on the board's setup strip, runs every step still left as one
  ordinary run — watchable, stoppable, and picking up from the first unfinished step when
  started again after a failure. A board with no goal written asks for the goal instead.
- Learn that a setup run died without going looking for it: when the newest one stopped
  short, the setup strip and the guided run's closing screen both say so where the live run
  said it was working, with a link into its log for why, and **Finish setup** still beside
  it as the retry. A run you stopped yourself reads as the plain offer: "The first run".
- A bar shows how far setup got and hands over the line to paste into your coding agent; a
  goal judged weak later brings the same bar back with just that item.
- A button on the board and a command in a terminal do the same thing to a card. Every read
  and write a screen makes is the board's own command, so the two can never disagree. The
  app carries what it reads the board with, and where it finds nothing, every screen says
  so in one line naming the command that fixes it.
- An edit saved from the board waits its turn behind whatever else is writing, so it never
  lands on top of the card an agent is writing. A run killed mid-write holds nobody up.

## Reading the board

- Flip the header between the track board and a **Queue** view that splits the same cards
  into ready to build and not ready.
- See which cards are waiting on another card, and which card is in the way.
- Read the whole project goal from a compass in the header, on the board and on a card page
  alike, and edit it there — the empty box carries the ask and a link to the guide, and
  saving stops the board asking for a goal.
- See the last 30 days of completed, created, and rejected cards as a chart in the Daily
  progress view.
- Find a card by typing part of its title or body into the rail's search box: "Finding a
  card".
- Read what the agent remembers from a **Memory** panel at the foot of the rail: the four
  project-wide files as rows, and under **Modules** one row per module opening into that
  module's own four files. Each file opens whole as a page of its own with Back, Forward,
  reload and the app's swipe all working; the page re-reads itself when a run finishes and
  when you come back to the window; an unwritten file keeps its row and says so; a ⋯ menu
  copies the file's path. Read-only, and no run starts from it: "The board's memory".

## Releases

- Move a card into a release, or back out of it, from the card page — no version id to type.
- Start a release from the header dropdown, on every board including one that never planned
  a version. Two tabs say which kind it is: **From a goal**, where the goal box is the whole
  choice and an agent run plans the release against it, and **No goal**, which applies the
  plain high-priority rule and counts its cards first.
- Fill a release from its goal — the ⋯ menu's **Fill from its goal**. It is an ordinary run:
  in the runs panel, stoppable, its log saying what it moved in, wrote and left out. The
  board says the release is being planned and re-reads itself when it ends. Running it again
  only adds.
- Show one release at a time from the header dropdown — other releases' cards are hidden,
  every blocker stays on screen, and the pick is remembered per project.
- Say what a version is for in the New release dialog, read it under each version in the
  release dropdown, and change it from the ⋯ menu's **What it is for**.
- Close a shipped version or drop one that won't ship from the ⋯ menu, with a confirm that
  lists what changes. Close writes a summary; drop leaves no summary record.

## Runs

- Stop a running run from the ✕ in the log window's title bar, with one confirmation.
- Continue a failed run with Resume, on Claude Code and Codex alike, instead of copying an
  id into a terminal.
- See what a run cost in dollars beside its duration, marked an estimate, and which model
  did the work, taken from what the agent reported.
- A run started in a terminal and one started from a button are the same run: both sides
  read one list, either side can watch, stop or continue it, and a card being worked on from
  either side shows busy on both: `cli/README.md`.

## Refining

- A run that writes or changes a card is followed by a refine of that card, as its own run
  in the panel. Finishing or rejecting a card refines the ones it was holding up, and a
  group's main card is left alone when a subtask finishes: "The refine that follows a run".
- Refine the card you are looking at from a **Refine** button on its page, whenever you want.

## Recurring tasks

- Run a recurring card from its page — **Run** stands in for Implement, does one pass of the
  card's Process, records the run, and leaves the card on the board; Archive and Refine
  never show.
- Give the card a cadence — a number, a unit, and a time of day for whole days — and the
  board runs the job itself when it comes due, showing the next run beside the last one.

## Cards

- Schedule an implement or a refine on a card that is waiting on another card, and the board
  runs it once the last card in its way leaves the board — the card reads **pending** until
  then, and one control takes the schedule off: "Schedule it instead".
- Answer a question with choices by ticking a list, with the recommended ones already ticked.
- Archive a group root once all its subtasks are done or rejected.

## Configuration

- Pick the agent that runs the work, Claude Code or Codex CLI, and the dialog draws the
  settings that agent says it takes.
- Run the board on **DeepSeek Harness**: pick it in the same list, fill in a model and a
  DeepSeek key or leave both empty, and every button spawns dsh through `dsh-acp`. Its log
  streams text, thinking and tool calls as they arrive, **Test**, **Stop** and **Resume**
  all work, and a resumed run carries on in the same dsh session with its history:
  "Running on DeepSeek Harness" in `kanban-ui/README.md`.
- See which agents this machine can actually run: the picker dims the ones whose CLI isn't
  on the board's PATH and marks them **not installed**, still lets you pick one, and names
  the command that installs it. It looks again every time the picker opens: "Configuration".
- Pick how hard the model thinks — low to max — or leave it on the agent's default.
- Pick who pays for a run — the Claude subscription, the Anthropic API, or any
  Anthropic-compatible gateway — and the run goes through that pick alone, not through
  something your shell exported.
- Keep your API key in `docs/kanban/.env`, typed into the dialog or written by hand, and the
  board keeps the file out of git.
- Press **Test** to send one tiny message through the setup you saved, with the agent's own
  reason when it doesn't work.
- The board reads its rules from the `akb` on your PATH when the app didn't bring its own,
  so a project needs no copy of them; with no command installed every screen says
  `npm install -g ai4kanban` instead of coming up empty.
- Add the coding agent skill from **Configuration → Skill** whenever you want it — a new
  board arrives without one. The pane says whether it is there and how current it is, one
  button writes it or updates an older copy, and it hands over the line for a newer `akb`
  when yours is behind rather than running it: "The coding agent skill".
- Run the board on Cursor or OpenCode as well as Claude Code and Codex — pick one in
  **Configuration → Agent** and every button spawns it, with its own settings, live log,
  stop and resume. Where a CLI reports no cost or no model name the log leaves that blank
  rather than guessing: "Running on Cursor", "Running on OpenCode" in the UI docs.
