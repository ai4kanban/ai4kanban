# Decisions

Settled user-facing answers for the local UI. Read before proposing so you don't re-ask a settled call.

## What the UI is

- **The goal is the only memory file the UI writes.**
- **User guide**: `kanban-ui/README.md`; any card changing visible UI behavior updates it.
- **统计图表时段**：最短 30 天，不做 24 小时或 7 天。
- **只为值得的里程碑庆祝**：整组完成、release 完成、当天第一次落地才庆祝，并写明在庆祝什么。
- **庆祝角色**：三个基础机器人一起欢呼，不随完成卡片的负责角色变化。
- **反馈助手不对用户露出**：配置里不列它，固定用全局默认运行环境。
- **Agent 角色形态**：穿职业服装的小机器人，靠服装区分职业，不用人形。
- **自定义 agent 的角色**：共用基础机器人，上臂徽标显示名称首个可见字符，不逐个设计服装。
- **角色工作姿势**：所有角色在同一款办公桌前背对用户用电脑工作，靠屏幕内容辅助区分职业，不另画专属工位。
- **Propose tasks is gone**: unasked-for cards are rarely trusted; new work comes from idea extraction on a named source.

## Getting the board and setup

- **Install status answers only "can I use the board?"**: no skill panel; details appear only when something is wrong.
- **Ask only what the user knows, one thing per screen**: defaults to press through; no step rail, transcript or list of what the agent read.
- **The board never drafts the goal or nags about it**: only the header's goal control offers to write one.
- **An unreadable repository still passes**: the folder name is saved as the project.

## Workflows and agents

- **Built-in agents are changed by copying**: the copy keeps everything but memory and replaces the original in its stage.
- **Runtimes**: no machine picker until a board knows a second machine.
- **Creating an agent**: one chat outside Configuration, from a written need or a skill link; it asks what the input leaves open and designs the agent's memory and output too.
- **执行 Agent 只属于它的工作流**：执行格没有下拉，「设置 Agent」只新建这个工作流专属的 agent，不能改选「开发」等已有 agent；「移除 Agent」就是删除它，连同提示词和记忆，不是解除指派。
- **内置 agent 的中文名称不求统一风格**：只改读着别扭的那一个，不批量改名。
- **卡片阶段由 agent 定，人只批准**：agent 建卡时写阶段列表，回退和增删也只由它做；人只用批准栏推进，没有前进或后退按钮。阶段不碰执行逻辑：有没有「执行」只看工作流是否配了执行 agent。

## Deliveries and runs

- **Resume is always the user's act**: the board never retries, backs off or restarts work by itself.
- **「重试」只给「继续」接不住的失败运行**：已取消、已完成不算失败，不出按钮。
- **An unfinished run stays a warning**: on its card too, until handled; only the user hides an old failure, and hiding keeps the log.
- **Context usage**: measured against the model's advertised window, so it may compact before looking full.
- **正在读的日志不被系统收走**：运行结束只改列表里那一行，已打开的日志留在原处。
- **看板首页不看日志**：卡片上的运行标记只打开运行对话框并选中那条运行。

## Connectors, keys and Cloud

- **Which agents ship**: only one that streams its log and can resume a stopped run, driven only by running a command and reading its output; more when cheap or asked for by name.
- **A logged-out CLI gates nothing**: it is warned about where the agent is picked.
- **Triage provider status**: what the last import returned; nothing watches it.
- **PDF and Word attachments**: go to the runtime as they are and surface its errors; no per-model blocking or conversion.
- **Cloud 托管 AI 能力**：Settings → Cloud 登录前后都展示，不提厂商和模型。
- **Cloud 页不写数据说明**：交给隐私政策页，登录处只留一句同意隐私政策与服务条款的链接。
- **Cloud unreachable**: retried while the tab is open, recovered with no click, and the local board is said to be unaffected.

## Cards and chat

- **A card not finished being created doesn't open**: it sits muted and marked.
- **Opening a card shows its frame at once**: a click answers immediately; the slightly slower full load is accepted.
- **Rewriting a message**: cuts the session back and continues; an agent that can't cut back offers no rewrite.
- **Discussions**: the board keeps the 20 most recent, dropping the oldest silently; a row's menu holds only Archive.
- **Plan files are machine-local**: not in the repository.
- **Background tasks in a chat**: the chat stays free; their results arrive later as their own message.

## Notifications

- **Rows only**: a row opens its card, with no page per event.
- **System notifications**: an actionable event raises one; one switch silences that while the bell keeps filling.
- **Scope**: the list and count belong to the open board; the connection is account-wide.
- **Problems before landings**: the bell counts only problems (failed and unfinished runs included); landed deliveries are kept apart.

## Moving around the app

- **Back/forward**: mouse buttons and a two-finger swipe wherever the system reports them, one covering layer per gesture.
- **Another board of the same project**: opens in a new window.
- **Sidebar collapse**: a button, no keyboard shortcut.

## The app's language

- **One setting**: covers the app's words, `akb` errors shown in the app, and the agent's prose; board structure (frontmatter, headings, files, commands, paths) and in-app guides stay English.
- **Only new writing follows the setting**: a switched board holds both languages.
- **Action words follow `akb`'s vocabulary**: a run is Build (中文「执行」) in every workflow, 运行, 细化; the Chinese UI calls a workflow 工作流, never 流程.
- **界面失败提示的英文**：按界面风格重写（不提终端命令），但不丢原句信息。

## Feedback

- **No task required**: a standing Feedback button takes feedback belonging to none.
- **No reply channel**: the team can't follow up, so vague feedback is dropped.
