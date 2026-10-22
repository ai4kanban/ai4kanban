# Decisions

Settled user-facing answers for the project as a whole; a module's own live in its folder
beside this file. Read before proposing so you don't re-ask a settled call.

## Positioning

- **定位以 `positioning.md` 为准**：入口文案直接引用，不再单独确认；看板是载体而非卖点。
- **以看板为中心、UI 优先**：主要操作走桌面端，不以聊天窗为主；人负责取舍和决策，agent 负责执行。
- **A middle manager**: it clarifies, delegates and carries work through acceptance; which
  projects to start or stop stays the user's. It is not tied to software.
- **The "3–6× faster" claim**: stays without a citation, backed by this repository's own auditable figures.
- **Local-first**: promises the default backend (markdown in git), not every backend a user can pick.
- **记忆的卖点**：按 Agent 和模块切分，取用更精准、占用上下文更少；不说「粒度更细」这类术语。
- **不走计划模式**：审阅都在卡片上，不需要「批注计划外的文档、网页」这类插件式审阅入口。
- **不做无人值守**：主打验收前置（先给用户看最在意的部分，不靠谱当场放弃）和规划后置（漏掉的功能实现后由后台补卡）。

## How far agents go alone

- **No autonomy switch**: no global switch or ladder of levels; each step that needs no user
  brings its own setting if it needs one.
- **看板助手一律常开**：不能关闭，定期运行的只能调周期；不做「自动批准执行」「自动回答问题」这类全自动开关。
- **Nothing rejects a card on its own**: the only exception is the unchecked-card discard `akb guide refine` describes.
- **A delivery that cannot land is not a question**: the board resolves and lands it, asking only when the work is genuinely at risk.
- **A finished delivery's worktree**: kept only when the user can really bring it back.

## Memory

- **全局记忆没有通用格式**：不统计条目数，不存频率或排期；何时重查由文件里的读取日期判断。

## What a card can carry

- **Card files**: mockups and rendered videos included, live in the board's one assets folder
  under its id, stay readable through the build, and are archived and shown with the card.

## Content deliverables

- **复刻求外观一致，不求逐像素或逐帧**（UI 与视频）：对比只为找出明显差异；像素比对是按需排查的工具，不做强制的逐轮量化修复和逐项数值报告。字体属于外观，按参考页实测的计算样式还原，不靠目测。

## Eval collection

- **Opt-in partners**: feedback starts with a small group whose code we may inspect; the eval set
  lives in the private `ai4kanban-evals` repo, admitting only cases we reproduce.
- **Consent page**: no payment, the case stays in the closed set indefinitely, analysis may pass
  through a model provider, a letter deletes it. Any later use needs fresh consent.

## Learning from acceptance

- **Learned SOPs stay proposals**: human-approved until acceptance judgement is proven reliable
  and a learned SOP is proven to help unseen tasks.

## Selling a service

- **Contact**: one form for support and custom workflows, confirmed on the page, not a mailto.
- **Custom agent workflow**: $15 per agent in every language; quote and payment go by email, and the site takes no payment.

## Pricing

- **取舍只看用户价值**：不因能否支撑收费（如 Pro）保留次优方案。
- **方案以 `/pricing` 与条款为准**：种子伙伴内部上限 20 人，不对外公布；培训只放一张链到 `/training` 的卡。
- **Pro 额度**：托管配音与生图共用，不加购，用尽停到下月，不改用用户自己的 agent；按每月约 10 条带配音和封面的视频定量，满额仍小有盈利。
- **triage 逐条判断**：Pro 免费、不限条数，不扣 credits。
- **托管能力按市价定价**：先查同类封装上游的零售工具怎么收再定，不凭空定；配乐按首计费，不按时长。
- **Pro 的卖点**：不把差别说成「更多工作流」；邮件策划对所有人免费，不作 Pro 卖点。
- **支出上限**：托管服务按用户设额度，不设全平台总上限。
- **Creem 只用正式商店**：不建测试商店，真实付款由用户人工验证后退款。
- **管理员不自动有 Pro**：测试时给自己发赠送，计费不设特例。
- **桌面端购买 Pro**：在桌面端选月付/年付并用 Cloud 登录下单，付款在系统浏览器完成，付完落到无需登录的「请回到 AI4Kanban」页。
