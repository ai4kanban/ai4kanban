# 打开已下架模板的旧链接，拿到真正的 404

## Setup

- **站点**：官网的静态构建（`out/`，与 main 只差本次改的 Pages Function）连同 main 的 `web/functions/` 拷到 `/tmp`，用 `cloud/node_modules` 里的 wrangler `pages dev out` 跑在本机（地址给 `SITE`）；无头 Chrome 开远程调试（`CDP_PORT`），脚本是 [retired.mjs](retired.mjs)（用 [cdp.mjs](cdp.mjs) 驱动），记下浏览器拿到的页面状态码。模板查询走线上 `api.ai4kanban.dev/v1/catalog`。
- **数据**：`logo-build` 已从 Cloud 目录下架，构建里也没有它的页面；`card-widen` 仍在架。
- **读者**：从旧书签或搜索结果点进模板页的访客，以及抓取网站的搜索引擎。

## Steps

1. 打开 `/templates/motion/logo-build`。
   页面写「This template is not available.」，下面「All categories」；浏览器收到的状态码是 404，页面带 `noindex`。
   ![英文页](01-retired-en.png) · [retired.log](retired.log)

2. 打开中文的 `/zh/templates/motion/logo-build`。
   页面写「找不到这个模板。」和「全部分类」；状态码同样是 404。
   ![中文页](02-retired-zh.png) · [retired.log](retired.log)

3. 删掉构建里 `card-widen` 的静态页（当作构建之后才发布的模板），再打开 `/templates/motion/card-widen`。
   状态码 200，页面从 Cloud 读出模板，显示名称、预览和「Copy prompt」，不被当成下架。
   ![构建后发布的模板](03-new-template.png) · [retired.log](retired.log)

4. 在线上 `ai4kanban.dev` 打开第 1、2 步的两个地址。
   应为 404。2026-10-21 时线上还没部署这次改动，两个地址仍是 200，这一步待部署后再证。
   [live.log](live.log)

## Feedback

- **对访客没变化，对搜索引擎是实打实的修正**：页面一字未改，但旧地址不再被当作有效页面收录。
- **下架页仍然太空**：只有一句话和一个链接，标签页标题还是「AI4Kanban: Templates」，不说是写错了名字还是已下架，也不推荐相近的模板。
- **多等一下**：下架判定要先问一次 Cloud，本机上这类页面约 1 秒才返回，在架的静态页是毫秒级；访客能感觉到，但只发生在本来就找不到的页面上。
