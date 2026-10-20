# 升级后，自建工作流变成看板里的 WORKFLOW.md；再手写一个

## Setup

- **项目**：一次性 git 项目，`akb install` 新装后提交。
- **旧版设置**：照升级前的格式，在 `.akb/boards/docs/kanban/ui.config.json` 的 `workflows.added` 里写了自建工作流 `wf-2`「Docs update」，`stages.wf-2` 写了规划由 `software-planner` 主持、帮手 `copywriting` 带附加要求「Match the docs voice.」、执行由 `builder` 负责。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 升级后第一次执行 `akb workflow list`，再看 `docs/kanban/workflows/wf-2/WORKFLOW.md`、`ui.config.json` 和 `git status`。
   列表照旧有「Docs update」，负责人和帮手不变；它被写成 `docs/kanban/workflows/wf-2/WORKFLOW.md`（frontmatter 带 `name`、`stages`，附加要求也在）；`ui.config.json` 里的 `added` 和 `stages.wf-2` 没了；新文件夹出现在 `git status` 里，可以随项目提交。
   [01-upgrade.log](01-upgrade.log)

2. 手写 `docs/kanban/workflows/launch-email/WORKFLOW.md`（`name`、`description`、规划由 `software-planner` 主持、帮手 `email-planner` 和 `copywriting`、执行留空），执行 `akb workflow list`，再 `akb raw create --title "Announce PDF export" --workflow launch-email`。
   列表多出 `launch-email  Launch email  (no worktree)`，下一行就是手写的说明；建出的 #2 带 `workflow: launch-email`。
   [02-hand-written.log](02-hand-written.log)

3. 再放两个写坏的文件：`notes/WORKFLOW.md` 没有 `name`，`coding/WORKFLOW.md` 与内置工作流重名；执行 `akb workflow list`。
   两个都不出现在列表里，列表末尾各一行 `!`：``… coding/WORKFLOW.md: `coding` is a built-in workflow, so this one is not used. Rename its folder.``、``… notes/WORKFLOW.md: its frontmatter has no `name` ``。
   [03-broken.log](03-broken.log)

4. 删掉这两个文件，执行 `akb workflow rename wf-2 Docs refresh`、`akb workflow stage wf-2 --stage plan --off copywriting`、`akb workflow delete wf-2`，每步后看文件。
   改名和关掉帮手都直接写进 `wf-2/WORKFLOW.md`（`name: Docs refresh`、`off: true`）；删除后文件夹整个没了，只剩 `launch-email`。
   [04-edit-by-command.log](04-edit-by-command.log)

## Feedback

- **升级无感**：旧的自建工作流一个不少、帮手的附加要求也跟着搬过去，用户什么都不用做。
- **能和团队共享了**：工作流成了看板里的文件，改动进 git、能审能回滚；代价是每次在界面里开关帮手都会在提交里多一处改动。
- **手写很顺**：抄一份内置的格式就能用，写错的文件不会悄悄消失，`!` 行直说哪个文件、错在哪、怎么改。
- **写错只在列表里提示**：`--json` 的 `workflows` 里没有这两条问题，只能从 `output` 文本里找；建卡、规划时也不会再提醒。
- **列表里看不出来源**：手写的和命令建的 `wf-2` 长得一样，看不出哪个文件对应哪个工作流，得自己去 `docs/kanban/workflows/` 翻。
- **没有跑到的**：降级回旧版命令后这些工作流看不到（卡片自己写明的代价）；看板 UI 的「配置 → 工作流」在这次改动后的样子。
