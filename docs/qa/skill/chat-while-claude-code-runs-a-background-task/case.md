# Claude Code 把命令放到后台后，继续聊天并等结论

## Setup

- **看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md`，建了 #2「Export to PDF」后提交。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替 Claude Code（不需要账号）——在 `<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs 20000"}}}`。它像 Claude Code 一样从 stdin 一条条收消息：以 `ping` 结尾的马上答 `pong`；其他的放一个后台任务、先答 `Started the tests in the background.`，20 秒后报 `npm test finished` 并另答一条 `The tests passed: 42 of 42.`
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb chat 2 "Run the tests in the background."`。
   先打印 `Started the tests in the background.`，然后终端停住，20 秒后才返回（exit 0）；后台的结论没有打印出来。
   [01-chat-waits.log](01-chat-waits.log)

2. 执行 `akb chat 2` 看对话。
   3 条消息：你的一条、`Started …`，以及一条单独的 agent 消息 `⏺ npm test finished` / `The tests passed: 42 of 42.`
   [02-history.log](02-history.log)

3. `akb card refine 2` 起一次卡片运行，6 秒后和 24 秒后各看一次 `akb run list`，再看 `akb run log`。
   6 秒时 `running`；结束时 `done in 21s`，同一份日志里先是 `Started …`，然后 `⏺ npm test finished` 和结论。
   [03-run-waits.log](03-run-waits.log)

4. `akb chat 2 --clear` 后，在一个终端里发 `Run the tests in the background.`，4 秒后在另一个终端发 `"Still there? ping"`；20 秒后看对话。
   第二条 1 秒就返回 `pong`；对话里依次是两问两答，后台结论最后单独成条。
   [04-talk-meanwhile.log](04-talk-meanwhile.log)

## Feedback

- **后台任务不再被杀**：运行和对话都等到结论回来，写在同一个会话里，承诺的后续真的回来了。
- **终端里干等**：`akb chat` 打印完第一句就静默 20 秒，不说还有几个后台任务在跑、也不说在等什么；等完返回时又不打印结论，要再 `akb chat 2` 才看得到。
- **证据的局限**：Claude Code 由替身顶替，只验证看板对后台事件的处理；真实 Claude Code 的事件格式和 2 小时上限没有跑。界面上「后台任务」那一行和「中止」按钮属于 local-ui。
