# 让一张卡等另一张卡，并被拒绝循环依赖

## Setup

- **看板**：刚用 `akb install` 建好，删掉了 `setup-checklist.md`；用 `akb raw create --title` 建了 #2「Export to PDF」和 #3「Print preview」。
- **终端**：zsh，在项目根目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb raw update 3 --blocked-by 2`。
   回执 `updated #3: blocked_by, schedule→refine when unblocked`，卡片文件里是 `blocked_by: [2]`。
   [01-block.log](01-block.log)

2. 执行 `akb raw list`。
   #3 那一行多出 `blocked by #2`。
   [02-list.log](02-list.log)

3. 反过来执行 `akb raw update 2 --blocked-by 3`。
   被拒绝（exit 1）：`#2 blocked by #3 makes a cycle: #2 → #3 → #2`；#2 的 `blocked_by` 仍是 `[]`。
   [03-cycle.log](03-cycle.log)

4. 执行 `akb raw update 2 --blocked-by 2`。
   被拒绝：`#2 cannot be blocked by itself.`
   [04-self.log](04-self.log)

5. 执行 `akb raw update 2 --blocked-by 9`（没有 #9）。
   被拒绝，并说明卡号目前只到 3。
   [05-missing.log](05-missing.log)

## Feedback

- **拒绝说得很具体**：循环直接画出 `#2 → #3 → #2`，一眼就知道是哪两张卡在打架，文件也没被改。
- **回执里的 `schedule→refine when unblocked` 费解**：用户只是加了依赖，这半句是看板内部的排程说法，没说清对自己意味着什么。
- **依赖只在 `raw` 下**：`akb card` 没有加依赖的动词，日常用户要知道去 `akb raw update` 找 `--blocked-by`，而 `raw` 听起来像不该碰的底层命令。
- **「don't invent ids」是写给 agent 的**：人手输错卡号时读到这句有点冒犯。
