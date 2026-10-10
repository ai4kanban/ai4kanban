# QA 手册索引

每个场景一个文件夹：`docs/qa/<module>/<case>/case.md`，证据（截图、GIF、日志）放在本机的 `.akb/qa/<module>/<case>/`，不进 git。这里列出各模块已有的场景、还没补写的模块，以及取证环境。

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
- [依赖卡归档或被否决后，等它的卡排上修订](skill/revise-the-cards-waiting-on-a-card-that-leaves/case.md)
- [周期 Agent 上一轮的待筛选条目还没处理，它照样按周期运行](skill/a-scheduled-agent-runs-while-its-last-items-wait-in-triage/case.md)
- [升级后，「用户文档」并入「文案与文档」，Coding 规划多出竞品调研和配图](skill/user-docs-folds-into-copy-and-docs-on-upgrade/case.md)
- [让 Agent 接入全局记忆](skill/give-an-agent-a-shared-global-memory/case.md)
- [在卡片聊天里请辅助 Agent：默认就地做，换了运行时的另开一次运行](skill/a-helper-on-another-runtime-runs-apart-from-the-card-chat/case.md)
- [QA 管理员跑一遍，场景进 git，证据留在本机](skill/qa-proof-stays-on-this-machine/case.md)
- [Claude Code 把命令放到后台后，继续聊天并等结论](skill/chat-while-claude-code-runs-a-background-task/case.md)

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
- [右键卡片里的图片，复制或下载它](local-ui/right-click-an-image-to-copy-or-download-it/case.md)
- [一键下载分镜的全部图片](local-ui/download-every-storyboard-image-in-one-zip/case.md)
- [在卡片上看一段循环播放的视频](local-ui/watch-a-looping-video-on-a-card/case.md)
- [新建一个全局记忆，让 Agent 接入它](local-ui/create-a-global-memory-and-let-an-agent-use-it/case.md)
- [在看板上读 QA 场景和它的截图](local-ui/read-qa-cases-and-their-evidence-on-the-board/case.md)
- [Agent 的后台任务还在跑时继续对话](local-ui/keep-chatting-while-a-background-task-runs/case.md)
- [在从讨论写成的卡片上展开「来自讨论」，开始聊这张卡](local-ui/chat-about-a-card-written-from-a-discussion/case.md)

已补写（2026-10-04）。桌面应用的安装和首次启动没有场景：取证会动到这台电脑上正在用的应用和它的看板。

### site

- [预约一次培训](site/book-a-training-session/case.md)
- [在定价页比较免费版和 Pro](site/compare-plans-on-the-pricing-page/case.md)
- [在官网下载桌面应用](site/download-the-desktop-app/case.md)
- [在隐私页查聊天回话会上报什么](site/read-what-usage-reporting-sends-for-a-chat-on-the-privacy-page/case.md)
- [在联系页发一条消息](site/send-a-message-from-the-contact-page/case.md)
- [切换官网语言](site/switch-the-site-language/case.md)
- [按主题浏览博客](site/browse-the-blog-by-topic/case.md)
- [在官网比较 AI4Kanban 和别的工具](site/compare-ai4kanban-with-another-tool/case.md)
- [读软件开发方案页](site/read-the-coding-workflow-page/case.md)

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

- [检查 main 上的 telemetry 改动是否已上线](telemetry/check-whether-telemetry-on-main-is-live/case.md)
- [在用量数据上查看聊天回合的次数和花费](telemetry/read-chat-turn-cost-on-the-numbers-page/case.md)
- [没有 Cloud 凭据时打开数据页](telemetry/open-the-numbers-page-without-cloud-credentials/case.md)
- [在数据页上按能力、按用户查看托管 AI 的成本](telemetry/read-ai-cost-per-user-on-the-numbers-page/case.md)
- [在命令行关掉、再打开用量上报](telemetry/turn-usage-reporting-off-from-the-command-line/case.md)
- [在 README 上看安装数徽章](telemetry/read-the-installs-badge-on-the-readme/case.md)

已补写（2026-10-10）。

### marketing

已补写，没有场景：这个模块是写在看板上的宣传工作本身（官网文案、帖子、邮件简报），不是产品功能；用户能碰到的退订、下载等页面都在 site。

## 待补写

没有。新模块加进 `modules.md` 后列在这里，每遍补写一个。

## 取证环境

- **临时项目和看板**：在 `/tmp` 下建临时 git 项目和临时看板，不碰本仓库的看板。
- **`akb`**：用仓库构建出的 `cli/dist/kanban.mjs`，并在 PATH 最前放一个同名的 `akb` shim——否则运行会用到已安装的旧版。用 `env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`。
- **替身 Agent**：要走规划、构建、续跑时，用 [stand-in.mjs](skill/chat-while-claude-code-runs-a-background-task/stand-in.mjs) 顶替真实 agent，不花钱。Claude Code 从 stdin 收提示词（#1540），从最后一个参数取提示词的旧替身认不出运行，重跑前照它改。
- **`kanban-ui`**：用 `KANBAN_BOARD_DIR`、`AI4KANBAN_HOME` 指向临时看板，并去掉环境里的 `KANBAN_DESKTOP`。几个 dev server 同时跑时各用一份 `kanban-ui` 拷贝：它们会轮流改写 `tsconfig.json`。
- **官网**：`web/node_modules` 软链到主检出，去掉 `__NEXT_PRIVATE_*`、`NEXT_DEPLOYMENT_ID`、`KANBAN_DESKTOP` 后 `next build`（拷到别处构建时连仓库根的 `VERSION` 一起拷），再用 `cloud/node_modules` 里的 wrangler `pages dev out`——`_redirects` 只在这样跑时生效；页面直连 `api.ai4kanban.dev` 的表单用用例目录里的 `api-stand-in.js` 顶替，不真的发信或占时段。
- **Cloud 看板网站**：`cloud-ui` 和 `kanban-ui` 的 `node_modules` 软链到主检出，`next dev`；登录、接口和结账用 [stand-in.mjs](cloud/sign-in-to-the-hosted-board/stand-in.mjs) 顶替，放在 `127.0.0.1` 上与网站跨站。
- **截图**：只截相关区域。
- **保密**：日志和截图里不出现密钥、账号和本机用户名路径。
