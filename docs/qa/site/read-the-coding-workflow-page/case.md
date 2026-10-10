# 读软件开发方案页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在 `127.0.0.1:4330`，无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [coding.mjs](coding.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900。录屏视频来自线上 `cdn.ai4kanban.dev`。
- **读者**：用 Claude Code、Codex 等写代码，想知道 AI4Kanban 能帮什么的人；多半从搜索或别人给的链接直接进来——官网页头和页脚都没有链到这一页。

## Steps

1. 打开 `/workflows/coding`。
   标题「AI4Kanban for coding」，副标题「Review what matters. Then let agents build.」，下面是像素风主视觉：「Invite members」卡片上挂着页面和邮件草稿，设计、文案、构建三个小机器人围着它。左侧有「ON THIS PAGE」目录，列出十个小节。此时页面还没有请求任何视频，也没有 GIF。
   ![首屏](01-hero.png) · [coding.log](coding.log)

2. 往下滚到第一段录屏。
   滚到附近才开始下载 MP4；录屏静音、循环、没有控制条，自己播放（3 秒后进度从 3.9 秒到 7 秒），画面是演示项目里一张卡片的待答问题和草稿。
   ![录屏在播放](02-recording-playing.png) · [coding.log](coding.log)

3. 滚回顶部。
   录屏离开视野后自动暂停。
   [coding.log](coding.log)

4. 看页面里往下走的链接。
   「Setup guide」到 `/docs`，「Agent guide」到 `/docs/agents`，「supported tool」到 `/docs/connectors`。
   [coding.log](coding.log)

5. 打开系统的「减少动态效果」后重新打开页面，滚到同一段录屏。
   录屏不自动播放，停在封面上，显示浏览器自带的播放控件，由读者自己点开。
   ![减少动态效果时](05-reduced-motion.png) · [coding.log](coding.log)

## Feedback

- **看得到真东西**：每节配的都是真实产品录屏，比示意图更能让人相信「先看草稿」是什么样子。
- **轻**：视频滚到附近才加载、离开就停，长页面滚起来不卡。
- **减少动态效果时一视同仁**：录屏改成手动播放，封面能看懂在讲什么。
- **找不到这一页**：页头、页脚和「Resources」面板都没有入口，不知道网址的人进不来。
- **页内没有下载按钮**：读完想试，只能回到页头点「Download」。
