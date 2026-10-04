# 卡片落地后，把 QA 的活留给开着的 QA 管理员

## Setup

- **项目**：一次性 git 项目，`akb install` 新装的看板，删掉 `setup-checklist.md` 后提交。
- **Agent**：[stand-in.mjs](../create-a-card-and-let-it-plan/stand-in.mjs) 顶替真实 agent，收到「实现」就写 `<id>.txt`；设了 `STAND_IN_TRACE` 时把启动参数（最后一个就是提示词）写进文件。
- **看板的定时器**：命令行没有起 proposer 的入口，用 [start-reflect.mjs](start-reflect.mjs) 顶替界面每分钟一次的定时器，只起 `nextWork()` 给出的 `reflect` 运行；带上卡号时直接起这些卡的 `reflect`，不等两次回顾之间的一小时。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb workflow schedule coding`。
   列出 `qa-manager  auto · never run`：Coding 自带的 QA 管理员开着。
   [01-schedule.log](01-schedule.log)

2. 建一张卡并执行 `akb card implement 2`，等它结束。
   `implement #2` 完成；当前分支多一次提交 `Export a card as PDF (#2)`。
   [02-implement.log](02-implement.log)

3. 让看板起这张卡落地后的 proposer 运行（`reflect`），看它收到的提示词和 `akb guide reflect`。
   提示词在 `<card>` 块之后有一个 `<scheduled-agents>` 块，一行 `qa-manager — <它的职责>`；`akb guide reflect` 写明过滤掉这个块里的 Agent 自己会做的工作，并直接给出 `missed.md` 和 `rejected.md` 的路径。
   [03-reflect.log](03-reflect.log)

4. 执行 `akb workflow schedule coding --off qa-manager`，再建一张卡落地，起它的 `reflect`。
   提示词里不再有 `<scheduled-agents>` 块。
   [04-off.log](04-off.log)

## Feedback

- **真实运行终于拿到名单**：开着的 QA 管理员连同一句职责直接写进 proposer 的提示词，关掉就消失，不用再指望它去读只在打印流程里才有的字段。
- **职责只有一句英文简介**：proposer 要靠「Keeps the project's test cases true to the product」自己推断哪些后续归 QA 管理员，边界（比如「给新命令写文档」算不算）全凭判断。
- **用户看不到 proposer 跳过了什么**：被过滤的提议不在待筛选里留痕，要确认「没提」是因为归了 QA 管理员，得翻运行日志。
- **回顾之间隔一小时**：连着落地两张卡，第二张要等一小时才轮到回顾；这里用脚本带卡号直接起，界面上没有这个入口。
- **证据的局限**：proposer 由替身顶替，验证的是它收到了什么，不是真实 agent 怎么判断；`missed.md`、`rejected.md` 有内容时它会不会去读，这次没跑。
