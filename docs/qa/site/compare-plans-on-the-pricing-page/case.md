# 在定价页比较免费版和 Pro

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），打开 `/pricing`，窗口 1280×1000；脚本是 [pricing.mjs](pricing.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：在决定要不要付费的人。

## Steps

1. 打开 `/pricing`。
   标签页标题「WildCrane: Plans and pricing」，大标题「Plans and pricing」，导语只有一句「Every plan runs on your own computer, with your own AI tools.」。默认选中「Yearly · Save 33%」。左边 Free $0（Apache 2.0 开源，按钮「Download」），五项里第二项是「All 6 workflows」，旁边一个折叠箭头；右边 Pro $120 / year、划掉的 $180，下面「$10 a month, billed yearly」，按钮「Start 7-day free trial」，「Everything in Free, plus:」下依次是「All Pro templates」「Automatic idea screening」「AI voiceover, image and music generation」「5,000 AI credits a month」（旁边小字「Credit costs」带折叠箭头）和「Priority support」，不再列任何工作流。页面描述「All WildCrane workflows are free. Pro adds templates for more polished results, AI credits and automatic idea screening. $10/month, billed yearly.」，分享说明相同。
   ![按年显示的两档价格](01-yearly.png) · [links.log](links.log)

2. 点「Monthly」。
   Pro 变成 $15 / month，划线价和「billed yearly」那行消失；按钮仍是「Start 7-day free trial」，Free 和两边的清单不变。
   ![按月显示的两档价格](02-monthly.png) · [links.log](links.log)

3. 点「All 6 workflows」，再点「Credit costs」。
   Free 下展开两列六项：Coding、Slide deck、Product video、Social post、Blog post、Video clone。Pro 下展开一句「AI voiceover, image and music generation share your 5,000 monthly credits.」和三行费率：Voiceover 1 credit / second、Image 320 credits each、Music 160 credits / track。箭头翻转。（「再点一次收起」这次没有实测：脚本只点开、没有再点，无法证明。）
   ![两处都展开](03-folds-open.png) · [links.log](links.log)

4. 读两种状态下按钮指向哪里。
   「Start 7-day free trial」按年按月都指向 `https://cloud.ai4kanban.dev/billing/trial`，不再带 `period`；「Download」指向 `/download`。这个地址留在旧域名，是有意保留的。（没登录时它会不会把人送到 `/signin?next=%2Fbilling%2Ftrial`，这次只在本机跑站点、没有访问 Cloud，无法证明。）
   [links.log](links.log)

5. 看两张价格卡背后的背景。
   背景是七条缓缓右移的空白小卡片：每张只有一小块色标（绿、橙、紫、蓝四种）和一两道灰线，没有任何文字；中间被价格卡挡住，四周渐隐，整体只到 70% 不透明度，对读屏软件隐藏。`/zh/pricing` 相同。价格卡下面还有三格：Seed partner（「Share redacted sessions with us to improve WildCrane.」）、Done-for-you agents（$15 / agent）、Training。
   ![价格卡背后的空白卡片](04-backdrop.png) · [links.log](links.log)

6. 打开 `/zh/pricing`，点开「全部 6 种工作流」和「消耗标准」。
   标签页标题「WildCrane：方案与定价」，大标题「方案与定价」；免费版第二项「全部 6 种工作流」，展开是编码、演示文稿、产品视频、社交帖子、博客文章、视频克隆；「下载」指向 `/zh/download`；Pro 按钮「免费试用 7 天」，同样指向 `https://cloud.ai4kanban.dev/billing/trial`，下面依次「全部 Pro 模板」「新想法自动筛选」「AI 配音、图像和音乐生成」「每月 5,000 AI 积分」「优先支持」，「消耗标准」展开是「配音、图像和音乐共用每月 5,000 AI 积分。」和配音 1 积分 / 秒、图像 320 积分 / 张、音乐 160 积分 / 首。页面描述「WildCrane 全部工作流免费。Pro 提供模板，让成品更精致，另含 AI 积分和新想法自动筛选；按年付费折合每月 $10。」
   ![中文定价页](05-zh-yearly.png) · ![中文页两处都展开](06-zh-folds-open.png) · [links.log](links.log)

## Feedback

- **改名在这页几乎无感**：标题、描述、Seed partner 一格都已写 WildCrane，中文页页头是新字标，没有残留的 AI4Kanban 字样。
- **试用链接还是旧域名**：悬停「Start 7-day free trial」看到的是 `cloud.ai4kanban.dev`，刚认识 WildCrane 的人会犹豫这是不是同一家。
- **一眼看懂免费给了什么**：「All 6 workflows」放在 Free 里，Pro 一栏只剩模板、筛选、生成和积分。
- **积分有上下文但要自己算**：「Credit costs」先说三种生成共用 5,000 积分，但「够几张图」仍要自己算（约 15 张）。
- **「Pro 模板」说不清**：Pro 第一项最模糊，没解释模板是什么、和免费版成品差在哪，也没链到模板库。
- **试用按钮不说规则**：看不出要不要绑卡、试用给多少积分、试用中能否提前买。
- **折叠项不显眼**：两处都只有一个小箭头，第一次看不知道能点。
- **年付月付切换直接**：价格即时变，划线原价和「billed yearly」摆在一起好比较。
