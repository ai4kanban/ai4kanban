# Decisions

Settled user-facing answers for the public site. Read before re-asking a settled call.

## Translations

- **Scope**: translate the landing page, the vs pages, and the training page (English and Chinese only); Markdown mirrors, blog, docs UI and legal pages stay English.
- **No auto-redirect**: English is always the root; a visible footer switcher names each language in itself. Chinese is Simplified only.
- **Per-path languages**: a path is not automatically four languages; its supported languages are recorded, and hreflang, sitemap and switcher read that record. A one-language page shows no switcher.
- **Upkeep**: by hand with `/translate-sync`, said the way each language naturally would, with no pre-deploy gate or native-speaker blocker. Positioning copy on the home page changes in every language in the same batch.
- **Never translated**: product, file and module names, shell commands and terminal captures.

## What the copy promises

- **"No external tool"**: the board has charts; the promise is nothing outside your repo to sync with.
- **No review claim**: coding deliveries get no second-agent review; the copy never promises one.
- **「3–6×」的证据**：首页里一段，不单开页——四个能点回公开源头的数字，配一条每日完成曲线。
- **Plain words**: pricing rows say what a user gets ("Works with 8 coding agents", "No limit on concurrent tasks"), not developer terms.

## The home page

- **顶栏导航**：桌面只留「文档」「定价」，博客、培训收进「资源」下拉；对比页只放页脚；语言切换桌面在页脚、手机在菜单抽屉。
- **顶栏按钮**：右侧只放 GitHub 图标按钮和「下载」（图标加文字）两个，都带硬阴影、底色不同；现阶段要引导用户 star 仓库。
- **Download is the only way in**: the app carries and installs `akb`. The setup prompt is linked from the READMEs and npm, never the landing page.
- **Shots follow the product**: each draws a real, recognizable page; when the product moves, the shot and its copy follow — never an old layout or a mix of two pages.
- **Directory badges**: footer of the landing page only, shown even when the score is low — the listing is the claim, not the score.

## Comparison pages

- **Vibe Kanban**: say plainly it shut down and its repo is stalled; name or link no alternative or fork.
- **Linear**: Linear is a workspace for teams of people and agents; AI4Kanban is a repo-local board an agent plans in, for solo developers and small teams.
- **Declare the winner**: say plainly where AI4Kanban wins; group what both offer as shared, never as the rival's strength or a symmetric "both win".
- **Multica**: one whole-product page, not limited to coding — both are general-purpose. AI4Kanban wins on out-of-the-box agents, workflows and memory, and drafts approved before execution; Multica users build their own specialist agents (beyond Mika) and its long-term memory depends on the runtime tool.
- **Taskmaster**：AI4Kanban 赢在专业工作流（Taskmaster 只有编码流程，含 TDD autopilot）、执行前草稿审批、偏好记忆、卡片内对话（它的讨论在 Cursor 等工具的聊天里）；它的看板是 VS Code 扩展，核心 CLI/MCP 可独立用。坦白承认它胜在内置 research 和测试先行流程，以及有 MCP（我们没有）。
- **对比页共用一套组件**：放在 `components/vs/`，新对手只给文案、标识和差异配图，不复制页面代码。

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
- **No recipes**: the site publishes none; `/recipes` and everything under it redirect to `/docs/agents`.
- **`web/design.md` is a reference**: a page may break from it.
- **Newsletter unsubscribe**: lives on ai4kanban.dev, not the mail platform's page, so the site keeps a writable endpoint.
