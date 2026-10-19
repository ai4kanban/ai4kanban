# 在官网模板目录里按分类浏览，看原视频和复刻视频，再看一个道具和一个动效

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`，带 `--proxy-server`）；脚本是 [templates.mjs](templates.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。目录、封面和视频都由浏览器直接从线上 `api.ai4kanban.dev/v1/catalog` 读取，原视频走 YouTube 隐私增强嵌入。
- **读者**：想找一个现成的界面、视频或动效模板，交给自己 agent 用的访客，未登录。

## Steps

1. 打开 `/templates`，从头滚到底。
   大标题「Templates」，下面一行「Browse by category.」；依次四个区块，标题旁写数量：「UI templates · 1 template」「Video templates · 1 template」「Props · 4 templates」「Motion · 4 templates」，没有分类选择或「查看全部」。每张卡片是封面、名称和两行说明，「Free」叠在封面左上角；视频模板封面右下角还标时长「1:09」。滚完整页只请求了目录接口和 10 张静态封面，页面上没有任何 video 或 iframe。
   ![目录首屏](01-catalog-top.png) · ![道具和动效两个区块](02-props-and-motion.png) · [templates.log](templates.log)

2. 点视频区块里的「UI walkthrough launch」。
   进到 `/templates/video/ui-walkthrough-launch`：「Back to video templates」、名称、「Video」「Free」两个标记和一句说明；下面左右两格「Original video」（旁边一个「YouTube」外链）和「Recreation」，各是一张静态封面加播放按钮和「1:09」，还没加载任何视频。再往下是长说明、标签，右侧「Use this template」：「Download and sign in to AI4Kanban. Ask your agent to use this template.」和橙色按钮「Download AI4Kanban」，没有命令或终端代码；最下面是来源链接和采集时间。
   ![视频详情](03-video-detail.png) · [templates.log](templates.log)

3. 点「Original video」上的播放按钮。
   只多出一个请求：`youtube-nocookie.com/embed/UAmKyyZ-b9E?autoplay=1`，左格换成 YouTube 播放器开始播放；右格仍是静态封面。
   ![原视频在页内播放](04-original-playing.png) · [templates.log](templates.log)

4. 点「Recreation」上的播放按钮。
   这时才请求 Cloud 上的 `recreation.mp4`，右格换成带控件的视频并开始播放（几秒后进度约 3 秒）。
   ![复刻视频在播放](05-recreation-playing.png) · [templates.log](templates.log)

5. 点「Back to video templates」。
   回到 `/templates#video`，页面直接停在「Video templates」区块（标题在视口顶部下方约 100px）。
   ![回到视频区块](06-back-to-video.png) · [templates.log](templates.log)

6. 打开道具「Dark Chrome window」（`/templates/prop/chrome-window`）。
   名称下是「Props」「Free」；没有原作／复刻对照，只有一张完整显示、不裁切的关键帧（16:9），左上角标「Keyframe」。说明上方一行带图标的提示「Works inside a video template; it can't run on its own.」；说明、标签、使用入口和来源与其他类别相同。关键帧原图只有 480×270，被放大到 1104 宽，看得出发虚。
   ![道具详情](07-prop-detail.png) · [templates.log](templates.log)

7. 打开中文的动效「Narrow card widens into a line」（`/zh/templates/motion/card-widen`）。
   「返回动效」、「动效」「免费」；关键帧按 16:9 完整显示，标「关键帧」，说明上方提示「需在视频模板中使用，不能单独运行。」；标签、「使用这个模板」「下载 AI4Kanban」「来源」「采集时间」都是中文，但名称、一句话简介和长说明仍是英文，长说明里还写着「the `HF` helpers `el` and `tl`」。
   ![中文动效详情](08-motion-detail-zh.png) · [templates.log](templates.log)

8. 用 390px 宽的手机打开视频详情，再打开道具「macOS Open panel」。
   视频详情里原视频和复刻视频上下排列，各占满宽度；道具关键帧同样满宽完整显示。两页都没有横向滚动（页面宽度 390）。
   ![手机上的视频详情](09-phone-video-detail.png) · ![手机上的道具详情](10-phone-prop-detail.png) · [templates.log](templates.log)

9. 打开一个不存在的模板 `/templates/prop/no-such-template`。
   页面写「This template is not available.」，下面一个「All categories」链回 `/templates`。
   ![模板不存在](11-missing.png) · [templates.log](templates.log)

## Feedback

- **一屏看全，路径短**：首页直接按类别列出全部 11 个模板，点一下就到详情，没有先选分类这一步；模板少的时候这样最省事。
- **对照做得克制**：原视频和复刻视频并排，点哪边才加载哪边，滚动目录不会拖慢页面，YouTube 也走了隐私增强模式。
- **道具和动效说清了身份**：「Keyframe」标注加一行「需在视频模板中使用」，一眼明白这不是能单独跑的成品；关键帧完整显示，不再被裁掉底部。
- **关键帧太小**：480 宽的预览图被拉到一千多像素，道具详情的大图明显发虚，反倒不如首页小封面清楚。
- **中文页一半是英文**：名称、简介、长说明都是英文，长说明里的「`HF` helpers `el` and `tl`」是内部说法，访客看不懂；道具和动效的「来源」都指向同一支 YouTube 视频，容易以为点错。
- **说明太长**：视频模板的长说明是一整段技术描述，读到「Use this template」前要翻过很长一屏，手机上尤其明显。
- **不存在的模板页太空**：只有一句话和一个链接，标签页标题还是「Templates」，没有提示是名字写错还是已下架。
