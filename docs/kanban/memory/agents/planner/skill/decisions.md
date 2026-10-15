# Decisions

Settled user-facing answers for this module. Read before proposing so you don't re-ask a
settled call.

## Memory

- **拒绝不起会话**：只从其他卡的 `blocked_by`/`related` 移除它，正文里提到它的句子留给那张卡的细化处理。
- **清空的卡片对话留到记忆审阅**：清空对话或换 agent 不立即删除旧对话，清理跟着记忆审阅走，另设保留上限。
- **竞品记忆忠实于竞品本身**：对比页是对外宣传，记忆是内部记录，两者重复无妨。

## The goal

- The goal is optional and free-form: the agent checks only that text is there and never nags about what the user wrote.

## Standalone skill

- **draft-first**：独立 skill，落地页在 `ai4kanban.dev/draft-first`，不买独立域名；分享只导出本地单个 HTML 文件，不上传服务；一条 npx 命令安装。
- **draft-first 可无迁移升级到 AI4Kanban**：草稿格式、`<!-- agent -->` 两半与看板一致；自带 helper 照搬 coding 工作流的内置 agent 并沿用其名字，触发范围不得比对应 agent 窄。
- **draft-first 只为关键部分出草稿**：哪些算关键由 helper 定义，用户在 `.draft-first/helpers/` 增改；SKILL.md 不写通用的「何时出草稿」规则。

## Planning and refining

- **按交付物选工作流**：看卡片最终交付什么，不看改动对象；指南里的选择规则不举具体工作流名。
- **One session per card**: it drives the card the whole way without pausing, ending `ready` or holding only questions a human must answer.
- **Creation owns context**: creation distils the request into a self-contained card and refinement tests it alone; lost context is a creation defect.
- **What triggers refine**: a run creating a card, never a run editing one; turning the gate on applies only to cards that reach `ready` afterwards.
- **The coding workflow is judged on cost and time alone**: one planning session, as few coding sessions as possible; trimming sessions trims their prompts too.
- **refine 指引保持轻量**：计划里站不住的缺口交给建议后续任务补卡，不往规划指引加核查规则；proposer 保持通用，不按工作流定制。
- **Material pasted to make cards from**: an article, research or feedback gets no board flow; the agent runtime answers it as it would any request.
- **游戏开发先看平台**：用户要的是微信小游戏和 ModRetro（Game Boy Color）；每张卡只交付单个场景或 mockup，整体测试在用户的模拟器、引擎或真机上。

## Sessions

- **续跑会话是基础能力**：从对话建的卡接续原会话，而不是让新 agent 读对话记录；续跑中断任务、卡片对话、讨论建卡、终端建卡都走同一套。
- **讨论建卡后规划用副本**：规划从讨论会话的副本接着走，讨论保持独立，不与规划共用同一会话；一次讨论建出多张卡时每张各 fork 一份，setup 的种子卡各自从 setup 会话 fork。
- **规划一轮做完**：建卡→细化→专项在同一轮内完成；回答问题也是应用答案→细化→专项一轮做完，细化力度由 agent 按改动范围判断；专项跑完后不再多跑一轮细化。
- **构建不续用规划会话**：会话复用只限规划阶段内（建卡→规划、回答问题→再规划）；build、审查和复盘都新开。
- **接用户终端里的会话**：只接能分叉的智能体（Claude Code、Codex、OpenCode），不续用原会话、不读智能体的本地会话记录。

## Implementation runs

- **No git repo**: every agent still runs; the board passes what each needs instead of telling the user to `git init`.
- **Rebases and landing**: a conflict gets one session to resolve it and no re-review; a landing conflict retries on the run-retry curve and is never handed back.
- **An abnormally ended delivery**: carried on by hand, never restarted for you; it finishes without rebuilding only on evidence its change is already on the target.
- **Run retry**: ships only on harnesses whose failure signals are proven, and gives up after a few attempts.
- 构建在独立工作树里、不含主目录未提交改动时，在启动处说明；主目录干净时不提。
- 看板的流程与语言规则优先于项目的 `AGENTS.md` / `CLAUDE.md`，项目配置只在不冲突时生效。

## Follow-ups and triage

- **Follow-ups are judged once, leaving triage**: a card the user asks for directly skips triage.
- **小改动默认先问用户**：建议后续任务的小改动由用户在该 agent 的选项里选「直接做完 / 先问我 / 不提」，默认先问我；通用回顾说明不写任何一档。
- **建议后续任务不设条数上限**：每条各自过「值得用户花时间读」的门槛，探索性的想法也提；堆积靠运行条件控制，不靠截断。
- **Sources**: optional and independent, sharing one Triage lifecycle and dedup; the board reaches one user-configured endpoint with a fixed format, and dist0's cost sits inside the Cloud subscription.
- A dismissal only blocks the automatic pull; adding by hand always goes through.
- **Pro 自动分拣由 Jev 逐条判断**：经 Cloud 调用，不是 agent（无会话和记忆，不进 agents 列表），各来源不各写判定规则；结论只有 plan / plan-without-refine / skip / human-review，从不自动开工；「忽略」「值得做」过把握度线才自动处理。
- **Jev 不判「产品是否已做到」**：它看不到代码，由提出条目的一方和第一次规划对照代码负责；proposer 的条目只让 Jev 补「要不要用户」和元数据。
- **换分拣方式的门槛**：新方式错删不多于原来，且错留少三分之一以上才替换。

## Recurring and background work

- **No recurring cards**: all repeating work is a workflow's scheduled agent run on a cadence the user sets; a one-off change to how it works is an ordinary card.
- **A scheduled agent** has no priority and no open questions: what it can't settle or finds broken goes to triage; output that needs review (e.g. a blog post) becomes that workflow's card.
- **Never gated on cleared triage**: it runs on its cadence and new input alone; a user who wants it quiet turns it off or lengthens the cadence.
- Each workflow may have its own triage automation and competitor analysis; this board's competitor analysis compares product features only, so it belongs to Coding.
- An agent splits a run with board sub-runs, never the harness's own subagents: not every runtime has them, and cost, logs and status must show on the board.
- Memory pruning is always on with a user-set cadence; the chat-memory review is always on and skips days with no conversation.
- Turning one agent on never flips another's switch; a page may warn and leaves both as set.
- An agent inside a workflow has no switch of its own — its stage assignment decides — except a scheduled one.

## Releases

- A bug no shipped version carries gets no patch release; the fix only lands on main.

## The command

- One command owns every board and agent action; every surface drives runs through it.
- It is a Node program installed and updated by one npm script — no binary, shell script, `curl | sh` or clone. Install never asks which agents you use, and a board install does not install the skill.
- **Cloud 付费命令归在 `akb cloud` 下**：要登录、扣额度的命令不放顶层。
- **No backward compatibility**: a renamed or reshaped feature switches over at once — a removed option fails as unknown, a retired `AGENT.md` key is rejected with its replacement, `akb update` deletes retired board files, and old cards are re-planned.

## Storage

- Memory, `metrics.csv` and `next-id` stay local markdown on every backend; only cards move, one backend per project.
- GitHub Projects backend is wanted but parked; Notion gets a card when a user asks.

## Agents and runtimes

- A runtime fully defines what a run runs as, with no per-harness inheritance, so two agents on one harness can use two gateways.
- Agent ids match display names and are scoped narrowly enough to leave room for siblings (`software-planner`, not `planner`).
- Splitting a flow onto its own agent copies the old agent's rule and runtime once, so behaviour is unchanged after upgrade; removing a built-in agent reassigns saved workflows and the config page says who took over.
- An agent's own setting is a dropdown it declares in its `AGENT.md`; the core never adds code or `akb` flags for one agent. Two ways of running one agent means two agents.
- **花费只按模型、运行工具和用户统计**：单次运行或会话的花费不做功能；每次运行只记它自己的花费，否则总数重复计算。

## Workflows and spec agents

- **Two stages only**: each card runs plan → execute; spec agents are post-plan hooks; nothing runs after execute — checking finished work belongs to scheduled agents (such as QA) that read archived cards.
- **Coding 工作流不搞特例**：`software-planner` 与其他领头 agent 同一架构，工作流专属规则写进它的 `AGENT.md`，不写进核心 guide，也不为 Coding 写特例代码。
- A built-in agent is an ordinary `AGENT.md`; adding one is writing a prompt, never command code. Scripts, references and validators ship with the agent; the core hard-codes no agent's checks.
- Workflows only switch their agents on or off; helpers run only on request. Built-in flows can be configured or copied, not renamed or deleted.
- An agent that writes text or files hands it over as final; the user edits the section to disagree.
- The card is the brief: executors get its requirements as frozen at delivery start. The executor is never the planner; an external tool or person is an execute-stage agent with an "external" runtime.
- An agent is harness-agnostic: its rules set the output standard and name no harness's tools or specific browser tool.
- 内容类工作流（视频、PPT）各配专用的规划与制作代理，不复用 `software-planner` 与 `builder`。
- 产品视频工作流只规定叙事与文案确认、成片检查和经验沉淀；制作方式由执行代理自定。
- 旁白只让用户选音色，不选模型；托管音色经 AI4Kanban Cloud 提供，无需各家 API key。
- 项目内的运镜配方反馈只留在该项目的看板记忆，不改写随命令分发的配方。
- 构图与动画选用索引随 akb 发布给脚本作者，不放官网；维护者用的盘点清单留在仓库。
- Recipes are named for what they do, never "demo".
- 审批轮次越少越好（每轮都冷启动新会话）；每轮提问写明第几轮、批准后发生什么。

## Mockups

- Mockups are gitignored, so what a layout settled must be in the card's words.
- 只产出渲染页面，不做字符草图，也不另建字符草图 agent。
- **截图不列拍摄清单**：要拍什么由图片的 `alt` 说明，不在卡片待办里另列截图位、场景和尺寸。
- One design system per app, picked from the card's module.
- 手机设计稿的外框负责 iOS 真机布局（状态栏、安全区等），规划和 ui-designer 不用管。

## Chat

- Nothing is built without talking first: the chat offers **Discuss**, and **Plan tasks** / **Start now** sit on the plan it writes.
- Only an agent that can take a second message into an open session can hold a chat; never resend the whole exchange.
- Each discussion owns one plan and cannot modify another's; plans change only through ai4kanban.
- A discussion transcript never enters git; without the local record the plan alone governs.
- **Plan tasks** 和 **Start now** 把讨论原话连同方案交给后续流程；方案是契约，原话补充意图。
- 创建未完成的卡只放行直接丢弃，不放行带否决记忆的普通拒绝。

## Writing the product

- 引入外部开源资料：许可允许就署名后改写，只取通用部分，不整段照搬。
