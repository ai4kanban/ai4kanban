# 读官网首页

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`，带 `--proxy-server`），窗口 1440×900，手机 390×844 和 375×667；脚本是 [home.mjs](home.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，用 `ffmpeg` 把动画拼成 GIF）。首屏录屏来自线上 `cdn.ai4kanban.dev/home/`。
- **读者**：第一次听说 AI4Kanban、点进 `ai4kanban.dev` 想弄清它做什么的人，用 Mac 打开。

## Steps

1. 打开 `/zh`。
   标签页标题「独立开发者的 Agent 工作台 | AI4Kanban」。居中一行橙色小字「独立开发者的 Agent 工作台」，标题两行「不用每个细节 / 都亲自盯」，导语「从开发到营销，AI4Kanban 把需要你判断的部分做成草稿。你审阅、修改并确认后，agent 接手后续工作。」，两个按钮：「下载 — macOS」直接给 v0.10.2 的 Apple 芯片 `.dmg`（GitHub 上已能下载），「查看 GitHub ↗」。这些文字在页面 HTML 里，不等录屏就能读；下面的 `/demo` 录屏静音、循环、无控件，自己播放（3 秒后从 3.2 秒走到 6.2 秒）。工作流预览这时还没加载（`iframe` 都没有地址）。
   ![中文首屏](01-zh-hero.png) · [home.log](home.log) · [download.log](download.log)

2. 往下滚到「关键部分由你把关 / 其余交给 agent」。
   左边标题和一段导语「AI4Kanban 帮你澄清想法。每种工作流都把需要你确认的部分做成草稿，供你审阅、修改，再由 agent 完成后续工作。互不依赖的任务会同时推进。」；右边是约 7 秒循环的动画：「你」的想法气泡飞进「AI4Kanban」看板，看板出两张草稿，橙框标着「你把关」框住你和看板；草稿依次打勾后，橙框移到看板和「Agent」之间，标「agent 接手」。动画进入视野后才播放。气泡第一轮是「上线 Pro 套餐」，之后每轮换一条，依次「添加深色模式」「30 秒 v2 宣传片」「v2 发布博客」「5 页小红书教程」，再回到第一条；换字都在气泡看不见时发生，每条都一行放下、不出画面。
   ![分工一节](02-zh-handoff.png) · ![两个循环](03-zh-handoff-loop.gif) · [home.log](home.log)

3. 继续滚到「不同的工作，各有合适的工作流」，一直往下滚过这一节。
   导语「从 6 种内置开发与内容工作流开始。……也可以创建自己的 agent 和工作流。」先正常滚过；随后六张预览卡、进度条和下面的「体验演示」「查看全部 agent 与工作流」一起钉在页头下方，往下滚时整排卡片向左平移，1440 宽的屏上同时看到约两张，进度条从 0 走到 100%。顺序是软件开发、视频复刻（代码生成的视频）、产品视频、幻灯片、轮播帖、博客文章，每张名下一行说明，如「审阅需要你参与的界面和文案，agent 按确认的方案完成开发。」。预览是看板里真实的草稿组件（英文演示内容），第一次滚动后才逐个加载，六个都显示出来；轮播帖 10 秒内一直停在 1/8 的幻灯片网格，不弹放大图。
   ![标题和导语](04-zh-workflows-title.png) · ![钉住后第一张](05-zh-workflows-first.png) · ![滚到一半](06-zh-workflows-middle.png) · ![最后一张](07-zh-workflows-last.png) · ![轮播帖附近](08-zh-workflows-carousel-clone.png) · [home.log](home.log)

4. 滚过这一节，再分别点「体验演示」和「查看全部 agent 与工作流」。
   链接行只有这两个；链接行底到下一节标题约 271px。「体验演示」到 `/demo`（「AI4Kanban demo」），另一个到 `/docs/agents`。
   ![工作流一节之后](09-zh-after-workflows.png) · [home.log](home.log)

5. 继续滚到页尾。
   「继续用你熟悉的 AI 工具」一段说明加 8 个工具 logo（Claude Code、Codex、Cursor、OpenCode、DSH、ZCode、Grok Build、Kimi Code）；浅色底的「从下一个想法开始」：「下载桌面应用，打开项目，一起澄清你想做的事。」、一个「下载 — macOS」按钮和一行未签名说明，没有命令行安装那一行。整页只有这四个小节标题，原来的「多项工作并行推进」「下次不用从头解释」「做完一项……」都不在了，滚到底也没请求看板/卡片截图、任务图、办公室像素图或记忆、跟进场景。页脚「产品」一栏是「下载 · 体验演示 · Cloud · 定价 · 模板 · 培训 · 联系我们」。
   ![工具一节](10-zh-tools.png) · ![页尾](11-zh-start.png) · [home.log](home.log)

6. 打开英文首页 `/`。
   标签页标题「Agent workspace for indie hackers | AI4Kanban」，描述「From coding to marketing, AI4Kanban brings you drafts of the parts that need your judgment. Review them, then let agents handle the execution details.」，分享标题「You don’t have to manage every detail.」。标题「You don’t have to / manage every detail.」；各节依次是「Review the key parts. / Let agents do the rest.」「The right workflow for the work」「Keep the AI tools you already use」「Bring your next idea」；动画里的字是「You」「You review」「Agents take over」，气泡依次是「Launch a Pro plan」「Add dark mode」「30s v2 launch video」「v2 release blog post」「Carousel of 5 tips」。
   ![英文分工一节](12-en-handoff.png) · [home.log](home.log)

7. 用 375×667 的手机分别打开 `/es`、`/fr`、`/ja`、`/zh` 和 `/`，看分工动画转完五轮。
   每种语言都是 5 条、按同样的顺序轮换，第一条是原来那句（如「Lancer une offre Pro」）；最长的「Ajouter le mode sombre」「Vídeo de 30 s de la v2」「5枚の使い方カルーセル」在 327px 宽的动画里也是一行，不出画面，页面不横向滚动。
   ![法语气泡](13-phone-fr-idea.png) · [home.log](home.log)

8. 用 390px 宽的手机打开 `/zh`，滚过首屏和工作流一节。
   标题和导语先正常滚过；钉住的只有一张预览卡（335px 宽）、名称、说明、进度条和两个入口，整块从 106px 到 778px，完整放在 844px 高的屏幕里，从第一张滑到最后一张都一样；页面不横向滚动。
   ![手机首屏](14-phone-hero.png) · ![手机上工作流的标题](15-phone-workflows-title.png) · ![钉住的第一张](16-phone-workflows-pinned.png) · ![钉住的最后一张](17-phone-workflows-last.png) · [home.log](home.log)

9. 用 375×667 的手机打开英文 `/`，滚到工作流一节中间。
   钉住的预览卡、进度条、「Try the demo」和「See all agents and workflows」都在屏内（80px 到 627px），标题不在钉住区里。
   ![375 宽的英文钉住区](18-phone-375-en-pinned.png) · [home.log](home.log)

10. 打开系统的「减少动态效果」后打开 `/zh`。
   首屏录屏不播放，停在海报帧（`hero-demo-poster.webp`）；分工动画不动，同时画出「你把关」实线框和「agent 接手」虚线框；工作流不再钉住横移，六张卡片排成两列往下排。
   ![静止的分工图](19-reduced-handoff.png) · ![两列的工作流](20-reduced-workflows.png) · [home.log](home.log)

## Feedback

- **一条主线，读得快**：首屏「不用每个细节都亲自盯」直接说收益，往下一节讲怎么做到，再是工作流、工具和下载，五段读完不到两分钟，不再像以前那样八段卖点各说各的。
- **首屏不靠录屏**：标题、导语和按钮都是文字，录屏晚到也不影响理解；下载按钮现在能下到 v0.10.2。
- **分工一节信息密**：一段话里塞了澄清想法、草稿把关、agent 接手和并行推进四件事，最后一句「互不依赖的任务会同时推进」像是顺手带过，原来有截图的并行能力现在只剩这一句。
- **气泡轮换让用途变宽**：多看几轮就能看到写功能、做视频、写博客、做轮播图都走同一条路，比只演「上线 Pro 套餐」更能说明「从开发到营销」；换字藏在气泡隐去的瞬间，看不到跳变。但一轮 7 秒，看全五条要半分钟，多数人只会看到前一两条；手机上气泡字很小，法语页的气泡左上角还被「Vous validez」标签压住一角。
- **工作流卡片更好懂**：每张多了一行「审阅什么、agent 做什么」，不用看预览也知道分工；编程和视频复刻排在前面也符合多数访客的来意。但预览里全是英文演示内容，软件开发那张甚至还是旧标题「Let agents do the rest.」的首页草稿，和页面现在的说法对不上。
- **横移区仍要滚很久**：宽屏上要滚约一屏半才走完六张，进度条是唯一提示，滚轮快的人会以为页面卡住；手机上一次一张，节奏反而清楚。
- **记忆和跟进不见了**：这两个卖点和它们的 3D 场景都移去了文档，首页读者只能从工作流导语和文档入口间接发现。
- **页尾更干脆**：只剩下载一种方式，偏好命令行的人要自己去下载页或文档找 `npx` 安装。
