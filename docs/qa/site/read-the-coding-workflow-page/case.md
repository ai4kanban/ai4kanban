# 读软件开发方案页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [coding.mjs](coding.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。录屏视频来自线上 `cdn.ai4kanban.dev`。
- **读者**：用 Claude Code、Codex 等写代码，想知道 AI4Kanban 能帮什么的人；从页脚、搜索或别人给的链接进来。

## Steps

1. 在首页滚到页脚，点「SOLUTIONS」下的「For coding」。
   页脚四栏：「PRODUCT」；「SOLUTIONS」（只有「For coding」）叠在「LEARN」上面；「COMPARE」；「PROJECT」叠在「LEGAL」上面。手机上两栏，同样的顺序两两成行，页面不横向滚动。中文首页的分组叫「解决方案」，链接文字仍是「For coding」，指向 `/zh/workflows/coding`。点完到 `/workflows/coding`。
   ![桌面页脚](01-footer-solutions.png) · ![手机页脚](01b-footer-phone.png) · [coding.log](coding.log)

2. 看首屏，再用 390px 宽的手机打开同一页。
   页面和页头都是纯白，背后没有任何动画背景。标题「AI4Kanban for coding」，副标题「Review what matters. Then let agents build.」，下面是装在画框里的像素风主视觉：淡纸色衬底（`#fbf9f5`）四角晕着橙、绿两色像素水彩，中间一张白色印框，不带阴影，框里是「Invite members」卡片、页面和邮件草稿，设计、文案、构建三个小机器人围着它。画框桌面宽 768px、留边 24px；手机宽 342px、留边 12px，页面不横向滚动。往下才是左侧的「ON THIS PAGE」目录（手机上折叠成一条），列出十个小节。此时页面还没有请求任何视频，也没有 GIF。
   ![首屏](02-hero.png) · ![手机首屏](02b-hero-phone.png) · [coding.log](coding.log)

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

- **首屏终于安静**：动画背景去掉后，白底上只剩标题和一幅装框的插图，一眼就知道该看哪里；水彩只在画框四角，衬托而不抢戏。
- **入口清楚**：页脚「SOLUTIONS」放在第二栏最上面，扫一眼就看到；但下面只有一条链接，空出一截才到「LEARN」，像没写完，页头「Resources」面板里也仍然没有这一页。
- **中文页脚中英混排**：分组标题是「解决方案」，链接却是「For coding」。
- **手机上插图字太小**：画框缩到 342px，卡片里的「PAGE」「EMAIL」「Default role?」几乎读不清。
- **看得到真东西**：每节配真实产品录屏，比示意图更可信；视频滚到附近才加载、离开就停，减少动态效果时改为手动播放。
- **页内没有下载按钮**：读完想试，只能回到页头点「Download」。
