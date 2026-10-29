# QA 手册

每个用例一个文件夹：`docs/qa/<module>/<case>/case.md`。证据不进 git，存在项目的
`.akb/qa/<module>/<case>/` 下，用例里按文件名引用。

## skill

- [在新项目里安装看板](skill/install-board/case.md)
- [让编码代理能驱动看板](skill/install-agent-skill/case.md)
- [用一句话建卡](skill/create-card/case.md)

## cloud

- [查看价格并选择方案](cloud/view-pricing/case.md)
- [未登录调用公开 API](cloud/call-api-signed-out/case.md)
- [打开分享出来的卡片链接](cloud/open-card-link/case.md)

## review

- [分享审核链接并管理谁能打开](review/share-review-link/case.md)
- [受邀审核人登录并评论](review/sign-in-invited-link/case.md)
- [确认或移除等审核的任务](review/decide-review/case.md)
- [打开不完整或失效的审核链接](review/open-broken-link/case.md)

## marketing

已覆盖，无用例：这是在看板上写的营销工作本身，没有用户操作的产品界面。

## 待覆盖

- **web**
- **runner**
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
