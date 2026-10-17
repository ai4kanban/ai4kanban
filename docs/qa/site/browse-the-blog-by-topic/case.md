# 按主题浏览博客

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`；`_redirects` 只在这样跑时生效），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [blog.mjs](blog.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。封面图来自线上 `cdn.ai4kanban.dev`。
- **读者**：想找某一类文章的人。

## Steps

1. 在首页把鼠标移到页头的「Resources」上。
   展开一个窄面板，两项各带图标和一行说明：「Blog · Field notes on building with AI agents」「Training · Hands-on help to ship your project」。
   ![Resources 面板](01-resources.png) · [blog.log](blog.log)

2. 点「Blog」。
   到 `/blog`：大标题「Blog」右边是 RSS 入口，标题下没有简介，直接是主题标签「All · The board · Coding agents · Workflow」；最新一篇「How we built an interactive demo of AI4Kanban with AI4Kanban」占一整行大图，其余 8 篇排成三列网格，每篇有封面、主题、日期、阅读时长、标题和两行摘要。
   ![博客首页](02-blog-index.png) · [blog.log](blog.log)

3. 往下滚到网格。
   封面各不相同，都是同一种画法：左边一句大字标题（如「Rework the drafts, not the code.」「A spec you can read.」「Show me before you build.」），右边打叉的旧做法对比打勾的新做法；置顶那篇是「Idea → UI draft → Demo」三格流程图；没有一张是界面截图。
   ![网格里的封面](03-blog-covers.png) · [blog.log](blog.log)

4. 点「The board」。
   地址变成 `/blog?topic=board`，标签高亮，置顶大图消失，网格只剩一篇「Why project planning becomes the bottleneck with AI coding tools」，封面是「Code can’t say why.」。
   ![按主题筛选](04-board-topic.png) · [blog.log](blog.log)

5. 按浏览器的后退。
   回到 `/blog` 的全部文章，置顶大图回来。
   [blog.log](blog.log)

6. 打开已下线文章的旧链接 `/blog/deepseek-harness-support`。
   直接回到博客首页 `/blog`（301），不是 404；首页上也没有这篇。
   [blog.log](blog.log)

7. 用 390px 宽的手机打开 `/blog?topic=agents`。
   「Coding agents」高亮，7 篇排成一列；整页没有横向滚动（页面宽度 390），标签一行放不下时可以横向滑。
   ![手机上的主题筛选](07-phone-agents.png) · [blog.log](blog.log)

## Feedback

- **标题下更干净**：去掉简介后，「Blog」下面直接是标签和文章，读者第一眼就在选文章；但新访客也少了一句「这里写什么」的交代，只能靠封面和标签猜。
- **封面能分清文章**：每篇一句标题加一组对比图，扫一眼网格就知道各篇讲什么。
- **封面图里的小字看不清**：三列网格里每张封面约 350px 宽，右侧示意图上的标注只有几像素高，基本只能当装饰看。
- **旧链接悄悄落回首页**：下线文章跳回 `/blog` 不会 404，但读者看不到任何提示，会以为链接坏了、点错了。
- **文章上的主题和所选主题对不上**：在「The board」下唯一那篇标着「WORKFLOW」，因为卡片只显示文章的第一个主题，第一眼像是筛错了。
- **「Workflow」等于「All」**：所有文章都带 workflow 主题，点它只是去掉了置顶大图。
