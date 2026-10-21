# 复制「视频克隆」工作流，给它配一个执行 Agent，卡片规划完就能开发

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **账号**：未登录 Cloud。
- **终端**：zsh，`PATH` 最前是这次构建出的命令，`HOME` 是空目录，`AI4KANBAN_HOME` 指向空的临时目录；日志里的 `akb` 就是这次构建出的命令。只用 `--print`，不起运行。

## Steps

1. 执行 `akb workflow duplicate video-clone`，再 `akb workflow rename wf-2 Template clone`，然后 `akb workflow list`。
   回 `copied it to "Video clone 2" (wf-2) — each of its agents was copied with it`；没有登录也照样复制；列表末尾是 `wf-2  Template clone  (no worktree)`，不带 Pro 标记，下一行是规划负责人 `video-cloner-2` 的描述「Leads a video clone card — clones a video made with code into a reusable beat-table template …」，再是规划 `video-cloner-2`、执行 `(nobody)`；`--json` 的 `description` 是同一句。
   [01-duplicate.log](01-duplicate.log)

2. 用副本建卡：`akb raw create --title '复刻发布短片' --workflow wf-2 --body-file body.md`，再执行 `akb card implement 2 --print`。
   卡片建成（中文标题没有英文 slug，文件名是 `2-task.md`）；`implement` 被拒：`#2 is finished during planning, so it is archived rather than built.`，退出码 1——执行阶段没人时照旧规划完就归档。
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

6. 看 #2 的规划提示指向的分阶段出稿规则：`akb card refine 2 --print`，再 `akb guide multi-stage-drafting`。
   提示里写着 `Pick from these, in order, following \`akb guide multi-stage-drafting\`.`；那份指引的「Leading a card」写明 `` `phases` alone tracks your drafting stages; todos list only the build stage's work. ``——领头 Agent 的草稿阶段只记在阶段条上，不写成待办，规划完待办里只剩执行阶段的事，「执行」不会因为草稿待办全勾而被藏起。
   [06-drafting-rule.log](06-drafting-rule.log)

7. 执行 `akb workflow stage wf-2 --stage execute --lead ''`，再 `akb card implement 2 --print`。
   回 `execute: lead→(nobody)`；#2 又被拒，跟第 2 步一样。
   [07-clear-executor.log](07-clear-executor.log)

8. 直接给内置的 `video-clone` 配执行 Agent：`akb workflow stage video-clone --stage execute --lead wf-2-executor`，再 `akb card implement 3 --print`；然后试着换它的规划负责人 `--stage plan --lead video-cloner-2`，最后把执行清空。
   内置工作流空着的执行阶段也收下：`Video clone · execute: lead→wf-2-executor`，#3 的 `implement` 随即放行；换规划负责人被拒：`` `Video clone` is built in — its lead agents are fixed. Duplicate it to make one you can reassign.``，退出码 1。
   [08-builtin-execute.log](08-builtin-execute.log)

## Feedback

- **开关清楚**：执行阶段有没有人，一条 `workflow stage` 就切过来，`implement` 的结果和规划提示同时跟着变，没有残留状态。
- **出稿和执行分开记**：草稿阶段只走阶段条、待办只留执行的事，规划完的卡不会因为草稿待办全勾就看起来「已经做完」；但这只是写给领头 Agent 的一句规则，要靠它照做。
- **复制品看得出是做什么的**：`workflow list` 在 `wf-2` 下面给出规划负责人的描述，和内置工作流一样一行说明；但那句是 Agent 的口吻（「Leads a video clone card — …」），偏长，也没说执行阶段配没配人。
- **不复制也能开发了**：内置工作流空着的执行阶段现在可以直接配人，这个场景复制的理由只剩「想换规划负责人」；第 2 步的拒绝仍只说「规划完就归档」，没提示「给执行阶段配一个 Agent 就能开发」。
- **命令行要自己写 Agent 文件**：看板界面里有「设置 Agent」按钮一键新建 `<工作流> executor`；命令行没有对应命令，得先照 `akb guide write-agent` 手写 `AGENT.md`，再 `workflow stage --lead`。
- **中文标题的卡文件名读不出是哪张卡**：`复刻发布短片` 写成 `2-task.md`，`复刻发布短片 2` 写成 `3-2.md`。
- **复制不用登录**：工作流不再分 Pro，免费用户也能复制「视频克隆」、改名、配执行 Agent，整条路上没有一处要账号。
- **没有跑到的**：真实的规划运行——没看领头 Agent 实际写出的待办里是否真的不含草稿阶段（要一次付费运行）；看板界面里「执行」按钮的显隐；真实的执行运行和把模板发布到共享模板库。
