# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## What the UI is and isn't

- The board's rules live in the command. The UI keeps its buttons and panels and drives every
  run through the command, rather than holding a second copy of how a card is written.
- Memory files are read-only here: a wrong line is fixed in the user's own editor. The goal is
  the one file the UI writes.
- Renaming and reordering releases stay terminal work — hand edits in `releases.md`.
- Configuration settles the board; what belongs to the machine rather than the board sits
  after the board's own settings and separated from them.
- A pane of short settings is a list of rows; a pane whose items are paragraphs is a narrow
  picker column beside one tall box.
- **One workflow editor**: always show the workflow rail and Plan → Execute → Review tabs,
  even for one flow. Name new flows and copies inline: save on blur, discard empty new entries immediately,
  and show no confirm/cancel buttons. Built-ins have a badge and
  cannot be renamed or deleted. Coding is the English software-flow name. Keep card type,
  preset and Full workflow out of the UI; discussion and automation live in Board agents.
- **The Chinese UI calls a workflow 工作流, everywhere**: the sidebar entry and every page
  that names the object use that one word, never 流程.
- **Create agents separately from assigning them**: Workflow agents owns reusable definitions
  and runtimes; Workflows selects one lead and existing helpers per step. Helpers are requested
  only when needed, with no call-mode control; only the selected helper exposes its local extra requirements. Return from management to the original selection without
  assigning the newly created agent automatically.
- **One instructions field**: custom agents use name, stage, instructions and runtime;
  purpose, input and deliverables belong in instructions. Saved details show the actual
  editable definition path with a copy action; unsaved and built-in agents show no fake path.
- **Runtimes is one list you add to**, with the default a position rather than a badge, so no
  control anywhere moves it. No Computers picker until a board can know a second machine.

## Getting the board

- The desktop app is the way in; npx is not how it is handed out, and Homebrew may come later.
  The browser way was deprecated the day the app shipped, said out loud, and frozen rather
  than pulled.
- macOS, Windows and Linux ship together. macOS is the one tested each release; the other two
  ship untested until someone reports otherwise.
- Signing never holds a release back — the app ships unsigned and the download page says what
  to click past.
- The app installs `akb` itself on first launch, asking for a password only where it must. A
  feature that asks for a password does not wait for a signed build, as long as declining
  costs nothing.
- The desktop app never hands out an npm command for `akb`: the row reads ready and updates
  with the app, and where another `akb` shadows it on PATH the row names that path and offers
  no command, leaving the fix to the user.
- A new project always gets its own repository: creating one from the launcher runs `git init`
  even inside an existing one.
- The coding agent skill is an extra you turn on, not part of getting a board.
- Onboarding leads with a Local board; Cloud is offered beside it, labelled, never
  preselected.

## Deliveries

- Each delivery builds in a worktree and branch of its own, forked from the commit it started
  at, so several run side by side without touching the user's edits. There is no cap on how
  many build at once — the disk and time are the user's call.
- Manual commit mode is one delivery at a time in the user's own folder, from clean code, with
  the user committing after review. A change applies only to deliveries started afterwards.
- Where one build works is also a per-click choice that opens on the setting's side and never
  writes back; every other way in reads the setting.
- Diff approval follows whether a build got a branch of its own, not the commits setting, so
  it stays settable in manual commit mode.
- **Discard** is the one way out in the UI and the only thing that removes the worktree and
  branch; `akb cancel` is the terminal half, leaving the checkout for salvage.
- The delivery block asks one question at a time: two ways to end a delivery never share a row.
- A delivery's state rides on the card's title band, and its diff and approval are tabs in the
  block that already holds the log, so the page gains no new furniture.
- **Build now never waits** and is one answer wherever it is offered: it runs with AI review
  and diff approval off whatever the board says, and the card it writes is a record rather
  than a checkpoint.

## Setup and the first run

- Setup asks only what the user knows — the project, the goal, which agent works — with
  defaults so it can be pressed through. The steps that read the repo run after it.
- Which agent works is asked first, and the step probes what is installed instead of asking;
  its one control is a link to the picker, and nothing cuts the probe short.
- The first run is one full-window view a step, one thing asked in each: no step rail, no
  transcript, no list of what the agent read.
- The first run never drafts the goal. It may say what makes a good goal, but text the user
  did not write is no goal.
- The board carries no notice about the goal at all: **Skip for now** answers the step, and
  the header's own control is the only place that ever offers to write one.
- Finishing setup refines the cards it writes — they are the roughest the board will ever hold.
- Usage reporting is disclosed in one required step before a board opens, once per machine,
  with no grandfathered-off state.
- Continuing past an unreadable repository answers the project step: the folder name is saved
  as the project and setup moves on.

## The goal

- `goal.md` is the whole direction, horizon and roadmap included. There is no separate roadmap
  file, and it gets no row in the Memory panel.
- The header star is the goal's only place on the board, in two states — open what is written,
  or **Add goal** on an empty file. It offers, never asks.
- A board holding no card replaces the columns with one centred panel: three empty columns say
  it three times.

## Runs

- Stopped is its own outcome, not a failure. Any run can be stopped whoever started it, and
  stop ends the agent only.
- Any run that ended before finishing can be continued, and Resume is always the user's act —
  the board never waits, backs off, or starts the work again by itself.
- The live view is a read-only log; nothing is typed into a running session.
- The model shown on a run is what the agent reported as it ran, not the model setting, and
  whatever the agent printed last is the reason a failed run shows — nothing reads a
  particular agent's error format.
- A refine follows the run that touched the card, as a run of its own. Nothing hunts the
  backlog, so there is no switch, no budget and no timer.
- The changes view shows uncommitted changes in a folder rather than a file list claimed for
  one run, and every run gets it.
- The Runs office is the dialog: history on the left, a bot's log on the right, only the two
  latest completed jobs left in the rest area and the rest in records.
- 正在读的日志不被系统收走：一次运行结束只改左侧列表里那一行的归属，右侧已打开的日志留在原处，宁可两边短暂对不上也不打断阅读。
- The office scene is drawn by a 2D engine rather than the DOM, at the cost of the engine's
  weight and keyboard access built by hand; a machine where no renderer can be created gets
  the list instead. Anything that moves is its own layer over a still backdrop.
- Context usage is measured against the model's advertised window, matching what the harness
  shows, so a session can be compacting before the reading looks full.
- A run that ended without finishing stays a standing warning until the card is handled, and
  it is marked on the card in its board column too, not only where runs are read — the columns
  carry one more permanent mark for it.

## Connectors and keys

- An agent ships only if it streams its log as it works and can resume a run that stopped
  short: a blank box reads as a hang, and no Resume leaves the user redoing the work.
- The board reaches an agent by starting a command and reading what it prints, and no other
  way; a bridge counts, and an agent whose live view exists only in a browser app of its own
  is not offered.
- A further agent ships when it is cheap to connect or when users ask for it by name. A
  chat-app assistant that is not a coding CLI is not one.
- Each connector declares the settings it takes and the dialog draws them in two shapes only —
  a box to type in and a list to pick from — each keeping its own block, so switching loses
  nothing.
- Keys live in `docs/kanban/.env` and nowhere else, are never shown back, and what `.env`
  names wins for a run. Deleting a runtime takes its key lines with it, and the confirmation
  says so.
- An installed CLI that is logged out is warned about where the agent is picked and gates
  nothing. A connector set to a provider carrying its own key is never called logged out.
- A triage provider's status is read, not monitored: the UI shows what the last import
  returned and runs no watcher.
- Let the selected runtime attempt a PDF or Word attachment and surface its errors; do not
  disable document formats by model or make the board convert them first.

## Cards, questions and groups

- A question with options keeps its text box, but the two ways don't mix: the user either
  ticks or types.
- A card's page opens on the half a human has to read, with the agent's notes folded behind
  one control, and stays how you last left it.
- A group is finished by finishing its subtasks, never by implementing the root; a group whose
  subtasks were all rejected is closed with Reject instead.
- A group root shows what waits on what as a map above the subtasks, and no map where nothing
  blocks anything.
- A card that is not finished being created does not open: it sits on the board muted and
  marked, so it can be neither inspected nor recovered from a page of its own.
- Add-task takes one module at a time and picking one is optional; with none picked the agent
  chooses the focus itself.

## Mockups on a card page

- A card's `<Mockup src>` keeps naming `.mockups/<card id>/…` whatever the folder is really
  at, and card references stay unchanged.
- A `.txt` mockup is drawn as its own characters, unscaled and with no switch to the code
  behind it, and a narrow window scrolls it sideways rather than re-wrapping.
- The canvas holding a card's screens ships as look-only: laid out automatically, pan and zoom,
  nothing saved. Dragging screens into place waits until it has been used in anger.

## Views and filters

- The queue view regroups the whole board and hides nothing. The release dropdown is the one
  place the board hides cards, and blockers stay on screen whatever is picked.
- The New release dialog picks the kind with two tabs, not a switch that means different
  things; on the goal tab the goal box is the whole choice.
- Memory is the rail's only panel for now, and the rail's search reaches open cards only.
- The archive is one row directly above Memory and stays hidden until opened: archived cards
  appear in no column and no count.
- Reading a closed version's changelog on the board is its own card, separate from the one
  that writes it.

## Chat in the UI

- Create task is an action, not a place: a full-screen sheet over the board that Esc or ✕
  closes, opening on **Discuss**, **Add task** or **Build now**.
- The chat is a full-height rail down the right, folded away by default so the board stays the
  centre, following what you are reading so only one conversation is ever on screen.
- It changes the board itself rather than handing the change to the card's buttons, and
  nothing asks first — archive, reject and starting a build included — with the changes
  sitting in the working tree for git to undo.
- It adds no rule of its own: the rail is an ordinary kanban-skill session.
- Nothing is ever sent on the user's behalf: a message typed while a reply arrives waits with
  sending off, and a stopped reply leaves what was written above an empty composer.
- A conversation picks its own agent and model, defaulting to the board's; switching the agent
  starts it over behind a confirmation. A runtime picked on the create sheet lasts one send.
- A board holds many discussions, listed in the rail under the open cards, each named by its
  agent once it has read the exchange. The board keeps only its 20 most recent and drops the
  oldest without asking; a row's menu holds Archive alone.
- A plan file lives with the board's machine-local state rather than in the repository, so
  cloning the repo carries no plans — the price of keeping the discussion's working papers off
  the project's history. Discuss writes `<id>-<slug>.md`, it moves to `plans/archive/` once its
  run has written cards, and its title is its first line.
- Propose tasks is gone from the app: cards nobody asked for are rarely worth trusting, and
  finding new work is idea extraction from a named source.
- An agent that cannot see images turns a pasted image away at the box, names the agents that
  can, and sends nothing.
- Pictures never send alone in Add task and Build now — Send stays off until something is
  typed — unlike Discuss, where a picture on its own is already a message.

## Notifications

- The pane is **Cloud & Notifications**, carrying cloud storage and notifications as two
  independent switches, and the cloud storage switch is the only way in and the only way back.
- The desktop notification center came first, proving complete messages and actions without
  Slack; Slack reuses the same event contract as the first external connector.
- The rail is rows carrying a card's number, title and the event's name, and nothing more. A
  row opens that card's page; no page is drawn for an event.
- The board's own card page never waits on Cloud to act — only a surface that is not the
  board's machine waits.
- An actionable event interrupts with a system notification as well as the bell, with one
  switch silencing the interruption while the bell keeps filling. A card the watched scope
  merely brought into view lands already read.
- The rail and its count are the open board's, while the connection stays account-wide; a
  board you are not looking at reaches you as a system notification.
- The rail is two tabs and opens on the first. Only a landed delivery sits on the second —
  not landed, interrupted and waiting for a machine stay with the work that needs a person,
  because a problem is something to look at, not a record. The bell counts the first tab
  alone, and a new landed event is a dot that switching clears.

## Moving around the app

- A mouse's back and forward buttons work wherever the system reports them.
- The two-finger swipe leaves whatever covers the page, one layer per gesture, while popovers
  and a sideways scroller with room left ignore it. Only the trackpad swipe carries that rule.
- A project holding more than one board shows the second inside the header's folder chip, and
  picking one opens it in a new window rather than reusing the one it was pressed in — so two
  views of one board are possible and duplicate windows are the user's to close.

## The app's language

- One setting, not two: it covers the app's own words and the prose the agent writes. The
  board's structure — frontmatter, headings, file names, commands, paths — stays English.
- It is guessed once from the operating system, then owned by the user and never guessed over
  again. The app guesses where the site does not, because its first screen carries neither the
  reader's languages nor a browser's switcher.
- The launcher carries its own switcher, because it is the screen you meet before there is a
  board to open Configuration on.
- Only new writing follows the setting, so a board that switches holds both languages at once.
- Everything `akb` produces stays English wherever it surfaces. The app translates only the
  words it writes itself.

## The board on a phone

- Cloud's URL and its sign-in are the whole of phone access: the app never serves its own board
  to a second device, which is the price of one way in rather than two.
- At phone width the board becomes a bottom tab bar with the columns swiped one at a time and
  Resolve opening as a page. The window-width board is unchanged.

## Memory pruning

- The recurring prune cadence is bounded where it is set — 5–1440 minutes, 1–720 hours,
  1–365 days. The bound is the control's only: a shorter cadence already in the config file
  keeps running.
- The daily chat-memory review is its own agent page, not a row on Memory pruner: one
  switch, on by default, with no cadence control, and its own rule.

## Feedback

- Feedback never requires a task: linking a landed task and describing the problem are both
  optional, and a standing Feedback button takes feedback belonging to no task.
- Sharing is one switch under the box, never a second entry, and it is off on every new
  conversation — agreeing once never turns one on, and the first press reads the terms again.
- Sharing comes before linking: the card picker appears only after sharing is enabled, and it
  serves sharing alone.
- A shared discussion cannot end without a card: every way of ending it refuses where it was
  pressed and asks for a card or for sharing to be turned off.
- The rail's End discussion is the only end action a conversation gets.
- Nothing is shown of what a submission came to — no sending, sent, failed or retry state —
  because the conversation is over by the time there is anything to say.
- Feedback collects no way to reply, so the site can still say no form on it asks for your
  email; the team cannot follow up, and vague feedback is dropped.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide, and any card that changes visible UI
  behavior updates it. `akb guide local-ui` covers installation only.

## Updating the app

- The update downloads itself as soon as a check finds one, showing nothing until the bytes
  are ready to install — at the cost of spending the bandwidth unasked.
- A failed download is the app's problem: network failures are retried silently on a ladder,
  and only once those run out does a failure chip appear, with no download link or retry
  button.
- A version cannot be skipped, and the app remembers no skipped version.
- A higher version takes the waiting one's place: a download in flight is dropped and a
  downloaded build thrown away, and the chip names whichever version will be installed.
- 看板首页不看日志：卡片上的运行标记只打开运行对话框并选中那条运行，看板上不再弹日志浮层。
- 像素房间里浮着的面板要像游戏对话框：直角、粗墨线、硬阴影、标题栏反色、贴边推出；只在办公室内用，正文文字不像素化。
