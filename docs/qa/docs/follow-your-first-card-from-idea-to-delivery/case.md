# 跟着「Your first card」把第一张卡从想法走到交付

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs`，窗口 1280×1000。
- **读者**：刚装好看板、想先看一遍一张卡从想法到交付长什么样的新用户。

## Steps

1. 点左栏「Start here」下的「Your first card」。
   进入 `/docs/first-card`，从页顶开始；标题「Your first card」；开头一段先给「install the board」「connect a coding tool」两个链接，说本页跟着 `/demo` 里给虚构笔记应用 Notely 加加密同步的例子走；下面是带播放控件的演示视频，封面是演示看板；右侧目录五个编号步骤，从「1. Explain the idea」到「5. Try the delivered work」。
   ![Your first card 页顶部](01-first-card-top.png)
   [页面结构](first-card.log)

2. 点视频。
   视频静音开始播放，约 33 秒，时间在走。
   ![播放中的演示视频](02-video-playing.png)
   [播放状态](02-video-plays.log)

3. 点右侧目录里的「2. Review the screen draft」，往下读到改好的草稿。
   第一版 Sync 设置草稿（要设同步密码），草稿框标题行只有折叠箭头、「Sync settings」和两个图标，图注写明「It is a draft, not the built feature」；接着是用「Revise」打开的讨论框；再下面是改好的草稿（24 个词的恢复密钥、Download key、Copy、确认已保存才能 Turn on sync），标题行同样精简。
   ![第一版草稿](03-review-the-screen-draft.png)
   ![改好的草稿](03-revised-draft.png)

4. 点目录里的「4. Build and deliver」。
   这一节说按「Build」后在 Runs 看进度；配图是归档页里的 #39，草稿框标题行与第 3 步一致，图注「After the build lands, #39 moves to Archive.」。
   ![构建与交付一节](04-build-and-deliver.png)
   ![归档卡片截图](04-archived-card.png)

5. 点目录里的「5. Try the delivered work」。
   归档卡片的 Diff 截图（4 个文件、`SyncSettings.tsx` 把密码框换成恢复密钥、落地提交号），下面说到自己项目里对照批准的草稿逐项试；最后一句链到「the daily loop」。页上七张图都加载出来。
   ![试用交付结果一节](05-try-the-delivered-work.png)

6. 回到页顶，点开头一段里的「interactive demo」。
   `/demo` 在新标签页打开，显示 Notely 的演示看板；文档页留在原标签页。
   ![打开的 /demo](06-demo.png)
   [标签页前后](06-demo-link.log)

7. 回到文档页，滚到页底。
   两张翻页卡：左「Previous / Overview」（Start here），右「Next / Draft review」（How it works）。
   ![页底翻页](07-pager.png)

## Feedback

- **草稿截图和应用对上了**：三张图里的草稿框都是现在应用里的精简标题行，不再有橙色大写标签和文件路径，下载应用后看到的就是这个样子。
- **从想法走到交付的路很完整**：五步编号、每步一张真界面截图，读完就知道一张卡会在哪几处停下来等你。
- **视频封面不再像没加载**：现在封面就是演示看板，一眼看得出是段视频。
- **首页终于指过来了**：`/docs` 的「Deliver your first card」直接放了这页的卡片。
- **草稿截图字偏小**：Sync 设置里的小字在 1280 宽下要凑近看。
- **用词没跟上首页**：首页说「Connect a coding agent」，这页开头还是「connect a coding tool」。
- **正文链接都开新标签页**：读一遍攒好几个标签页。
- **没有跑到的**：窄屏；视频完整播完；在自己的项目里真的照做一遍（要真实 agent）。
