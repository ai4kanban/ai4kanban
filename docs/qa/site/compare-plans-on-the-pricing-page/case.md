# 在定价页比较免费版和 Pro

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），打开 `/pricing`，窗口 1280×1000；脚本是 [pricing.mjs](pricing.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：在决定要不要付费的人。

## Steps

1. 打开 `/pricing`。
   标签页标题「AI4Kanban: Plans and pricing」，大标题「Plans and pricing」，导语只有一句「Every plan runs on your own computer, with your own AI tools.」。默认选中「Yearly · Save 33%」。左边 Free $0（Apache 2.0 开源，按钮「Download」），列出编码工作流、不限并发、无限自定义工作流和 agent 等五项；右边 Pro $120 / year、划掉的 $180，下面「$10 a month, billed yearly」，按钮「Get Pro」，「Everything in Free, plus:」下先是五个工作流（Slide deck、Product video、Social post、Blog post、Video clone），再是自动筛选新想法、「5,000 AI credits a month — voiceover uses 1 per second, a generated image 320, a music track 160」和优先支持。页面描述「AI4Kanban: an agent workspace for indie hackers. Coding is free; Pro adds slides, product videos, carousels, blogs and video clones. $10/month, billed yearly.」，分享说明相同。
   ![按年显示的两档价格](01-yearly.png) · [03-links.log](03-links.log)

2. 点「Monthly」。
   Pro 变成 $15 / month，划线价和「billed yearly」那行消失；Free 和两边的清单不变。
   ![按月显示的两档价格](02-monthly.png) · [03-links.log](03-links.log)

3. 读两种状态下按钮指向哪里。
   「Get Pro」按年指向 `https://cloud.ai4kanban.dev/billing/checkout?period=yearly`，按月变成 `period=monthly`；「Download」指向 `/download`。没有点进 Cloud 的结账页。
   [03-links.log](03-links.log)

4. 看两张价格卡背后的背景。
   背景是七条缓缓右移的空白小卡片：每张只有一小块色标（绿、橙、紫、蓝四种）和一两道灰线，没有任何文字；中间被价格卡挡住，四周渐隐，整体只到 70% 不透明度，对读屏软件隐藏。`/zh/pricing` 相同。价格卡下面还有三格：Seed partner、Done-for-you agents（$15 / agent）、Training。
   ![价格卡背后的空白卡片](04-backdrop.png) · [03-links.log](03-links.log)

5. 打开 `/zh/pricing`。
   标签页标题「AI4Kanban：方案与定价」，大标题「方案与定价」，导语「所有方案都在你自己的电脑上运行，使用你自己的 AI 工具。」；Pro 列出幻灯片、产品视频、社媒帖、博客文章、视频克隆五个工作流，额度一行是「每月 5,000 AI 积分，配音每秒用 1 积分，生成图像每张用 320 积分，生成音乐每首用 160 积分」，不再提「封面」。页面描述「AI4Kanban，独立开发者的 Agent 工作台。软件开发免费；Pro 提供幻灯片、产品视频、社媒帖、博客文章和视频克隆工作流，按年付费折合每月 $10。」
   ![中文定价页](05-zh-yearly.png) · [03-links.log](03-links.log)

## Feedback

- **免费和付费的边界清楚了**：Pro 一栏把五个内容工作流逐个列出，视频克隆不再漏掉；导语只剩一句「都在你自己的电脑上、用你自己的 AI 工具」，不再重复首页的定位，读者直接看两栏比较。
- **额度终于能算一算**：配音按秒、图像每张 320、配乐每首 160 都写出来了，「生成图像」也比原来的「生成封面」更像一种能力而不是一个用途；但还是要自己换算「5,000 积分够几张图、几首歌」，没有一句「大约够 15 张图」之类的直观说法。
- **年付月付切换直接**：切换即时，结账链接也跟着换，不会选了月付却按年扣；「$10 a month, billed yearly」把折算月价和划线原价都摆出来，很好比较。
- **背景安静**：背景卡片只剩色块和灰线，看得出是一块看板在动，又不抢价格的注意力。
- **Free 的五项偏技术**：「Coding workflow with 8 agents」「Works with 8 coding agents」两个「8」挨着，第一次看容易混成一回事。
