# QA 手册

每个用例一个文件夹：`docs/qa/<module>/<case>/case.md`。证据不进 git，存在项目的
`.akb/qa/<module>/<case>/` 下，用例里按文件名引用。

## skill

- [在新项目里安装看板](skill/install-board/case.md)
- [让编码代理能驱动看板](skill/install-agent-skill/case.md)
- [用一句话建卡](skill/create-card/case.md)
- [让代理用中文回复和写卡](skill/reply-in-my-language/case.md)
- [构建一张卡并跟随到落地](skill/follow-delivery-until-landed/case.md)

## cloud

- [查看价格并选择方案](cloud/view-pricing/case.md)
- [未登录调用公开 API](cloud/call-api-signed-out/case.md)
- [打开分享出来的卡片链接](cloud/open-card-link/case.md)
- [在任务对话里看每条回复花了多少钱](cloud/reply-cost/case.md)
- [按模型查看工作区的用量和费用](cloud/usage-by-model/case.md)

## review

- [分享审核链接并管理谁能打开](review/share-review-link/case.md)
- [受邀审核人登录并评论](review/sign-in-invited-link/case.md)
- [确认或移除等审核的任务](review/decide-review/case.md)
- [打开不完整或失效的审核链接](review/open-broken-link/case.md)
- [按段阅读任务的预览](review/read-previews/case.md)
- [在审核页和 AI 讨论任务](review/chat-with-ai/case.md)
- [评论写到一半刷新页面](review/draft-comment/case.md)
- [打开带待答问题的审核链接](review/open-question-link/case.md)
- [切换审核页的语言](review/switch-language/case.md)

## web

- [第一次打开 WildCrane Web](web/first-visit/case.md)
- [从首页一句话开始一个任务](web/start-from-home/case.md)
- [在看板上找到待审核的任务并开始执行](web/review-on-board/case.md)
- [跳过方案直接构建一个想法](web/build-now/case.md)
- [查看工作流里有哪些角色](web/workflow-roles/case.md)

## runner

- [第一次启动 Runner 并登录](runner/sign-in-and-connect/case.md)
- [在第二台电脑上启动 Runner](runner/second-computer/case.md)
- [让 Runner 在本机项目文件夹里干活](runner/run-in-project-folder/case.md)

## marketing

已覆盖，无用例：这是在看板上写的营销工作本身，没有用户操作的产品界面。

## 待覆盖

- **site**

## 如何运行取证

- **akb（skill）**：在 `cli/` 里 `node scripts/build.mjs` 构建本仓库的 CLI；在 `/tmp` 下建一个
  `git init` 过的空项目，PATH 最前放一个名为 `akb` 的脚本：
  `AI4KANBAN_COMMAND=akb exec node <仓库>/cli/bin/ai4kanban.mjs "$@"`。先 `unset KANBAN_RUN
  KANBAN_BOARD_DIR KANBAN_DESKTOP AI4KANBAN_CLI`，并把 `AI4KANBAN_HOME` 指向临时目录，免得用到
  本机已装的旧版 `akb` 或真实看板。
- **cloud**：直接对线上 `https://api.ai4kanban.dev` 取证，`curl` 看响应，页面用无头 Chrome 截图
  （`--virtual-time-budget=4000`，等价格数字滚完）；点击按钮用自己端口的 CDP。
- **review**：线上只能取证失效链接；其余用本地云端栈——临时 PostgreSQL 套上
  `cloud/test/sql/supabase.sql` 和全部迁移并种入 GitHub 身份的测试账号，一个 Supabase 替身
  （PostgREST RPC 走 psql、签发 ES256 token、邮箱验证码固定），`cloud/` 里
  `wrangler dev --local` 指向替身，`review/` 用 `VITE_API_URL`/`VITE_SUPABASE_URL` 跑 vite。
  没有 Runner 时，用 SQL 把任务置为 `waiting_review`、`review_status='ready'`、`review_phase=1`
  造出待审核；登录态写进 `localStorage['wildcrane.review.session']`（`expires_at` 用毫秒）。
- **web**：同 review 的本地云端栈，`web/` 用同样的 `VITE_*` 跑 vite。用一台假 Runner 代替真电脑：
  `POST /v1/runner`（`machineId` 须是 UUID，protocol 11，`claude-code` 已登录，15 分钟内续一次）、
  `POST /v1/runner/folders` 放一个项目；Agent 的回复用 `/v1/runner/jobs/<id>/claim` 和 `/finish`
  写入，卡片正文用 `PUT /v1/tasks/{id}/card`（`base_version`、`assets: {}`）。跳过导览要写
  `wc.usageNoticeShown`、`wc.welcomeTourShown`。叠放的导览卡片里有隐藏的同名按钮，点击要选
  `elementFromPoint` 命中的那个；手机宽度的整段流程放在同一个 CDP 连接里，重连会丢掉视口模拟。
- **runner**：同 web 的本地云端栈，但用真 Runner：`runner/` 里 `node scripts/build.mjs`，再以
  `WILDCRANE_HOME=<临时目录>`、`AI4KANBAN_CLOUD_URL`/`AI4KANBAN_SUPABASE_URL`/`AI4KANBAN_SUPABASE_ANON_KEY`
  指向本地栈、`WILDCRANE_POLL_MS=2000` 运行 `bin/wildcrane-runner.mjs`（替身没有 Realtime，靠轮询领作业）。
  替身加一个 `/auth/v1/token` 代答 GitHub 登录；PATH 前放一个假的 `open` 记下登录地址，浏览器直接打开
  其中的 `redirect_to?code=任意`。作业用 `POST /v1/runner/jobs` 派发，由本机已登录的 `claude` 真跑。
  证据里把电脑名换成 `QA-Mac`。
