# 在命令行把一张已有的卡换到另一个工作流

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **卡片**：#2「Write a launch post for the new export feature」，默认工作流（Coding），已规划好、`status: ready`，有 Scope 和一条待办。
- **账号**：未登录 Cloud。
- **Agent**：第 4 步用本目录的 [stand-in.mjs](stand-in.mjs) 顶替 Claude Code（不花钱）——`<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs"}}}`。它收下提示词、说一句话，然后空等一分钟，好让运行一直在跑。
- **终端**：zsh，`PATH` 最前是这次构建出的命令，`AI4KANBAN_HOME` 指向临时目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb raw update 2 --workflow blog-post`，再看卡片的 frontmatter 和 `akb raw list --json`。
   回 `updated #2: workflow→blog-post, status→todo, schedule→refine`；卡片多了 `workflow: blog-post` 和 `schedule: action: refine`，状态从 `ready` 回到 `todo`，正文不变。
   [01-switch.log](01-switch.log)

2. 给卡片设上阶段 `akb raw update 2 --phases "Outline,Article" --phase 1`，再执行 `akb raw update 2 --workflow ""`。
   回 `workflow→coding, status→todo, schedule→refine`；frontmatter 里的 `workflow`、`phases`、`phase` 都没了，只留 `schedule: refine`。
   [02-switch-back.log](02-switch-back.log)

3. 执行 `akb raw update 2 --workflow blog`，再执行 `akb raw update 2 --workflow coding`。
   第一条退出码 1：`no workflow called "blog" on this board. It has: coding, hyperframes-video, slide-deck, carousel-post, blog-post, video-clone.`；第二条卡片已在 Coding 上，回 `updated #2: (nothing changed)`，不重排规划。
   [03-refused.log](03-refused.log)

4. 执行 `akb card refine 2` 起一次运行，趁它在跑执行 `akb raw update 2 --workflow blog-post`；`akb run stop` 停下后再执行一次；然后在未登录的情况下再执行 `akb card refine 2`，看 `akb run list` 和 `akb run log`，再停下。
   在跑时被拒：`#2 has a run in progress — stop it before switching its workflow.`，退出码 1；停下后照常换过去。换到 Blog post 后，没有账号也能规划：`refine` 起了一次 `clarify #2`，状态 `running`。
   [04-run-in-progress.log](04-run-in-progress.log)

5. `akb workflow new Docs update` 建 `wf-2`，把 #2 换到 `wf-2`，再 `akb workflow delete wf-2`；然后把 #2 换回默认，再删一次。
   第一次删被拒：`"Docs update" — 1 open card (#2) still runs on this workflow — move it to another one first.`，退出码 1；卡片换走后删除成功。
   [05-delete-workflow.log](05-delete-workflow.log)

## Feedback

- **分错了不用重建**：一条命令换过去，正文和已写的内容都在，旧工作流的阶段一并清掉，不会把「大纲 › 正文」带到 Coding 上。
- **换过去就能用**：Blog post 不再要 Pro，没登录的用户把卡换过去，下一条 `refine` 就开跑，不会换完才发现被锁。
- **拒绝说得清楚**：工作流写错时列出全部 id，有运行时直说先停下，删工作流时指明是哪张卡、该怎么办。
- **换了看不出来**：`akb raw list`（含 `--json`）不显示卡片在哪个工作流、也不显示排上了 refine，只有打开卡片文件才知道；`workflow new` 还说「all three stages are empty」，而工作流只有规划和执行两段。
- **只认 id**：要写 `wf-2`、`blog-post`，不能写「Docs update」这样的名字。
- **没有跑到的**：真实的 Agent（第 4 步是替身，没看 `blog-planner` 真的写出大纲）；卡片有进行中的交付时被拒（需要一次真实的开发运行）；换完后看板自动开始的那次 refine（命令行下只排上，不会自己跑）；卡片页上的工作流下拉。
