# 读软件开发方案页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [coding.mjs](coding.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。录屏视频来自线上 `cdn.ai4kanban.dev`。
- **读者**：用 Claude Code、Codex 等写代码，想知道 AI4Kanban 能帮什么的人；从页脚、搜索或别人给的链接进来。

## Steps

1. 在首页滚到页脚，点「SOLUTIONS」下的「For coding」。
   页脚四栏：「PRODUCT」；「SOLUTIONS」（只有「For coding」）叠在「LEARN」上面；「COMPARE」；「PROJECT」叠在「LEGAL」上面。手机上两栏，同样的顺序两两成行，页面不横向滚动。中文首页的分组叫「解决方案」，链接文字仍是「For coding」，指向 `/zh/workflows/coding`。点完到 `/workflows/coding`。
   ![桌面页脚](01-footer-solutions.png) · ![手机页脚](01b-footer-phone.png) · [coding.log](coding.log)

2. 看首屏。
   标题「AI4Kanban for coding」，副标题「Review what matters. Then let agents build.」，下面是像素风主视觉：「Invite members」卡片上挂着页面和邮件草稿，设计、文案、构建三个小机器人围着它。左侧有「ON THIS PAGE」目录，列出十个小节。此时页面还没有请求任何视频，也没有 GIF。
   ![首屏](02-hero.png) · [coding.log](coding.log)

3. 往下滚到第一段录屏。
   滚到附近才开始下载 MP4；录屏静音、循环、没有控制条，自己播放（3 秒后进度从 3.7 秒到 7.1 秒），画面是演示项目里一张卡片的待答问题和草稿。
   ![录屏在播放](03-recording-playing.png) · [coding.log](coding.log)

4. 滚回顶部。
   录屏离开视野后自动暂停。
   [coding.log](coding.log)

5. 看页面里往下走的链接。
   「Setup guide」到 `/docs`，「Agent guide」到 `/docs/agents`，「supported tool」到 `/docs/connectors`。
   [coding.log](coding.log)

6. 打开系统的「减少动态效果」后重新打开页面，滚到同一段录屏。
   录屏不自动播放，停在封面上，显示浏览器自带的播放控件，由读者自己点开。
   ![减少动态效果时](06-reduced-motion.png) · [coding.log](coding.log)

## Feedback

- **终于有入口**：页脚的「SOLUTIONS」把这一页放在第二栏最上面，扫一眼就看到。
- **页脚更整齐**：四栏、短分组叠放，没有一栏孤零零拖长；手机上两栏也不挤。
- **「SOLUTIONS」下只有一条**：一个分组一个链接，下面空出一截才到「LEARN」，看着像没写完；页头「Resources」面板里仍然没有这一页。
- **中文页脚中英混排**：分组标题是「解决方案」，链接却是「For coding」，和旁边的「Documentation」「Blog」一样没翻。
- **看得到真东西**：每节配的都是真实产品录屏，比示意图更能让人相信「先看草稿」是什么样子；视频滚到附近才加载、离开就停，减少动态效果时改为手动播放。
- **页内没有下载按钮**：读完想试，只能回到页头点「Download」。
