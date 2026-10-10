# 让博客策划写一篇博客的大纲，它先读了排在前面的页面

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`；没有博客目录。
- **账号**：博客工作流要 Pro，用一份手写的 Pro 登录状态（`AI4KANBAN_HOME` 指向临时目录，Cloud 地址指向不存在的本机端口）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），能用 WebSearch、WebFetch。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create --workflow blog-post "Blog post on why a kanban board works better than a chat thread for steering AI coding agents. Primary keyword: kanban for AI agents. …"`。
   立即返回一次 `create` 运行和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 新卡 #2 问博客发在哪里，执行 `akb card resolve 2 "There is no published blog yet; write the post standalone."`。
   返回一次 `resolve` 运行。
   [02-resolve.log](02-resolve.log)

3. 等运行结束后执行 `akb run list`。
   `create`、`resolve` 之后自动跑了 `clarify #2`（2 分 24 秒，约 $0.45），已没有在跑的运行。
   [03-runs.log](03-runs.log)

4. 执行 `akb run log <clarify 的 id>`。
   写大纲前先 `WebSearch(kanban for AI agents)`，再 `WebFetch` 读排在前面的页面；结尾的汇报列出本文比这些页面多给的三点，并说明三点都出自项目自己的做法。
   [04-clarify-log.log](04-clarify-log.log)

5. 打开卡片 #2。
   `## By \`blog-planner\` agent` 里是 Brief 和 7 节的大纲，第 3–5 节的角度正是那三点；卡片上没有调研过程、竞品页面或「多给的几点」清单；唯一的问题请你批准或退回大纲。
   [05-card.log](05-card.log)

## Feedback

- **大纲不再和别人撞车**：三点（回答写回卡片正文、卡片分人看和 Agent 看两半、纠正留进 Agent 的记忆）都是排在前面的页面没讲的，章节也围着它们排，比泛泛的「看板 vs 聊天」有说服力。
- **调研只能在运行日志里看到**：卡片上看不出它读过哪些页面、凭什么说这三点是新的；想核对得去翻 `akb run log`，而日志里只有工具调用的标题，没有页面地址。
- **要多答一个问题**：主题里已经写了「online-only blog (no blog folder)」，策划仍先问博客发在哪，多了一轮 `resolve`。
- **有一处链接被主动拿掉**：它打不开 Codex 的文档页，就不引用，并在汇报里说明——这是对的，但用户只有在日志里才知道。
- **没有跑到的**：没有主关键词时跳过调研；第二阶段写正文；批准或退回大纲。
