# QA 手册索引

每个场景一个文件夹：`docs/qa/<module>/<case>/case.md`，证据（截图、GIF、日志）放在本机的 `.akb/qa/<module>/<case>/`，不进 git。这里列出各模块已有的场景、还没补写的模块，以及取证环境。

## 场景

### skill

- [回答完卡片上最后一个问题，同一轮里细化到 ready](skill/a-card-is-refined-once-its-question-is-answered/case.md)
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
- [让对话 Agent 起一个常驻服务，回复结束后它跟着结束](skill/a-dev-server-the-chat-agent-starts-ends-with-its-reply/case.md)
- [规划一张纯文字卡片，看软件规划师画出示意图](skill/plan-a-text-only-card-and-get-an-explainer-diagram/case.md)
- [让博客策划写一篇博客的大纲，研究员先查资料、读排在前面的页面](skill/blog-planner-reads-the-top-pages-before-the-outline/case.md)
- [让软件规划师换用自己的 Agent 规划](skill/let-the-software-planner-plan-on-its-own-agent/case.md)
- [让文案 Agent 改两个页面：整页重写的给全文，只改一句的给 diff](skill/get-a-full-draft-for-a-rewrite-and-a-diff-for-a-small-edit/case.md)
- [请产品配图先画一张示意图，再做一段 canvas 动画预览](skill/ask-the-illustrator-for-an-image-and-a-canvas-animation/case.md)
- [卡片的 chat 正在回复时否决它](skill/reject-a-card-while-its-chat-is-replying/case.md)
- [批准博客大纲后，卡片上只留一个正文链接；回到大纲重来时，交付待办改回未勾选](skill/approve-a-blog-outline-and-the-card-keeps-only-the-article/case.md)
- [QA 管理员（或它的子运行）报出的条目，直接建成 Coding 卡](skill/a-qa-manager-item-becomes-a-coding-card/case.md)
- [建一张只点名竞品的卡，让竞品调研拿整个产品对比](skill/research-a-named-competitor-against-the-whole-product/case.md)
- [升级后，版本从看板上消失，卡片照常可读](skill/releases-leave-the-board-on-upgrade/case.md)
- [建一张要求「复用现有组件」的界面卡，规划照样请界面设计师出稿](skill/plan-a-card-that-reuses-a-component-and-still-get-a-ui-draft/case.md)
- [规划一份演示文稿：先看线框稿和样张，再拿到图片版 PPT](skill/see-wireframe-slides-before-the-styled-deck/case.md)
- [用「视频克隆」复刻一条程序化短片：先审原片拆解和复刻脚本，批准后拿到模板和对比](skill/clone-a-programmatic-video-into-a-template/case.md)
- [在命令行按标签找模板、看预览，再取回一个](skill/find-a-template-and-fetch-it-from-the-command-line/case.md)
- [在卡片上手写 `<Compare>`，让 `akb raw validate` 指出写错的地方](skill/write-a-compare-on-a-card-and-validate-it/case.md)
- [改版时给一张已规划好的卡加一张图，改版当场请配图画出来](skill/a-revision-that-adds-an-image-runs-the-illustrator/case.md)
- [复制「视频克隆」工作流，给它配一个执行 Agent，卡片规划完就能开发](skill/give-a-copied-video-clone-workflow-a-build-agent/case.md)
- [在命令行生成一张图和一段托管配乐](skill/generate-an-image-and-hosted-music-from-the-command-line/case.md)
- [在命令行把一张已有的卡换到另一个工作流](skill/switch-a-card-to-another-workflow/case.md)
- [在命令行从 Cloud 的道具库和动效库找到并取回一个，取回的动效单独就能跑](skill/find-a-prop-or-motion-in-the-cloud-library/case.md)
- [看工作流列表就知道一张卡该交给哪个工作流](skill/workflows-say-when-to-pick-them/case.md)
- [升级后，自建工作流变成看板里的 WORKFLOW.md；再手写一个](skill/keep-your-own-workflows-as-files-on-the-board/case.md)
- [升级后，改过社媒帖流程的看板自动加上「社媒帖配图」，关掉后不再加回](skill/a-customized-social-post-workflow-gets-the-illustrator-on-upgrade/case.md)
- [用 Codex 续聊一张卡，每条回复只记这一轮的费用；升级后旧记录自动改对](skill/a-resumed-codex-chat-costs-only-its-own-turn/case.md)
- [在卡片对话里要求改草稿，草稿当轮就改好；第二轮改卡也不再重读一遍](skill/ask-the-card-chat-to-change-a-draft-and-it-changes-the-draft/case.md)
- [发布一个不写 access 和 source 的模板，按 Pro、原创收进模板库](skill/publish-a-template-without-access-or-source/case.md)
- [给图文模板上传按顺序排好的多页展示，其中一页带实况视频](skill/upload-a-carousel-showcase-with-a-live-page/case.md)
- [不用 Git 工作树的卡片：交付只认这次新加的 Output 行](skill/a-files-delivery-counts-only-new-output-lines/case.md)
- [一篇博客同时发官网和 dev.to：两份稿子分开交付，dev.to 那份指回原文；下一篇照记下的去向走](skill/deliver-a-blog-post-to-the-site-and-dev-to-as-separate-copies/case.md)
- [从 ai4kanban 包换装 wildcrane 包](skill/switch-from-the-ai4kanban-package-to-wildcrane/case.md)

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
- [在卡片页按「执行」，而它的工作流负责人文件被看板拒用](local-ui/start-a-card-whose-workflow-lead-is-refused/case.md)
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
- [结束一段讨论，它的 Agent 和 Agent 起的进程一起停下](local-ui/end-a-discussion-and-its-agent-stops/case.md)
- [在卡片页上看软件规划师画的示意图](local-ui/see-an-explainer-diagram-on-a-card/case.md)
- [在卡片上看一份会动的样稿](local-ui/watch-a-scripted-mockup-move-on-a-card/case.md)
- [给工作流的规划者单独选一个运行时](local-ui/pick-a-runtime-for-a-workflow-planner/case.md)
- [放大卡片里的样稿和图片，看清小字](local-ui/zoom-a-mockup-or-image-on-a-card/case.md)
- [在「搁置」列里找出放了好几天没动的卡](local-ui/find-cards-untouched-for-days-in-the-stale-column/case.md)
- [卡片的对话还在回复时移除这张卡](local-ui/reject-a-card-while-its-chat-is-replying/case.md)
- [在卡片页把 Markdown 原稿当文章读，切换版本](local-ui/read-a-markdown-asset-as-an-article-on-a-card/case.md)
- [在归档页按交付时间或创建时间排序](local-ui/sort-the-archive-by-delivery-or-creation-time/case.md)
- [只在用键盘移动时看到聚焦框](local-ui/see-a-focus-frame-only-when-moving-by-keyboard/case.md)
- [升级后打开一个用过版本的旧看板](local-ui/open-a-board-that-used-releases-after-upgrading/case.md)
- [在配置里凭角色图认出每个内置 Agent](local-ui/tell-built-in-agents-apart-by-their-art/case.md)
- [找到「视频克隆」工作流，看它要什么](local-ui/find-the-video-clone-workflow/case.md)
- [在桌面应用的账单面板里恢复已取消的 Pro 续费](local-ui/resume-a-canceled-pro-renewal-in-the-desktop-app/case.md)
- [在卡片上把原片和复刻放在一起对比](local-ui/compare-a-source-and-its-clone-on-a-card/case.md)
- [点附件标签把它收起，再点展开](local-ui/collapse-an-asset-by-clicking-its-label/case.md)
- [做演示文稿：先看清交付的是图片版 PPT，再在卡片上直接翻 HTML 幻灯片](local-ui/see-html-slides-directly-in-the-storyboard/case.md)
- [给复制的「视频克隆」工作流设置执行 Agent，让卡片可以执行](local-ui/give-a-copied-video-clone-workflow-a-build-agent/case.md)
- [审视频复刻的两份分镜：一次看一镜，翻镜，收起](local-ui/review-two-storyboards-one-shot-at-a-time/case.md)
- [在卡片页看阶段走到哪一步，批准草稿进入下一阶段](local-ui/approve-a-stage-on-a-card/case.md)
- [视频复刻还没出片时，逐镜对照原片和复刻脚本](local-ui/compare-a-source-video-against-a-clone-script/case.md)
- [不登录 Cloud，也在铃铛里看到等你处理的卡片](local-ui/get-notified-without-signing-in/case.md)
- [不复制，直接给内置的「视频克隆」工作流设置或移除执行 Agent](local-ui/give-the-built-in-video-clone-workflow-a-build-agent/case.md)
- [在「配置 → 云端」看 Cloud 提供哪些托管 AI 能力，在「账单」看它们各花多少积分](local-ui/see-what-cloud-offers-in-settings/case.md)
- [在卡片页把一张卡换到另一个工作流](local-ui/switch-a-card-to-another-workflow/case.md)
- [在「博客文章」工作流里找到博客研究员，停用再启用它](local-ui/see-the-researcher-in-the-blog-workflow/case.md)
- [在「社媒帖」工作流里找到社媒帖配图，停用后它不再回来](local-ui/see-the-illustrator-in-the-social-post-workflow/case.md)
- [在运行办公室里看每个 Agent 穿着自己的职业装](local-ui/see-each-agent-in-its-own-outfit-in-the-runs-office/case.md)
- [在桌面应用的账单面板里先免费试用 Pro 7 天，试用结束后再购买](local-ui/start-a-pro-trial-in-the-desktop-billing-panel/case.md)
- [在卡片对话里提问，看回复一段段写出来](local-ui/ask-in-a-card-chat-and-watch-the-reply-arrive/case.md)
- [收起侧边栏，再只用键盘从搜索打开一张卡](local-ui/collapse-the-sidebar-and-find-a-card-by-keyboard/case.md)
- [从看板打开一张卡片页](local-ui/open-a-card-page-from-the-board/case.md)
- [扫过顶栏的按钮，打开再关上「运行历史」](local-ui/open-and-close-the-runs-dialog-from-the-header/case.md)
- [从「新想法」按钮或 N 键开始一段讨论](local-ui/start-a-discussion-from-new-idea-or-the-n-key/case.md)
- [在桌面应用的项目菜单里新建一个项目](local-ui/create-a-project-from-the-projects-menu/case.md)
- [在浏览器标签栏和看板左上角认出 WildCrane 的飞鹤](local-ui/see-the-crane-on-the-board-s-tab/case.md)
- [打开项目，skill 自动装好；只有出了问题，设置里才出现「安装」](local-ui/skill-is-installed-when-a-project-opens/case.md)
- [在桌面应用的配置里装上 akb 命令，照提示确认版本](local-ui/install-the-akb-command-from-settings-and-check-it/case.md)
- [在 macOS 深色和染色图标样式下认出 Dock 里的应用](local-ui/see-the-app-icon-in-dark-and-tinted-modes/case.md)

已补写（2026-10-04）。桌面应用的安装和首次启动没有场景：取证会动到这台电脑上正在用的应用和它的看板。

### site

- [预约一次培训](site/book-a-training-session/case.md)
- [在定价页比较免费版和 Pro](site/compare-plans-on-the-pricing-page/case.md)
- [在官网下载桌面应用](site/download-the-desktop-app/case.md)
- [在隐私页查聊天回话会上报什么](site/read-what-usage-reporting-sends-for-a-chat-on-the-privacy-page/case.md)
- [在联系页发一条消息](site/send-a-message-from-the-contact-page/case.md)
- [切换官网语言](site/switch-the-site-language/case.md)
- [按主题浏览博客](site/browse-the-blog-by-topic/case.md)
- [在官网比较 WildCrane 和别的工具](site/compare-ai4kanban-with-another-tool/case.md)
- [读软件开发方案页](site/read-the-coding-workflow-page/case.md)
- [读一篇带配图的博客文章](site/read-a-blog-post/case.md)
- [读创始人讲为什么做 WildCrane](site/read-why-tao-is-building-ai4kanban/case.md)
- [读官网首页](site/read-the-home-page/case.md)
- [读 SaaS 方案页](site/read-the-saas-solution-page/case.md)
- [在 /demo 走完一遍交互演示](site/walk-through-the-interactive-demo/case.md)
- [AI 从 llms.txt 找到文档页](site/read-the-docs-list-in-llms-txt/case.md)
- [读 Claude Code 介绍页，看先审草稿再交给 Claude Code 是怎么回事](site/read-the-claude-code-page/case.md)
- [读 Grill Me 介绍页，看一个大想法怎么拆卡、逐卡规划、按依赖交付](site/read-the-grill-me-page/case.md)
- [读 Codex 介绍页，看 WildCrane 在 Codex 之上多了什么](site/read-the-codex-page/case.md)
- [在官网模板目录里按分类浏览，看动效片段，复制一段提示词去 WildCrane 里用](site/browse-the-template-catalog/case.md)
- [打开已下架模板的旧链接，拿到真正的 404](site/open-a-retired-template-link/case.md)
- [在官网模板目录里看图文模板：先见骨架，再翻整套竖屏页面，动态页自己播放](site/browse-carousel-templates/case.md)
- [打开已停掉的 draft-first 旧链接，回到首页](site/open-an-old-draft-first-link/case.md)
- [在隐私页查官网在浏览器里存了什么，再对照浏览器](site/read-what-the-site-keeps-in-your-browser-on-the-privacy-page/case.md)
- [打开旧的 ai4kanban.dev 链接，落到 wildcrane.ai 的同一页](site/open-an-old-ai4kanban-dev-link/case.md)

### docs

- [从文档首页找到并读完「The daily loop」](docs/find-and-read-the-daily-loop-from-the-docs-home/case.md)
- [在文档页之间跳转](docs/move-between-docs-pages/case.md)
- [在文档里查 QA 手册是怎么维护的](docs/read-how-the-qa-manual-is-kept-in-the-docs/case.md)
- [在文档里查怎么让一个 Agent 定期运行](docs/read-how-to-run-an-agent-on-a-schedule-in-the-docs/case.md)
- [在文档里查待筛选条目从哪来、怎么分拣](docs/read-how-triage-sorts-an-item-in-the-docs/case.md)
- [在文档里查看板自带哪些 Agent、各自做什么](docs/read-the-agents-the-board-ships-in-the-docs/case.md)
- [在文档里查怎么在对话里讨论想法、改卡片](docs/read-how-to-discuss-a-card-in-the-docs/case.md)
- [在文档里查怎么接入编码工具、给每个 Agent 选运行时](docs/set-up-a-runtime-for-each-agent-from-the-docs/case.md)
- [在文档里查否决一张卡时写的原因去了哪里](docs/read-what-happens-to-a-rejection-reason-in-the-docs/case.md)
- [跟着「Your first card」把第一张卡从想法走到交付](docs/follow-your-first-card-from-idea-to-delivery/case.md)
- [在文档里查规划时会出哪些草稿、怎么改、怎么批准](docs/review-drafts-before-a-build-in-the-docs/case.md)
- [在文档里查 Agent 记住了什么、记忆怎么保持最新](docs/read-how-agents-remember-your-preferences-in-the-docs/case.md)
- [在文档里查任务用哪个工作流、怎么自定义工作流](docs/read-which-workflow-a-task-uses-in-the-docs/case.md)
- [在文档里查怎么看、停、续跑一次运行，以及给 Agent 换运行时](docs/watch-stop-and-resume-a-run-from-the-docs/case.md)
- [在文档里查交付后的跟进建议从哪来、怎么调](docs/read-follow-up-suggestions-in-the-docs/case.md)

### cloud

- [在浏览器里登录 Cloud 看板](cloud/sign-in-to-the-hosted-board/case.md)
- [在浏览器里打开一个工作区的看板](cloud/open-a-workspace-board/case.md)
- [在 Cloud 看板网站查看套餐并购买 Pro](cloud/check-your-plan-and-subscription/case.md)
- [在浏览器里退出 Cloud 看板](cloud/sign-out-of-the-hosted-board/case.md)
- [在 Cloud 看板上，删掉的归档卡片带走它已结束的交付记录](cloud/deleted-archived-cards-take-their-deliveries-with-them/case.md)
- [在 Cloud 看板上，子卡仍在推进的分组不进「搁置」列](cloud/a-group-stays-off-stale-while-a-subtask-moves/case.md)
- [在 Cloud 看板网站恢复已取消的 Pro 续费](cloud/resume-a-canceled-pro-renewal/case.md)
- [登录后在模板库按标签找模板，预览后取回](cloud/find-preview-and-fetch-a-shared-template/case.md)
- [用 `akb cloud image` 生成一张图像](cloud/generate-an-image-with-cloud/case.md)
- [用 `akb cloud music` 生成一段托管配乐](cloud/generate-music-with-cloud/case.md)
- [维护者给已发布的模板登记展示资料（含图文的整套页面），官网不登录就能读到目录](cloud/register-a-template-showcase-for-the-public-catalog/case.md)
- [模板默认是 Pro：免费账号只能取到维护者明确发布为免费的模板](cloud/templates-are-pro-unless-published-free/case.md)
- [在 Cloud 看板网站开始 7 天 Pro 试用，试用中不能购买，已试用过的不能再开](cloud/start-a-pro-trial-on-the-hosted-board/case.md)

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
- **`akb`**：用仓库构建出的 `cli/dist/kanban.mjs`（拷到别处构建时连 `skill/` 一起拷），并在 PATH 最前放一个同名的 `akb` shim——否则运行会用到已安装的旧版；shim 指向的 `bin/ai4kanban.mjs` 要有执行权限，否则静默退回旧版。用 `env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；跑真实 Claude Code 时再带上 `http_proxy`/`https_proxy`，否则 403。
- **替身 Agent**：要走规划、构建、续跑时，用 [stand-in.mjs](skill/chat-while-claude-code-runs-a-background-task/stand-in.mjs) 顶替真实 agent，不花钱。Claude Code 从 stdin 收提示词（#1540），从最后一个参数取提示词的旧替身认不出运行，重跑前照它改。
- **`kanban-ui`**：用 `KANBAN_BOARD_DIR`、`AI4KANBAN_HOME` 指向临时看板，并去掉环境里的 `KANBAN_DESKTOP`。几个 dev server 同时跑时各用一份 `kanban-ui` 拷贝：它们会轮流改写 `tsconfig.json`。
- **官网**：`web/node_modules` 软链到主检出，去掉 `__NEXT_PRIVATE_*`、`NEXT_DEPLOYMENT_ID`、`KANBAN_DESKTOP` 后 `next build`（拷到别处构建时连仓库根的 `VERSION`、`telemetry/contract.ts` 和 `kanban-ui/` 一起拷，从 `/private/tmp/...` 构建，并把 `web/node_modules/ai4kanban-ui` 指向这份 `kanban-ui`——否则 `/demo` 读到主检出的 `kanban-ui`，报 `Can't resolve '@/…'`），再用 `cloud/node_modules` 里的 wrangler `pages dev out`——`_redirects` 只在这样跑时生效；页面直连 `api.ai4kanban.dev` 的表单用用例目录里的 `api-stand-in.js` 顶替，不真的发信或占时段。
- **Cloud 看板网站**：`cloud-ui` 和 `kanban-ui` 的 `node_modules` 软链到主检出，`next dev`；登录、接口和结账用 [stand-in.mjs](cloud/sign-in-to-the-hosted-board/stand-in.mjs) 顶替，放在 `127.0.0.1` 上与网站跨站。
- **截图**：只截相关区域。
- **出网请求**：取证脚本里 Node 的 `fetch` 要带 `NODE_USE_ENV_PROXY=1` 才走代理，否则请求 GitHub 等外站会一直挂着。
- **保密**：日志和截图里不出现密钥、账号和本机用户名路径。
