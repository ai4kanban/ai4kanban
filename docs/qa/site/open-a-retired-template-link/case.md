# 打开已下架模板的旧链接，拿到真正的 404

## Setup

- **站点**：官网的静态构建（`out/`）连同 main 的 `web/functions/` 拷到 `/tmp`，用 `cloud/node_modules` 里的 wrangler `pages dev out` 跑在本机（地址给 `SITE`）；无头 Chrome 开远程调试（`CDP_PORT`），脚本是 [retired.mjs](retired.mjs)（用 [cdp.mjs](cdp.mjs) 驱动），记下浏览器拿到的页面状态码；第 4 步脚本直接打开线上站点 `https://wildcrane.ai`。模板查询走线上 `api.ai4kanban.dev/v1/catalog`。
- **数据**：`logo-build` 已从 Cloud 目录下架，构建里也没有它的页面；`card-widen` 仍在架。
- **读者**：从旧书签或搜索结果点进模板页的访客，以及抓取网站的搜索引擎。

## Steps

1. 打开 `/templates/motion/logo-build`。
   页面写「This template is not available.」，下面「All categories」；浏览器收到的状态码是 404，页面带 `noindex`，标签页标题「WildCrane: Templates」，页头是新的白鹤标志和「WildCrane」字样。
   ![英文页](01-retired-en.png) · [retired.log](retired.log)

2. 打开中文的 `/zh/templates/motion/logo-build`。
   页面写「找不到这个模板。」和「全部分类」；状态码同样是 404。
   本机向 Cloud 查下架要 1–3 秒，偶尔超过 3 秒的上限，这时按设计放行成 200；这次前几回拿到 200，重跑到查询及时返回才是 404。
   ![中文页](02-retired-zh.png) · [retired.log](retired.log)

3. 删掉构建里 `card-widen` 的静态页（当作构建之后才发布的模板），再打开 `/templates/motion/card-widen`。
   状态码 200，页面从 Cloud 读出模板，显示名称「Narrow card widens into a line」、预览和「Copy prompt」（提示词写「Make a video with WildCrane …」），不被当成下架。
   ![构建后发布的模板](03-new-template.png) · [retired.log](retired.log)

4. 在线上 `wildcrane.ai` 打开第 1、2 步的两个地址。
   两个都应是 404，页面同第 1、2 步。2026-10-23 实测：两个都是 404，带 `noindex`，标题「WildCrane: Templates」/「WildCrane：模板」，截图与本机第 1、2 步逐字节相同。
   ![线上英文页](04-live-en.png) · ![线上中文页](05-live-zh.png) · [live.log](live.log)

## Feedback

- **改名没留痕迹**：页头、标签页标题、提示词都已是 WildCrane，看不到旧名。
- **线上英文、中文都对了**：旧书签点进来是 404 加 `noindex`，此前英文页残留旧模板缓存的问题这次没再出现。
- **404 靠一次 Cloud 查询**：查询慢过 3 秒就放行成 200，页面说找不到、状态码却说正常；本机取证时就碰到过，Cloud 慢时搜索引擎可能继续收录。
- **下架页仍然太空**：只有一句话和一个链接，标签页标题只是「WildCrane: Templates」，不说是写错了名字还是已下架，也不推荐相近的模板。
