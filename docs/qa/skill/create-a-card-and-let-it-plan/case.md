# 建一张卡，让看板把它规划好

## Setup

- **看板**：刚用 `akb install` 建好，删掉了 `setup-checklist.md`。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替真实 agent——在 `<项目>/.akb/boards/docs/kanban/ui.config.json` 写 `"harness":"claude-code"` 和 `harnessSettings["claude-code"].command = "node stand-in.mjs <cli/bin/ai4kanban.mjs>"`。它收到「加任务」就照原话建一张卡；收到「规划」就写一行摘要并问一个 `[user]` 问题（默认纸张大小，推荐 A4）。不花钱，也不需要账号。
- **终端**：zsh，在项目根目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create "Export a card as PDF"`。
   立即返回，打印 `create — run <id>` 和跟踪、停止这次运行的两条命令。
   [01-create.log](01-create.log)

2. 几秒后执行 `akb run list`。
   `create` 已完成，看板自己接着起了 `clarify #2` 并完成；`nothing running.`
   [02-runs.log](02-runs.log)

3. 执行 `akb raw list`。
   多出 #2「Export a card as PDF」，状态 `todo`，带 `1 open question`，摘要换成了规划写的那句话。
   [03-list.log](03-list.log)

4. 打开卡片文件。
   frontmatter 的 `questions` 里有 `[user] Which page size is the default?`，选项 A4 / US Letter，推荐第一个。
   [04-card.log](04-card.log)

5. 执行 `akb run log <clarify 的 id>`。
   第一行 `[board] started from a copy of the session this card was created in`，下面是 agent 的回话。
   [05-clarify-log.log](05-clarify-log.log)

## Feedback

- **一句话就到「等我回答」**：建卡后不用再敲任何命令，看板自己接着规划，这是命令行里最顺的一段。
- **`create` 的回执不提后面还有规划**：回执只说起了一次 `create`，要去 `run list` 才发现多了个 `clarify`；回执里多一句「建好后会自动规划」就不会意外。
- **问题只能去文件里读**：`raw list` 只说有 1 个问题，看问题本身要打开卡片文件读 YAML，命令行没有「列出这张卡的问题」的动词。
- **证据的局限**：规划内容由替身写成，验证的是看板的流程（建卡 → 自动规划 → 问题落到卡上），不是真实 agent 的规划质量。
