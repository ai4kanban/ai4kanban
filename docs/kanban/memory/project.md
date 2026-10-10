# Project

What the project is today, from its users' side. Rewritten whole by `akb describe-project`;
edits here do not last.

## What it is

AI4Kanban 是一个 AI 项目经理：用看板组织你的 coding agent，同时推进更多工作。agent 先把需要你拍板的部分（设计稿、文案、提示词等）做成草稿给你审，方向定了再构建落地；它们还会记住你的偏好、建议后续工作。提供 macOS / Windows / Linux 桌面应用（内含 `akb` 命令行和 agent skill），看板默认是仓库里 `docs/kanban/` 下的 Markdown 文件。

## Who it is for

- **独立开发者和小团队**：想同时驱动多个 AI agent、承接更大项目的人。
- **已在用 coding agent 的开发者**：Claude Code、Codex、Cursor 等用户，使用自己的订阅，无额外 token 费用。

## Problems it solves

- **规划跟不上执行**：agent 越做越快，瓶颈变成人来不及想清需求、定方向；草稿先审让你只看关键处。
- **agent 需要人盯**：分派、跟进、审阅占满一天；看板替你协调，只在需要决策时通知你。
- **需求不清就写错代码**：先循环澄清、拆解，agent 能定的自己定，只留 2–3 个真正需要你判断的问题。
- **决策不留痕**：决策和否决记入项目记忆，后续规划沿用，不再重提被否掉的想法。
- **反馈散落各处**：外部线索和完工后的后续工作汇进同一个待分拣队列，逐条变卡片或忽略。

## Features

- **看板与卡片**：一个想法一张卡，按优先级、ROI、依赖和 release 排序；"下一步做什么"直接给出推荐。
- **Refine / Resolve**：自动规划可规划的卡片，太大就拆成子任务，把开放问题留给你回答。
- **一键构建（Build）**：在独立会话和 worktree 里并行构建，冲突自动处理，作为一次提交落到当前分支并自动归档；也支持手动提交；Diff 标签显示改动，构建中也能看到未提交部分。
- **QA 手册**：质检 agent 从用户角度测试近期改动，每次构建后更新 `docs/qa/` 里受影响的测试用例，每步附截图或日志为证（只存本机），用例下的反馈可一键送进 Triage。
- **Chat**：就整个看板或某张卡对话，结论可直接改卡或拆成新卡；每轮显示花费，被退出打断的回复可重发。
- **Runs**：后台运行 agent，可看日志、停止、续跑、重试，显示每次运行的成本、token 和模型。
- **8 种 coding agent**：Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness、ZCode、Grok Build，每个 agent 可单独选工具和模型。
- **Releases**：按目标规划版本、自动填卡，关闭时生成 changelog。
- **项目记忆**：决策、否决、重设计按模块记录，模块长大后自动拆分；归档卡片的对话回收进记忆并定期精简；全局记忆（如内置的竞品库）可供多个 agent 共用。
- **内置 agent**：复盘完成的卡片并建议后续工作，已上线改动或被移除的前置卡让未完成卡片的计划失效时自动修订；从移除和忽略的理由中学习偏好，自动更新项目描述。
- **定时 agent**：按固定频率或默认的 Auto（有新输入时）自动运行，并显示为何还在等待；也可随时手动启动。
- **草稿先审（Specialists）**：文案（含用户文档）、UI 设计稿、产品配图、竞品调研、技术选型、提示词、邮件等专项 agent，默认在卡片对话里运行，各写卡片的一节；大改动分阶段出草稿（如先大纲后全文），每阶段你确认后才继续，最后由构建写入。
- **工作流与自定义 agent**：工作流分 Plan 和 Execute 两段；可自建工作流、agent 和规划助手，并给任一 agent 加自己的规则。
- **内容工作流（Pro）**：产品视频、幻灯片、图文轮播（可一键下载全部图片）、博客文章，挂在卡片上，归档即验收；托管配音和生图消耗每月 AI credits。
- **Triage**：Proposer 的建议、途中发现的后续工作，以及用 `akb triage add` 送来的外部反馈，进入待分拣队列，逐条 Make card、Start now、Discuss 或 Ignore；顶栏红色角标显示未处理条数；Auto-sort 需 Pro。
- **移除与归档**：被移除的卡连同理由留在归档里；归档卡片 30 天后自动清理。
- **Local 与 Cloud 看板**：本地 Markdown 看板随 git 走；Cloud 看板（邀请制预览）跨机器同步，浏览器和手机上可读。
- **通知**：需要决策时发送桌面或 Slack 通知；达成里程碑时庆祝一次。
- **Insights**：每日完成、新建、否决卡片的统计。
- **Markdown 图片**：卡片和文档里的图片可放大预览，右键复制或下载。
- **欢迎导览**：新看板首次打开时展示导览卡片，可从设置或 Help 菜单重新打开。
- **多看板与 CLI/skill**：一个仓库可放多块看板；所有按钮都有对应的 `akb` 命令和 skill 说法。
