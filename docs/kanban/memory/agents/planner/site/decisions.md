# Decisions

Settled user-facing answers for the public site. Read before re-asking a settled call.

## Translations

- **Scope**: translate the landing page, the vs pages, and the training page (English and Chinese only); Markdown mirrors, blog, docs UI and legal pages stay English. A one-language page shows no switcher.
- **No auto-redirect**: English is always the root; a visible switcher names each language in itself. Chinese is Simplified only.
- **Upkeep**: by hand with `/translate-sync`, said the way each language naturally would, with no pre-deploy gate or native-speaker blocker. Only the English and Chinese copy is reviewed; the other languages are translated from the English during implementation. Positioning copy on the home page changes in every language in the same batch.

## What the copy promises

- **"No external tool"**: the board has charts; the promise is nothing outside your repo to sync with.
- **No review claim**: coding deliveries get no second-agent review; the copy never promises one.
- **不承诺「从想法到合入代码」**：编码工作流的卖点是执行前审关键草稿、记住偏好、交付后跟进，减少指导和返工。
- **和只用 Claude Code 的差别**：人只负责把 UI 审到完全符合预期，其余细节交给 agent；边界清楚，同时待审的多个任务各只占少量注意力、少返工。只用 Claude Code 得自己起服务、逐步复现找问题。
- **「3–6×」的证据**：首页里一段，不单开页——四个能点回公开源头的数字，配一条每日完成曲线。
- **Plain words**: pricing rows are short benefits that say what a user gets ("Works with 8 coding agents", "5,000 AI credits a month"), not developer terms; lists and rates (which workflows, credits per voice second, image or song) go in an expandable detail under the row.

## The home page

- **首页定位**：中文「独立开发者的 Agent 工作台」，英文「Agent workspace for indie hackers」；主标题讲用户少操心什么：中文「不用每个细节都亲自盯」，英文「You don’t have to manage every detail.」，分享标题沿用主标题。
- **首页叙事**：五段——Hero（不必管理每个执行细节）→ 如何做到（关键部分由你把关，其余交给 agent；一句带过并行）→ 工作流（编程、视频复刻在前，博客最后；自建工作流只在导语里一句）→ 自带工具（logo 栏）→ 下载；记忆、跟进移入文档。
- **删掉首页板块时配图不浪费**：截图、动画迁进对应文档页实际展示，不留未引用的文件。
- **不让用户盯着 agent**：卖点是把注意力还给用户——专注重要的事，复杂工作在后台推进、有进展时通知；不写「看着它们完成」。中文标题不夹英文复数 agents，多个 agent 一起说「AI 团队」。
- **首页不提 Pro**：付费范围只在定价页说明。
- **入口**：首屏只放下载与 GitHub，不放草稿 skill 的安装命令；顶栏只留「文档」「定价」和「资源」（博客、培训），现阶段引导 star 仓库；对比页只进页脚。
- **页脚**：链接不重复品牌名（写 For coding）；for-<agent> 页单独成组。目录站徽章即使分数低也展示——收录本身就是背书。
- **`/demo` 是脚本式演示**：从新想法走到规划、修订关键草稿、Build、交付后归档，每步只能点高亮的那个控件；首页工作流区之后和页脚放「体验演示」入口。

## Comparison pages

- **不再对比的对手**：GitHub Issues、Linear 和已弃用的 Vibe Kanban 的对比页退役，旧路径重定向到同语言首页，站内不再列出。
- **Declare the winner**: say plainly where AI4Kanban wins; group what both offer as shared, never as the rival's strength or a symmetric "both win".
- **构建后审阅算平手**：AI4Kanban 靠编码智能体自带的测试和验收，有意不加第二道审阅；对手的自动审阅不算它赢。
- **记忆不作卖点**：对手自己写的 skill 也是一种记忆，用户感知不到差别；不断言谁更好，不放首屏主题。
- **摘要与首屏**：搜索描述、分享描述与首屏导语共用一句客观比较摘要，正文讲差异和选择依据；「Agent 工作台」是产品类别，不当作对比优势。
- **Multica**: one whole-product page, not limited to coding — both are general-purpose. AI4Kanban wins on out-of-the-box agents, workflows and memory, and drafts approved before execution; Multica users build their own specialist agents and its long-term memory depends on the runtime tool.
- **Taskmaster**：AI4Kanban 赢在专业工作流（它只有编码流程）、执行前草稿审批、偏好记忆、卡片内对话；坦白承认它胜在内置 research、测试先行流程和 MCP。
- **Hermes Kanban**：首屏主题是「先定交付要求，再放手执行」——Hermes 弱规划强执行，需要人一直跟进；中途提问两边都有，不算差别。
- **Orca**：定位不同。Orca 是编码智能体之上很薄的一层，适合亲自掌控每个细节的人；AI4Kanban 适合把执行交给智能体、自己掌握方向和关键决定的人。Codex 对比只作小注，不评判二者。

## Agent pages

- **Grill Me 页**：主线是「一个计划一张卡，复杂想法拆成多卡逐卡规划」，CTA 保留「Scale Grill Me from one plan to the whole project.」，不改成讲草稿；FAQ「Does AI4Kanban replace Grill Me?」答 Yes。
- **Codex 页**：只讲 AI4Kanban 在 Codex（多数人用桌面端）之上多做了什么，不重复首页定位；Codex 是执行层，不写成对手；差异点：任务独立于对话（一个任务可有多个对话，一次讨论可建多个任务）、分阶段规划并直接审草稿而非读文字计划、工作流定出「哪里需要人看」并给易审草稿、记忆按角色细分、独立任务各在自己的 worktree 并行。
- **Claude Code 页的差异点**：卡片上的草稿审阅、多运行时分工（如 Codex 写作、Claude Code 编码）、后续建议、QA manager；Claude Code 原生已有跨会话任务列表、提示建议和定时运行，不说它没有。

## The legal pages

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
- **多页文案按页拆卡**：每张卡并列英中文案供审阅。
- **一页一个主关键词**：博客同样一篇一个，多个就拆成多篇；编码页用 `AI coding workflow`；`agent planning`、`Codex workflow`、`Claude Code workflow` 留给各自的页面；draft-first 落地页占 `draft-first`，方法论博客用 `draft-first development`。
- **No recipes**: the site publishes none; their old paths point to `/docs/agents`.
- **Newsletter unsubscribe**: lives on ai4kanban.dev, not the mail platform's page.

## Use-case and solution pages

- **补首页没讲的**：如「AI4Kanban for coding」归「解决方案」，讲具体用法、多写文字，不重复首页配图。
- **首屏主视觉**：各解决方案页共用 SaaS 页的首屏，暂不为每页单做。
- **SaaS 页不做关键词优化**：页名就叫「AI4Kanban for SaaS」，按 SaaS 使用场景讲价值，不定 SEO 主关键词。

## draft-first

- **落地页**：首屏唯一主按钮是复制 npx 安装命令；AI4Kanban 的宣传只在下半部分；不进顶栏，从首页、博客和 skill 的 README 链入。
- **说法**：草稿是把关键点的返工提前到规划期；不说「不要计划」，不说消灭返工，也不说「提前交付」——草稿还不是交付。

## Template catalog

- **模板目录**：按分类分 tab、每个 tab 分页，每页不放太多，只加载当前 tab 的内容；分类按实际发布内容生成，不写死；视频到详情页点击才加载；视频详情并列来源原片与复刻结果；每个模板标明免费或 Pro。

## Docs

- **Agents 文档页列全部专家**：按工作流分组、每组一张表，每个专家配自己的 agent 插图，插图与正文字号同大。
