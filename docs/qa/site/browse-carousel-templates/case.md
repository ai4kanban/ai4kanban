# 在官网模板目录里看图文模板：先见骨架，再翻整套竖屏页面，动态页自己播放

## Setup

- **站点**：官网（`web/`，main `291eb306`）拷到 `/tmp` 做静态构建，用 `cloud/node_modules` 里的 wrangler `pages dev out` 跑在本机（地址给 `SITE`）；无头 Chrome 开远程调试（`CDP_PORT`），脚本是 [carousel.mjs](carousel.mjs)（用 [cdp.mjs](cdp.mjs) 驱动）。目录和模板都由浏览器从线上 `api.ai4kanban.dev/v1/catalog` 读取，取证时有 `warm-explainer`（8 页动态页）和 `long-read`（7 页静态页）两个图文模板。
- **没有快照的站点**：第 1 步和第 3 步前半用同一份代码的第二份构建（地址给 `EMPTY`），构建时 [catalog-stand-in.mjs](catalog-stand-in.mjs) 对目录接口回 503，页面里就没有构建时的快照，和线上快照过旧时一样；构建完再让它把请求转给线上 Cloud。
- **压住 Cloud**：要看骨架的几步，脚本先扣住浏览器对目录接口的请求，截完图再放行。
- **读者**：想找一套轮播图模板，先看整套页面长什么样的访客，未登录。

## Steps

1. 在没有快照的站点打开 `/templates#carousel`，Cloud 还没回话。
   标题「Templates」「Browse by category.」照常显示；分类 tab 的位置是 5 根短灰条，下面一排 4 张 3:4 竖屏的灰色卡片骨架（252×336）加标题和两行简介的灰条，轻轻呼吸；页面上没有「Loading…」字样，只有读屏能读到「Loading templates…」。
   ![目录骨架](01-catalog-loading.png) · [carousel.log](carousel.log)

2. 放行 Cloud。
   骨架原位换成内容，留在 `#carousel`：tab 是「UI 1 · Video 1 · Props 4 · Motion 4 · Carousel 2」，选中「Carousel」；两张卡片「Warm animated explainer」「Long-read carousel」都是 252×336 的竖屏封面，`warm-explainer` 的封面是它的第 1 页。鼠标停在「Warm animated explainer」上，卡片不播放、不请求任何视频。
   ![图文分类](02-catalog-carousel.png) · [carousel.log](carousel.log)

3. 打开 `/templates/carousel/warm-explainer`，Cloud 还没回话：先在没有快照的站点，再在正常构建上。
   没有快照时，只有「Back to carousel templates」是真字，标题、标签、简介、说明和右侧「使用」栏都是灰条，预览区是一条 5 张 4:5 竖屏骨架（333×416）。有快照时，名称、「Carousel」「Free」和简介立刻出现，只有预览区还是骨架，不先闪出旧版的单张图。
   ![没有快照的详情骨架](03-detail-loading-no-snapshot.png) · ![有快照时只等预览](04-detail-loading.png) · [carousel.log](carousel.log)

4. 放行 Cloud。
   预览区换成标着「8 pages」的页面带，8 页一样高（333×416）、按自身 4:5 比例排开；视野里的前 4 页各自静音循环播放，只请求了这 4 页的 `.mp4`，后 4 页还没加载。右侧「Use this template」下的提示词是「Use the AI4Kanban carousel template "warm-explainer" to make: <describe your topic>」和「Copy prompt」。
   ![前 4 页在播](05-detail-playing.png) · [carousel.log](carousel.log)

5. 把页面带横滑到最后。
   第 5–8 页进入视野，这时才请求它们的视频并开始播放；滑出去的前 4 页暂停。
   ![滑到最后](06-detail-strip-end.png) · [carousel.log](carousel.log)

6. 打开 `/templates/carousel/long-read`。
   标「7 pages」，7 张静态图（313×416，3:4），不请求任何视频。
   ![静态的长文轮播](07-long-read.png) · [carousel.log](carousel.log)

7. 打开中文的 `/zh/templates#carousel`，再点进 `warm-explainer`。
   tab 是「界面 1 · 视频 1 · 道具 4 · 动效 4 · 图文 2」，选中「图文」；详情页返回链接「返回图文模板」，标签「图文」「免费」，页数「共 8 页」，提示词「用 AI4Kanban 的图文模板「warm-explainer」做：<写下你的主题和内容>」，按钮「复制提示词」；8 页仍是英文示例页，名称、简介和说明也是英文。
   ![中文详情](08-zh-detail.png) · [carousel.log](carousel.log)

8. 打开系统的「减少动态效果」，再打开 `warm-explainer`，点第 1 页的播放键。
   8 页都只显示封面帧，中间一个播放键（读屏名「Play」），不请求任何视频；点第 1 页后只有它请求视频并播放，其余仍停在封面。
   ![封面加播放键](09-reduced-covers.png) · [carousel.log](carousel.log)

9. 让第 2 页的视频加载失败，再打开 `warm-explainer`。
   第 2 页停在它的封面帧（原图 1080×1350），不出现破图或黑框；其他页照常播放。
   ![第 2 页停在封面](10-page-2-failed.png) · [carousel.log](carousel.log)

10. 用 390px 宽的触屏手机打开 `warm-explainer`，再回到 `/templates#carousel`。
    页面带里一页几乎占满屏宽（325×406），右边露出下一页的边；页面不横向滚动。目录里两张卡片一行一张，都是 342×456 的竖屏封面。
    ![手机上的页面带](11-phone-detail.png) · [carousel.log](carousel.log)

## Feedback

- **一眼看出是一整套**：竖屏页面带比原来一张横图清楚得多，动态页一滑进来就动，`warm-explainer` 的卖点终于看得见。
- **骨架安静、不跳**：骨架和成品同尺寸，内容到了原位替换；有快照时文字先出、只等预览，等待感很短。
- **中文站看不到中文排版**：页面、名称、简介和说明全是英文，只有 tab、标签和提示词是中文；中文读者要靠想象判断中文效果。
- **4:5 封面在 3:4 卡片里被裁**：`warm-explainer` 的封面是 4:5，目录卡片统一 3:4 并用 `cover` 填满，左右各被裁掉一窄条；`long-read` 正好 3:4 不受影响。
- **流量提示缺失**：滑完 `warm-explainer` 要下 8 段视频，页面上没有任何提示；手机用户在流量下浏览时不知道。
- **手机上说明换行生硬**：详情页的长说明保留了原文的硬换行，390 宽的屏上一行只剩「per」「Data is」这样的半截。
- **一共只有两个**：分类 tab 写着「Carousel 2」，可挑的余地还很小。
