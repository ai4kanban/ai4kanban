# 用 Codex 续聊一张卡，每条回复只记这一轮的费用；升级后旧记录自动改对

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，建 #2「Export to PDF」后提交；`akb agent runtime add Codex codex`，`akb chat 2 --runtime codex` 让这段对话跑 Codex。
- **替身 Codex**：PATH 上的 `codex` 是 [codex-stand-in.mjs](codex-stand-in.mjs)，不需要账号。它照真实 Codex 的语义：每轮一个进程，`turn.completed` 报的是整个线程的累计用量，`~/.codex/sessions/` 下的 rollout 每轮记一条 `token_count` 和 `task_complete`；模型写成 `gpt-5.5`、提供方 `openai`，看板按价目表估价。三轮各自的用量是固定的：第 1 轮 10 万输入、2000 输出；第 2 轮 12 万输入（9 万命中缓存）、3000 输出；第 3 轮 15 万输入（12 万命中缓存）、1000 输出。
- **旧记录**：前两轮用 #1888 之前的命令（同一仓库 `8f286ca7` 构建）聊出来，留下升级前的记录。
- **查看记录**：命令行不显示费用，界面（聊天、Insights）读的是 `.akb/boards/docs/kanban/` 下的 `chats/card-2.json` 和 `usage.json`；用 [show.js](show.js) 把两处逐条打出来。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`。

## Steps

1. 用旧版命令 `akb chat 2 "Is PDF export a big job?"`、`akb chat 2 "And the hardest part?"`，再看记录。
   第 2 条回复记的是线程累计（13 万未缓存输入、9 万缓存、5000 输出），`costUsd` 0.845，比它自己那一轮多算了第 1 轮；账本合计 1.405。
   [01-old-records.log](01-old-records.log)

2. 换成新版命令，打开这段对话 `akb chat 2`，再看记录。
   第 2 条回复和账本对应条目都改成这一轮自己的用量（3 万未缓存、9 万缓存、3000 输出），`costUsd` 0.285；第 1 条不变；账本合计 0.845。
   [02-upgrade-fix.log](02-upgrade-fix.log)

3. 用新版命令再聊一轮 `akb chat 2 "What would you cut first?"`，看记录；再打开一次对话。
   第 3 条回复只记这一轮（3 万未缓存、12 万缓存、1000 输出），`costUsd` 0.24；三条合计 1.085。再打开一次，合计不变。
   [03-next-turn.log](03-next-turn.log)

4. 看 rollout 里最后一条 `token_count` 的线程累计，按同一价目估算。
   约 1.085 美元，与三条回复之和相等。
   [04-thread-total.log](04-thread-total.log)

## Feedback

- **数字终于对得上**：续聊越久，旧版把每条回复记得越贵；现在逐条相加就是整段对话的花费，Insights 里的总数不再虚高。
- **历史自己改好**：升级后只要打开一次对话就修正，用户什么都不用做；不过看到昨天的费用突然变小、又没有任何提示，可能会以为数据丢了。
- **命令行看不到费用**：`akb chat` 只打印对话，想核对每条花了多少只能去翻 `.akb/` 下的 JSON 或打开界面。
- **仍是估算**：按仓库价目表算，不是 OpenAI 的实际账单。
- **没有跑到的**：真实 Codex（用替身代替，语义照 #1888 卡片核实的写）；fork 出的线程；后台运行和交付运行里的 Codex 记账；界面上聊天气泡和 Insights 的显示。
