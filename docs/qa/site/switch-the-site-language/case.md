# 切换官网语言

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本地，无头 Chrome，窗口 1280×900；脚本是 [language.mjs](language.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，用 CDP 的 `acceptLanguage` 改浏览器语言，用 `Storage.clearDataForOrigin` 扮演第一次来的读者）。
- **读者**：英文页面读着吃力、想换成母语的人。

## Steps

1. 浏览器语言设为 `en-US,en`，打开 `/pricing`，滚到页脚，点右下角带地球图标的「English」。
   页头上方没有提示条，页头是「Documentation · Pricing · Resources · Download」；页脚向上展开一个小菜单：当前的「English」高亮，下面只有「中文」——定价页只有中英两种。
   ![页脚的语言菜单](01-footer-menu.png) · [switch.log](switch.log)

2. 点「中文」。
   跳到 `/zh/pricing`，`lang=zh-Hans`，标题「方案与定价」。浏览器首选英文，但刚在页脚选过语言，页头上方不出现「Switch to English」提示条，页头也没有语言链接。
   ![中文定价页](02-zh-pricing.png) · [switch.log](switch.log)

3. 再打开页脚的「中文」菜单，选「English」。
   回到 `/pricing`，`lang=en`。
   [switch.log](switch.log)

4. 打开首页，在页脚的语言菜单里选「日本語」。
   首页的菜单有中文、Español、日本語、Français 四种；选日语后到 `/ja`，`lang=ja`，标题「細部まですべて / 管理しなくていい」，页头是「ドキュメント · リソース · ダウンロード」，没有定价。
   [switch.log](switch.log)

5. 在 `/zh`、`/ja`、`/es`、`/fr` 各滚到页脚。
   栏目和链接都已是本地语言：中文「产品」一栏是「下载 · 体验演示 · Cloud · 定价 · 模板 · 培训 · 联系我们」，其余有「文档 · 博客 · 创始人 · 更新日志 · 隐私政策 · 服务条款」，左下署名「由 Tao Wu 打造」；演示入口在日、西、法页是「デモを試す」「Probar la demo」「Essayer la démo」；日文其余是「ドキュメント · ブログ · 創業者 · 更新履歴 · プライバシー · 利用規約」。保留原样的只有产品名（Cloud、各竞品）、语言名和「Kanban for Claude Code」这类按页面名写的智能体页链接；西语的 Blog、Legal 和法语的 Contact、Solutions、Documentation、Blog 与英文同形，本来就是这两种语言的写法。
   ![中文页脚](07-zh-footer.png) · [switch.log](switch.log)

6. 清掉网站数据（当作第一次来），浏览器语言改成 `zh-CN,zh`，打开 `/pricing`。
   页头上方一条浅色提示条，居中写着地球图标、「此页面有中文版。」和橙色链接「切换到中文」（指向 `/zh/pricing`），右端一个 ×；页头本身仍是「Documentation · Pricing · Resources · Download」。提示条从第一帧就在，页面没有被往下推（layout shift 0）。往下滚，提示条随页面滚走，页头照旧吸顶。
   ![提示条建议中文](04-bar-suggests-zh.png) · [switch.log](switch.log)

7. 点「切换到中文」，再回到 `/pricing`。
   到 `/zh/pricing`，没有提示条；回到英文 `/pricing` 也不再出现——选择记在浏览器里。
   [switch.log](switch.log)

8. 清掉网站数据，再开 `/pricing`，点提示条右端的 ×，然后刷新，再打开首页。
   提示条当场消失，页面留在英文 `/pricing`；刷新后和首页都不再出现。
   [switch.log](switch.log)

9. 每次都清掉网站数据，换浏览器语言打开这些页面，看页头上方。
   - `zh-CN` 打开只有英文的 `/blog`：没有提示条。
   - `zh-TW` 打开 `/`：「此页面有中文版。」→ `/zh`。
   - `ja` 打开 `/pricing`：没有（定价页无日文）；打开 `/`：「このページは日本語でもご覧いただけます。 日本語に切り替える」→ `/ja`。
   - `fr-FR` 打开 `/`：「Cette page est disponible en français. Passer au français」→ `/fr`。
   - `en-US,en` 打开 `/zh`：「This page is available in English. Switch to English」→ `/`。
   - `en-US,zh-CN` 打开 `/`：没有，只看首选语言。
   ![日文提示条](08-bar-suggests-ja.png) · ![中文页建议 English](05-bar-suggests-en.png) · [switch.log](switch.log)

10. 清掉网站数据，用 390px 宽、首选 `zh-CN` 的手机打开 `/pricing`。
   顶部一行提示条「此页面有中文版。 切换到中文 ×」，不带地球图标；下面顶栏仍只有 Logo、GitHub、下载和菜单。其他语言用短句，也都一行放下：「Available in English.」「日本語版があります。」「Disponible en español.」「Disponible en français.」。
   ![手机上的提示条](06-phone-bar.png) · [switch.log](switch.log)

11. 点页头右上角的菜单，在「LANGUAGE」一栏点「中文」，再回到 `/pricing`。
   抽屉里是 Documentation、Pricing、Blog、Templates、Training，下面「LANGUAGE」列出 English 和中文；点「中文」到 `/zh/pricing`。回到 `/pricing` 不再出现提示条——换过一次语言就不再提示。**实测未通过**：提示条又出现，抽屉里的选择没被记住（只有提示条和页脚菜单算数），已报待筛选。
   ![手机菜单里的语言](03-phone-drawer.png) · [switch.log](switch.log)

## Feedback

- **提示条一眼就看到**：用读者自己的语言写在页头上方，比原来夹在导航里的「中文」显眼得多；从首帧就在，不会把页面推下去。
- **关掉就安静了**：点 × 或切换一次后，整个站都不再提示；在页脚选过语言的人也不会被反向提示，没有多余打扰。
- **手机菜单里的语言不算「选过」**：在抽屉里换了中文，回到英文页提示条又出来，和页脚菜单的行为不一致；手机上抽屉恰恰是最顺手的入口。
- **桌面页头没有语言入口了**：关掉提示条后，主动想换语言只能滚到页脚。
- **只认第一语言**：`en-US,zh-CN` 这类双语用户看不到中文提示。
- **能选的语言随页面变**：首页有五种，定价页只有两种；日语浏览器在定价页看不到任何建议，页面上也没有说明。
- **繁体也给简体**：`zh-TW` 看到「此页面有中文版」并进简体页，没提示是简体。
- **页脚换了语言，去处没换**：文档、博客、法律页仍是英文，点进去才发现。
