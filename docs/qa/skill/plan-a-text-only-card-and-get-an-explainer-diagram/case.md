# 规划一张纯文字卡片，看软件规划师画出示意图

## Setup

- **项目**：一次性 git 项目，只有一个 `webhooks.js`（`deliver` 把事件逐个 POST 给订阅者，失败只打日志）；`akb install` 新装，删掉 `setup-checklist.md` 后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流，规划由软件规划师领头。
- **终端**：zsh，在项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create "Failed webhook deliveries are retried by a background worker up to 3 times with backoff; after the third failure the event is written to a dead-letter file that an operator can replay with a command"`。
   立即返回，打印 `create — run <id>` 和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 约一分钟后执行 `akb run list`。
   `create` 已完成（58 秒，约 $0.35），`nothing running.`
   [02-runs.log](02-runs.log)

3. 打开新卡 #3。
   分隔线上方多出 `## By \`software-planner\` agent`，里面只有一个 `mermaid` 代码块：`flowchart TB`，5 个节点（投递 → 后台重试 → 成功 / 死信文件 ← 运维重放），箭头带 `fails`、`third retry fails` 等标签；卡上没有其他专项 Agent 的段。
   [03-card.log](03-card.log)

4. 执行 `akb raw validate 3`。
   `Spec format valid (1 card).`
   [04-validate.log](04-validate.log)

5. 再建一张一句话就说得清的卡：`akb create "Rename the deliver function in webhooks.js to sendToSubscribers"`。
   同样立即返回一次 `create` 运行。
   [05-create-small.log](05-create-small.log)

6. 运行结束后打开新卡 #4。
   只有正文、Scope、Todo 和一个问题，没有 `## By` 段，也没有空的占位段。
   [06-card-small.log](06-card-small.log)

## Feedback

- **图确实一眼看懂**：五个节点把「失败 → 重试 → 死信 → 重放」的环路画了出来，比 Scope 里四条文字更快抓住意图；改名这种小卡不画，卡片也没有多一个空段，判断得当。
- **命令行里只是一段代码**：在终端或编辑器里看到的是 mermaid 源码，要到卡片页才是图；卡片页的绘制属于 local-ui，这里没有验证。
- **何时画由模型判断**：同一类卡片换一种说法可能画、也可能不画，用户无法要求「这张也画一张」，只能等规划者自己决定。
- **`akb raw validate` 不带编号会被新装看板自带的 #1 卡挡住**：#1 缺 `## Scope` 等段，整体校验以 1 退出；这里改用 `validate 3` 只查新卡。
- **没有跑到的**：已有界面改动、请了 ui-designer 等专项 Agent 的卡（应不画）；讨论里「立即执行」生成的临时卡；修改卡片后图跟着更新。
