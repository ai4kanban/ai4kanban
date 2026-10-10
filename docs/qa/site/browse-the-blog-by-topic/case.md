# 按主题浏览博客

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在 `127.0.0.1:4330`，无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [blog.mjs](blog.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。
- **读者**：想找某一类文章的人。

## Steps

1. 在首页把鼠标移到页头的「Resources」上。
   展开一个窄面板，两项各带图标和一行说明：「Blog · Field notes on building with AI agents」「Training · Hands-on help to ship your project」。
   ![Resources 面板](01-resources.png) · [blog.log](blog.log)

2. 点「Blog」。
   到 `/blog`：标题下是主题标签「All · The board · Coding agents · Workflow」，最新一篇占一整行大图（这篇的封面是用代码画的「Show me before you build.」），其余文章排成三列网格，每篇有封面、主题、日期、阅读时长、标题和两行摘要。
   ![博客首页](02-blog-index.png)

3. 点「The board」。
   地址变成 `/blog?topic=board`，标签高亮，置顶大图消失，网格只剩一篇「Why project planning becomes the bottleneck with AI coding tools」。
   ![按主题筛选](03-board-topic.png) · [blog.log](blog.log)

4. 按浏览器的后退。
   回到 `/blog` 的全部文章，置顶大图回来。
   [blog.log](blog.log)

5. 用 390px 宽的手机打开 `/blog?topic=agents`。
   「Coding agents」高亮，文章排成一列；整页没有横向滚动（页面宽度 390），标签一行放不下时可以横向滑。
   ![手机上的主题筛选](05-phone-agents.png)

## Feedback

- **筛选又快又能分享**：点一下就地筛，地址带上主题，能后退、能直接发链接。
- **文章上的主题和所选主题对不上**：在「The board」下唯一那篇标着「WORKFLOW」，因为卡片只显示文章的第一个主题，第一眼像是筛错了。
- **「Workflow」等于「All」**：所有文章都带 workflow 主题，点它只是去掉了置顶大图。
- **封面大多一样**：除了置顶那篇，网格里的封面几乎都是同一张看板截图，靠图分不出文章。
