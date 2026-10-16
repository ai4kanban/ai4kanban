# 读 SaaS 方案页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×900，手机 390×844；脚本是 [saas.mjs](saas.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，首屏动画按真实时间截帧）。
- **读者**：一个人或小团队做 SaaS 的创始人，想知道 AI4Kanban 能不能同时帮他推进产品和营销。

## Steps

1. 在首页滚到页脚，点「SOLUTIONS」下的「For SaaS」（排在「For coding」后面）。
   到 `/solutions/saas`，页面标题「Build and market your SaaS | AI4Kanban」；小标「AI4KANBAN FOR SAAS」，大标题两行「Build your SaaS. / Keep marketing moving.」，导语「A workspace for SaaS founders and small teams. Review key drafts, approve them, and let agents finish the details.」
   [saas.log](saas.log)

2. 看标题下的插图，等几秒，再把鼠标移到插图右上角。
   浅灰看板斜放在白底上，带橙色描边的卡片升起、展开成一张抽象的卡片页（标题、橙色执行按钮、一份页面草稿），之后收回、卡片开始跑进度；画面宽高比 9:4，看板向下渐隐，没有文字也没有机器人。鼠标移上去，整幅画面跟着微微倾斜。
   ![开场](02a-hero-start.png) · ![卡片页展开](02b-hero-card-page.png) · [saas.log](saas.log)

3. 往下读。
   左侧「ON THIS PAGE」目录列出 14 项；正文 11 个大节，从「Product work and marketing, on the same board.」到「Make the workflow fit your SaaS.」，覆盖草稿审阅、配图、文案、竞品调研、客户邮件、营销素材、偏好记忆、交付后跟进、沿用自己的工具。
   [saas.log](saas.log)

4. 读到营销素材一节，看「Pro」那一行。
   「Carousel posts and product videos require Pro. See plans」，「See plans」指向 `/pricing`。
   [saas.log](saas.log)

5. 读到最后一节，点「Request customization」。
   到 `/contact?reason=customize`，标题「Talk to us」，联系原因已选好「customize」。
   ![定制入口](04-customize.png) · [saas.log](saas.log)

6. 打开 `/zh/solutions/saas`，再打开 `/ja/solutions/saas`。
   中文标题两行「一边开发产品 / 一边推进营销」，Pro 一行「轮播帖和产品视频需要 Pro。查看套餐」指向 `/zh/pricing`；日文标题「SaaS を作りながら、 / マーケティングも進める。」，Pro 一行没有套餐链接（日文没有定价页）。
   ![中文首屏](05-zh-hero.png) · [saas.log](saas.log)

7. 用 390px 宽的手机打开 `/solutions/saas`。
   插图缩到 342×205（宽高比 5:3），主体完整，页面不横向滚动；目录折叠成一条「ON THIS PAGE」。
   ![手机首屏](06-phone-hero.png) · [saas.log](saas.log)

8. 打开系统的「减少动态效果」后重新打开页面。
   插图不动，直接显示看板和卡片的静止画面。
   ![减少动态效果时](07-reduced-motion.png) · [saas.log](saas.log)

## Feedback

- **说的是创始人的事**：标题一句话点出「做产品 + 做营销」，正文按真实任务（落地页、发布视频、客户邮件、竞品调研）组织，不像在推销一个不存在的 SaaS 工作流。
- **插图克制好看**：浅灰加一点橙，3D 动起来有质感，一眼能看出「卡片 → 草稿 → 执行」；但它很抽象，没读正文前看不出那张浮起的是卡片页。
- **页面很长**：11 节、14 条目录，一个忙碌的创始人很难读完；正文配图复用 coding 页截图，读过 coding 页的人会有重复感。
- **定制入口顺手**：「Request customization」直达联系表单并预选原因，不用再填一遍。
- **收尾有下一步**：页尾就有「Download」和「Setup guide」，读完能直接去试（coding 页没有）；但入口只在页脚，页头「Resources」里找不到这一页。
