# 切换官网语言

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本地，无头 Chrome，窗口 1280×900；脚本是 [language.mjs](language.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，用 CDP 的 `acceptLanguage` 改浏览器语言）。
- **读者**：英文页面读着吃力、想换成母语的人。

## Steps

1. 浏览器语言设为 `en-US,en`，打开 `/pricing`，滚到页脚，点右下角带地球图标的「English」。
   页头是「Documentation · Pricing · Resources · Download」，没有语言链接；页脚向上展开一个小菜单：当前的「English」高亮，下面只有「中文」——定价页只有中英两种。
   ![页脚的语言菜单](01-footer-menu.png) · [switch.log](switch.log)

2. 点「中文」。
   跳到 `/zh/pricing`，`lang=zh-Hans`，标题「方案与定价」。浏览器首选英文，页头多出一个带地球图标的「English」：「文档 · 定价 · 资源 · English · 下载」。
   ![中文定价页](02-zh-pricing.png)

3. 再打开页脚的「中文」菜单，选「English」。
   回到 `/pricing`，`lang=en`。
   [switch.log](switch.log)

4. 打开首页，在页脚的语言菜单里选「日本語」。
   首页的菜单有中文、Español、日本語、Français 四种；选日语后到 `/ja`，`lang=ja`，标题「まず下書きを確認 / 残りはエージェントに」，页头是「ドキュメント · リソース · English · ダウンロード」，没有定价。
   [switch.log](switch.log)

5. 在 `/zh`、`/ja`、`/es`、`/fr` 各滚到页脚。
   栏目和链接都已是本地语言：中文「产品」一栏是「下载 · 体验演示 · Cloud · 定价 · 培训 · 联系我们」，其余有「文档 · 博客 · 创始人 · 更新日志 · 隐私政策 · 服务条款」，左下署名「由 Tao Wu 打造」；新加的演示入口在日、西、法页是「デモを試す」「Probar la demo」「Essayer la démo」；日文其余是「ドキュメント · ブログ · 創業者 · 更新履歴 · プライバシー · 利用規約」。保留原样的只有产品名（Cloud、draft-first、各竞品）、语言名和「Kanban for Claude Code」这类按页面名写的智能体页链接；西语的 Blog、Legal 和法语的 Contact、Solutions、Documentation、Blog 与英文同形，本来就是这两种语言的写法。
   ![中文页脚](07-zh-footer.png) · [switch.log](switch.log)

6. 浏览器语言改成 `zh-CN,zh`，打开 `/pricing`。
   页头「Resources」右边出现带地球图标的「中文」，指向 `/zh/pricing`。
   ![页头建议中文](04-header-suggests-zh.png) · [switch.log](switch.log)

7. 点页头的「中文」。
   到 `/zh/pricing`，页头的语言链接消失——已经是首选语言。
   [switch.log](switch.log)

8. 依次换浏览器语言打开这些页面，看页头。
   - `zh-CN` 打开只有英文的 `/blog`：没有链接。
   - `zh-TW` 打开 `/`：显示「中文」→ `/zh`。
   - `ja` 打开 `/pricing`：没有链接（定价页无日文）；打开 `/`：显示「日本語」→ `/ja`。
   - `en-US,en` 打开 `/zh`：显示「English」→ `/`。
   - `en-US,zh-CN` 打开 `/`：没有链接，只看首选语言。
   ![中文页建议 English](05-header-suggests-en.png) · [switch.log](switch.log)

9. 用 390px 宽、首选 `zh-CN` 的手机打开 `/pricing`。
   顶栏仍只有 Logo、GitHub、下载和菜单，没有语言链接。
   ![手机顶栏](06-phone-top-bar.png) · [switch.log](switch.log)

10. 点页头右上角的菜单。
   抽屉里是文档、定价、博客、培训，下面一栏「LANGUAGE」列出 English 和中文；点「中文」到 `/zh/pricing`。
   ![手机菜单里的语言](03-phone-drawer.png) · [switch.log](switch.log)

## Feedback

- **页脚跟着换语言**：切到中文或日文后，页脚不再半中半英，新加的「体验演示」也已本地化；但链接仍去英文的文档、博客和法律页（演示本身也是英文界面），点进去才会回到英文，页脚上看不出来。
- **桌面上找得到**：浏览器是中文时，英文页页头直接写着「中文」，一眼看到、一下切过去，不用再滚到页脚。
- **不打扰**：首选英文的人看不到任何多余东西；到了首选语言的页面，链接自己消失。
- **只认第一语言**：`en-US,zh-CN` 这类双语用户在英文页看不到中文提示，只能去页脚找。
- **能选的语言随页面变**：首页有五种，定价页只有两种；日语浏览器在定价页看不到任何建议，选了日语后页头的「定价」也消失，页面上没有任何说明。
- **繁体也给简体**：`zh-TW` 显示「中文」并进简体页，对繁体读者够用，但没有提示是简体。
