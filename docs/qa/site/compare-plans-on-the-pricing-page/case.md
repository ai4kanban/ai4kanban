# 在定价页比较免费版和 Pro

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），打开 `/pricing`，窗口 1280×1000；脚本是 [pricing.mjs](pricing.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：在决定要不要付费的人。

## Steps

1. 打开 `/pricing`。
   默认选中「Yearly · Save 33%」。左边 Free $0（Apache 2.0 开源，按钮「Download」），右边 Pro $120 / year、划掉的 $180，下面写「$10 a month, billed yearly」，按钮「Get Pro」；Pro 列出比 Free 多出的五项。
   ![按年显示的两档价格](01-yearly.png)

2. 点「Monthly」。
   Pro 变成 $15 / month，划线价和「billed yearly」那行消失；Free 不变。
   ![按月显示的两档价格](02-monthly.png)

3. 读两种状态下按钮指向哪里。
   「Get Pro」按年指向 `https://cloud.ai4kanban.dev/billing/checkout?period=yearly`，按月变成 `period=monthly`；「Download」指向 `/download`。没有点进 Cloud 的结账页。
   [03-links.log](03-links.log)

4. 看两张价格卡背后的背景。
   背景是七条缓缓右移的空白小卡片：每张只有一小块色标（绿、橙、紫、蓝四种）和一两道灰线，没有任何文字；中间被价格卡挡住，四周渐隐，整体只到 70% 不透明度，对读屏软件隐藏。`/zh/pricing` 相同。
   ![价格卡背后的空白卡片](04-backdrop.png) · [03-links.log](03-links.log)

## Feedback

- **比较直接**：两档并排、差别一眼可见，月付和年付切换即时，结账链接也跟着换，不会选了月付却按年扣；按年的「$10 a month, billed yearly」把折算月价和划线原价都摆出来，很好比较。
- **背景安静了**：原来背景卡片上写着「Add dark mode」之类的任务名，眼睛会被拉去读；现在只剩色块和灰线，看得出是一块看板在动，又不抢价格的注意力。只露在价格卡四周窄窄一圈，宽屏上更像淡淡的纹理。
- **额度难理解**：Pro 的「5,000 AI credits a month — voiceover uses 1 per second, a generated cover 320」对没用过的人太抽象，读不出这些额度够做多少事。
