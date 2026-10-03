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
   回执 `Global default runs Codex — every agent that named no runtime runs it.`；再看 `akb agent`，第一行换成 Codex，`builder`、`qa-manager` 都跟着变成 `codex`。
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

## Feedback

- **切换是一步的事**：`use` 之后整张 Agent 表立刻跟着变，而且不进 git，不会把个人选择提交给队友。
- **每条 `use` 都把整张表再打一遍**：回执本身已经说清，后面二十多行 Agent 列表让终端一下子满屏。
- **`test` 失败时把原始报错全倒出来**：十几行 `Reconnecting… 401` 和时间戳，真正有用的是「没登录」，却要用户自己读出来；没有一句「先登录 Codex」之类的下一步。
- **说明文字有小错**：表尾说「A runtime in brackets」，表里用的却是圆括号。
- **没有跑到的**：带 key 的运行时（`akb agent set`）和给单个 Agent 绑定运行时（`akb agent bind`）这次没有走。
