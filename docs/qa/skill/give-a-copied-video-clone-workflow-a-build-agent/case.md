# 复制「视频克隆」工作流，给它配一个执行 Agent，卡片规划完就能开发

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **账号**：已登录 Cloud，Pro（本地假 Cloud 应答 `/v1/billing`）——复制 Pro 工作流要 Pro。
- **终端**：zsh，`PATH` 最前是这次构建出的命令，`HOME` 是空目录，`AI4KANBAN_HOME` 和 Cloud 地址指向临时目录和假 Cloud；日志里的 `akb` 就是这次构建出的命令。只用 `--print`，不起运行。

## Steps

1. 执行 `akb workflow duplicate video-clone`，再 `akb workflow rename wf-2 Template clone`，然后 `akb workflow list`。
   回 `copied it to "Video clone 2" (wf-2) — each of its agents was copied with it`；列表末尾是 `wf-2  Template clone  (Pro)  (no worktree)`，规划 `video-cloner-2`，执行 `(nobody)`。
   [01-duplicate.log](01-duplicate.log)

2. 用副本建卡：`akb raw create --title '复刻发布短片' --workflow wf-2 --body-file body.md`，再执行 `akb card implement 2 --print`。
   卡片建成；`implement` 被拒：`#2 is finished during planning, so it is archived rather than built.`，退出码 1——执行阶段没人时照旧规划完就归档。
   [02-no-executor.log](02-no-executor.log)

3. 写 `docs/kanban/agents/wf-2-executor/AGENT.md`（`lead: execute`，英文标题「Template clone executor」，正文：把卡片的模板复制到 `templates/<卡片 slug>/` 并提交），执行 `akb workflow stage wf-2 --stage execute --lead wf-2-executor`，再看 `akb workflow list`。
   回 `Template clone · execute: lead→wf-2-executor`；列表里 `wf-2` 的执行一栏变成 `wf-2-executor`。
   [03-set-executor.log](03-set-executor.log)

4. 再执行 `akb card implement 2 --print`。
   不再拒绝：打印 `implement #2 — printed, not started.`，带上开发卡片的完整流程和收尾三步（勾待办、写交付记录、`akb raw archive 2`），跟 Coding 卡一样。
   [04-build-allowed.log](04-build-allowed.log)

5. 用内置的 `video-clone` 再建一张卡 #3，分别看两张卡 `akb card refine <id> --print` 里有没有「规划完就归档」那句，再对 #3 执行 `akb card implement 3 --print`。
   #3 的提示里有 `This card is finished in planning, then archived, never built: leave no unticked todo, and end by telling me to archive it once I'm happy.`；#2 的没有（`grep` 退出码 1）。#3 的 `implement` 照旧被拒。
   [05-refine-prompts.log](05-refine-prompts.log)

6. 执行 `akb workflow stage wf-2 --stage execute --lead ''`，再 `akb card implement 2 --print`。
   回 `execute: lead→(nobody)`；#2 又被拒，跟第 2 步一样。
   [06-clear-executor.log](06-clear-executor.log)

7. 试着直接给内置的 `video-clone` 配执行 Agent：`akb workflow stage video-clone --stage execute --lead wf-2-executor`。
   被拒：`` `Video clone` is built in — its lead agents are fixed. Duplicate it to make one you can reassign.``，退出码 1。
   [07-builtin-fixed.log](07-builtin-fixed.log)

## Feedback

- **开关清楚**：执行阶段有没有人，一条 `workflow stage` 就切过来，`implement` 的结果和规划提示同时跟着变，没有残留状态。
- **命令行要自己写 Agent 文件**：看板界面里有「设置 Agent」按钮一键新建 `<工作流> executor`；命令行没有对应命令，得先照 `akb guide write-agent` 手写 `AGENT.md`，再 `workflow stage --lead`。
- **复制品没有简介**：`workflow list` 里内置的每个工作流都有一行说明，复制出来的 `wf-2` 没有，也看不出它会不会走开发。
- **拒绝的说法没跟着变**：第 2 步的拒绝只说「规划完就归档」，没提示「给执行阶段配一个 Agent 就能开发」，第一次碰到的人不知道还有这条路。
- **没有跑到的**：真实的执行运行（这里只看了 `--print`）；执行 Agent 把模板发布到共享模板库（不在这次改动里）。
