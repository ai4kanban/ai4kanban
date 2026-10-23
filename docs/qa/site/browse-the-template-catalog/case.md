# 在官网模板目录里按分类浏览，看动效片段，复制一段提示词去 WildCrane 里用

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`，带 `--proxy-server`）；脚本是 [templates.mjs](templates.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。目录、封面和视频都由浏览器直接从线上 `api.ai4kanban.dev/v1/catalog` 读取，原视频走 YouTube 隐私增强嵌入。
- **替身**：线上目录列表现在已带动效片段地址（第 2 步悬停即播）；脚本仍在第 3、11、12 步把列表换成线上列表、片段改用各动效详情里登记的视频，行为与第 2 步线上一致；第 4 步再加 10 份动效副本凑出第二页。其余都是线上数据。
- **读者**：想找一个现成的界面、视频或动效模板，交给自己 agent 用的访客，未登录。

## Steps

1. 打开 `/templates`。
   大标题「Templates」、副标题「Browse by category.」，右边同一行五个 tab：「UI 1 · Video 1 · Props 4 · Motion 4 · Carousel 3」；默认选中 UI，深橙色字、下方一道短橙条，其余灰字，都没有底色。下面只有 UI 的 1 张卡片「Headline over a tilted product screen」，只请求了目录接口和这一张封面；标签页标题「WildCrane: Templates」。
   ![UI tab](01-catalog-ui-tab.png) · [templates.log](templates.log)

2. 点「Motion」tab，再把鼠标移到「Narrow card widens into a line」上（线上目录）。
   地址变成 `/templates#motion`，浏览记录没有增加；4 张动效卡，封面 16:9 完整显示（原图 1280×720），右下角标播放图标和时长（「▶ 0:03」「▶ 0:03」「▶ 0:04」「▶ 0:05」）；这时才请求这 4 张封面。悬停后只请求这一张的 `clip.mp4`，片段静音循环播放——线上列表已带片段地址。
   ![Motion tab](02-motion-tab.png) · [templates.log](templates.log)

3. 换成带片段的目录（替身），打开 `/templates#motion`，悬停同一张，再移开。
   悬停前不加载任何片段；悬停后只请求这一张的 `clip.mp4`，片段就地静音循环播放，时长标签换成底部的橙色进度条，标题变橙；移开后片段消失，回到封面。
   ![悬停播放](03-hover-plays.png) · ![移开后](04-hover-left.png) · [templates.log](templates.log)

4. 一个 tab 有 14 个模板时（替身），看列表底部，点「Next」，再切到 Props 又切回 Motion。
   第 1 页 12 张，底部「‹ Previous · 1 · 2 · Next ›」，都是文字，当前页同 tab 一样是橙字加短橙条；点「Next」到第 2 页剩 2 张，页面滚回列表顶部。Props 只有 4 张，不显示分页；切回 Motion 回到第 1 页。
   ![分页](05-pager.png) · ![第 2 页](06-page-2.png) · [templates.log](templates.log)

5. 在 Video tab 点「UI walkthrough launch」。
   到 `/templates/video/ui-walkthrough-launch`：「Back to video templates」、名称、「Video」「Pro」和一句说明；下面左右两格「Original video」（旁边「YouTube」外链）和「Recreation」，各是静态封面加播放按钮和「1:09」。右侧「Use this template」：「Paste it into WildCrane and add your topic.」，一块浅灰的提示词预览「Use the WildCrane video template "ui-walkthrough-launch" to make: <describe your product and what the video should show>」，下面橙色按钮「Copy prompt」；侧栏没有下载按钮或定价链接，下面是来源（YouTube 链接）和采集时间 2026-10-16。
   ![视频详情](07-video-detail.png) · [templates.log](templates.log)

6. 点「Copy prompt」。
   按钮变成「Copied」，剪贴板里正是预览里那段提示词；2.9 秒后再看，按钮已变回「Copy prompt」。截图里按钮在画面外，以日志为准。
   ![已复制](08-copied.png) · [templates.log](templates.log)

7. 依次点「Original video」和「Recreation」上的播放按钮。
   原视频只多请求 `youtube-nocookie.com/embed/UAmKyyZ-b9E?autoplay=1&rel=0`，换成 YouTube 播放器；复刻这时才请求 `recreation.mp4`，换成带控件、有声音的视频开始播放。
   ![两边都在播](09-both-playing.png) · [templates.log](templates.log)

8. 点「Back to video templates」。
   回到 `/templates#video`，选中的是 Video tab，列表里只有这一个视频模板。
   ![回到 Video tab](10-back-to-video.png) · [templates.log](templates.log)

9. 打开道具「Dark Chrome window」（`/templates/prop/chrome-window`）。
   「Props」「Pro」，一张标「Keyframe」的关键帧，下方提示「Works inside a video template; it can't run on its own.」；提示词是「Make a video with WildCrane using the prop "chrome-window": <describe your video>」，下面仍有来源和采集时间。关键帧原图只有 480×270，被放大到 1102 宽，明显发虚。
   ![道具详情](11-prop-detail.png) · [templates.log](templates.log)

10. 打开中文的动效「Narrow card widens into a line」（`/zh/templates/motion/card-widen`），等 5 秒后点右下角的暂停。
    预览在左栏、638px 宽，标「预览」，打开就静音循环自动播放（列表标 0:04；打开时在 1.5 秒，5 秒后在 2.4 秒，已循环过一遍），底部一条橙色进度条，右下角暂停按钮；右栏只有「使用这个模板」：「粘贴到 WildCrane，再补上你的主题。」、提示词「用 WildCrane 做一个视频，用上动效「card-widen」：<写下视频的主题和内容>」和「复制提示词」，没有「来源」。点暂停后片段停下，按钮变成「播放」。名称、简介和长说明仍是英文，页顶有「This page is available in English. Switch to English」横条。
    ![中文动效在播](12-motion-zh-playing.png) · ![暂停后](13-motion-zh-paused.png) · [templates.log](templates.log)

11. 打开系统的「减少动态效果」，在列表悬停动效卡（替身），再打开动效详情。
    悬停不播放；详情页不自动播放，显示封面和播放按钮。
    ![减少动态效果时的详情](14-reduced-motion-detail.png) · [templates.log](templates.log)

12. 用 390px 宽的触屏手机打开 `/templates`，切到 Motion 往下滚（替身），再打开视频详情。
    tab 落在标题下方，一行放得下；页面宽 390，不横向滚动。滚到哪张、哪张就播放，同一时刻只有一段在播。视频详情里原视频和复刻上下排列，各占满宽度。
    实测失败：新增「Carousel」后 tab 一行放不下——tab 行内容宽 411、可见 390，「Carousel 3」被屏幕右边切掉；页面本身仍是 390 宽，滚动播放和视频详情都符合预期。已报待筛选。
    ![手机目录](15-phone-catalog.png) · ![滚到可见的那张在播](16-phone-motion-visible-plays.png) · ![手机上的视频详情](17-phone-video-detail.png) · [templates.log](templates.log)

13. 打开一个不存在的模板 `/templates/prop/no-such-template`。
    页面写「This template is not available.」，下面一个「All categories」链回 `/templates`。
    ![模板不存在](18-missing.png) · [templates.log](templates.log)

## Feedback

- **改名干净**：页头、标签页标题、提示词、侧栏说明都已是 WildCrane，复制出去的提示词不会再带旧名。
- **分 tab 清爽**：一次只看一类，封面按需加载，数量和标题同一行；但一共 13 个模板分五个 tab，各 1–4 个，多点了一下。
- **动效列表终于能看了**：线上悬停即播，几秒能判断节奏；详情页打开就播、可暂停。
- **手机上 tab 被切掉**：第五个 tab「Carousel」露出半截，没有提示可以横滑，容易漏掉一整类。
- **复制提示词路线清楚**：模板名写好、只留主题要填，有即时反馈；但没装 WildCrane 的人在侧栏找不到下载入口，只能自己去顶栏。
- **切 tab 不进浏览记录**：点了几个 tab 再按后退，会直接离开模板页。
- **道具关键帧发虚**：480 宽的图被拉到 1102 宽，动效详情限宽后没这问题，道具页没跟上。
- **中文页一半是英文**：名称、简介、长说明都是英文，「`HF` helpers `el` and `tl`」是内部说法，访客看不懂。
- **不存在的模板页太空**：只有一句话和一个链接，标签页标题只是「WildCrane: Templates」，不说是写错还是已下架。
