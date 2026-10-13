# Decisions

Settled user-facing answers for the public site. Read before re-asking a settled call.

## Translations

- **Scope**: translate the landing page, the vs pages, and the training page (English and Chinese only); Markdown mirrors, blog, docs UI and legal pages stay English.
- **No auto-redirect**: English is always the root; a visible footer switcher names each language in itself. Chinese is Simplified only.
- **Per-path languages**: each path records its languages, and hreflang, sitemap and switcher follow that record; a one-language page shows no switcher.
- **Upkeep**: by hand with `/translate-sync`, said the way each language naturally would, with no pre-deploy gate or native-speaker blocker. Positioning copy on the home page changes in every language in the same batch.

## What the copy promises

- **"No external tool"**: the board has charts; the promise is nothing outside your repo to sync with.
- **No review claim**: coding deliveries get no second-agent review; the copy never promises one.
- **不承诺「从想法到合入代码」**：编码工作流的卖点是执行前审关键草稿、记住偏好、交付后跟进，减少指导和返工。
- **「3–6×」的证据**：首页里一段，不单开页——四个能点回公开源头的数字，配一条每日完成曲线。
- **Plain words**: pricing rows say what a user gets ("Works with 8 coding agents", "No limit on concurrent tasks"), not developer terms.

## The home page

- **首页叙事顺序**：Hero → 关键草稿 → 专业智能体（含偏好记忆）→ 主动跟进 → 多项工作并行 → 使用自己的工具 → 下载；任务管理与调度只作基础能力。
- **首页主标题**：英文「See the draft before it's built.」，中文「先看草稿，再往下做」。
- **顶栏**：桌面只留「文档」「定价」，博客、培训收进「资源」下拉；右侧只有 GitHub 和「下载」，现阶段引导 star 仓库；对比页只放页脚；语言切换桌面在页脚、手机在菜单抽屉。
- **Shots follow the product**: each draws a real, recognizable page; when the product moves, the shot and its copy follow — never an old layout or a mix of two pages.
- **页脚分组**：链接不重复品牌名（写 For coding，不写 AI4Kanban for coding）；for-<agent> 页单独成组，不混在「学习」里。
- **Directory badges**: footer of the landing page only, shown even when the score is low — the listing is the claim, not the score.

## Comparison pages

- **不再对比的对手**：GitHub Issues、Linear 和已弃用的 Vibe Kanban 的对比页退役，旧路径重定向到同语言首页，导航、页脚、sitemap 和 `llms.txt` 都不再列出。
- **Declare the winner**: say plainly where AI4Kanban wins; group what both offer as shared, never as the rival's strength or a symmetric "both win".
- **构建后审阅算平手**：AI4Kanban 靠编码智能体自带的测试和验收，有意不加第二道审阅；对手的自动审阅不算它赢。
- **记忆不作卖点**：对手自己写的 skill 也是一种记忆，用户感知不到差别；不断言谁更好，不放首屏主题。
- **Multica**: one whole-product page, not limited to coding — both are general-purpose. AI4Kanban wins on out-of-the-box agents, workflows and memory, and drafts approved before execution; Multica users build their own specialist agents and its long-term memory depends on the runtime tool.
- **Taskmaster**：AI4Kanban 赢在专业工作流（它只有编码流程）、执行前草稿审批、偏好记忆、卡片内对话；坦白承认它胜在内置 research、测试先行流程和 MCP。
- **Hermes Kanban**：首屏主题是「先定交付要求，再放手执行」——Hermes 弱规划强执行，需要人一直跟进；中途提问两边都有，不算差别。
- **Orca**：定位不同。Orca 是编码智能体之上很薄的一层，适合亲自掌控每个细节的人；AI4Kanban 适合把执行交给智能体、自己掌握方向和关键决定的人。Codex 对比只作小注，不评判二者。

## The legal pages

- **Source**: adapt the company's dist0 pages rather than a template.
- **收款主体**：收款账户属于厦门宛理之间科技有限公司，但条款以 NULLREACH LTD 为网站、Cloud 和 Pro 的主体，不为收款路径另写公司关系说明。
- **隐私页**：只写 NULLREACH LTD 为数据控制者，不披露培训销售方或向中国传输数据；付款信息由客户通过邮件直接给销售方。
- **Contact**: `support@ai4kanban.dev` for support and data requests on every page.
- **Amend in place**: a change to what we collect amends the existing page with a new effective date, never a second page.

## The training page

- **Offer**: two tiers — one-on-one session and monthly coaching — priced in USD, the same number in every language, never "contact us". No course platform, payment or membership.
- **Booking**: visitors see only open hours in their own time for the current week; never advertise slot counts or the author's schedule.

## Planning the site

- **One card per workflow landing page**: each needs its own UI polish.
- **文案改动先出草稿**：即使只是把已定稿的页面同步到 `builder.md`、`llms.txt` 摘要或署名，也由 `copywriting` 先出草稿给用户审。
- **使用场景页补首页没讲的**：如「AI4Kanban for coding」归「解决方案」，讲具体用法、多写文字，不重复首页配图。
- **一页一个主关键词**：博客同样一篇一个关键词，多个就拆成多篇；编码页用 `AI coding workflow`；`agent planning`、`Codex workflow`、`Claude Code workflow` 留给各自的页面；draft-first 落地页占品牌词 `draft-first`，方法论博客用 `draft-first development`。
- **多页文案按页拆卡**：每张卡并列英中文案供审阅；英中定稿后其余语言跟着翻，不再单独审。
- **No recipes**: the site publishes none; `/recipes` and everything under it redirect to `/docs/agents`.
- **draft-first 落地页**：首屏唯一主按钮是复制 npx 安装命令；沿用站点 header，AI4Kanban 的宣传内容只在下半部分出现；不进顶栏导航，从首页、博客和 skill 的 README 链入。
- **draft-first 的说法**：草稿是把关键点的返工提前到规划期；不说「不要计划」，不说消灭返工，也不说「提前交付」——草稿还不是交付。
- **Newsletter unsubscribe**: lives on ai4kanban.dev, not the mail platform's page, so the site keeps a writable endpoint.
- **博客封面图放 CDN**：渲染成 webp 上传到 `cdn.ai4kanban.dev/<博客名>/`，博客直接引用网址；图片不进 git。
