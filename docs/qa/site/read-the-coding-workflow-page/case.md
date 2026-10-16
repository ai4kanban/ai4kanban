# 读软件开发方案页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [coding.mjs](coding.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。录屏视频来自线上 `cdn.ai4kanban.dev`。
- **读者**：用 Claude Code、Codex 等写代码，想知道 AI4Kanban 能帮什么的人；从页脚、搜索或别人给的链接进来。

## Steps

1. 在首页滚到页脚，点「SOLUTIONS」下的「For coding」。
   页脚四栏：「PRODUCT」；「SOLUTIONS」（「For coding」「For SaaS」「draft-first」）叠在「LEARN」上面；「COMPARE」；「PROJECT」叠在「LEGAL」上面。手机上两栏，同样的顺序两两成行，页面不横向滚动。中文首页的分组叫「解决方案」，链接是「编程」「SaaS」「draft-first」，指向 `/zh/workflows/coding`、`/zh/solutions/saas` 和 `/zh/draft-first`。点完到 `/workflows/coding`。
   ![桌面页脚](01-footer-solutions.png) · ![手机页脚](01b-footer-phone.png) · [coding.log](coding.log)

2. 看首屏，等几秒，再用 390px 宽的手机打开同一页。
   页面和页头都是纯白，背后没有任何动画背景。标题「AI4Kanban for coding」，副标题「Review what matters. Then let agents build.」，下面直接是和 SaaS 方案页同一幅 3D 动画，不带画框：浅灰看板斜放在白底上，带橙色描边的卡片升起、展开成一张抽象的卡片页（标题、橙色执行按钮、一份页面草稿），之后收回到看板上；没有文字也没有机器人。图片说明是「A card lifts off the board and opens into its card page, where agents' drafts fill in; you press Run and the card starts building.」。动画桌面宽 896px，手机宽 342px，页面不横向滚动。往下才是左侧的「ON THIS PAGE」目录（手机上折叠成一条），列出十个小节。此时这一页还没有请求任何视频（日志里的 `hero-demo-v1.mp4` 是先前首页的），也没有 GIF。
   ![卡片页展开](02-hero.png) · ![收回看板](02a-hero-board.png) · ![手机首屏](02b-hero-phone.png) · [coding.log](coding.log)

3. 往下滚到第一段录屏。
   滚到附近才开始下载 MP4；录屏静音、循环、没有控制条，自己播放（3 秒后进度从 3.4 秒到 6.5 秒），画面是演示项目里一张卡片的待答问题和草稿。
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

- **首屏换成了会讲故事的动画**：原来元素很多的像素插图换成「卡片升起 → 展开成卡片页 → 执行」的 3D 动画，干净，也和 SaaS 页是同一套说法；但它很抽象，没读正文的人看不出浮起的是卡片页，画面颜色很淡，看板底部渐隐；卡片收回看板后，标题下空着一大块白。
- **两个方案页首屏一模一样**：从 SaaS 页跳过来的人会以为点错了页面，只能靠标题区分。
- **入口清楚**：页脚「SOLUTIONS」放在第二栏最上面，扫一眼就看到，三个方案页并排；中文页脚也已译成「编程」「SaaS」。页头「Resources」面板里仍然没有这一页。
- **手机上更小**：动画缩到 342px，卡片页里的草稿只剩几根线条。
- **看得到真东西**：每节配真实产品录屏，比示意图更可信；视频滚到附近才加载、离开就停，减少动态效果时改为手动播放。
- **页内没有下载按钮**：读完想试，只能回到页头点「Download」。
