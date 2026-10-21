# 打开已停掉的 draft-first 旧链接，回到首页

## Setup

- **站点**：官网（`web/`，main `291eb306`）拷到 `/tmp` 做静态构建，用 `cloud/node_modules` 里的 wrangler `pages dev out` 跑在本机（地址给 `SITE`）——`_redirects` 只在这样跑时生效；无头 Chrome 开远程调试（`CDP_PORT`），脚本是 [redirect.mjs](redirect.mjs)（用 [cdp.mjs](cdp.mjs) 驱动）。取证时线上 `ai4kanban.dev/draft-first` 还是旧落地页（200），这次构建尚未部署。
- **读者**：从旧博客、书签或搜索结果点进 `/draft-first` 的访客。

## Steps

1. 请求 `/draft-first`、`/zh/draft-first`、`/es/draft-first`、`/ja/draft-first`、`/fr/draft-first`。
   每个都回 301，分别跳到 `/`、`/zh`、`/es`、`/ja`、`/fr`。
   [redirect.log](redirect.log)

2. 在浏览器里打开 `/zh/draft-first`，再打开 `/draft-first`。
   前者落在中文首页「不用每个细节 / 都亲自盯」，后者落在英文首页「You don’t have to / manage every detail.」，都不经过 404。
   ![落在中文首页](01-zh-home.png) · [redirect.log](redirect.log)

3. 看页脚，再打开 `/llms.txt`。
   页脚没有任何指向 draft-first 的链接；`llms.txt` 里也没有 draft-first 一行。
   [redirect.log](redirect.log)

## Feedback

- **旧链接不再落空**：五种语言的旧地址都回到同语言首页，访客不会看到 404。
- **跳转没有任何说明**：首页上看不出 draft-first 已并入 AI4Kanban，专门来找 draft-first 的人会以为链接坏了、被随手扔到首页。
- **带斜杠的旧链接仍是 404**：`/draft-first/` 不在跳转规则里，直接 404；外链里这种写法不多，但会有。
