# Decisions

Settled user-facing answers for the local UI. Read before proposing so you don't re-ask a settled call.

## What the UI is

- The board's rules live in the command; the UI drives every run through it and never holds a second copy of how a card is written.
- The goal is the only memory file the UI writes.
- Configuration settles the board; machine-level settings come after the board's own, set apart.
- **The Chinese UI calls a workflow 工作流 everywhere**, never 流程.
- `kanban-ui/README.md` is the user guide; any card changing visible UI behavior updates it.
- Memory stays out of users' way: one small entry on desktop, never a slot in the phone's bottom bar.
- The phone header is the card search, with no logo; a search box searches the same thing on every page.

## Getting the board

- The desktop app is the only way in: no npx hand-out, Homebrew maybe later; the browser package stays frozen, not pulled.
- macOS, Windows and Linux ship together; only macOS is tested each release.
- The app never hands out an npm command for `akb`; a shadowing `akb` on PATH is named and the fix left to the user.
- Install status answers only "can I use the board?": no skill panel, and details appear only when something is wrong.
- Onboarding leads with a Local board; Cloud is offered beside it, never preselected.

## Setup and the first run

- Setup asks only what the user knows — project, goal, agent — with defaults to press through; repo-reading steps run after.
- One thing per screen: no step rail, no transcript, no list of what the agent read.
- The board never drafts the goal and never nags about it; only the header's goal control offers to write one.
- An unreadable repository still passes the project step, saving the folder name as the project.

## Workflows and agents

- An agent's instructions box is its whole `AGENT.md`, frontmatter included, so a new setting needs no new form field.
- Changing a built-in agent means copying it: the copy keeps description, files, rules and settings, starts with empty memory, and replaces it in the stage at once.
- A built-in agent gets one optional Extra instructions box in its stage; a custom agent has none — its `AGENT.md` holds that.
- Runtimes is one list you add to, the default being a position; no machine picker until a board knows a second machine.
- Creating an agent starts from a written need or a skill link typed into one chat, outside Configuration; it asks what the input leaves open and designs the agent's memory and output too.

## Deliveries and runs

- No cap on concurrent deliveries.
- Start now never waits: no AI review or diff approval, whatever the board says.
- Resume is always the user's act; the board never retries, backs off or restarts work by itself.
- A run that ended unfinished stays a warning, on its card too, until handled; only the user hides an old failure, and hiding keeps the log.
- Context usage is measured against the model's advertised window, so it may compact before looking full.
- 正在读的日志不被系统收走：运行结束只改列表里那一行，已打开的日志留在原处。
- 看板首页不看日志：卡片上的运行标记只打开运行对话框并选中那条运行。

## Connectors and keys

- An agent ships only if it streams its log and can resume a stopped run; the board reaches it only by running a command and reading its output. More ship when cheap or asked for by name.
- A logged-out CLI is warned about where the agent is picked and gates nothing; a provider starts on the subscription over an API key, and a saved choice is kept.
- A triage provider's status is what the last import returned; nothing watches it.
- A settings tab that can't reach Cloud keeps retrying while open, needs no click to recover, and says the local board is unaffected.
- PDF and Word attachments go to the runtime as they are and surface its errors; no per-model blocking or conversion.

## Cards and groups

- A card not finished being created doesn't open; it sits muted and marked.

## Chat

- Rewriting a message cuts the session back to before it and continues; an agent that can't cut back offers no rewrite — replaying into a new session isn't one.
- The chat rail shows one conversation at a time, following what you are reading.
- The board keeps its 20 most recent discussions, dropping the oldest silently; a row's menu holds only Archive.
- Plan files are machine-local state, not in the repository.
- Propose tasks is gone: unasked-for cards are rarely trusted; new work comes from idea extraction on a named source.

## Notifications

- The cloud storage switch is the only way into and out of Cloud; Cloud and Notifications are separately named.
- The notification rail holds rows only; a row opens its card, with no page per event.
- An actionable event also raises a system notification; one switch silences that while the bell keeps filling.
- The rail and count belong to the open board; the connection is account-wide.
- Two tabs: problems first (the bell counts only these, failed and unfinished runs included), landed deliveries second.

## Moving around the app

- Mouse back/forward work wherever the system reports them; a two-finger swipe leaves one covering layer per gesture, except inside popovers and scrollers with room left.
- Picking a project's other board opens it in a new window.

## The app's language

- One setting covers both the app's words and the agent's prose; board structure (frontmatter, headings, files, commands, paths) stays English.
- Only new writing follows the setting, so a switched board holds both languages.
- `akb`'s terminal output and in-app guides stay English; everything the app shows, `akb` errors included, follows the setting.
- **Action labels fit every workflow and stay short**: no software-only verb like Implement or Build on shared buttons, never longer than what they replace.
- **界面失败提示的英文**：按界面风格重写（首字母大写、带句号、不提终端命令），但不丢原句信息。

## Background agents

- Prune cadence bounds (5–1440 minutes, 1–720 hours, 1–365 days) apply only in the control; a shorter value already in config keeps running.
- The daily chat-memory review is its own agent page: always on, no switch, no cadence.

## Feedback

- Feedback never requires a task; a standing Feedback button takes feedback belonging to none.
- Sharing starts off on every conversation; agreeing once never turns it on for later ones.
- Feedback collects no reply channel, so the team can't follow up and vague feedback is dropped.
