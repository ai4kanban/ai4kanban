# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## What the UI is and isn't

- The board's rules live in the command. The UI keeps its buttons and panels and drives every
  run through the command, rather than holding a second copy of how a card is written.
- Memory files are read-only here: a wrong line is fixed in the user's own editor. The goal is
  the one file the UI writes. Renaming and reordering releases stay terminal work.
- Configuration settles the board; what belongs to the machine rather than the board sits
  after the board's own settings and separated from them.
- A pane of short settings is a list of rows; a pane whose items are paragraphs is a narrow
  picker column beside one tall box.
- **The Chinese UI calls a workflow 工作流, everywhere** — never 流程.

## Getting the board

- The desktop app is the way in; npx is not how it is handed out, and Homebrew may come later.
  The browser way was deprecated the day the app shipped, said out loud, and frozen rather
  than pulled.
- macOS, Windows and Linux ship together. macOS is the one tested each release; the other two
  ship untested until someone reports otherwise.
- Signing never holds a release back — the app ships unsigned and the download page says what
  to click past.
- The app installs `akb` itself on first launch, asking for a password only where it must, and
  never hands out an npm command for it. Where another `akb` shadows it on PATH the row names
  that path and leaves the fix to the user.
- A new project always gets its own repository: creating one from the launcher runs `git init`
  even inside an existing one.
- The coding agent skill is an extra you turn on, not part of getting a board.
- **Install status answers only "can I use the board?"**: no standalone skill panel. When all
  is well, no skill path, version or rewrite button; only a problem shows what it affects and
  how to fix it.
- Onboarding leads with a Local board; Cloud is offered beside it, labelled, never
  preselected.

## Setup and the first run

- Setup asks only what the user knows — the project, the goal, which agent works — with
  defaults so it can be pressed through. The steps that read the repo run after it.
- Which agent works is asked first, and the step probes what is installed instead of asking.
- The first run is one full-window view a step, one thing asked in each: no step rail, no
  transcript, no list of what the agent read.
- The first run never drafts the goal, and the board carries no notice about it: the header's
  own control is the only place that ever offers to write one.
- Finishing setup refines the cards it writes — they are the roughest the board will ever hold.
- Usage reporting is disclosed in one required step before a board opens, once per machine.
- Continuing past an unreadable repository answers the project step: the folder name is saved
  as the project and setup moves on.

## Workflows and agents in the UI

- **One workflow editor**: always show the workflow rail and Plan → Execute → Review tabs,
  even for one flow. Name new flows and copies inline — save on blur, discard empty new
  entries, no confirm or cancel buttons. Built-ins carry a badge and cannot be renamed or
  deleted.
- **Create agents separately from assigning them**: one lead and existing helpers per step,
  helpers requested only when needed, and only the selected helper exposes its extra
  requirements. Return from management to the original selection without assigning
  automatically.
- **One instructions field**: name, stage, instructions and runtime. The instructions box is
  the whole `AGENT.md`, frontmatter included, so a new `akb:` key needs no new form field.
  Saved agents show the real editable path with a copy action; unsaved and built-in ones show
  no fake path.
- **Copying an agent is how a built-in is changed**: the copy takes the description, files,
  rules and settings, starts with empty memory, and the stage switches to it at once.
- **Runtimes is one list you add to**, with the default a position rather than a badge. No
  Computers picker until a board can know a second machine.
- **共享提示不占整行**：Agent 被多个工作流共用时，只在名称旁放一个「共用 · <工作流名>」小标签，后果写进悬停提示；整句的共享说明信息量低、占地方。
- **Creating an agent starts from what it should do** — a written need or a skill from the web,
  both typed into one chat box with no separate field for a link. The flow asks how it should
  work where the input leaves that open, and designs its memory and the form of its output
  along with its duties. The `write-agent` guide is its only rulebook, and the conversation
  does not happen inside the Configuration dialog.
- **A stage's agent panel keeps one optional Extra instructions box** for a built-in agent in
  that stage, labelled 「额外要求」 with no agent name repeated: no output selector and no
  second instructions box with another scope to choose. A custom agent shows no such box —
  its own `AGENT.md` is where those requirements go.

## Deliveries

- Each delivery builds in a worktree and branch of its own, forked from the commit it started
  at, so several run side by side. There is no cap on how many build at once.
- Manual commit mode is one delivery at a time in the user's own folder, from clean code, with
  the user committing after review. A change applies only to deliveries started afterwards.
- Where one build works is also a per-click choice that opens on the setting's side and never
  writes back.
- Diff approval follows whether a build got a branch of its own, not the commits setting.
- **Discard** is the one way out in the UI and the only thing that removes the worktree and
  branch; `akb cancel` is the terminal half, leaving the checkout for salvage.
- The delivery block asks one question at a time: two ways to end a delivery never share a row.
- A delivery's state rides on the card's title band, and its diff and approval are tabs in the
  block that already holds the log.
- **Build now never waits** and is one answer wherever it is offered: AI review and diff
  approval off whatever the board says, and the card it writes is a record, not a checkpoint.

## Runs

- Stopped is its own outcome, not a failure. Any run can be stopped whoever started it, and
  stop ends the agent only.
- Any run that ended before finishing can be continued, and Resume is always the user's act —
  the board never waits, backs off, or starts the work again by itself.
- The live view is a read-only log; nothing is typed into a running session.
- The model shown on a run is what the agent reported as it ran, and whatever the agent
  printed last is the reason a failed run shows — nothing reads a particular error format.
- A refine follows the run that touched the card, as a run of its own. Nothing hunts the
  backlog, so there is no switch, no budget and no timer.
- The changes view shows uncommitted changes in a folder rather than a file list claimed for
  one run, and every run gets it.
- Context usage is measured against the model's advertised window, matching what the harness
  shows, so a session can be compacting before the reading looks full.
- A run that ended without finishing stays a standing warning until the card is handled, marked
  on the card in its board column too. An old failed run is cleared only by the user hiding it,
  and hiding keeps the log.
- 正在读的日志不被系统收走：一次运行结束只改左侧列表里那一行的归属，右侧已打开的日志留在原处。
- The Runs office is the dialog: history on the left, a bot's log on the right, only the two
  latest completed jobs in the rest area and the rest in records. The scene is drawn by a 2D
  engine rather than the DOM, and a machine where no renderer can be created gets the list.
- 看板首页不看日志：卡片上的运行标记只打开运行对话框并选中那条运行。

## Connectors and keys

- An agent ships only if it streams its log as it works and can resume a run that stopped
  short: a blank box reads as a hang, and no Resume leaves the user redoing the work.
- The board reaches an agent by starting a command and reading what it prints, and no other
  way. A further agent ships when it is cheap to connect or when users ask for it by name.
- Each connector declares the settings it takes and the dialog draws them in two shapes only —
  a box to type in and a list to pick from — each keeping its own block.
- Keys live in `docs/kanban/.env` and nowhere else, are never shown back, and what `.env`
  names wins for a run. Deleting a runtime takes its key lines with it, and the confirmation
  says so.
- An installed CLI that is logged out is warned about where the agent is picked and gates
  nothing. Where an agent offers both, the provider starts on the subscription rather than an
  API key, and a provider the user has already saved is kept.
- A triage provider's status is read, not monitored: the UI shows what the last import
  returned and runs no watcher.
- A settings tab that cannot reach Cloud keeps retrying on its own for as long as it is
  open — up to 30 seconds apart, with no attempt limit — so a restored network needs no
  click, and it says the local board is unaffected.
- Let the selected runtime attempt a PDF or Word attachment and surface its errors; do not
  disable document formats by model or make the board convert them first.

## Cards, questions and groups

- A question with options keeps its text box, but the two ways don't mix: the user either
  ticks or types.
- A card's page opens on the half a human has to read, with the agent's notes folded behind
  one control, and stays how you last left it.
- A group is finished by finishing its subtasks, never by implementing the root; a group whose
  subtasks were all rejected is closed with Reject instead. A group root shows what waits on
  what as a map above the subtasks, and no map where nothing blocks anything.
- A card that is not finished being created does not open: it sits on the board muted and
  marked.
- Card markdown highlights code with a real syntax highlighter and an off-the-shelf,
  low-saturation theme; diffs keep the delivery diff's mint and peach.
- A card's `<Mockup src>` keeps naming `.mockups/<card id>/…` whatever the folder is really
  at. A `.txt` mockup is drawn as its own characters, unscaled, and a narrow window scrolls it
  sideways rather than re-wrapping.
- The canvas holding a card's screens ships as look-only: laid out automatically, pan and
  zoom, nothing saved.

## Views and filters

- The queue view regroups the whole board and hides nothing. The release dropdown is the one
  place the board hides cards, and blockers stay on screen whatever is picked.
- The New release dialog picks the kind with two tabs, not a switch that means different
  things; on the goal tab the goal box is the whole choice.
- Memory is the rail's only panel for now, and the rail's search reaches open cards only. The
  archive is one row directly above it and stays hidden until opened.
- `goal.md` is the whole direction, horizon and roadmap included, reached from the header
  star in two states — open what is written, or **Add goal** on an empty file. It offers,
  never asks.
- A board holding no card replaces the columns with one centred panel.

## Chat in the UI

- Create task is an action, not a place: a full-screen sheet over the board that Esc or ✕
  closes. Its box is **Discuss** only, with no mode switch; a new card's workflow is picked
  beside the plan's Plan tasks / Start now.
- After **Plan tasks** or **Start now** the discussion window shows **Starting…** and
  closes itself the moment the run really starts; a refused start stays put with its reason.
- The chat is a full-height rail down the right, folded away by default so the board stays the
  centre, following what you are reading so only one conversation is ever on screen.
- It changes the board itself rather than handing the change to the card's buttons, and
  nothing asks first — archive, reject and starting a build included.
- Nothing is ever sent on the user's behalf: a message typed while a reply arrives waits with
  sending off, and a stopped reply leaves what was written above an empty composer.
- A conversation picks its own agent and model, defaulting to the board's; switching the agent
  starts it over behind a confirmation.
- The board keeps only its 20 most recent discussions and drops the oldest without asking; a
  row's menu holds Archive alone.
- A plan file lives with the board's machine-local state rather than in the repository, so
  cloning the repo carries no plans.
- Propose tasks is gone from the app: cards nobody asked for are rarely worth trusting, and
  finding new work is idea extraction from a named source.
- An agent that cannot see images turns a pasted image away at the box, names the agents that
  can, and sends nothing.

## Notifications

- **Cloud** and **Notifications** are two settings tabs, each named for what it holds. The
  cloud storage switch is the only way in and the only way back.
- The desktop notification center came first, proving complete messages and actions without
  Slack; Slack reuses the same event contract as the first external connector.
- The rail is rows carrying a card's number, title and the event's name, and nothing more. A
  row opens that card's page; no page is drawn for an event.
- The board's own card page never waits on Cloud to act — only a surface that is not the
  board's machine waits.
- An actionable event interrupts with a system notification as well as the bell, with one
  switch silencing the interruption while the bell keeps filling.
- The rail and its count are the open board's, while the connection stays account-wide.
- The rail is two tabs and opens on the first. Only a landed delivery sits on the second,
  because a problem is something to look at, not a record. The bell counts the first tab
  alone.
- The bell stands on its own outside the tool cluster, lighting up only while something is
  unread. A run that failed or ended unfinished reaches it too, not only the Runs office.

## Moving around the app

- A mouse's back and forward buttons work wherever the system reports them.
- The two-finger swipe leaves whatever covers the page, one layer per gesture, while popovers
  and a sideways scroller with room left ignore it.
- A project holding more than one board shows the second inside the header's folder chip, and
  picking one opens it in a new window rather than reusing the one it was pressed in.

## The app's language

- One setting, not two: it covers the app's own words and the prose the agent writes. The
  board's structure — frontmatter, headings, file names, commands, paths — stays English.
- It is guessed once from the operating system, then owned by the user and never guessed over
  again. The launcher carries its own switcher, because it is the screen you meet before there
  is a board.
- Only new writing follows the setting, so a board that switches holds both languages at once.
- `akb`'s terminal output stays English, and a guide the app unfolds in place is English only.
  What the app shows — errors and status labels included, even when they come from `akb` —
  follows the app's language.
- **Action labels fit every workflow and stay short**: no software-only verb such as Implement
  or Build on a shared button, and a new label is never longer than the one it replaces —
  Start now, Plan tasks, Revise.
- **界面失败提示的英文**：按界面风格重写（首字母大写、带句号、不提终端命令），但不能丢掉原句的信息。

## The board on a phone

- Cloud's URL and its sign-in are the whole of phone access: the app never serves its own board
  to a second device.
- At phone width the board becomes a bottom tab bar with the columns swiped one at a time and
  Resolve opening as a page. The window-width board is unchanged.

## Background agents

- The recurring prune cadence is bounded where it is set — 5–1440 minutes, 1–720 hours,
  1–365 days. The bound is the control's only: a shorter cadence already in the config file
  keeps running.
- The daily chat-memory review is its own agent page: one switch, on by default, with no
  cadence control.

## Feedback

- Feedback never requires a task: linking a landed task and describing the problem are both
  optional, and a standing Feedback button takes feedback belonging to no task.
- Sharing is one switch under the box, off on every new conversation — agreeing once never
  turns one on, and the first press reads the terms again. Sharing comes before linking: the
  card picker appears only after sharing is enabled.
- A shared discussion cannot end without a card: every way of ending it refuses where it was
  pressed. The rail's End discussion is the only end action a conversation gets.
- Nothing is shown of what a submission came to, because the conversation is over by the time
  there is anything to say.
- Feedback collects no way to reply, so the site can still say no form on it asks for your
  email; the team cannot follow up, and vague feedback is dropped.

## Updating the app

- The update downloads itself as soon as a check finds one, showing nothing until the bytes
  are ready to install — at the cost of spending the bandwidth unasked.
- A failed download is the app's problem: network failures are retried silently, and only once
  those run out does a failure chip appear, with no download link or retry button.
- A version cannot be skipped, and the app remembers no skipped version. A higher version takes
  the waiting one's place.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide, and any card that changes visible UI
  behavior updates it. `akb guide local-ui` covers installation only.
