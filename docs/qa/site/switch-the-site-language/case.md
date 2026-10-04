# 切换官网语言

## Setup

- **站点**：官网（`web/`）在本地跑起来（`next dev`），无头 Chrome，窗口 1280×900；脚本是 [language.mjs](language.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：英文页面读着吃力、想换成母语的人。

## Steps

1. 打开 `/pricing`，点页头的「English」。
   展开一个小菜单：当前的「English」高亮，下面只有「中文」——定价页只有中英两种。
   ![定价页的语言菜单](01-menu.png) · [switch.log](switch.log)

2. 点「中文」。
   跳到 `/zh/pricing`，`lang=zh-Hans`，标题「免费开启，Pro 更进一步」，页头变成「文档 · 博客 · 对比 · 定价 · 培训 · 中文」，按年/按月和价格都已翻译。
   ![中文定价页](02-zh-pricing.png)

3. 再点页头的「中文」，选「English」。
   回到 `/pricing`，`lang=en`。
   [switch.log](switch.log)

4. 打开首页，点「English」，选「日本語」。
   首页的菜单有中文、Español、日本語、Français 四种；选日语后到 `/ja`，`lang=ja`，标题「舵を取るのはあなた。チームを率いるのは AI。」。日语页头只有「ドキュメント · ブログ · 比較」，没有定价和培训。
   ![首页的语言菜单](03-home-menu.png) · [switch.log](switch.log)

## Feedback

切换就地完成，停在同一页的对应语言，不会被甩回首页。菜单只列当前页真有的译本，不会点进 404。但不同页面能选的语言不一样，用户看不出规律：在首页选了日语，页头的「定价」「培训」随之消失，想看价格得先切回英文，而且没有任何说明。
