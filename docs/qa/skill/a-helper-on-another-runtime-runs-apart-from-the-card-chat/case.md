# 在卡片聊天里请辅助 Agent：默认就地做，换了运行时的另开一次运行

## Setup

- **看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md`，建了 #2「Export to PDF」。
- **运行时**：`akb agent runtime add Design claude-code`，`akb agent bind ui-designer design`；两个运行时的命令都指向 [stand-in.mjs](../run-a-workflow-agent-on-a-schedule/stand-in.mjs)（不需要账号；对非周期运行什么都不做就结束）。
- **聊天**：命令行没有聊天里替 agent 敲命令的入口；看板在聊天里给 agent 设 `KANBAN_CHAT_RUNTIME=<运行时 id>`，这里手动设上，顶替一次聊天里 agent 敲的命令。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb agent runtime`，看 Agents 一栏。
   `copywriting` 是 `(Global default)`，`ui-designer` 是 `Design`。
   [01-runtimes.log](01-runtimes.log)

2. 在 Global default 的聊天里执行 `akb spec copywriting 2 --print`。
   `spec #2 — printed, not started. Do it here, in this session`：就在聊天里做。
   [02-same-runtime.log](02-same-runtime.log)

3. 在同一个聊天里执行 `akb spec ui-designer 2 --print`，几秒后 `akb run list`。
   不打印，而是另开一次运行：`ui-designer runs on its own runtime, so it started as a separate run — don't write its section yourself.`，后面是运行号和跟踪、停止它的命令；`run list` 里有 `spec ui-designer #2`。
   [03-other-runtime.log](03-other-runtime.log)

4. 在 Design 的聊天里执行同一条命令。
   回到就地打印。
   [04-in-its-own-chat.log](04-in-its-own-chat.log)

5. 在聊天之外的终端里执行同一条命令。
   就地打印：不在聊天里时看板不拿运行时比较。
   [05-terminal.log](05-terminal.log)

6. 看 `akb guide refine` 的「Spec agents」一条。
   写着 `Add --print to run it in this session; start a separate session instead … when it writes its section from scratch or this session already ran another agent.`
   [06-guide.log](06-guide.log)

## Feedback

- **省钱的默认**：照着反馈改一稿不再动辄开新会话；运行时不同时由系统兜底，agent 不必自己判断。
- **「从零写」仍靠 agent 判断**：另开会话的其余两种情况只写在引导里，用户在命令行看不到它为什么这次另开、那次没开。
- **终端里不比较运行时**：直接在终端 `--print` 一个绑了别的运行时的 Agent，会在当前会话里用错的模型做；只有聊天里才拦得住。
