# 切换官网语言

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本地，无头 Chrome，窗口 1280×900；脚本是 [language.mjs](language.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：英文页面读着吃力、想换成母语的人。

## Steps

1. 打开 `/pricing`，滚到页脚，点右下角带地球图标的「English」。
   向上展开一个小菜单：当前的「English」高亮，下面只有「中文」——定价页只有中英两种。页头没有语言切换。
   ![页脚的语言菜单](01-footer-menu.png) · [switch.log](switch.log)

2. 点「中文」。
   跳到 `/zh/pricing`，`lang=zh-Hans`，标题「免费开启，Pro 更进一步」，页头变成「文档 · 定价 · 资源 · 下载」。
   ![中文定价页](02-zh-pricing.png)

3. 再打开页脚的「中文」菜单，选「English」。
   回到 `/pricing`，`lang=en`。
   [switch.log](switch.log)

4. 打开首页，在页脚的语言菜单里选「日本語」。
   首页的菜单有中文、Español、日本語、Français 四种；选日语后到 `/ja`，`lang=ja`，标题「舵を取るのはあなた。チームを率いるのは AI。」，页头只剩「ドキュメント · リソース · ダウンロード」，没有定价。
   [switch.log](switch.log)

5. 用 390px 宽的手机打开 `/pricing`，点页头右上角的菜单。
   抽屉里是文档、定价、博客、培训，下面一栏「LANGUAGE」列出 English 和中文；点「中文」到 `/zh/pricing`。
   ![手机菜单里的语言](03-phone-drawer.png) · [switch.log](switch.log)

## Feedback

- **就地切换**：停在同一页的对应语言，菜单只列当前页真有的译本，不会点进 404。
- **桌面上不好找**：语言切换只在页脚右下角，读不懂英文的人得先滚到底才看得到；手机上收在菜单里反而顺手。
- **能选的语言随页面变**：首页有五种，定价页只有两种；选了日语后页头的「定价」消失，想看价格得先切回英文，页面上没有任何说明。
