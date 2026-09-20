# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## Translations

- Translate the acquisition surface only — the landing page and the vs pages. The recipes and
  the plain-Markdown mirrors stay English; they serve AI crawlers and existing users.
- Never redirect a visitor by browser language. English is always the root, with a visible
  footer switcher labelling each language in its own name.
- Language paths are `/zh`, `/es`, `/ja`, `/fr`. Chinese is published as Simplified only, so
  it is tagged `zh-Hans`.
- Translations are kept current by hand with `/translate-sync` — the same meaning said the way
  each language naturally would — with no pre-deploy gate and no native-speaker read blocking
  publication.
- Product names, file names, module names, shell commands and the terminal capture stay
  English in every language: a reader types or sees them on their own screen.
- A page that exists in only one language shows no switcher, and a path is not automatically
  four languages — the supported languages are recorded per path, and hreflang, the sitemap
  and the switcher all read that record.
- **首页多语言同步**：首页定位类文案改动时，五种语言同批更新，不留某种语言停在旧说法。
- **文档站界面文字**：文档站只有英文时，新增的文档界面文字只做英文，不单独做中文。

## What the copy promises

- "No dashboard, no separate tool" means no *external* tool — nothing outside your repo to
  sync with. It never promised the board has no charts, so say "no external tool".
- The copy does not say a second agent reviews every delivery: review is a detail of how a
  delivery works, not a selling point.
- **「3–6×」这类主张拿什么做证据？**：首页里的一段，不单开一页——四个能点回公开源头的数字，配一条
  每日完成曲线；曲线比纯数字直观。

## The home page's hand-drawn shots

- Each shot draws a page the product really has. When the product moves the page, the shot
  follows the product and the step's copy is rewritten to match — the shot never keeps an
  old layout, or mixes two pages, to stay true to the copy.

## The quick start

- The landing page's main button is downloading the app, and the download is the only way in
  it offers: the app carries `akb` and installs it at first open.
- The pages are written for the app-first way in. The setup prompt stays linked from the
  READMEs and the npm page, read by someone already in a terminal, never from the landing page.

## Comparison pages

- Say plainly that Vibe Kanban shut down and its repo is stalled, and don't soften it. Name
  and link no competitor, alternative or community fork.
- Linear: AI4Kanban is for solo developers and small teams using an AI coding agent; Linear is
  a workspace for a team of people and agents, AI4Kanban a repo-local board an agent plans in.

## The legal pages

- Nullreach Ltd, registered in England and Wales, is on both pages, with English and Welsh law
  governing the terms. The same company publishes both pages for dist0, so the site's versions
  adapt those rather than starting from a template.
- They are not translated: they follow the blog, which is English-only.
- `support@ai4kanban.dev`, on the site's own domain, is the address for support and data
  requests, and any later page needing a contact uses it too.
- A change to what we collect amends the existing page in place with a new effective date,
  never a second page, because the sentence promising no collection has to stop being true for
  existing users as well as new ones.
- The archived copy of raw events is kept indefinitely, still carrying the install id, and the
  deletion promise by install id covers it.

## Third-party badges

- A directory badge goes in the landing page's footer only, beside the credit line, at the
  footer's own visual weight — not in the body and not on the other pages.
- **徽章上的分数偏低时照样放吗？**：照放，不隐藏数值也不等分数上来再上线。页脚徽章声明的是「被第三方
  收录并公开评级」，分数本身不是卖点。

## The training page

- **首版培训服务分几档？**：两档——60 分钟一对一上手指导，加一档按月持续陪跑。不做课程平台、支付或
  会员体系。
- **两档卖多少钱？**：99 美元/次与 349 美元/月（每周 1 次共 4 次）。一律美元标价，各语言版本同一个
  数字，页面直接标金额，不写「面议」。
- **预约怎么排？**：作者维护 UTC+8 开放小时，访客只看自己当地当前周的小时排期；不宣传名额数量、不展示
  作者时间。站内选时、填资料、提交并保存真实预约，成功后该小时关闭。
- **培训页发几种语言？**：只发英文 `/training` 和中文 `/zh/training`——只承诺能交付的语言。

## The newsletter

- **周报的退订页放在哪里**：放在 ai4kanban.dev 站点上，链接和结果页都用自己的域名，不用邮件平台自带
  的退订页。站点因此需要一个能写退订状态的接口，不再是一份纯静态导出。
