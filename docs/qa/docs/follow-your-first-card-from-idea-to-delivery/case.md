# 跟着「Your first card」把第一张卡从想法走到交付

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs`，窗口 1280×1000。
- **读者**：刚装好看板、想先看一遍一张卡从想法到交付长什么样的新用户。

## Steps

1. 点左栏「Start here」下的「Your first card」。
   进入 `/docs/first-card`，从页顶开始；分组「Start here」，标题「Your first card」；导语说描述想做什么、审草稿、要修改、满意了就构建并试用成品；开头一段先给「install the board」「connect a coding tool」两个链接，说本页跟着 `/demo` 里给虚构笔记应用 Notely 加加密同步的例子走；下面是带播放控件的演示视频；右侧目录是五个编号步骤，从「1. Explain the idea」到「5. Try the delivered work」。
   ![Your first card 页顶部](01-first-card-top.png)

2. 点视频。
   视频静音开始播放，约 33 秒；控件里时间在走。
   ![播放中的演示视频](02-video-playing.png)
   [播放状态](02-video-plays.log)

3. 点右侧目录里的「2. Review the screen draft」。
   滚到这一节：第一版 Sync 设置草稿（要设同步密码），图注写明「It is a draft, not the built feature」；接着是用「Revise」打开的讨论框，里面是要改成恢复密钥的那句话；再下面是改好的草稿（24 个词的恢复密钥、Download key、Copy、确认已保存才能 Turn on sync）。
   ![审草稿一节](03-review-the-screen-draft.png)

4. 点目录里的「5. Try the delivered work」。
   滚到最后一步：归档卡片的 Diff 截图（4 个文件、`SyncSettings.tsx` 把密码框换成恢复密钥、落地提交号），下面一段说到自己项目里对照批准的草稿逐项试；最后一句链到「the daily loop」。页上七张截图都加载出来。
   ![试用交付结果一节](04-try-the-delivered-work.png)

5. 回到页顶，点开头一段里的「interactive demo」。
   `/demo` 在新标签页打开，显示 Notely 的演示看板；文档页留在原标签页。
   ![打开的 /demo](05-demo.png)
   [标签页前后](05-demo-link.log)

6. 回到文档页，滚到页底。
   两张翻页卡：左「Previous / Overview」（Start here），右「Next / Draft review」（How it works）。
   ![页底翻页](06-pager.png)

## Feedback

- **终于有一条从想法走到交付的路**：五步编号、每步一张真界面截图，读完就知道一张卡会在哪几处停下来等你。
- **草稿和成品分得清**：草稿图注写明「不是做好的功能」，第 5 步用 Diff 和提交号说明交付在哪，不会误以为看板替你把应用跑起来了。
- **视频封面几乎是白的**：没点播放前，播放器里只有顶上一条细细的看板截图，中间一大片空白，像没加载出来；点了才知道是视频。
- **草稿截图字偏小**：第 2 步两张草稿按 59% 缩放截的，1280 宽下 Sync 设置里的小字要凑近看。
- **首页没指过来**：`/docs` 的「Read this first」仍只放「The daily loop」，新用户得自己在左栏发现这一页。
- **正文链接都开新标签页**：「interactive demo」「the daily loop」都另开一页，读一遍攒好几个标签页。
- **没有跑到的**：窄屏；视频完整播完；在自己的项目里真的照做一遍（要真实 agent）。
