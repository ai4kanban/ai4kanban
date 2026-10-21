# 打开已下架模板的旧链接，拿到真正的 404

## Setup

- **站点**：官网的静态构建（`out/`）连同 main 的 `web/functions/` 拷到 `/tmp`，用 `cloud/node_modules` 里的 wrangler `pages dev out` 跑在本机（地址给 `SITE`）；无头 Chrome 开远程调试（`CDP_PORT`），脚本是 [retired.mjs](retired.mjs)（用 [cdp.mjs](cdp.mjs) 驱动），记下浏览器拿到的页面状态码；第 4 步脚本直接打开线上站点。模板查询走线上 `api.ai4kanban.dev/v1/catalog`。
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
   两个都应是 404，页面同第 1、2 步。2026-10-21 实测：中文地址 404，正确；英文地址浏览器拿到的仍是 200 和完整的旧模板页（标题、说明、「Download AI4Kanban」），响应 `age` 约 37 小时、`s-maxage=604800`，是部署前留在边缘的缓存——同一地址加 `?x=1` 就是 404。已报待筛选。
   ![线上英文页](04-live-en.png) · ![线上中文页](05-live-zh.png) · [live.log](live.log)

## Feedback

- **本机和中文线上都对了**：下架页一字未改，状态码变成 404，搜索引擎不再把它当有效页面。
- **英文线上反而更糟**：旧书签点进去看到的是一张完整、可「下载使用」的模板页，访客会以为模板还在，找不到才发现上当；要等边缘缓存过期（最长一周）或有人手动清缓存。
- **下架页仍然太空**：只有一句话和一个链接，标签页标题还是「AI4Kanban: Templates」，不说是写错了名字还是已下架，也不推荐相近的模板。
- **多等一下**：下架判定要先问一次 Cloud，本机上这类页面约 1 秒才返回，在架的静态页是毫秒级。
