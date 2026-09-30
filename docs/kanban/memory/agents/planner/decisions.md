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
- **不做无人值守**：主打验收前置（先给用户看最在意的部分，如 UI，不靠谱就当场放弃）和规划后置（漏掉的功能在实现后由后台补卡，不在实现前反复规划）。

## How far agents go alone

- No global autonomy switch or ladder of levels: each step that needs no user brings its own
  setting if it needs one.
- **看板助手一律常开**：不能关闭，定期运行的只能调周期；不做「自动批准执行」「自动回答问题」这类全自动开关。
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
- **Pro 额度**：每月一笔 credits，托管配音与生图共用，不加购，用尽停到下月，不改用用户自己的 agent；按每月约 10 条带配音和封面的视频定量，满额仍小有盈利；生成一张封面扣 320 积分（中等质量）。
- **triage 逐条判断**：Pro 免费、不限条数，不扣 credits。
- **Pro 的卖点**：不把差别说成「更多工作流」；邮件策划对所有人免费，不作 Pro 卖点。
- **支出上限**：托管服务按用户设额度，不设全平台总上限。
- **Creem 只用正式商店**：不建测试商店，真实付款由用户人工验证后退款。
- **退款**：默认不退款（法律另有要求除外），个别退款由我们决定是否受理；一旦退款或拒付，付费方案与 credits 立即全部收回。
- **管理员不自动有 Pro**：测试时给自己发赠送，计费不设特例。
- **桌面端购买 Pro**：在桌面端定价页选月付/年付，用桌面端 Cloud 登录下单，付款页在系统浏览器打开，付完落到无需登录的「请回到 AI4Kanban」页。

## skill

- **按交付物选工作流**：看卡片最终交付什么，不看改动对象；指南里的选择规则不举具体工作流名。
- **发版前不做旧数据兼容**：未发版功能改名或改格式时直接换新。
- **Cloud 付费命令归在 `akb cloud` 下**：要登录、扣额度的命令不放顶层。
- **视频卡演示截图只显示一次**：排练结果及截图在卡片审阅区显示，脚本段落只注明对应哪段演示，不重复嵌图。
- **博客工作流不在 SEO 上花力气**：主攻关键词只问用户，没有就跳过；不做关键词研究或排名追踪。
- **不保留 AI 审查**：coding 卡 build 完直接交付，不留可选审查开关；漏掉的靠归档后的建议后续任务补。
- **对话里要求实现**：助手从不在对话里改代码，也绝不绕过卡片；用户明说建卡或直接做时可跳过讨论计划，当轮从原话建卡并启动后台 build。
- **refine 指引保持轻量**：计划里站不住的缺口交给建议后续任务事后对照交付补卡，不往规划指引加核查规则；proposer 保持通用，不按工作流定制。
- **续跑会话是基础能力**：从对话建的卡接续原会话，而不是让新 agent 读对话记录；认出「当前是哪个智能体的哪段会话」和续跑/分叉只在一处实现，续跑中断任务、卡片对话、讨论建卡、终端建卡都走它。
- **Pro 的 triage 由 Jev 逐条判断**：本机组装上下文，经 Cloud 调用；结论只有 plan / plan-without-refine / skip / human-review，极小改动（调按钮样式、修小错）建卡跳过规划，不自动开工。
- **游戏开发先看平台**：用户要的是微信小游戏和 ModRetro（Game Boy Color），希望尽量多覆盖；每张卡只交付单个场景或 mockup，不带完整产品，整体测试在用户的模拟器、引擎或真机上。
- **接用户终端里的会话**：只接能分叉的智能体（Claude Code、Codex、OpenCode），不续用原会话、不读智能体的本地会话记录。
- **看板设置按机器存**：本地看板和 Cloud 工作区都不共享看板设置（工作流、运行时、模型），不进 git、不上传。

## local-ui

- **统计图表时段**：最短 30 天，不做 24 小时或 7 天。
- **跨组件共享状态只用 React**：模块级 store 配 `useSyncExternalStore`，不引入 Zustand、Jotai 等外部库。

## cloud

- **申请人邮件**：只发英文。
- **alpha 定位**：礼貌说明仍在开发、目前对受邀用户免费、不承诺永久免费。
- **托管看板暂不对外**：面向用户的 Cloud 说明只放桌面端 Cloud 设置页和 Cloud 邮件。
- **「将此看板存储到 Cloud」**：修完已知问题、团队用真实看板在正式环境往返一次且数据完整后，一次性对所有受邀用户开放，不分批。

## marketing

- **周报发送**：随版本发布，由用户手动发送；agent 只准备到测试邮件通过为止。
