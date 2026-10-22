# 在隐私页查官网在浏览器里存了什么，再对照浏览器

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×1000，开始前清掉站点数据；脚本是 [storage.mjs](storage.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，读 Cookie、`localStorage` 和 `sessionStorage`）。
- **读者**：看到页头上方的语言提示条、点过之后想知道网站是不是在自己浏览器里留了东西的人。

## Steps

1. 打开 `/privacy`，读顶部「The short version」第一条。
   「This site counts two things.」一条写着没有 Cookie、没有账号、没有任何标识，并说明浏览器里存了什么，与下面正文一致。**实测未通过**：它说「The only thing it keeps in your browser is the language you pick, so it stops offering you one.」，没提正文写明的 `/demo` 存储，已报待筛选。
   ![摘要第一条](01-short-version.png) · [storage.log](storage.log)

2. 往下读「Visiting the site」一节的列表。
   「No cookies.」写着不设任何 Cookie、浏览器里不留标识，并说没有 Cookie 横幅是因为留下的两样都是读者自己做的设置；紧跟两条新条目：「Your language choice.」——点提示条的链接或 ×、或页脚语言菜单后，在本地存储里存那种语言的代码，不再弹提示条，不是标识、不发给任何人、清浏览器数据即删除；「The demo.」——`/demo` 和应用一样，在浏览器里记住界面布局和输入的文字，只留在本机。
   ![Visiting the site 一节](02-visiting-the-site.png) · [storage.log](storage.log)

3. 往下读「Cookies and tracking」一节。
   「The site sets no cookies.」之后写明保存了所选语言和演示页的布局与输入，链回「Visiting the site」，都不是标识、都不发给我们。「How we use information」下的 consent 一段写着「nothing the site keeps in your browser beyond the language and demo settings you made yourself」。
   ![Cookies and tracking 一节](03-cookies-and-tracking.png) · [storage.log](storage.log)

4. 看浏览器里这个站点存了什么（只读过隐私页）。
   没有 Cookie，`localStorage` 和 `sessionStorage` 都是空的。隐私页只有英文版，页脚没有语言菜单。
   [storage.log](storage.log)

5. 打开首页，在页脚语言菜单里选「中文」，再看浏览器。
   到 `/zh`；仍没有 Cookie，`localStorage` 只多了一项 `ai4kanban:locale = zh`，和政策说的一致。
   [storage.log](storage.log)

6. 打开 `/demo`，点「New idea」让想法自己打完，再看浏览器。
   刚打开时没有新增；想法打出来后 `localStorage` 多了 `kanban-draft:create:discussion-demo`（106 个字符，即输入框里的草稿），没有 Cookie，`sessionStorage` 为空。
   [storage.log](storage.log)

## Feedback

- **说法和实际对得上**：真的只存了一个语言代码，`/demo` 存的是输入草稿，两样都在政策里写明了；没有 Cookie，也没有标识。
- **摘要漏了演示页**：「The short version」说浏览器里「只」存所选语言，正文却写了两样；只读摘要的人会被误导，正文和摘要应该一致。
- **点 × 也会存东西**：政策写了，但读者直觉上「关掉」不像「做了选择」；存的是当前页语言，问题不大。
- **找得到但要翻**：浏览器存储的说明分在「Visiting the site」和「Cookies and tracking」两处，后者在页面很靠后；好在前者就在目录第二项。
- **没有跑到的**：手机抽屉里的语言选择——它不存任何东西（见 [切换官网语言](../switch-the-site-language/case.md) 第 11 步），政策也没把它列为入口，两边一致。
