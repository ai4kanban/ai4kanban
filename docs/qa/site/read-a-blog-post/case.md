# 读一篇带配图的博客文章

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [post.mjs](post.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。配图来自线上 `cdn.ai4kanban.dev`。
- **读者**：从博客首页点进一篇文章、从头读到尾的人。

## Steps

1. 在 `/blog` 点「Why spec-to-code fails, and how we fix it」。
   到 `/blog/spec-to-code`：主题、日期、阅读时长一行（「WORKFLOW · OCT 10, 2026 · 6 MIN READ」），大标题、导语，作者行写「Tao Wu · Founder of WildCrane」，整行链到 `/builder`；下面左侧「ON THIS PAGE」目录，右侧正文。正文里有 4 张配图。
   ![文章开头](01-post-top.png) · [post.log](post.log)

2. 往下滚到第一张配图。
   图直接落在正文里：没有描边，没有阴影，只有 12px 圆角；宽度和正文一致（688px）。
   ![正文里的配图](02-picture.png) · [post.log](post.log)

3. 用 390px 宽的手机打开同一篇，滚到同一张图。
   图缩到正文宽度（342px），同样无框、保留圆角；页面不横向滚动。
   ![手机上的配图](03-phone-picture.png) · [post.log](post.log)

## Feedback

- **新名落到了文章里**：页头换成鹤和「WildCrane」字标，作者行也写「Founder of WildCrane」，读者不会看到旧名。
- **图和正文融在一起**：浅底配图没有框，像页面的一部分，读起来不被打断。
- **浅底图边界偏弱**：图的米色底和页面底色接近，只靠圆角分出边界，扫读时不容易一眼看出图从哪里开始。
- **手机上字太小**：配图缩到 342px，图里的小字（「specify」「You review all of it…」）几乎读不清，也不能点开放大。
- **作者行看不出能点**：灰色小字、没有下划线，读者很难发现点进去是作者自述。
