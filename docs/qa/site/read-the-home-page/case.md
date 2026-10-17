# 读官网首页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1440×900，手机 390×844；脚本是 [home.mjs](home.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。录屏和插图来自线上 `cdn.ai4kanban.dev/home/`。
- **读者**：第一次听说 AI4Kanban、点进 `ai4kanban.dev` 想弄清它做什么的人，用 Mac 打开。

## Steps

1. 打开 `/zh`。
   标题上方一行居中的橙色小字「独立创业者的 Agent 工作台」（左边没有竖线），标题分两行「先看草稿 / 其余交给 Agent」，导语「从开发到营销，AI4Kanban 挑出任务中需要你把关的部分，提前做成草稿。你改好关键部分，Agent 完成后续工作，让你不必每件事都亲自盯、来回改。」，两个按钮：「下载 — macOS」直接给 v0.10.1 的 `.dmg`，「查看 GitHub ↗」。下面是 `/demo` 的录屏：静音、循环、无控件，自己播放（3 秒后从 3.1 秒走到 6.1 秒）。
   ![中文首屏](01-zh-hero.png) · [home.log](home.log)

2. 往下滚到「关键部分先看草稿，方向不对现在就改。」，继续滚。
   标题上方没有色条和编号。标题、导语「agent 把关键部分做成草稿，放在任务卡片上。先看、先改，再开始后续工作。」、左边四种草稿（UI 原型、文案稿、分镜、配图，各一行说明）和右边的配图一起固定在页头下方（标题始终在距顶 80px 处），整块在 900px 高的窗口里放得下，底边在 675px；滚动时高亮框依次滑过四种类型，右侧配图同步换成对应的草稿；列表下方是小字收尾句「你不用把每个细节都规定好……」。
   ![高亮在 UI 原型](02-zh-drafts-ui.png) · [home.log](home.log)

3. 滚回这一节开头，点左边的「分镜」，再点「UI 原型」。
   页面平滑滚到该项的停驻位置，高亮框落在被点的那一项上，右侧配图换成对应的草稿（点「分镜」后是脚本作者的静态分镜）。
   ![点「分镜」之后](03-zh-drafts-script.png) · [home.log](home.log)

4. 继续滚过「这次提过的意见，下次不用再说。」和「让 agent 替你查缺补漏」。
   两节标题上方都没有编号。前一节配一张简笔画（一个人提意见，机器人照做几份草稿），下方小字「产品视频、幻灯片、轮播帖和博客文章需要 Pro。」；后一节配机器人拿放大镜找出遗漏、递给人一条跟进的简笔画。两张图都直接画在白底上，没有截图框。
   ![意见记住](04-zh-agents.png) · ![查缺补漏](05-zh-followups.png) · [home.log](home.log)

5. 滚到「多项工作一起推进，关键决定交给你。」，点后面露出一截的那张图。
   两张叠放的截图来自 `/demo`：前面是看板，后面是 #38 卡片页；点后面那张，它翻到前面（按钮标签从「切换到 Card 视图」变成「Card 视图（当前）」）。截图是英文界面。
   ![看板在前](06-zh-deck-board.png) · ![卡片页翻到前面](07-zh-deck-card.png) · [home.log](home.log)

6. 滚到页尾。
   「写下一个想法，先看看草稿。」，一个「下载 — macOS」按钮，下面说明构建未签名、首次打开会被拦，最后一行「偏好命令行？在项目里运行 npx ai4kanban@latest install。」
   ![页尾](08-zh-start.png) · [home.log](home.log)

7. 打开英文首页 `/`。
   定位行「An agent workspace for indie hackers」，标题分两行「See the draft. / Let agents do the rest.」，导语「From coding to marketing, AI4Kanban brings you drafts of the parts that need your judgment. Review, refine, and let agents take it from there—without having to manage every detail.」。页面标题「See the draft before agents get to work | AI4Kanban」，meta description 仍是旧定位（「AI4Kanban prepares key drafts for tasks on your board…」）。四种草稿叫 UI mockup、Copy draft、Storyboard、Figures，说明各一行（如「Preview layout and interactions.」）。
   [home.log](home.log)

8. 用 390px 宽的手机打开 `/zh`，先看首屏，再滚到草稿一节。
   首屏的定位行同样居中，标题占两行；草稿一节不再固定：四种类型上下排列，每种的说明下直接跟它的配图；页面不横向滚动。
   ![手机首屏](09-phone-hero.png) · ![手机上的草稿板块](10-phone-drafts.png) · [home.log](home.log)

9. 打开系统的「减少动态效果」后打开 `/zh`。
   首屏录屏不播放，停在首帧（`hero-demo-poster-v1.jpg`）。
   [home.log](home.log)

## Feedback

- **一眼知道给谁用**：新加的定位行「独立创业者的 Agent 工作台」先回答了「这是给谁的」，两行标题把分工说清——人看草稿，其余交给 Agent；配上真实的 `/demo` 录屏，几秒钟就明白产品做什么。
- **导语偏长**：中文导语在桌面上占两行、手机上占四行，「挑出…提前做成草稿」「改好关键部分」两处意思和标题重复，扫读的人多半跳过。
- **对外说法不一致**：页面标题、meta description 和 `llms.txt` 的 Home 一行还是旧定位，没提独立创业者和营销；搜索结果和 AI 摘要里看到的，和点进来看到的首屏不是一套话。
- **草稿一节终于一屏装下**：去掉编号、说明压成一行后，标题、列表、配图和收尾句同时在眼前，配图不再沉到下面；左边四项能点，点一下直接跳到那一项，不用慢慢滚。
- **还是费滚动**：不点的话，固定区要滚 1.5 屏才走完四种类型，滚轮快的人会觉得页面卡住了；点击跳转没有任何外观提示，只有鼠标变成手形。不支持滚动驱动动画的浏览器（如 Firefox）看到的是手机式排列，这次没在 Firefox 里实测。
- **没了编号更清爽**：各节只剩标题，读起来不像在数章节；代价是长页面里少了一点「读到哪了」的感觉。
- **简笔画**：亲切、一眼看懂，和上下的真实界面截图风格反差明显。
- **中文页里是英文界面**：录屏、草稿一节的 UI 原型和卡组的两张截图都是英文的 notely 演示项目，中文读者只能自己对照着理解。
- **翻转卡组不好发现**：后面那张只露出 40px 一条边，也没有提示可以点。
