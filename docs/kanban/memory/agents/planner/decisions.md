# Decisions

Settled user-facing answers for the project as a whole; a module's own live in its folder
beside this file. Read before proposing so you don't re-ask a settled call.

## Positioning

- 定位以仓库根目录 `positioning.md` 为准，入口文案直接引用，不再单独确认；看板是载体而非卖点。
- The project manager is a middle manager: it clarifies, delegates and carries work through
  acceptance; which projects to start or stop stays the user's. It is not tied to software.
- The "3–6× faster" claim stays without a citation, backed by this repository's own auditable
  figures beside it.
- Local-first promises the default backend (markdown in git), not every backend a user can pick.

## How far agents go alone

- No global autonomy switch or ladder of levels: each step that needs no user brings its own
  setting if it needs one.
- Nothing decides on its own that a card should be rejected; that would be a separate feature.
- A delivery that cannot land is not a question: the board resolves and lands it, asking only
  when the work is genuinely at risk.
- A finished delivery's worktree is kept only when the user can really bring it back.

## What a card can carry

- A card's files, mockups and rendered videos included, live in the board's one assets folder
  under its id, stay readable through the build, and are archived and shown with the card.

## Eval collection

- Partner feedback is opt-in and starts with a small group of partners whose code we may
  inspect; the eval set lives in the private `ai4kanban-evals` repo, admitting only cases we
  reproduce.
- Partners, seed partners included, see one page before consenting: no payment, the case stays
  in the closed set indefinitely, analysis may pass through a model provider, a letter deletes
  it. Any later use needs fresh consent.

## Learning from acceptance

- Review feedback turned into SOPs stays a human-approved proposal until acceptance judgement
  is proven reliable and a learned SOP is proven to help unseen tasks.

## Selling a service

- Contact is one form for support and custom workflows, confirmed on the page, not a mailto.
- A custom agent workflow costs $15 per agent in every language; quote and payment go by
  email, and the site takes no payment.

## Pricing

- **四档**：Free（Apache 2.0、8 种编码 agent、编码工作流、不限并发和自定义）；Pro $15/月或 $120/年，默认显示年付；种子伙伴（隐私保护下分享对话换 6 个月 Pro，候补加入，内部上限 20 人不对外公布）；培训只放一张链到 `/training` 的卡。
- **Pro 额度**：每月一笔 credits，托管配音与生图共用，不加购，用尽停到下月；按每月约 10 条带配音和封面的视频定量，满额仍小有盈利；生成一张封面扣 320 积分（中等质量）。
- **Pro 的卖点**：不把差别说成「更多工作流」；邮件策划对所有人免费，不作 Pro 卖点。
- **支出上限**：托管服务按用户设额度，不设全平台总上限。
- **Creem 只用正式商店**：不建测试商店，真实付款由用户人工验证后退款。
- **桌面端购买 Pro**：在桌面端定价页选月付/年付，用桌面端 Cloud 登录下单，付款页在系统浏览器打开，付完落到无需登录的「请回到 AI4Kanban」页。

## skill

- **按交付物选工作流**：看卡片最终交付什么，不看改动对象；指南里的选择规则不举具体工作流名。
- **发版前不做旧数据兼容**：未发版功能改名或改格式时直接换新。
- **Cloud 付费命令归在 `akb cloud` 下**：要登录、扣额度的命令不放顶层。

## local-ui

- **统计图表时段**：最短 30 天，不做 24 小时或 7 天。

## cloud

- **申请人邮件**：只发英文。
- **alpha 定位**：礼貌说明仍在开发、目前对受邀用户免费、不承诺永久免费。
- **托管看板暂不对外**：面向用户的 Cloud 说明只放桌面端 Cloud 设置页和 Cloud 邮件。
- **「将此看板存储到 Cloud」**：修完已知问题、团队用真实看板在正式环境往返一次且数据完整后，一次性对所有受邀用户开放，不分批。

## marketing

- **周报发送**：随版本发布，由用户手动发送；agent 只准备到测试邮件通过为止。
