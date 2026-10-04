# QA 手册索引

每个场景一个文件夹：`docs/qa/<module>/<case>/case.md`，证据放在它旁边。这里列出各模块已有的场景、还没补写的模块，以及取证环境。

## 场景

### skill

- [回答完卡片上最后一个问题，等看板自己细化它](skill/a-card-is-refined-once-its-question-is-answered/case.md)
- [在不是 git 仓库的项目里，靠归档卡片而不是新提交让周期 Agent 运行](skill/a-finished-card-not-a-commit-starts-a-scheduled-agent/case.md)
- [往待筛选里加一条，忽略它，再恢复](skill/add-ignore-and-restore-a-triage-item/case.md)
- [回答卡片的问题，然后让看板把它做完](skill/answer-a-card-then-build-it/case.md)
- [让一张卡等另一张卡，并被拒绝循环依赖](skill/block-a-card-on-another-and-refuse-a-cycle/case.md)
- [建一张卡，让看板把它规划好](skill/create-a-card-and-let-it-plan/case.md)
- [升级后查看 QA 管理员从「执行之后」搬到了哪里](skill/find-the-qa-manager-on-a-schedule-after-upgrading/case.md)
- [在新项目里装好看板](skill/install-a-board-in-a-new-project/case.md)
- [卡片落地后，把 QA 的活留给开着的 QA 管理员](skill/leave-qa-work-to-the-qa-manager-after-a-card-lands/case.md)
- [列出某个时间以来落地的卡片](skill/list-the-cards-that-landed-since-a-time/case.md)
- [对话 Agent 还在跑命令时退出看板](skill/quit-the-board-while-a-chat-agent-is-running-commands/case.md)
- [升级后，周期任务卡变成定期运行的 Agent](skill/recurring-cards-become-scheduled-agents-on-update/case.md)
- [带着原因否决一张卡](skill/reject-a-card-with-a-reason/case.md)
- [用命令行让工作流里的一个 Agent 按周期自己运行](skill/run-a-workflow-agent-on-a-schedule/case.md)
- [查看并切换运行看板的 Agent](skill/see-and-switch-the-agent-that-runs-the-board/case.md)
- [查看、停止并继续一次运行](skill/see-stop-and-resume-a-run/case.md)
- [在命令行开始一张卡，而它的工作流负责人文件被看板拒用](skill/start-a-card-whose-workflow-lead-is-refused/case.md)
- [在 Cloud 看板上等没有归档日期的旧卡片满 30 天被清掉](skill/undated-archived-cards-expire-on-a-cloud-board/case.md)

### local-ui

- [手动归档今天的第一张卡，看到欢呼](local-ui/archive-a-card-by-hand-and-see-the-cheer/case.md)
- [在工作流的 Agent 列表里新建一个 Agent](local-ui/create-an-agent-in-the-workflow-agent-list/case.md)
- [移除一张卡时决定写不写原因](local-ui/decide-whether-to-give-a-reason-when-rejecting-a-card/case.md)
- [升级后在「工作流」里找到原来的周期任务卡](local-ui/find-your-recurring-cards-under-workflows-after-upgrading/case.md)
- [翻看欢迎导览](local-ui/flip-through-the-welcome-tour/case.md)
- [打开待筛选，看条目是谁写的，再回到原来的页面](local-ui/open-triage-and-see-who-added-an-item/case.md)
- [在手机看板上读卡片标记的提示气泡](local-ui/read-a-card-mark-tooltip-on-the-phone-board/case.md)
- [在触屏上点一下读提示气泡](local-ui/read-a-tooltip-by-tapping-on-a-touch-screen/case.md)
- [在归档里读一张被否决的卡的原因](local-ui/read-the-rejection-reason-on-an-archived-card/case.md)
- [在卡片页读一次交付到了哪一步、为什么停下](local-ui/read-where-a-delivery-stands-on-the-card-page/case.md)
- [在讨论里看它写成的卡片哪些已经完成](local-ui/see-which-cards-a-discussion-became-are-done/case.md)
- [在工作流里让一个 Agent 定期运行](local-ui/set-a-workflow-agent-to-run-on-a-schedule/case.md)
- [看板自带的 Agent 在「自动」下多久跑一次](local-ui/see-when-the-board-s-own-agents-run-on-auto/case.md)
- [在卡片页按「开发」，而它的工作流负责人文件被看板拒用](local-ui/start-a-card-whose-workflow-lead-is-refused/case.md)
- [切换看板界面的语言](local-ui/switch-the-board-language/case.md)
- [在看板上把一个想法变成卡片](local-ui/turn-an-idea-into-a-card-on-the-board/case.md)
- [在执行中的卡片上看「差异」，合入后在归档页再看一次](local-ui/watch-a-building-card-s-changes-in-the-diff-tab/case.md)

已补写（2026-10-04）。桌面应用的安装和首次启动没有场景：取证会动到这台电脑上正在用的应用和它的看板。

### site

- [预约一次培训](site/book-a-training-session/case.md)
- [在定价页比较免费版和 Pro](site/compare-plans-on-the-pricing-page/case.md)
- [在官网下载桌面应用](site/download-the-desktop-app/case.md)
- [在隐私页查聊天回话会上报什么](site/read-what-usage-reporting-sends-for-a-chat-on-the-privacy-page/case.md)
- [在联系页发一条消息](site/send-a-message-from-the-contact-page/case.md)
- [切换官网语言](site/switch-the-site-language/case.md)

### docs

- [从文档首页找到并读完「The daily loop」](docs/find-and-read-the-daily-loop-from-the-docs-home/case.md)
- [在文档页之间跳转](docs/move-between-docs-pages/case.md)
- [在文档里查 QA 手册是怎么维护的](docs/read-how-the-qa-manual-is-kept-in-the-docs/case.md)
- [在文档里查怎么让一个 Agent 定期运行](docs/read-how-to-run-an-agent-on-a-schedule-in-the-docs/case.md)
- [在文档里查待筛选条目从哪来、怎么分拣](docs/read-how-triage-sorts-an-item-in-the-docs/case.md)
- [在文档里查看板自带哪些 Agent、各自做什么](docs/read-the-agents-the-board-ships-in-the-docs/case.md)
- [在文档里查否决一张卡时写的原因去了哪里](docs/read-what-happens-to-a-rejection-reason-in-the-docs/case.md)

### cloud

- [在浏览器里登录 Cloud 看板](cloud/sign-in-to-the-hosted-board/case.md)
- [在浏览器里打开一个工作区的看板](cloud/open-a-workspace-board/case.md)
- [在 Cloud 看板网站查看套餐并购买 Pro](cloud/check-your-plan-and-subscription/case.md)
- [在浏览器里退出 Cloud 看板](cloud/sign-out-of-the-hosted-board/case.md)
- [在 Cloud 看板上，删掉的归档卡片带走它已结束的交付记录](cloud/deleted-archived-cards-take-their-deliveries-with-them/case.md)

### telemetry

待补写。

- [检查 main 上的 telemetry 改动是否已上线](telemetry/check-whether-telemetry-on-main-is-live/case.md)
- [在用量数据上查看聊天回合的次数和花费](telemetry/read-chat-turn-cost-on-the-numbers-page/case.md)
- [没有 Cloud 凭据时打开数据页](telemetry/open-the-numbers-page-without-cloud-credentials/case.md)
- [在数据页上按能力、按用户查看托管 AI 的成本](telemetry/read-ai-cost-per-user-on-the-numbers-page/case.md)

### marketing

已补写，没有场景：这个模块是写在看板上的宣传工作本身（官网文案、帖子、邮件简报），不是产品功能；用户能碰到的退订、下载等页面都在 site。

## 待补写

每遍补写一个模块：写出下面的场景，真实走一遍并取证，然后把它从这里删掉，并去掉上面该模块的「待补写」。

- **telemetry**：不预定场景，补写时从真实产品里选；没有用户会操作的行为时，标为已补写并写明原因。

## 取证环境

- **临时项目和看板**：在 `/tmp` 下建临时 git 项目和临时看板，不碰本仓库的看板。
- **`akb`**：用仓库构建出的 `cli/dist/kanban.mjs`，并在 PATH 最前放一个同名的 `akb` shim——否则运行会用到已安装的旧版。用 `env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`。
- **替身 Agent**：要走规划、构建、续跑时，用 [stand-in.mjs](skill/create-a-card-and-let-it-plan/stand-in.mjs) 顶替真实 agent，不花钱。
- **`kanban-ui`**：用 `KANBAN_BOARD_DIR`、`AI4KANBAN_HOME` 指向临时看板，并去掉环境里的 `KANBAN_DESKTOP`。
- **官网**：`web/node_modules` 软链到主检出，去掉 `__NEXT_PRIVATE_*`、`NEXT_DEPLOYMENT_ID`、`KANBAN_DESKTOP` 后 `next dev`；页面直连 `api.ai4kanban.dev` 的表单用用例目录里的 `api-stand-in.js` 顶替，不真的发信或占时段。
- **Cloud 看板网站**：`cloud-ui` 和 `kanban-ui` 的 `node_modules` 软链到主检出，`next dev`；登录、接口和结账用 [stand-in.mjs](cloud/sign-in-to-the-hosted-board/stand-in.mjs) 顶替，放在 `127.0.0.1` 上与网站跨站。
- **截图**：只截相关区域。
- **保密**：日志和截图里不出现密钥、账号和本机用户名路径。
