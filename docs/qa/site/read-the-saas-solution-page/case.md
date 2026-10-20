# 读 SaaS 方案页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×900，手机 390×844；脚本是 [saas.mjs](saas.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，首屏动画按真实时间截帧）。
- **读者**：一个人或小团队做 SaaS 的创始人，想知道 AI4Kanban 能不能同时帮他推进产品和营销。

## Steps

1. 在首页滚到页脚，点「SOLUTIONS」下的「For SaaS」（排在「For coding」后面）。
   到 `/solutions/saas`，页面标题「Agent workspace for SaaS development and marketing | AI4Kanban」；小标「AI4KANBAN FOR SAAS」，大标题两行「Build your SaaS. / Keep marketing moving.」，导语「An agent workspace for SaaS founders and small teams. Review key drafts for product and marketing; let agents finish the details.」
   [saas.log](saas.log)

2. 看标题下的插图，等几秒，再把鼠标移到插图右上角。
   浅灰看板斜放在白底上，带橙色描边的卡片升起、展开成一张抽象的卡片页（标题、橙色执行按钮、一份页面草稿），之后收回、卡片开始跑进度；画面宽高比 9:4，看板向下渐隐，没有文字也没有机器人。鼠标移上去，整幅画面跟着微微倾斜。
   ![开场](02a-hero-start.png) · ![卡片页展开](02b-hero-card-page.png) · [saas.log](saas.log)

3. 往下读。
   左侧「ON THIS PAGE」目录列出 8 项，和正文 8 个大节一一对应，依次是：同一看板上的产品与营销、把产品进展做成营销素材、发布的文案与客户邮件、按确认的草稿实现功能、项目背景与偏好延续、交付后的跟进、沿用自己的工具、按需定制。营销素材排在第二节，开发排到第四节。
   [saas.log](saas.log)

4. 读第二节「Turn product work into marketing material.」，看「Pro」那一行。
   四种素材各一行，先审什么、拿到什么：Blog post（大纲 → 带图和链接的全文）、Product video（脚本 → 成片和封面）、Slide deck（内容和幻灯片预览 → 每页一张图的 PowerPoint，文字和形状不能单独改）、Social post（文案 → 帖子和所选平台的配文，轮播另有逐页图片）。下面一行「Blog posts, product videos, slide decks and social posts require Pro. See plans」，「See plans」指向 `/pricing`。
   ![营销素材一节](03-marketing-material.png) · [saas.log](saas.log)

5. 读到最后一节，点「Request customization」。
   到 `/contact?reason=customize`，标题「Talk to us」，联系原因已选好「customize」。
   ![定制入口](04-customize.png) · [saas.log](saas.log)

6. 打开 `/zh/solutions/saas`，再打开 `/ja/solutions/saas`。
   中文标题两行「一边开发产品 / 一边推进营销」，导语「为 SaaS 创始人和小团队准备的 Agent 工作台。你把关产品与营销的关键草稿，agent 完成细节。」，Pro 一行「博客文章、产品视频、幻灯片和社媒帖需要 Pro。查看套餐」指向 `/zh/pricing`；日文标题「SaaS を作りながら、 / マーケティングも進める。」，Pro 一行「ブログ記事、製品動画、スライド、SNS投稿には Pro が必要です。」没有套餐链接（日文没有定价页）。
   ![中文首屏](05-zh-hero.png) · [saas.log](saas.log)

7. 用 390px 宽的手机打开 `/solutions/saas`。
   插图缩到 342×205（宽高比 5:3），主体完整，页面不横向滚动；目录折叠成一条「ON THIS PAGE」。
   ![手机首屏](06-phone-hero.png) · [saas.log](saas.log)

8. 打开系统的「减少动态效果」后重新打开页面。
   插图不动，直接显示看板和卡片的静止画面。
   ![减少动态效果时](07-reduced-motion.png) · [saas.log](saas.log)

## Feedback

- **改名落到了每种语言**：四种素材里的 Social post 写清是文案、各平台配文、轮播另有逐页图片；英、中、日三页的 Pro 一行都改成社媒帖 / social posts / SNS投稿，和定价页一致，做 LinkedIn 文字帖的创始人也看得出这页说的是自己。
- **短，像创始人的一周**：8 节，营销素材排第二，四种素材各一行「先审什么、拿到什么」，一眼能比较。
- **说清了限制**：幻灯片「每页一张图、文字不能单独改」直接写在列表里，不会买了才发现。
- **日文页没有套餐链接**：Pro 一行只说要 Pro，不给去处，日文读者要自己找英文定价页。
- **中文大小写不一**：导语先写「Agent 工作台」，后写「agent 完成细节」。
- **插图克制但抽象**：浅灰加一点橙，3D 有质感；没读正文前看不出浮起的是卡片页，而且和 coding 页首屏一模一样。
- **定制入口顺手**：「Request customization」直达联系表单并预选原因；页头「Resources」里仍找不到这一页。
