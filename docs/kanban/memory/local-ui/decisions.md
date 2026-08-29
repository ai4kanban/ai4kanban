# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## What the UI is and isn't

- The board's rules live in the command. The UI keeps its buttons and panels and drives
  every run through the command, rather than holding a second copy of how a card is
  written or a run is started.
- Memory files are read-only here: you read a wrong line and fix it in your own editor.
  The goal is the one file the UI writes.
- Renaming and reordering releases stay terminal work — hand edits in `releases.md`.
- Configuration settles the board; what belongs to the machine rather than the board —
  the Cloud sign-in, the language, a runtime's binding — sits after the board's own
  settings and separated from them.
- A pane of short settings is a list of rows. A pane whose items are paragraphs — flow
  rules — is a narrow picker column beside one tall box.
- Runtimes is a list that sets nothing: a row opens that runtime, where the binding is the
  one thing that can be pressed, and a board naming no runtimes opens on the binding itself.

## Getting the board

- The desktop app is the way in. npx is not how it is handed out; Homebrew may come later.
- macOS, Windows and Linux ship together from the first release that has an app. macOS is
  the one tested each release; the other two ship untested until someone reports otherwise.
- Signing never holds a release back — the app ships unsigned and the download page says
  what to click past. The Mac app gets signed eventually; Windows waits for users to ask.
- The browser way was deprecated the day the app shipped, said out loud, and frozen rather
  than pulled.
- The app installs `akb` itself on first launch: one symlink into the first of the user's
  own bin folders the PATH already reads, and `/usr/local/bin` with the system password
  dialog only when it reads neither. A feature that asks for a password does not wait for
  a signed build, as long as declining costs nothing.
- The coding agent skill is an extra you turn on, not part of getting a board.
- Onboarding leads with a Local board; Cloud is offered beside it, labelled, never
  preselected.

## Deliveries

- Each delivery builds in a git worktree and branch of its own, forked from the commit it
  started at, so several run side by side without touching each other or the user's edits.
- **Automatic Git commits** off is manual commit mode: one delivery at a time in the
  user's own folder, from clean code, with the user committing after review. A change
  applies only to deliveries started afterwards.
- Where one build works is also a per-click choice on the Implement dialog. It opens on
  the side the setting picks and never writes back, so the setting is the default each
  Implement starts from rather than the only way to change it; every other way in —
  Schedule, Resolve & implement, `akb implement` — reads the setting.
- Diff approval follows whether a build got a branch of its own, not the commits setting,
  so it stays settable in manual commit mode.
- **Discard** is the one way out of a delivery in the UI and the only thing that removes
  its worktree and branch; `akb cancel` is the terminal half, ending the delivery and
  leaving the checkout for salvage.
- The delivery block asks one question at a time: a live run means **Stop run** alone,
  nothing running means **Resume** and **Discard**. Two ways to end a delivery never share
  a row.
- No cap on how many deliveries build at once — the disk and time are the user's call.
  Manual commit mode is the exception, one at a time by its own lock.
- A delivery's state rides on the card's title band: the pill, plus one line saying what it
  waits on. Its diff and approval are tabs in the block that already holds the log, so the
  page gains no new furniture.

## Setup and the first run

- Setup runs in the UI as a guided first run asking only what the user knows — the project,
  its tracks, the goal, which agent works — with defaults so it can be pressed through. The
  steps that read the repo and think run after it.
- Finishing setup refines the cards it writes: they are the roughest the board will ever
  hold and nothing else comes for them.
- The goal nudge is a nudge, not a gate — dismissible, back if the goal turns weak again,
  gone as soon as the user writes anything. One shared notice bar carries conditions like it.

## The goal

- `goal.md` is the whole direction, horizon and roadmap included. There is no separate
  roadmap file.
- The goal is a reminder, not a file you work in: a quiet header control opens the whole
  thing and editing sits one click in. It gets no row in the Memory panel.

## Runs

- Stopped is its own outcome, not a failure. Any run can be stopped whoever started it,
  stop ends the agent only, and it takes a confirmation.
- Any run that ended before finishing can be continued, and Resume is always the user's
  act — the board never waits, backs off, or starts the work again by itself.
- The live view is a read-only log; nothing is typed into a running session.
- The model shown on a run is what the agent reported as it ran, not the model setting,
  which most people leave empty.
- Nothing reads a particular agent's error format: whatever the agent printed last is the
  reason the run shows.
- A refine follows the run that touched the card, as a run of its own. Nothing hunts the
  backlog, so there is no switch, no budget and no timer. It answers everything except
  `[user]` questions, and a stopped refine is not picked up again.
- The changes view shows uncommitted changes in a folder, never a file list claimed for one
  run, and every run gets it — a refine or resolve writes card files too.

## Connectors and keys

- An agent ships only if it streams its log as it works and can resume a run that stopped
  short: a blank box for the whole run reads as a hang, and no Resume leaves the user
  redoing the work by hand.
- The board reaches an agent by starting a command and reading what it prints, and no other
  way; a bridge counts. An agent whose live view exists only in a browser app of its own is
  not offered.
- Claude Code and Codex first, then Cursor and OpenCode, then DeepSeek Harness and ZCode
  because users asked. Anything further waits to be asked for. OpenClaw was dropped — it is
  a chat-app assistant, not a coding CLI.
- Each connector declares the settings it takes and the dialog draws them, in two shapes
  only — a box to type in and a list to pick from — each keeping its own block, so
  switching loses nothing.
- Keys live in `docs/kanban/.env` and nowhere else, kept out of git by the board's own
  gitignore, and a saved key is never shown back. What `.env` names wins for a run; a
  variable it doesn't name is left alone.
- ZCode signs in with a Coding Plan key alone. The *the login ZCode has* pick was dropped
  rather than taught to explain itself, and comes back when a login is shown to work (#282).

## Cards, questions and groups

- A question with options keeps its text box, but the two ways don't mix: on a
  `single-option` question the user either ticks one option or types an answer.
- A card's page opens on the half a human has to read, with the agent's notes folded
  behind one control, and stays how you last left it.
- A group is finished by finishing its subtasks, never by implementing the root; a group
  whose subtasks were all rejected is closed with Reject instead.
- "Implement group" is one run owned by the root that works until every subtask is done or
  rejected, locking them all behind one log. Claude Code only — another connector falls
  back to one long run with the same instructions.
- A group root shows what waits on what as a map above the subtasks: one column per layer,
  blockers first, id-only chips, no labels, and no map where nothing blocks anything.

## Mockups on a card page

- A `.txt` mockup is drawn as its own characters — unscaled, with no switch to "the code
  behind it", because the file is the drawing — and a narrow window scrolls it sideways
  rather than re-wrapping columns that would stop being the drawing.

## Views and filters

- The queue view regroups the whole board and hides nothing. The release dropdown is the
  one place the board hides cards, and blockers stay on screen whatever is picked, since an
  unplanned blocker usually blocks the version being planned.
- The New release dialog picks the kind with two tabs, not a switch that means different
  things; on the goal tab the goal box is the whole choice, and a goal can be added later.
- Memory is the only left-rail panel for now — Runs and Daily progress keep their header
  dialogs until we have seen how it reads. The rail's search reaches open cards only.
- Propose and add-task take one module at a time and picking one is optional; with none
  picked the agent chooses the focus itself.
- Reading a closed version's changelog on the board is its own card, separate from the one
  that writes it.

## Chat in the UI

- The chat is a full-height rail down the right, folded away by default so the board stays
  the centre of the app, and it follows what you are reading — the board's chat on the
  board and on a memory file, a card's on its page — so only one is ever on screen.
- It changes the board itself rather than handing the change to the card's own buttons, and
  nothing asks first: archive, reject and starting a build included, with the changes
  sitting in the working tree for git to undo.
- It adds no rule of its own — the rail is an ordinary kanban-skill session.
- Nothing is ever sent on the user's behalf: a message typed while a reply is arriving
  waits with sending off, and a stopped reply leaves an empty composer with whatever was
  written kept above it.

## Notifications

- The desktop notification center came first, proving complete messages and actions without
  Slack; Slack reuses the same event contract as the first external connector.
- It is a right-hand rail of rows carrying the card's number and title with the event's name
  under them, and nothing more. A row opens that card's page, where the state and its
  actions already are; no page is drawn for an event.
- The board's own card page never waits on Cloud to act — Implement and Resolve go through
  at once and are recorded afterwards. Only a surface that is not the board's machine waits.
- An actionable event interrupts: a system notification as well as the bell, opening the
  card, with one switch silencing the interruption while the bell keeps filling. A delivery
  it started raises a second notification on every final outcome, not only failure.

## Moving around the app

- A mouse's back and forward buttons work wherever the system reports them. The two-finger
  swipe moves between card pages only, because the board scrolls its columns with the very
  same gesture.

## The app's language

- One setting, not two: the chosen language covers the app's own words and the prose the
  agent writes into cards, questions, memory and changelogs. The board's structure —
  frontmatter, headings, file names, commands, paths — stays English.
- It is guessed once from the operating system on a machine that has never said, then owned
  by the user and never guessed over again. The app guesses where the site does not, because
  its first screen carries neither the reader's languages nor a browser's switcher.
- The launcher carries its own switcher, top-right and framed like window chrome, because it
  is the screen you meet before there is a board to open Configuration on.
- Only new writing follows the setting. Nothing rewrites what is already on disk, so a board
  that switches holds both languages at once.
- Everything `akb` produces stays English wherever it surfaces — failures, notification rows,
  the terminal. The app translates only the words it writes itself, the system-standard menu
  items included.

## The board on a phone

- At phone width the board becomes a bottom tab bar — Board, Find, Memory, More — with the
  columns swiped one at a time and Resolve opening as a page. The window-width board keeps
  its rail, header and side-by-side columns.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide, and any card that changes visible UI
  behavior updates it. `akb guide local-ui` covers installation only.
