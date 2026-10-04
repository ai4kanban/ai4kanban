# 在定价页比较免费版和 Pro

## Setup

- **站点**：官网（`web/`）在本地跑起来（`next dev`），无头 Chrome 打开 `/pricing`，窗口 1280×1000；脚本是 [pricing.mjs](pricing.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
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

## Feedback

两档并排、差别一眼可见，月付和年付切换即时，结账链接也跟着换，不会选了月付却按年扣。按年的说明「$10 a month, billed yearly」把折算后的月价和划线原价都摆出来，很好比较。Pro 的权益里「5,000 AI credits a month — voiceover uses 1 per second, a generated cover 320」对没用过的人太抽象，读不出这些额度够做多少事。
