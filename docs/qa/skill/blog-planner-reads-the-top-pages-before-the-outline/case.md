# 让博客策划写一篇博客的大纲，它先读了排在前面的页面

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`；没有博客目录。
- **账号**：博客工作流要 Pro，用一份手写的 Pro 登录状态（`AI4KANBAN_HOME` 指向临时目录，Cloud 地址指向本机替身，只答 `/v1/billing` 为 Pro）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），能用 WebSearch、WebFetch。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create --workflow blog-post "Blog post on why a kanban board works better than a chat thread for steering AI coding agents. Primary keyword: kanban for AI agents. Online-only blog (no blog folder)."`。
   立即返回一次 `create` 运行和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 新卡 #2 问博客发在哪里，执行 `akb card resolve 2 "There is no published blog yet; write the post standalone."`。
   返回一次 `resolve` 运行。
   [02-resolve.log](02-resolve.log)

3. 等运行结束后执行 `akb run list`。
   `create`（49 秒，约 $0.43）、`resolve #2`（1 分 39 秒，约 $0.32）都完成，已没有在跑的运行。
   [03-runs.log](03-runs.log)

4. 执行 `akb run log <resolve 的 id>`。
   写大纲前先 `WebSearch(kanban for AI agents)`，再两次 `WebFetch` 读排在前面的页面；结尾的汇报点名读了哪两页，列出本文比它们多给的三点，并说明三点都出自看板自己的做法。
   [04-resolve-log.log](04-resolve-log.log)

5. 打开卡片 #2，再执行 `akb card approve 2`。
   卡片有 `phases: [Outline, Article]`、`phase: 1`；`## By \`blog-planner\` agent` 里是 Brief 和 8 节的大纲，其中三节的角度正是那三点；卡片上没有调研过程或竞品页面。应该没有问题、由「批准」进入正文。
   **未通过**：卡上还有一道 `[user]` 问题「Is the outline in the blog-planner section ready to turn into the full article?」（Approve / Revise）；`akb card approve 2` 被拒：`#2 has open questions — answer them before approving the stage.`，界面上也就不会出批准栏。
   [05-card.log](05-card.log)

## Feedback

- **大纲不和别人撞车**：三点（问题写在卡上、卡片分人看和 Agent 看两半、分阶段批准并就地改稿）都是排在前面的页面没讲的，章节也围着它们排。
- **汇报终于给了页面地址**：结尾直接链接读过的两页，核对来源不用再翻工具调用。
- **还在请你批准大纲**：阶段已经写进卡片，却又多一道「Approve / Revise」问题，正好挡住「批准」；用户得按旧方式回答问题，阶段条和批准栏形同虚设。
- **要多答一个问题**：主题里已写「Online-only blog (no blog folder)」，策划仍先问博客发在哪，多了一轮 `resolve`。
- **没有跑到的**：没有主关键词时跳过调研；回答那道确认问题后能否进入正文；第二阶段写正文。
