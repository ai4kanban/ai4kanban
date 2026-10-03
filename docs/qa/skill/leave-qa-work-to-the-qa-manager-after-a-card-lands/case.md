# 卡片落地后，把 QA 的活留给开着的 QA 管理员

## Setup

- **项目**：一次性 git 项目，`akb install` 新装的看板，删掉 `setup-checklist.md` 后提交。
- **Agent**：[stand-in.mjs](../create-a-card-and-let-it-plan/stand-in.mjs) 顶替真实 agent，收到「实现」就写 `<id>.txt`；设了 `STAND_IN_TRACE` 时把启动参数（最后一个就是提示词）写进文件。
- **看板的定时器**：命令行没有起 proposer 的入口，用 [start-reflect.mjs](start-reflect.mjs) 顶替界面每分钟一次的定时器，只起 `nextWork()` 给出的 `reflect` 运行。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb workflow schedule coding`。
   列出 `qa-manager  auto · never run`：Coding 自带的 QA 管理员开着。
   [01-schedule.log](01-schedule.log)

2. 建一张卡并执行 `akb card implement 2`，等它结束。
   `implement #2` 完成；当前分支多一次提交 `Export a card as PDF (#2)`。
   [02-implement.log](02-implement.log)

3. 让看板起这张卡落地后的 proposer 运行（`reflect`），看它收到的提示词。
   提示词里有 `scheduled` 一项，写着 `qa-manager — <它的职责>`，proposer 据此不再提议「补写或重录 QA 用例」。
   **实际**：提示词里没有 `scheduled`，也没有 `missed`、`rejected`；`akb guide reflect` 的过滤规则提到「`scheduled` 里列出的 Agent」，但没有命令能打印 reflect 的流程（`akb reflect --print` 是未知命令）。已记入待筛选。
   [03-reflect.log](03-reflect.log)

## Feedback

- **改动到不了真实运行**：#1494 只把 `scheduled` 加进了打印出来的流程，而看板起的 proposer 只拿到提示词，读 `akb guide reflect` 也只看到「列在 `scheduled` 下的 Agent」这句话，看不到名单。用户照样会在 qa-manager 开着时收到「重录 QA 用例」这类重复提议。
- **用户看不到 proposer 跳过了什么**：就算过滤生效，它跳过的理由只写在运行报告里，待筛选里什么也不留；要确认「没提」是因为归了 qa-manager，得翻运行日志。
- **证据的局限**：proposer 由替身顶替，验证的是它收到了什么，不是真实 agent 怎么判断。
