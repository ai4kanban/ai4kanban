# Product

What the product is today, from its users' side. Rewritten whole by `akb describe-product`;
edits here do not last.

## What it is

AI4Kanban 是一个 AI 项目经理：用看板组织你的 coding agent，把模糊想法变成明确的卡片，派给 agent 规划、实现、落地，只把需要你拍板的决策和待验收的结果带给你。提供 macOS / Windows / Linux 桌面应用、`akb` 命令行和 agent skill，看板默认是仓库里 `docs/kanban/` 下的 Markdown 文件。

## Who it is for

- **独立开发者和小团队**：想同时驱动多个 AI agent、承接更大项目的人。
- **已在用 coding agent 的开发者**：Claude Code、Codex、Cursor 等用户，使用自己的订阅，无额外 token 费用。

## Problems it solves

- **agent 需要人盯**：分派任务、跟进进度、审阅产出占满一天；看板替你协调，只在需要决策时通知你。
- **需求不清就写错代码**：先循环澄清、拆解，agent 能自己回答的就自己定，只留 2–3 个真正需要你判断的问题。
- **决策不留痕**：每次决策和否决都记入项目记忆，后续规划沿用，不再重复提出被否掉的想法。

## Features

- **看板与卡片**：一个想法一张卡，按优先级、ROI、依赖和 release 排序；"下一步做什么"直接给出推荐。
- **Refine / Resolve**：自动规划卡片，太大就拆成子任务，把开放问题留给你回答。
- **一键实现**：Implement 在独立 worktree 里构建，作为一次提交落到当前分支并自动归档；也支持手动提交模式。
- **需手动验证的项**：构建留下的"check by hand"清单，验收后归档。
- **Chat**：在终端或应用里就整个看板或某张卡对话，讨论结论可直接改卡或拆成新卡。
- **Runs**：后台运行 agent，可查看日志、停止、续跑，并显示成本、token 和模型。
- **8 种 coding agent**：Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness、ZCode、Grok Build，可为每个 agent 单独选工具和模型。
- **Releases**：按目标规划版本、自动填卡，关闭时生成 changelog。
- **项目记忆**：决策、否决、重设计按模块记录，每日从对话中回收，定期精简。
- **内置 agent**：Proposer 提出后续工作、Sweeper 清理久置卡片、Triage 分拣线索、产品描述自动更新。
- **Specialists**：文案、UI 设计稿、技术选型、提示词、邮件等专项 agent，各写卡片的一节。
- **周期任务**：按固定频率自动执行的重复卡片。
- **内容工作流（Pro）**：产品视频、幻灯片、图文轮播、博客文章，产出直接挂在卡片上，归档即验收。
- **Triage（Cloud 预览）**：从 Reddit、X、小红书等拉取用户反馈进入待分拣队列，可转成卡片或忽略。
- **Local 与 Cloud 看板**：本地 Markdown 看板随 git 走；Cloud 看板（邀请制预览）跨机器同步、浏览器可读。
- **通知**：需要决策时发送桌面或 Slack 通知。
- **Insights**：每日完成、新建、否决卡片的统计。
- **多看板与 CLI/skill**：一个仓库可放多块看板；所有按钮都有对应的 `akb` 命令和 skill 说法。
