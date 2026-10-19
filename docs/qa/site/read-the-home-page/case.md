# 读官网首页

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`，带 `--proxy-server`），窗口 1440×900，手机 390×844 和 375×667；脚本是 [home.mjs](home.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，用 `ffmpeg` 把动画拼成 GIF）。首屏录屏来自线上 `cdn.ai4kanban.dev/home/`。
- **读者**：第一次听说 AI4Kanban、点进 `ai4kanban.dev` 想弄清它做什么的人，用 Mac 打开。

## Steps

1. 打开 `/zh`。
   标签页标题「独立开发者的 Agent 工作台 | AI4Kanban」。标题上方一行居中的橙色小字「独立开发者的 Agent 工作台」，标题两行「先看草稿 / 其余交给 Agent」，导语「从开发到营销，AI4Kanban 挑出任务中需要你把关的部分，提前做成草稿。……」，两个按钮：「下载 — macOS」直接给当前版本的 `.dmg`，「查看 GitHub ↗」。下面是 `/demo` 的录屏：静音、循环、无控件，自己播放（3 秒后从 3.9 秒走到 6.9 秒）。六个工作流预览这时还没加载（`iframe` 都没有地址）。
   ![中文首屏](01-zh-hero.png) · [home.log](home.log)
   实测「下载 — macOS」指向 `releases/download/v0.10.2/…`，这个 release 在 GitHub 上还不存在，点了是 404；与下载页同一原因，已在 site/download-the-desktop-app 第 4 步提交 triage。

2. 往下滚到「关键部分由你把关 / 后续交给 agent」。
   左边标题和导语「AI4Kanban 把想法中需要你把关的部分先做成草稿，让你能具体审阅、反复修改。确认后，agent 按草稿完成后续工作，你可以继续处理其他事务。」；右边是一段约 7 秒循环的动画：「你」的想法「上线 Pro 套餐」飞进「AI4Kanban」看板，看板出两张草稿，橙框标着「你把关」框住你和看板；两张草稿依次打勾；橙框移到看板和「Agent」之间，草稿交给 Agent。动画只在进入视野后播放，无障碍标签是一整句「你把想法交给 AI4Kanban，它整理成草稿供你把关；……」。
   ![定位一节](02-zh-review.png) · ![一个循环](03-zh-review-loop.gif) · [home.log](home.log)

3. 继续滚到「产品要开发，营销也要跟上」，一直往下滚过这一节。
   标题和导语先正常滚过；随后六张预览卡、一条进度条和下面的「体验演示」「查看全部 agent 与工作流」一起钉在页头下方，往下滚时整排卡片向左平移，1440 宽的屏上同时看到约两张，下一张露在右侧、出血到屏幕边，进度条从 0 走到 100%；滚完六张（软件开发、博客文章、产品视频、幻灯片、轮播帖、视频克隆（代码生成的视频））页面才继续往下。卡片下只有工作流名称，不标 Pro。每张预览是看板里真实的草稿组件（英文演示内容）：界面原型、README 文章、分镜、幻灯片、轮播帖、原片与复刻对照；第一次滚动后才逐个加载，六个都显示出来（`/demo/drafts/*` 返回 `X-Frame-Options: SAMEORIGIN`，不再是破图）。
   ![标题和导语](04-zh-workflows-title.png) · ![钉住后第一张](05-zh-workflows-first.png) · ![滚到一半](06-zh-workflows-middle.png) · ![最后一张](07-zh-workflows-last.png) · [home.log](home.log)

4. 停在轮播帖和视频克隆两张，看 10 秒。
   轮播帖预览一直停在 3×4 的幻灯片网格、第 1/8 张，不翻页、不弹出放大图；视频克隆预览里原片和复刻上下对照播放。两张图背后的水彩底左右镜像：轮播帖的橙色在右上，视频克隆的在左上。
   ![轮播帖和视频克隆](08-zh-workflows-carousel-clone.png) · [home.log](home.log)

5. 滚过这一节，再分别点「体验演示」和「查看全部 agent 与工作流」。
   链接行只有这两个，没有「Explore the coding workflow」；链接行底到下一节标题「多项工作并行推进」约 217px。「体验演示」到 `/demo`（标题「AI4Kanban demo」），另一个到 `/docs/agents`。
   ![工作流一节之后](09-zh-after-workflows.png) · [home.log](home.log)

6. 在「多项工作并行推进」点后面露出一截的那张图。
   两段说明产品和营销任务放在同一看板、互不依赖的并行推进；两张叠放的截图来自 `/demo`：前面是看板，后面是 #38 卡片页；点后面那张，它翻到前面（按钮标签从「切换到 Card 视图」变成「Card 视图（当前）」）。截图是英文界面。
   ![看板在前](10-zh-deck-board.png) · ![卡片页翻到前面](11-zh-deck-card.png) · [home.log](home.log)

7. 继续滚过「下次不用从头解释」和「做完一项，继续补缺补漏」。
   两节都是左文右图的 3D 动画场景，不再是简笔画：前一节场景在右，一张斜放的看板上浮起「Blog post: launch」草稿和「Memory」卡；后一节场景翻到左边，看板的 Done 列旁递出一张跟进卡。场景进入视野才动，里面的字是英文；两节之间只隔 48px。
   ![偏好记忆](12-zh-memory.png) · ![主动跟进](13-zh-followups.png) · [home.log](home.log)

8. 滚到页尾。
   「继续用你熟悉的 AI 工具」列出 Claude Code、Codex、Cursor 等 8 种工具；浅色底的「从第一项工作开始」，一个「下载 — macOS」按钮，下面说明构建未签名、首次打开会被拦，最后一行「偏好命令行？在项目里运行 npx ai4kanban@latest install。」页脚「产品」一栏是「下载 · 体验演示 · Cloud · 定价 · 培训 · 联系我们」，「体验演示」指向 `/demo`。
   ![页尾](14-zh-start.png) · [home.log](home.log)

9. 打开英文首页 `/`。
   标签页标题「Agent workspace for indie hackers | AI4Kanban」，描述「Specialist agents draft the key parts of coding and marketing tasks for you to review, then finish the work—so you spend less time checking and reworking it.」，分享标题「See the draft. Let agents do the rest.」。定位行「An agent workspace for indie hackers」，标题「See the draft. / Let agents do the rest.」；各节依次是「Review the key parts. / Agents do the rest.」「Build the product. Keep marketing moving.」「Move independent work forward together」「Start the next task with what you've already agreed」「Finish one piece of work. Catch what comes next.」「Keep the AI tools you already use」「Start with your first task」。动画里的字是「You」「Launch a Pro plan」「You review」「Agents take over」；工作流下的链接只有「Try the demo」「See all agents and workflows」。
   ![英文定位一节](15-en-review.png) · [home.log](home.log)

10. 用 390px 宽的手机打开 `/zh`，滚过首屏和工作流一节，再滚到「下次不用从头解释」。
    工作流的标题和导语先正常滚过；钉住的只有一张预览卡（335px 宽，右侧露出下一张的边）、名称、进度条和两个入口，整块从 133px 到 751px，完整放在 844px 高的屏幕里，从第一张滑到最后一张都一样；页面不横向滚动。记忆一节的 3D 场景高 217px，场景底到下一节标题 112px，没有大块空白。
    ![手机首屏](16-phone-hero.png) · ![手机上工作流的标题](17-phone-workflows-title.png) · ![钉住的第一张](18-phone-workflows-pinned.png) · ![钉住的最后一张](19-phone-workflows-last.png) · ![手机上的记忆场景](20-phone-memory.png) · [home.log](home.log)

11. 用 375×667 的手机打开英文 `/`，滚到工作流一节中间。
    钉住的预览卡、进度条、「Try the demo」和「See all agents and workflows」都在屏内（80px 到 627px），标题不在钉住区里。
    ![375 宽的英文钉住区](21-phone-375-en-pinned.png) · [home.log](home.log)

12. 打开系统的「减少动态效果」后打开 `/zh`。
    首屏录屏不播放，停在海报帧（`hero-demo-poster.webp`）；定位动画不动，同时画出「你把关」实线框和「agent 接手」虚线框；工作流不再钉住横移，六张卡片排成两列往下排。
    ![静止的定位图](22-reduced-review.png) · ![两列的工作流](23-reduced-workflows.png) · [home.log](home.log)

## Feedback

- **一眼知道给谁用、做什么**：定位行「独立开发者的 Agent 工作台」、两行标题加真实录屏，几秒钟就明白；标签页标题和描述也换成同一套说法，搜索结果和首屏终于对得上。
- **定位动画讲清了分工**：「你 → AI4Kanban → Agent」三拍，先框住你和看板、再移到看板和 Agent，比一段文字更直观；但它和首屏标题「先看草稿，其余交给 Agent」意思几乎一样，紧挨着读有点重复，导语也偏长。
- **工作流预览真实可信**：六张都是产品里的真实草稿组件，不再是手绘示意，轮播帖也不会突然弹出放大图；可预览里全是英文演示内容，中文读者要自己对照，字也小到只能看个大概。
- **横移区要滚很久**：宽屏上钉住的区块要滚约一屏半才走完六张，卡片上下各空出一百多像素，滚轮快的人会以为页面卡住；进度条是唯一提示，细到容易忽略。手机上一次只看一张，反而节奏更清楚。
- **入口更干净**：链接行只剩「体验演示」和「查看全部 agent 与工作流」，「体验演示」是按钮，页脚也有同名入口，想先玩一下的人很好找；工作流卡片不再标 Pro，付费范围要去定价页才知道。
- **3D 场景比简笔画精致**：记忆和跟进两节有质感、会动，两节之间也不再空一大段；但场景里的字很小又是英文，不看旁边的文字说不清它在演什么。
- **下载按钮是坏的**：首屏和页尾的「下载 — macOS」都指向尚未发布的 v0.10.2，这次本机构建点下去是 404；线上目前仍是 v0.10.1。
- **翻转卡组不好发现**：后面那张只露出一窄条边，也没有提示可以点。
