# QA 手册索引

每个场景一个文件夹：`docs/qa/<module>/<case>/case.md`，证据放在它旁边。这里列出各模块已有的场景、还没补写的模块，以及取证环境。

## 场景

### skill

- [回答完卡片上最后一个问题，等看板自己细化它](skill/a-card-is-refined-once-its-question-is-answered/case.md)
- [往待筛选里加一条，忽略它，再恢复](skill/add-ignore-and-restore-a-triage-item/case.md)
- [回答卡片的问题，然后让看板把它做完](skill/answer-a-card-then-build-it/case.md)
- [让一张卡等另一张卡，并被拒绝循环依赖](skill/block-a-card-on-another-and-refuse-a-cycle/case.md)
- [建一张卡，让看板把它规划好](skill/create-a-card-and-let-it-plan/case.md)
- [升级后查看 QA 管理员从「执行之后」搬到了哪里](skill/find-the-qa-manager-on-a-schedule-after-upgrading/case.md)
- [在新项目里装好看板](skill/install-a-board-in-a-new-project/case.md)
- [列出某个时间以来落地的卡片](skill/list-the-cards-that-landed-since-a-time/case.md)
- [对话 Agent 还在跑命令时退出看板](skill/quit-the-board-while-a-chat-agent-is-running-commands/case.md)
- [带着原因否决一张卡](skill/reject-a-card-with-a-reason/case.md)
- [用命令行让工作流里的一个 Agent 按周期自己运行](skill/run-a-workflow-agent-on-a-schedule/case.md)
- [查看并切换运行看板的 Agent](skill/see-and-switch-the-agent-that-runs-the-board/case.md)
- [查看、停止并继续一次运行](skill/see-stop-and-resume-a-run/case.md)
- [在命令行开始一张卡，而它的工作流负责人文件被看板拒用](skill/start-a-card-whose-workflow-lead-is-refused/case.md)
- [在 Cloud 看板上等没有归档日期的旧卡片满 30 天被清掉](skill/undated-archived-cards-expire-on-a-cloud-board/case.md)

### local-ui

待补写。

- [在工作流的 Agent 列表里新建一个 Agent](local-ui/create-an-agent-in-the-workflow-agent-list/case.md)
- [移除一张卡时决定写不写原因](local-ui/decide-whether-to-give-a-reason-when-rejecting-a-card/case.md)
- [在手机看板上读卡片标记的提示气泡](local-ui/read-a-card-mark-tooltip-on-the-phone-board/case.md)
- [在触屏上点一下读提示气泡](local-ui/read-a-tooltip-by-tapping-on-a-touch-screen/case.md)
- [在归档里读一张被否决的卡的原因](local-ui/read-the-rejection-reason-on-an-archived-card/case.md)
- [在卡片页读一次交付到了哪一步、为什么停下](local-ui/read-where-a-delivery-stands-on-the-card-page/case.md)
- [在工作流里让一个 Agent 定期运行](local-ui/set-a-workflow-agent-to-run-on-a-schedule/case.md)
- [在卡片页按「开发」，而它的工作流负责人文件被看板拒用](local-ui/start-a-card-whose-workflow-lead-is-refused/case.md)

### site

待补写。

- [在隐私页查聊天回话会上报什么](site/read-what-usage-reporting-sends-for-a-chat-on-the-privacy-page/case.md)

### docs

- [从文档首页找到并读完「The daily loop」](docs/find-and-read-the-daily-loop-from-the-docs-home/case.md)
- [在文档页之间跳转](docs/move-between-docs-pages/case.md)
- [在文档里查 QA 手册是怎么维护的](docs/read-how-the-qa-manual-is-kept-in-the-docs/case.md)
- [在文档里查怎么让一个 Agent 定期运行](docs/read-how-to-run-an-agent-on-a-schedule-in-the-docs/case.md)
- [在文档里查否决一张卡时写的原因去了哪里](docs/read-what-happens-to-a-rejection-reason-in-the-docs/case.md)

### cloud

待补写。还没有场景。

### telemetry

待补写。

- [检查 main 上的 telemetry 改动是否已上线](telemetry/check-whether-telemetry-on-main-is-live/case.md)
- [在用量数据上查看聊天回合的次数和花费](telemetry/read-chat-turn-cost-on-the-numbers-page/case.md)
- [没有 Cloud 凭据时打开数据页](telemetry/open-the-numbers-page-without-cloud-credentials/case.md)
- [在数据页上按能力、按用户查看托管 AI 的成本](telemetry/read-ai-cost-per-user-on-the-numbers-page/case.md)

### marketing

待补写。还没有场景。

## 待补写

每遍补写一个模块：写出下面的场景，真实走一遍并取证，然后把它从这里删掉，并去掉上面该模块的「待补写」。

- **local-ui**（浏览器里的本地看板）
  - 首次打开一个没有看板的项目并完成设置
  - 新建任务，看到它出现在看板上
  - 在卡片页回答问题
  - 一键实现，并查看交付的改动
  - 在 Runs 里看日志、停止、继续
  - 在卡片对话里提问
  - 在待筛选里建卡、忽略、恢复
  - 切换界面语言
- **local-ui**（桌面应用）
  - 安装并首次启动
  - 打开一个项目的看板
- **site**（官网）
  - 下载
  - 查看定价
  - 提交联系表单
  - 预约培训
  - 切换语言
- **cloud**（Cloud 看板）
  - 登录
  - 打开工作区的看板
  - 查看账单与订阅
  - 退出登录
- **telemetry**、**marketing**：不预定场景，补写时从真实产品里选；没有用户会操作的行为时，标为已补写并写明原因。

## 取证环境

- **临时项目和看板**：在 `/tmp` 下建临时 git 项目和临时看板，不碰本仓库的看板。
- **`akb`**：用仓库构建出的 `cli/dist/kanban.mjs`，并在 PATH 最前放一个同名的 `akb` shim——否则运行会用到已安装的旧版。用 `env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`。
- **替身 Agent**：要走规划、构建、续跑时，用 [stand-in.mjs](skill/create-a-card-and-let-it-plan/stand-in.mjs) 顶替真实 agent，不花钱。
- **`kanban-ui`**：用 `KANBAN_BOARD_DIR`、`AI4KANBAN_HOME` 指向临时看板，并去掉环境里的 `KANBAN_DESKTOP`。
- **截图**：只截相关区域。
- **保密**：日志和截图里不出现密钥、账号和本机用户名路径。
