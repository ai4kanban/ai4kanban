# Project

What the project is today, from its users' side. Rewritten whole by `akb describe-project`;
edits here do not last.

## What it is

AI4Kanban 是一个 AI 项目经理：用看板组织你的 coding agent，把模糊想法变成明确的卡片，派给 agent 规划、构建、落地，只把需要你拍板的决策和待验收的结果带给你。提供 macOS / Windows / Linux 桌面应用（内含 `akb` 命令行和 agent skill），看板默认是仓库里 `docs/kanban/` 下的 Markdown 文件。

## Who it is for

- **独立开发者和小团队**：想同时驱动多个 AI agent、承接更大项目的人。
- **已在用 coding agent 的开发者**：Claude Code、Codex、Cursor 等用户，使用自己的订阅，无额外 token 费用。

## Problems it solves

- **agent 需要人盯**：分派任务、跟进进度、审阅产出占满一天；看板替你协调，只在需要决策时通知你。
- **需求不清就写错代码**：先循环澄清、拆解，agent 能自己回答的就自己定，只留 2–3 个真正需要你判断的问题。
- **决策不留痕**：每次决策和否决都记入项目记忆，后续规划沿用，不再重复提出被否掉的想法。
- **用户反馈散落各处**：外部线索和做完卡片后的后续工作汇进同一个待分拣队列，逐条变成卡片或忽略。

## Features

- **看板与卡片**：一个想法一张卡，按优先级、ROI、依赖和 release 排序；"下一步做什么"直接给出推荐。
- **Refine / Resolve**：自动规划所有可规划的卡片，由规划 agent 判断何时就绪；太大就拆成子任务，把开放问题留给你回答。
- **一键构建（Build）**：总在独立会话和 worktree 里构建，作为一次提交落到当前分支并自动归档；有开放问题的卡在落地前等你回答；也支持手动提交模式；卡片的 Diff 标签显示改动，构建中也能看到尚未提交的部分。
- **QA 手册**：每次构建后按模块并行更新 `docs/qa/` 里受影响的测试用例，每一步附截图或日志为证，用例可在看板里查看，用例下的反馈可一键送进 Triage。
- **Chat**：在终端或应用里就整个看板或某张卡对话，结论可直接改卡或拆成新卡；每轮回复显示自身的花费；退出时被打断的回复可重新发送。
- **Runs**：后台运行 agent，可查看日志、停止、续跑、重试，并显示每次运行自身的成本、token 和模型。
- **8 种 coding agent**：Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness、ZCode、Grok Build，可为每个 agent 单独选工具和模型。
- **Releases**：按目标规划版本、自动填卡，关闭时生成 changelog。
- **项目记忆**：决策、否决、重设计按模块记录，模块长大后记忆自动拆分；归档卡片的对话会被回收进记忆，定期精简。
- **内置 agent**：复盘已完成的卡片并建议后续工作（小修复可选直接做、先问我或不建议），已上线的改动让某张未完成卡片的计划失效时自动修订它；精简记忆、在同一次复盘里从移除卡片和忽略线索的理由中学习偏好、自动更新项目描述。
- **定时 agent**：工作流可按固定频率或默认的 Auto（有新输入时）自动运行 agent，并显示它为何还在等待；关闭后仍可手动启动。
- **Specialists**：文案、UI 设计稿、技术选型、提示词、邮件、用户文档等专项 agent，各写卡片的一节，供你确认后由构建写入。
- **工作流与自定义 agent**：每个工作流分 Plan 和 Execute 两段，各有负责人；规划时可调用自建的规划助手；可自建工作流和 agent，并给任一 agent 写一段自己的规则。
- **内容工作流（Pro）**：产品视频、幻灯片、图文轮播、博客文章，在规划阶段产出并挂在卡片上，归档即验收；托管配音和生图消耗每月 AI credits。
- **Triage**：Proposer 的建议、规划和构建途中发现的后续工作，以及你用 `akb triage add` 从 Reddit、小红书等处送来的反馈，都进入待分拣队列，逐条 Make card、Start now、Discuss 或 Ignore，并显示每条来自哪个 agent 或来源；未处理条数以红色角标显示在顶栏；Auto-sort 需 Pro。
- **移除与归档**：被移除的卡连同理由留在归档里；归档卡片 30 天后自动清理。
- **Local 与 Cloud 看板**：本地 Markdown 看板随 git 走；Cloud 看板（邀请制预览）跨机器同步，浏览器和手机上可读。
- **通知**：需要决策时发送桌面或 Slack 通知；达成里程碑时庆祝一次。
- **Insights**：每日完成、新建、否决卡片的统计。
- **欢迎导览**：新看板首次打开时展示一组导览卡片，可从设置或 Help 菜单重新打开。
- **多看板与 CLI/skill**：一个仓库可放多块看板；所有按钮都有对应的 `akb` 命令和 skill 说法。
