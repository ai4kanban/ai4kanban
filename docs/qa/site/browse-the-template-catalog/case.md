# 在官网模板目录里按分类浏览，看动效片段，复制一段提示词去 AI4Kanban 里用

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`，带 `--proxy-server`）；脚本是 [templates.mjs](templates.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。目录、封面和视频都由浏览器直接从线上 `api.ai4kanban.dev/v1/catalog` 读取，原视频走 YouTube 隐私增强嵌入。
- **替身**：线上 Cloud 还没部署 #1873，目录列表不带动效片段地址；第 3、11、12 步让脚本把列表换成线上列表加上各动效已登记的片段，第 4 步再加 10 份动效副本凑出第二页。其余都是线上数据。
- **读者**：想找一个现成的界面、视频或动效模板，交给自己 agent 用的访客，未登录。

## Steps

1. 打开 `/templates`。
   大标题「Templates」、副标题「Browse by category.」，右边同一行四个 tab：「UI 1 · Video 1 · Props 4 · Motion 4」；默认选中 UI，深橙色字、下方一道短橙条，其余灰字，都没有底色。下面只有 UI 的 1 张卡片，只请求了目录接口和这一张封面。
   ![UI tab](01-catalog-ui-tab.png) · [templates.log](templates.log)

2. 点「Motion」tab，再把鼠标移到「Narrow card widens into a line」上（线上目录）。
   地址变成 `/templates#motion`，浏览记录没有增加；4 张动效卡，封面 16:9 完整显示（原图 1280×720），右下角标播放图标和时长（如「▶ 0:03」）；这时才请求这 4 张封面。悬停后没有任何变化、不请求片段——线上列表还不带片段地址。
   ![Motion tab](02-motion-tab.png) · [templates.log](templates.log)

3. 换成带片段的目录（替身），打开 `/templates#motion`，悬停同一张，再移开。
   悬停前不加载任何片段；悬停后只请求这一张的 `clip.mp4`，片段就地静音循环播放，时长标签换成底部的橙色进度条，标题变橙；移开后片段消失，回到封面。
   ![悬停播放](03-hover-plays.png) · ![移开后](04-hover-left.png) · [templates.log](templates.log)

4. 一个 tab 有 14 个模板时（替身），看列表底部，点「Next」，再切到 Props 又切回 Motion。
   第 1 页 12 张，底部「‹ Previous · 1 · 2 · Next ›」，都是文字，当前页同 tab 一样是橙字加短橙条；点「Next」到第 2 页剩 2 张，页面滚回列表顶部。Props 只有 4 张，不显示分页；切回 Motion 回到第 1 页。
   ![分页](05-pager.png) · ![第 2 页](06-page-2.png) · [templates.log](templates.log)

5. 在 Video tab 点「UI walkthrough launch」。
   到 `/templates/video/ui-walkthrough-launch`：「Back to video templates」、名称、「Video」「Free」和一句说明；下面左右两格「Original video」（旁边「YouTube」外链）和「Recreation」，各是静态封面加播放按钮和「1:09」。右侧「Use this template」：「Paste it into AI4Kanban and add your topic.」，一块浅灰的提示词预览「Use the AI4Kanban video template "ui-walkthrough-launch" to make: <describe your product and what the video should show>」，下面橙色按钮「Copy prompt」；没有下载按钮、Pro 提示或定价链接。
   ![视频详情](07-video-detail.png) · [templates.log](templates.log)

6. 点「Copy prompt」。
   按钮变成「Copied」，剪贴板里正是预览里那段提示词；约 2 秒后按钮变回「Copy prompt」。
   ![已复制](08-copied.png) · [templates.log](templates.log)

7. 依次点「Original video」和「Recreation」上的播放按钮。
   原视频只多请求 `youtube-nocookie.com/embed/UAmKyyZ-b9E?autoplay=1`，换成 YouTube 播放器；复刻这时才请求 `recreation.mp4`，换成带控件、有声音的视频开始播放。
   ![两边都在播](09-both-playing.png) · [templates.log](templates.log)

8. 点「Back to video templates」。
   回到 `/templates#video`，选中的是 Video tab，列表里只有这一个视频模板。
   ![回到 Video tab](10-back-to-video.png) · [templates.log](templates.log)

9. 打开道具「Dark Chrome window」（`/templates/prop/chrome-window`）。
   「Props」「Free」，一张标「Keyframe」的关键帧，上方提示「Works inside a video template; it can't run on its own.」；提示词是「Make a video with AI4Kanban using the prop "chrome-window": <describe your video>」，下面仍有来源和采集时间。关键帧原图只有 480×270，被放大到 1104 宽，明显发虚。
   ![道具详情](11-prop-detail.png) · [templates.log](templates.log)

10. 打开中文的动效「Narrow card widens into a line」（`/zh/templates/motion/card-widen`），等 5 秒后点右下角的暂停。
    预览在左栏、638px 宽，标「预览」，打开就静音循环自动播放（4 秒片段，5 秒后回到 2.8 秒），底部一条橙色进度条，右下角暂停按钮；右栏只有「使用这个模板」，提示词「用 AI4Kanban 做一个视频，用上动效「card-widen」：<写下视频的主题和内容>」和「复制提示词」，没有「来源」。点暂停后片段停下，按钮变成「播放」。名称、简介和长说明仍是英文。
    ![中文动效在播](12-motion-zh-playing.png) · ![暂停后](13-motion-zh-paused.png) · [templates.log](templates.log)

11. 打开系统的「减少动态效果」，在列表悬停动效卡（替身），再打开动效详情。
    悬停不播放；详情页不自动播放，显示封面和播放按钮。
    ![减少动态效果时的详情](14-reduced-motion-detail.png) · [templates.log](templates.log)

12. 用 390px 宽的触屏手机打开 `/templates`，切到 Motion 往下滚（替身），再打开视频详情。
    tab 落在标题下方，一行放得下；页面宽 390，不横向滚动。滚到哪张、哪张就播放，同一时刻只有一段在播。视频详情里原视频和复刻上下排列，各占满宽度。
    ![手机目录](15-phone-catalog.png) · ![滚到可见的那张在播](16-phone-motion-visible-plays.png) · ![手机上的视频详情](17-phone-video-detail.png) · [templates.log](templates.log)

13. 打开一个不存在的模板 `/templates/prop/no-such-template`。
    页面写「This template is not available.」，下面一个「All categories」链回 `/templates`。
    ![模板不存在](18-missing.png) · [templates.log](templates.log)

## Feedback

- **分 tab 后清爽很多**：一次只看一类，封面按需加载，tab 和数量与标题同一行，扫一眼就知道各类有多少；但现在一共才 10 个模板，四个 tab 各只有 1–4 个，反而多点了一下。
- **动效终于看得出效果**：详情页打开就播、悬停就播，几秒钟能判断节奏合不合用，比原来一张小截图强得多；可线上目录接口还没部署，列表悬停目前什么都不发生，这部分访客还用不上。
- **复制提示词路线清楚**：模板名已经写好，只留主题要填，复制有即时反馈；但没装 AI4Kanban 的人在侧栏找不到下载入口，只能自己想到去顶栏。
- **切 tab 不进浏览记录**：点了几个 tab 再按后退，会直接离开模板页。
- **道具关键帧太小**：480 宽的图被拉到一千多像素，道具详情的大图明显发虚；动效详情改成最宽 640 后就没这个问题，道具页没跟上。
- **中文页一半是英文**：名称、简介、长说明都是英文，长说明里的「`HF` helpers `el` and `tl`」是内部说法，访客看不懂。
- **不存在的模板页太空**：只有一句话和一个链接，标签页标题还是「AI4Kanban: Templates」，没有提示是名字写错还是已下架。
