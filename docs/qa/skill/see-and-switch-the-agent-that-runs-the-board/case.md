# 查看并切换运行看板的 Agent

## Setup

- **看板**：刚用 `akb install` 建好，删掉了 `setup-checklist.md`，没有改过任何运行设置。
- **机器**：装有 Claude Code 和 ChatGPT 应用自带的 Codex；`HOME` 是空目录，所以两者都没有登录。
- **终端**：zsh，在项目根目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb agent`。
   第一行 `Global default       Claude Code`（订阅、未设 key），下面列出每个 Agent 都跟随 Global default。
   [01-agent.log](01-agent.log)

2. 执行 `akb agent list`。
   列出八种连接器，`claude-code` 前有 `*`；每种写出启动命令、可配置项和缺少的能力。
   [02-list.log](02-list.log)

3. 执行 `akb agent use codex`。
   回执 `Global default runs Codex — every agent that named no runtime runs it.`，附整张 Agent 表（回顾对话记忆的那一行叫 `chat-reviewer`）；再看 `akb agent`，第一行换成 Codex，`builder`、`chat-reviewer`、`qa-manager` 都跟着变成 `codex`。
   [03-use-codex.log](03-use-codex.log)

4. 执行 `akb agent use gpt`。
   被拒绝（exit 1）：`no agent called "gpt"`，并指向 `akb agent list`。
   [04-use-unknown.log](04-use-unknown.log)

5. 执行 `akb agent test`。
   显示 `testing Global default …`；Codex 没登录，约 30 秒后回 `it failed.`，附上 Codex 自己的 401 报错，最后一行 `the agent did not answer`（exit 1）。
   [05-test.log](05-test.log)

6. 执行 `akb agent use claude-code` 切回。
   第一行回到 Claude Code；`git status` 为空，切换没有改动任何受版本控制的文件。
   [06-use-back.log](06-use-back.log)

7. 模拟旧版本存下的设置：加一行运行时 `akb agent runtime add "Codex 备用" codex`，把 `.akb/boards/docs/kanban/ui.config.json` 的 `agentRuntime` 写成旧名 `"memory-reviewer": "codex"`，执行 `akb agent`；再执行 `akb agent bind chat-reviewer global`。
   `chat-reviewer` 一行显示 `Codex 备用  codex`，旧名的设置照样生效，表里没有 `memory-reviewer`；绑回 Global default 后，旧名那一行也从文件里消失。
   [07-old-name.log](07-old-name.log)

## Feedback

- **切换是一步的事**：`use` 之后整张 Agent 表立刻跟着变，而且不进 git，不会把个人选择提交给队友。
- **改名对老用户无感**：旧名存下的绑定原样生效，表里只出现新名字，下一次改绑顺手把旧键清掉；`chat-reviewer` 比 `memory-reviewer` 更说得清它读的是对话。
- **名字还是要猜**：`chat-reviewer`、`dismissal-reviewer`、`memory-pruner` 并排列着，表里没有一句说明各自做什么，要绑运行时的人得去翻文档。
- **每条 `use` 都把整张表再打一遍**：回执本身已经说清，后面二十多行 Agent 列表让终端一下子满屏。
- **`test` 失败时把原始报错全倒出来**：十几行 `Reconnecting… 401` 和时间戳，真正有用的是「没登录」，却要用户自己读出来；没有一句「先登录 Codex」之类的下一步。
- **说明文字有小错**：表尾说「A runtime in brackets」，表里用的却是圆括号。
- **没有跑到的**：带 key 的运行时（`akb agent set`）；第 5 步（`akb agent test`）沿用上一次的实跑，这次没重跑；旧名设置是手写进文件的，没有用真正的旧版本存。
