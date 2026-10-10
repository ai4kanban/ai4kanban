# Decisions

Settled user-facing answers for the project as a whole; a module's own live in its folder
beside this file. Read before proposing so you don't re-ask a settled call.

## Positioning

- **定位以 `positioning.md` 为准**：入口文案直接引用，不再单独确认；看板是载体而非卖点。
- **以看板为中心**：不以聊天窗为主要交互；人负责取舍和决策，agent 负责执行。
- **UI 优先**：用户的主要操作走桌面端，Skill 只是可选项。
- **A middle manager**: it clarifies, delegates and carries work through acceptance; which
  projects to start or stop stays the user's. It is not tied to software.
- **The "3–6× faster" claim**: stays without a citation, backed by this repository's own
  auditable figures beside it.
- **Local-first**: promises the default backend (markdown in git), not every backend a user can pick.
- **记忆的卖点**：记忆天然按 Agent 和模块切分，取用更精准、占用上下文更少；不说「粒度更细」这类术语。
- **不做无人值守**：主打验收前置（先给用户看最在意的部分，如 UI，不靠谱就当场放弃）和规划后置（漏掉的功能在实现后由后台补卡，不在实现前反复规划）。

## Teams and Cloud

- **开源版与 Cloud 分工**：开源版聚焦本地单人工作流；多人权限、通知和协作同步由 Cloud 提供。
- **Cloud 不代跑 agent**：执行仍在每个人自己的机器上，用自己的模型账号；Cloud 负责派发、协作和同步。
- **团队协作先解决四件事**：识别成员；把 agent 的问题送给能决策的人；避免多个 agent 同时处理同一张卡；团队决策进入同一份可追溯记忆。
- **外部系统只是入口和镜像**：GitHub Issues、Linear 等导入需求、镜像进展；外部评论只作建议导入，不能直接覆盖看板。

## How far agents go alone

- **No autonomy switch**: no global switch or ladder of levels; each step that needs no user
  brings its own setting if it needs one.
- **看板助手一律常开**：不能关闭，定期运行的只能调周期；不做「自动批准执行」「自动回答问题」这类全自动开关。
- **Nothing rejects a card on its own**: except an auto-sorted card whose planning or build finds
  the product already does it, or what it concerns is gone — archived straight away with the
  evidence as its reason.
- **A delivery that cannot land is not a question**: the board resolves and lands it, asking only
  when the work is genuinely at risk.
- **A finished delivery's worktree**: kept only when the user can really bring it back.

## Memory

- **全局记忆的位置**：每个全局记忆放在 `docs/kanban/memory/<名称>/`，与 `project.md`、`agents/` 同级。
- **全局记忆和工作流、agent 一样由用户自建**：内置的与自建的格式完全相同；契约由创建者写，agent 只在 frontmatter 声明 `memory: [<名称>]`，AGENT.md 不重复契约；安装时不创建。
- **全局记忆没有通用格式**：不统计、不显示条目数，界面不用「条目」这类词；记忆不存频率或排期，重查按文件里的读取日期判断。

## What a card can carry

- **Card files**: mockups and rendered videos included, live in the board's one assets folder
  under its id, stay readable through the build, and are archived and shown with the card.

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
- **Custom agent workflow**: $15 per agent in every language; quote and payment go by email, and
  the site takes no payment.

## Pricing

- **取舍只看用户价值**：不因能否支撑收费（如 Pro）保留次优方案。
- **四档**：Free（Apache 2.0、8 种编码 agent、编码工作流、不限并发和自定义）；Pro $15/月或 $120/年，默认显示年付；种子伙伴（隐私保护下分享对话换 6 个月 Pro，候补加入，内部上限 20 人不对外公布）；培训只放一张链到 `/training` 的卡。
- **Pro 额度**：每月一笔 credits，托管配音与生图共用，不加购，用尽停到下月，不改用用户自己的 agent；按每月约 10 条带配音和封面的视频定量，满额仍小有盈利。
- **triage 逐条判断**：Pro 免费、不限条数，不扣 credits。
- **Pro 的卖点**：不把差别说成「更多工作流」；邮件策划对所有人免费，不作 Pro 卖点。
- **支出上限**：托管服务按用户设额度，不设全平台总上限。
- **Creem 只用正式商店**：不建测试商店，真实付款由用户人工验证后退款。
- **退款**：默认不退款（法律另有要求除外），个别退款由我们决定是否受理；一旦退款或拒付，付费方案与 credits 立即全部收回。
- **管理员不自动有 Pro**：测试时给自己发赠送，计费不设特例。
- **桌面端购买 Pro**：在桌面端选月付/年付并用 Cloud 登录下单，付款在系统浏览器完成，付完落到无需登录的「请回到 AI4Kanban」页。
