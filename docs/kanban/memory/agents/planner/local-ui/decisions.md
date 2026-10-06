# Decisions

Settled user-facing answers for the local UI. Read before proposing so you don't re-ask a settled call.

## What the UI is

- **One copy of the rules**: the board's rules live in the command; the UI drives every run through it.
- **The goal is the only memory file the UI writes.**
- **Configuration order**: the board's own settings first; machine-level settings after, set apart.
- **User guide**: `kanban-ui/README.md`; any card changing visible UI behavior updates it.
- **Memory stays out of the way**: one small entry on desktop, never a slot in the phone's bottom bar.
- **Phone header is the card search**: a search box searches the same thing on every page.
- **统计图表时段**：最短 30 天，不做 24 小时或 7 天。
- **只为值得的里程碑庆祝**：整组完成、release 完成、当天第一次落地才庆祝，并写明在庆祝什么；不是每次归档都庆祝。
- **反馈助手不对用户露出**：配置里不列它，固定用全局默认运行环境。

## Getting the board

- **Desktop app only**: no npx hand-out, Homebrew maybe later.
- **Platforms**: macOS, Windows and Linux ship together; only macOS is tested each release.
- **No npm command for `akb`**: a shadowing `akb` on PATH is named and the fix left to the user.
- **Install status answers only "can I use the board?"**: no skill panel; details appear only when something is wrong.

## Setup and the first run

- **Ask only what the user knows**: project, goal, agent — with defaults to press through; repo-reading steps run after.
- **One thing per screen**: no step rail, no transcript, no list of what the agent read.
- **The board never drafts the goal or nags about it**: only the header's goal control offers to write one.
- **An unreadable repository still passes**: the folder name is saved as the project.

## Workflows and agents

- **Built-in agents are changed by copying**: the copy keeps description, files, rules and settings, starts with empty memory, and replaces it in the stage.
- **Extra instructions**: one optional box per built-in agent in its stage; a custom agent's `AGENT.md` holds that instead.
- **Runtimes**: one list you add to, the default being a position; no machine picker until a board knows a second machine.
- **Creating an agent**: starts from a written need or a skill link in one chat, outside Configuration; it asks what the input leaves open and designs the agent's memory and output too.
- **内置 agent 的中文名称不求统一风格**：只改读着别扭的那一个，不批量改名。

## Deliveries and runs

- **No cap on concurrent deliveries.**
- **Start now never waits**: no AI review or diff approval, whatever the board says.
- **Resume is always the user's act**: the board never retries, backs off or restarts work by itself.
- **「重试」只给「继续」接不住的失败运行**：已取消、已完成这类不算失败的不出按钮。
- **An unfinished run stays a warning**: on its card too, until handled; only the user hides an old failure, and hiding keeps the log.
- **Context usage**: measured against the model's advertised window, so it may compact before looking full.
- **正在读的日志不被系统收走**：运行结束只改列表里那一行，已打开的日志留在原处。
- **看板首页不看日志**：卡片上的运行标记只打开运行对话框并选中那条运行。

## Connectors and keys

- **Which agents ship**: only one that streams its log and can resume a stopped run, reached only by running a command and reading its output; more when cheap or asked for by name.
- **A logged-out CLI gates nothing**: it is warned about where the agent is picked; a provider starts on the subscription over an API key, and a saved choice is kept.
- **Triage provider status**: what the last import returned; nothing watches it.
- **Cloud unreachable**: the settings tab keeps retrying while open, recovers with no click, and says the local board is unaffected.
- **PDF and Word attachments**: go to the runtime as they are and surface its errors; no per-model blocking or conversion.

## Cards and chat

- **A card not finished being created doesn't open**: it sits muted and marked.
- **Rewriting a message**: cuts the session back and continues; an agent that can't cut back offers no rewrite.
- **One conversation at a time**: the chat rail follows what you are reading.
- **Discussions**: the board keeps the 20 most recent, dropping the oldest silently; a row's menu holds only Archive.
- **Plan files are machine-local**: not in the repository.
- **Background tasks in a chat**: the chat stays free; their results arrive later as their own message.
- **Propose tasks is gone**: unasked-for cards are rarely trusted; new work comes from idea extraction on a named source.

## Notifications

- **Rows only**: a row opens its card, with no page per event.
- **System notifications**: an actionable event raises one; one switch silences that while the bell keeps filling.
- **Scope**: the rail and count belong to the open board; the connection is account-wide.
- **Two tabs**: problems first (the bell counts only these, failed and unfinished runs included), landed deliveries second.

## Moving around the app

- **Back/forward**: mouse buttons and a two-finger swipe work wherever the system reports them, one covering layer per gesture.
- **Another board of the same project**: opens in a new window.

## The app's language

- **One setting**: covers the app's words and the agent's prose; board structure (frontmatter, headings, files, commands, paths) stays English.
- **Only new writing follows the setting**: a switched board holds both languages.
- **`akb` output**: terminal output and in-app guides stay English; everything the app shows, `akb` errors included, follows the setting.
- **Action words follow `akb`'s vocabulary**: a run is Build (中文「执行」) in every workflow, 运行, 细化; the Chinese UI calls a workflow 工作流, never 流程.
- **界面失败提示的英文**：按界面风格重写（不提终端命令），但不丢原句信息。

## Feedback

- **No task required**: a standing Feedback button takes feedback belonging to none.
- **Sharing starts off on every conversation**: agreeing once never turns it on for later ones.
- **No reply channel**: the team can't follow up, so vague feedback is dropped.
