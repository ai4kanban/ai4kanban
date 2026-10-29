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

## marketing

已覆盖，无用例：这是在看板上写的营销工作本身，没有用户操作的产品界面。

## 待覆盖

- **review**
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
