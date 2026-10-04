# Decisions

Settled user-facing answers for the project as a whole; a module's own live in its folder
beside this file. Read before proposing so you don't re-ask a settled call.

AI project management that grows with you.

AI4Kanban的目标是一个自进化的AI *项目经理*：给它一个模糊想法，它会自主解读、拆解、循环澄清，直到每个需求细节都被明确。

- [x] 自主拆解：agent解读需求，将其拆解为多个子任务；夹带的无关需求会被拆出，作为独立任务。
- [x] 循环澄清：agent首先对需求自主提问；凡是凭记忆和常识能解答的，直接决策，否则请人类介入澄清。此流程不断重复，直到agent对需求提不出更多疑问。
- [x] 7x24：拆解与澄清在后台持续进行，直到需求明确。
- [x] 决策可追溯：人类随时能看到需求是如何一步步被细化的。
- [x] 自主提需求：agent基于各模块的记忆提出功能提案。人类的否决会被记录，令agent此后不再提出同类提案。
- [x] 自进化：每次人工介入都会被记录，作为后续自主决策的参照。记忆按项目模块分别组织。
- [x] 依赖和优先级管理：agent不仅拆解任务，还负责排定优先级——识别任务间的依赖，权衡价值与成本，确保任务以正确的顺序执行。
- [x] 交付闭环：AI4Kanban的职责不止于把需求澄清，而是覆盖任务的完整生命周期——提出、澄清、执行、归档。看板始终反映项目的真实进展。

AI4Kanban为小微团队而设计：用看板管理工作，把人从具体实施中解脱出来，去关注每项工作对用户的价值，而非coding agent的执行细节。得益于新模型的能力，当前的coding agent已经能高完成度地把明确的需求翻译成代码；但如果需求本身不明确，它只会在错误的假设上做错误的开发。AI4Kanban依靠持续积累的记忆，在你提出模糊想法时沿着过去的决策轨迹自主判断，最终产出可落地的明确需求。

----

- [ ] Harness无关：任何Harness都可以使用，包括但不限于Claude Code、Codex、Cursor。
- [x] 本地优先：看板任务默认存储为本地Markdown文件，无需MCP，无需数据库，节约token。一切以纯文本留存于git，可审查、可diff、可回滚。
- [x] 开箱即用：一条prompt完成安装与升级；AI4Kanban专为项目管理打造，配置极简。
- [x] ~~两种使用模式：既可通过skill在命令行内管理看板，也可在本地UI中操作。~~
- [ ] UI优先（或者说看板优先）：通过Skill进行首次安装和配置的不可控因素太多，用户的主要操作应该通过GUI，Skill只作为后续可选项。
  - [ ] 桌面端：考虑到人负责取舍而非执行，人应该可以在任意设备上提供决策，而不仅是web浏览器。
  - [ ] CLI：与agent harness的交互、看板管理都封装在CLI中，UI后端通过CLI进行看板/agent操作，这使得Skill能够实现UI同样的功能。
  - [ ] Onboarding：首次使用时应该经过类似于typeless的引导，完成看板的初始化，包括设置 goal.md。
  - [ ] Chat with Board：既然UI优先，那么交互方式应该能跳过agent，直接在UI中进行任务的讨论。

人类项目经理用看板管理工作，agent也应如此。AI4Kanban不以聊天窗作为交互方式，而以看板为中心。

----

- [ ] 外部系统接入（近期）：从Obsidian、Notion、GitHub Issues等导入需求或镜像进展；它们不是AI4Kanban的权威存储。
- [ ] 可插拔Harness（近期）：看板任务可交由Claude Code、Codex、Cursor等执行。
- [ ] Git worktree（近期）：任务在各自的worktree中并行执行，互不干扰。
- [ ] 定时任务/Webhook（近期）：按计划或经Webhook自动从外部导入需求。
- [ ] 阻塞任务管理（近期）：对长期搁置的任务做激进处理——拆分、改写，或直接否决。

----

团队协作（中期）。以下是方向，不是已实现的功能。

- 开源版聚焦本地单人工作流；多人权限、通知和协作同步由托管团队版提供。
- 开源项目早期可以把看板放在仓库的`docs/kanban/`中，由维护者在本地使用；社区仍通过Issue提交需求、通过PR贡献代码。
- 当核心贡献者增多时，项目可以迁移到AI4Kanban Cloud。Cloud支持从`docs/kanban/`批量导入卡片、记忆、release和历史数据。
- Cloud以云数据库为权威数据源。看板默认私有，项目可主动设为公开只读，让社区查看路线图和进度。
- 需要直接参与看板工作的核心贡献者通过Cloud协作。AI4Kanban计划为符合条件的开源项目提供支持，具体政策另行发布。
- 执行近期仍在开发者自己的机器上：每个人的机器是自己的执行节点，使用自己的模型账号；Cloud负责任务派发、协作和数据同步，不代跑agent。
- 团队协作要解决四件事：识别团队成员；把agent的问题送给能决策的人；避免多个agent同时处理同一张卡；让团队决策进入同一份可追溯记忆。
- 决策收件箱让成员在浏览器中回答agent、编辑确定性字段并查看任务状态；IM接入用于把提问送到成员日常工作的地方。
- GitHub Issues、Linear等继续作为社区反馈入口和进展镜像；外部评论只作为建议导入，不能直接覆盖看板。

## Positioning

- 定位以仓库根目录 `positioning.md` 为准，入口文案直接引用，不再单独确认；看板是载体而非卖点。
- The project manager is a middle manager: it clarifies, delegates and carries work through
  acceptance; which projects to start or stop stays the user's. It is not tied to software.
- The "3–6× faster" claim stays without a citation, backed by this repository's own auditable
  figures beside it.
- Local-first promises the default backend (markdown in git), not every backend a user can pick.
- **记忆的卖点**：记忆天然按 Agent 和模块切分，取用更精准、占用上下文更少；不说「粒度更细」这类术语。
- **不做无人值守**：主打验收前置（先给用户看最在意的部分，如 UI，不靠谱就当场放弃）和规划后置（漏掉的功能在实现后由后台补卡，不在实现前反复规划）。

## How far agents go alone

- No global autonomy switch or ladder of levels: each step that needs no user brings its own
  setting if it needs one.
- **看板助手一律常开**：不能关闭，定期运行的只能调周期；不做「自动批准执行」「自动回答问题」这类全自动开关。
- Nothing decides on its own that a card should be rejected, except one exception: an auto-sorted card whose planning (or, skipping planning, its build) finds the product already does it or what it concerns is gone is removed straight to the archive with the evidence as its reason, without asking.
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

- **取舍只看用户价值**：不因能否支撑收费（如 Pro）保留次优方案。
- **四档**：Free（Apache 2.0、8 种编码 agent、编码工作流、不限并发和自定义）；Pro $15/月或 $120/年，默认显示年付；种子伙伴（隐私保护下分享对话换 6 个月 Pro，候补加入，内部上限 20 人不对外公布）；培训只放一张链到 `/training` 的卡。
- **Pro 额度**：每月一笔 credits，托管配音与生图共用，不加购，用尽停到下月，不改用用户自己的 agent；按每月约 10 条带配音和封面的视频定量，满额仍小有盈利；生成一张封面扣 320 积分（中等质量）。
- **triage 逐条判断**：Pro 免费、不限条数，不扣 credits。
- **Pro 的卖点**：不把差别说成「更多工作流」；邮件策划对所有人免费，不作 Pro 卖点。
- **支出上限**：托管服务按用户设额度，不设全平台总上限。
- **Creem 只用正式商店**：不建测试商店，真实付款由用户人工验证后退款。
- **退款**：默认不退款（法律另有要求除外），个别退款由我们决定是否受理；一旦退款或拒付，付费方案与 credits 立即全部收回。
- **管理员不自动有 Pro**：测试时给自己发赠送，计费不设特例。
- **桌面端购买 Pro**：在桌面端定价页选月付/年付，用桌面端 Cloud 登录下单，付款页在系统浏览器打开，付完落到无需登录的「请回到 AI4Kanban」页。
