# QA 手册

每个用例一个文件夹：`docs/qa/<module>/<case>/case.md`。证据不进 git，存在项目的
`.akb/qa/<module>/<case>/` 下，用例里按文件名引用。

## skill

- [在新项目里安装看板](skill/install-board/case.md)
- [让编码代理能驱动看板](skill/install-agent-skill/case.md)
- [用一句话建卡](skill/create-card/case.md)
- [让代理用中文回复和写卡](skill/reply-in-my-language/case.md)
- [构建一张卡并跟随到落地](skill/follow-delivery-until-landed/case.md)
- [用命令行按档次生成图片](skill/generate-image-by-tier/case.md)
- [在 Runner 管理的项目里用命令行批准任务](skill/approve-on-runner-board/case.md)
- [用命令行按语言和档次生成配音](skill/generate-narration-by-tier/case.md)
- [用 DO_NOT_TRACK 关掉用量上报](skill/stop-usage-with-do-not-track/case.md)
- [同一个 Agent 装了多份时，看板自动用最新能启动的一份](skill/use-newest-agent-copy/case.md)
- [指定 Agent 的版本，不被更新的副本替换](skill/pin-agent-copy/case.md)

## cloud

- [查看价格并选择方案](cloud/view-pricing/case.md)
- [未登录调用公开 API](cloud/call-api-signed-out/case.md)
- [打开分享出来的卡片链接](cloud/open-card-link/case.md)
- [在任务对话里看每条回复花了多少钱](cloud/reply-cost/case.md)
- [按模型查看工作区的用量和费用](cloud/usage-by-model/case.md)
- [看任务正在创建、细化还是执行](cloud/run-step/case.md)
- [按档次生成图片](cloud/image-tiers/case.md)
- [在命令行改了卡片，网页上的任务跟着变](cloud/board-follows-cards/case.md)
- [看任务是谁创建的](cloud/card-creator/case.md)
- [对话列表只放你亲自聊过的任务](cloud/chats-you-wrote/case.md)
- [丢弃一次执行，保留任务](cloud/discard-build/case.md)
- [按语言和档次生成配音](cloud/narration-tiers/case.md)
- [移除一个没结束的任务，再恢复它](cloud/remove-and-restore/case.md)

## review

- [分享审核链接并管理谁能打开](review/share-review-link/case.md)
- [受邀审核人登录并评论](review/sign-in-invited-link/case.md)
- [确认或移除等审核的任务](review/decide-review/case.md)
- [打开不完整或失效的审核链接](review/open-broken-link/case.md)
- [按段阅读任务的预览](review/read-previews/case.md)
- [在任务页和 AI 讨论任务](review/chat-with-ai/case.md)
- [评论写到一半刷新页面](review/draft-comment/case.md)
- [打开带待答问题的任务页](review/open-question-link/case.md)
- [切换任务页的语言](review/switch-language/case.md)
- [在已结束任务的审核页和 AI 讨论](review/chat-on-ended-task/case.md)
- [工作区成员打开分享链接](review/member-opens-link/case.md)

## web

- [第一次打开 WildCrane Web](web/first-visit/case.md)
- [从首页一句话开始一个任务](web/start-from-home/case.md)
- [在看板上找到待审核的任务并开始执行](web/review-on-board/case.md)
- [跳过方案直接构建一个想法](web/build-now/case.md)
- [查看工作流里有哪些角色](web/workflow-roles/case.md)
- [在任务页查看卡片里的预览](web/view-previews/case.md)
- [在设置里查看账单和 AI 能力](web/billing-ai/case.md)
- [在任务页用画布并排看预览](web/canvas-view/case.md)
- [等一张新卡片写好](web/card-being-created/case.md)
- [在任务页和 AI 聊这张卡](web/chat-on-task/case.md)
- [移除任务，再恢复它](web/remove-and-restore/case.md)
- [丢弃一次执行，保留任务](web/discard-run/case.md)
- [在待筛选看一条建议的详情](web/triage-detail/case.md)
- [工作区成员打开分享链接，直接到任务页](web/open-share-link/case.md)
- [在任务页分享，拿到 Web 上的链接地址](web/share-panel-address/case.md)
- [所有者在任务页保存组件里的修改](web/save-component-on-task/case.md)
- [在设置里看连接的 Agent 版本](web/agent-version-in-settings/case.md)

## runner

- [第一次启动 Runner 并登录](runner/sign-in-and-connect/case.md)
- [在第二台电脑上启动 Runner](runner/second-computer/case.md)
- [让 Runner 在本机项目文件夹里干活](runner/run-in-project-folder/case.md)
- [在运行时设置里选 Claude Code 的模型](runner/pick-claude-model/case.md)
- [在任务对话里附图提问，Agent 用我的语言回答](runner/chat-in-my-language/case.md)
- [在 Runner 管理的项目里用命令行改任务，网页立刻跟着变](runner/cli-changes-reach-web/case.md)
- [丢弃一次执行，任务和方案留下](runner/discard-build/case.md)
- [网页上改了卡片，本机看板几秒内跟着变](runner/pull-board-changes/case.md)
- [一台电脑装了几份 Agent，Runner 用能启动的最新版本](runner/newest-agent-copy/case.md)

## plugin

- [在 Claude Code 面板里看到新版本并升级](plugin/update-from-panel/case.md)
- [查不到新版本或插件已过旧时看面板](plugin/update-notice-fallbacks/case.md)
- [在 Codex 里问状态时得知新版本](plugin/codex-update-notice/case.md)
- [在面板的 Agent 标签页看连接的是哪个版本](plugin/agent-version-in-panel/case.md)
- [安装 Claude Code 插件并登录](plugin/install-and-sign-in/case.md)
- [在插件里把文件夹变成项目](plugin/add-project/case.md)
- [在面板里发起想法并管理任务](plugin/start-idea/case.md)

## marketing

已覆盖，无用例：这是在看板上写的营销工作本身，没有用户操作的产品界面。

## site

线上 `wildcrane.ai` 仍是 `legacy` 上的旧站，`site/` 不在 main 上。

- [从官网下载桌面应用](site/download-desktop-app/case.md)
- [在官网查看价格](site/view-pricing/case.md)
- [把官网切换成中文](site/switch-to-chinese/case.md)

## 待覆盖

无。

## 如何运行取证

- **akb（skill）**：在 `cli/` 里 `node scripts/build.mjs` 构建本仓库的 CLI；在 `/tmp` 下建一个
  `git init` 过的空项目，PATH 最前放一个名为 `akb` 的脚本：
  `AI4KANBAN_COMMAND=akb exec node <仓库>/cli/bin/ai4kanban.mjs "$@"`。先 `unset KANBAN_RUN
  KANBAN_BOARD_DIR KANBAN_DESKTOP AI4KANBAN_CLI`，并把 `AI4KANBAN_HOME` 指向临时目录，免得用到
  本机已装的旧版 `akb` 或真实看板。
- **cloud**：直接对线上 `https://api.ai4kanban.dev` 取证，`curl` 看响应，页面用无头 Chrome 截图
  （`--virtual-time-budget=4000`，等价格数字滚完）；点击按钮用自己端口的 CDP。
- **review**：#116 上线前 `/s/` 只在本地云端栈上有，线上无法取证。本地云端栈：临时 PostgreSQL 套上
  `cloud/test/sql/supabase.sql` 和全部迁移并种入 GitHub 身份的测试账号，一个 Supabase 替身
  （PostgREST RPC 走 psql、签发 ES256 token、邮箱验证码固定），`cloud/` 里
  `wrangler dev --local` 指向替身，`web/` 用 `VITE_API_URL`/`VITE_SUPABASE_URL` 跑 vite。
  没有 Runner 时，用 SQL 把任务置为 `waiting_review`、`review_status='ready'`、`review_phase=1`
  造出待审核；登录态写进 `localStorage['wildcrane.review.session']`（`expires_at` 用毫秒）。
  Worker 用 `--var APP_URL:<web 来源>`，`REVIEW_URL` 已删除。客人用 `PUT /v1/tasks/{id}/guests/{email}`。
- **web**：同 review 的本地云端栈，`web/` 用同样的 `VITE_*` 跑 vite。用一台假 Runner 代替真电脑：
  `POST /v1/runner`（`machineId` 须是 UUID，protocol 11，`claude-code` 已登录，15 分钟内续一次）、
  `POST /v1/runner/folders` 放一个项目；Agent 的回复用 `/v1/runner/jobs/<id>/claim` 和 `/finish`
  写入，卡片正文用 `PUT /v1/tasks/{id}/card`（`base_version`、`assets: {}`）。跳过导览要写
  `wc.usageNoticeShown`、`wc.welcomeTourShown`。叠放的导览卡片里有隐藏的同名按钮，点击要选
  `elementFromPoint` 命中的那个；手机宽度的整段流程放在同一个 CDP 连接里，重连会丢掉视口模拟。
  每个用户一份全新的 Chrome 配置，加 `--disable-features=BackForwardCache`，否则页面会卡在 API 上。成员要先调过任一
  `/v1` 路由才有账号行，还要写 `wc.setupDone.<账号>`，否则首次设置会盖住页面或改掉全局默认。组件域名用
  `--host-resolver-rules="MAP *.wildcraneusercontent.com:443 127.0.0.1:<端口>" --ignore-certificate-errors` 指到本地 TLS 服务。
- **runner**：同 web 的本地云端栈，但用真 Runner：`runner/` 里 `node scripts/build.mjs`，再以
  `WILDCRANE_HOME=<临时目录>`、`AI4KANBAN_CLOUD_URL`/`AI4KANBAN_SUPABASE_URL`/`AI4KANBAN_SUPABASE_ANON_KEY`
  指向本地栈、`WILDCRANE_POLL_MS=2000` 运行 `bin/wildcrane-runner.mjs`（替身没有 Realtime，靠轮询领作业）。
  替身加一个 `/auth/v1/token` 代答 GitHub 登录；PATH 前放一个假的 `open` 记下登录地址，浏览器直接打开
  其中的 `redirect_to?code=任意`。作业用 `POST /v1/runner/jobs` 派发，由本机已登录的 `claude` 真跑。
  证据里把电脑名换成 `QA-Mac`。
  多份 Agent 用临时 `HOME` 和干净的 `PATH`，假副本的版本号要高于真的：`/Applications/ChatGPT.app` 和
  `/opt/homebrew/bin` 还是会被搜到；另外 unset `NVM_DIR`、`PNPM_HOME`。
- **site**：直接对线上 `https://wildcrane.ai` 取证，用自己端口的无头 Chrome 加 CDP 点击和截图；浏览器语言
  用 `Network.setUserAgentOverride` 的 `acceptLanguage` 模拟。下载链接用 `curl -sL -o /dev/null -w '%{http_code}'` 记日志。
- **plugin**：`git archive` 取 `runner cli plugins .claude-plugin skill cloud/src`，在 `runner/` 里构建。
  Claude Code 用临时 `CLAUDE_CONFIG_DIR` 和占位 key，从本地 marketplace 安装（`{"source":"url","url":"file:///…"}`
  才按版本缓存；`--plugin-dir` 不加载 hooks），在 `tmux -L <自己的>` 里驱动，`capture-pane -e` 渲染成 PNG。Codex 用
  `codex exec --json … </dev/null`；它不向插件服务传 `WILDCRANE_HOME`、`AI4KANBAN_*`，要写进临时 `mcp.json` 的
  `env`，否则会用上真实账号。假 Cloud 要答 `jobs: []`。
  另加 `DISABLE_AUTOUPDATER=1`，unset `CLAUDE_CODE_CHILD_SESSION`，`.claude.json` 写 `hasCompletedOnboarding` 和项目信任。
  启动后等 14 秒再发 `/wildcrane`。按钮只有面板开着时有焦点：用 Tab 走到目标（SGR 里反显的 `7m`）再按 Enter。
  要真登录时接本地云端栈，替身的 `/auth/v1/token` 要答 `user.id`；项目文件夹不能在 `/tmp`，账号上已有的假 Runner 要先
  `POST /v1/runner/release`。插件的 Runner 不认 `WILDCRANE_POLL_MS`，替身下只在启动时领作业。
- **通用**：本机 shell 导出了指向真实看板的 `AI4KANBAN_BOARD`，取证前先 `unset`（在看板运行里还要 unset
  `AI4KANBAN_LANGUAGE_LINE`、`AI4KANBAN_TASK`、`AI4KANBAN_COMMAND`、`WILDCRANE_JOB`）。`akb triage add` 要用
  `--board <项目>/.akb/kanban`，`--dir` 会写到过期的 `docs/kanban/`。`POST /v1/tasks` 要带
  `"workflow":"wf_builtin_coding"`，正文字段是 `request`；本地 Worker 要带占位的 `CREEM_*` 变量，账单页才能加载。
- **本地云端栈的坑**：Runner 报告停止要 `outcome: done` 加 `report.stopped: true`；上下文圆环要同时有
  `report.session` 和 `context`；替身要经 stdin 把 SQL 交给 `psql`，否则带图消息 503；Worker 的副本也要带 `cli/`。
  起一个想法用 `POST /v1/discussions/external`；要到 `refine`，在卡片 frontmatter 写 `stages: 2` 再批准；真实的问题
  要来自一次运行 finish 的 `review.question`，写进卡片不算。共享看板上领作业前先记下已有作业 id。
