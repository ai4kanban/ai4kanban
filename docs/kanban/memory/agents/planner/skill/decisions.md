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

- **draft-first**：独立 skill，落地页在 `ai4kanban.dev/draft-first`，不买独立域名；一条 npx 命令安装；分享只导出本地单个 HTML 文件，不上传服务。
- **draft-first 可无迁移升级到 AI4Kanban**：草稿格式与看板一致；自带 helper 照搬 coding 工作流的内置 agent 及其名字，触发范围不比对应 agent 窄；哪些部分出草稿由 helper 定义、用户可增改，SKILL.md 不写通用规则。

## Planning and refining

- **按交付物选工作流**：看卡片最终交付什么，不看改动对象；指南里的选择规则不举具体工作流名。
- **已有卡片可换工作流**：只在卡片未开始或已停下时可换，进行中的不能换；换后回到待规划，立即由新工作流重新规划，已产出的内容保留。
- **What triggers refine**: a run creating a card, never a run editing one; turning the gate on applies only to cards that reach `ready` afterwards.
- **The coding workflow is judged on cost and time alone**: one planning session, as few coding sessions as possible; trimming sessions trims their prompts too.
- **refine 指引保持轻量**：计划里站不住的缺口交给建议后续任务补卡，不往规划指引加核查规则；proposer 保持通用，不按工作流定制。
- **Material pasted to make cards from**: an article, research or feedback gets no board flow; the agent runtime answers it as it would any request.
- **游戏开发先看平台**：用户要的是微信小游戏和 ModRetro（Game Boy Color）；每张卡只交付单个场景或 mockup，整体测试在用户的模拟器、引擎或真机上。

## Sessions

- **规划阶段续用会话**：从对话、讨论或终端建的卡接续原会话（讨论和 setup 各给每张卡 fork 一份副本，讨论本身保持独立），不让新 agent 读对话记录；build、审查和复盘都新开会话。
- **规划一轮做完**：建卡→细化→专项、或应用答案→细化→专项都在一轮内完成，细化力度按改动范围判断，专项后不再多跑细化。
- **接用户终端里的会话**：只接能分叉的智能体（Claude Code、Codex、OpenCode），不续用原会话、不读其本地会话记录。

## Implementation runs

- **No git repo**: every agent still runs; the board passes what each needs instead of telling the user to `git init`.
- **Rebases and landing**: a conflict gets one session to resolve it and no re-review; a landing conflict retries on the run-retry curve and is never handed back.
- **An abnormally ended delivery**: carried on by hand, never restarted for you; it finishes without rebuilding only on evidence its change is already on the target.
- **Run retry**: ships only on harnesses whose failure signals are proven, and gives up after a few attempts.
- 构建在独立工作树里、不含主目录未提交改动时，在启动处说明；主目录干净时不提。
- 看板的流程与语言规则优先于项目的 `AGENTS.md` / `CLAUDE.md`，项目配置只在不冲突时生效。

## Follow-ups and triage

- **Follow-ups are judged once, leaving triage**: a card the user asks for directly skips triage; a dismissal only blocks the automatic pull, never adding by hand.
- **小改动默认先问用户**：建议后续任务的小改动由用户在该 agent 的选项里选「直接做完 / 先问我 / 不提」，默认先问我。
- **建议后续任务不设条数上限**：每条各自过「值得用户花时间读」的门槛，探索性想法也提；堆积靠运行条件控制，不靠截断。
- **Sources**: optional and independent, sharing one Triage lifecycle and dedup; the board reaches one user-configured endpoint with a fixed format, and dist0's cost sits inside the Cloud subscription.
- **Pro 自动分拣由 Jev 逐条判断**：经 Cloud 调用，不是 agent；结论只有 plan / plan-without-refine / skip / human-review，从不自动开工，过把握度线才自动处理；它看不到代码，不判「产品是否已做到」，那由提出条目的一方和第一次规划负责。
- **换分拣方式的门槛**：新方式错删不多于原来，且错留少三分之一以上才替换。

## Recurring and background work

- **No recurring cards**: all repeating work is a workflow's scheduled agent on a cadence the user sets; a one-off change to how it works is an ordinary card.
- **A scheduled agent** has no priority or open questions and never waits for cleared triage: what it can't settle goes to triage, output needing review becomes that workflow's card; a user who wants it quiet turns it off or lengthens the cadence.
- Each workflow may have its own triage automation and competitor analysis; this board's competitor analysis compares product features only, so it belongs to Coding.
- An agent splits a run with board sub-runs, never the harness's own subagents: not every runtime has them, and cost, logs and status must show on the board.
- Memory pruning is always on with a user-set cadence; the chat-memory review is always on and skips days with no conversation.
- Turning one agent on never flips another's switch; an agent inside a workflow has no switch of its own (its stage assignment decides), except a scheduled one.

## Releases

- A bug no shipped version carries gets no patch release; the fix only lands on main.

## The command

- One command owns every board and agent action; every surface drives runs through it.
- It is a Node program installed and updated by one npm script — no binary, shell script, `curl | sh` or clone. Install never asks which agents you use, and a board install does not install the skill.
- **Cloud 付费命令归在 `akb cloud` 下**：要登录、扣额度的命令不放顶层。
- **No backward compatibility**: a renamed or reshaped feature switches over at once — removed options fail as unknown, retired files are deleted on update, and old cards are re-planned.

## Storage

- Memory, `metrics.csv` and `next-id` stay local markdown on every backend; only cards move, one backend per project.
- GitHub Projects backend is wanted but parked; Notion gets a card when a user asks.

## Agents and runtimes

- A runtime fully defines what a run runs as, with no per-harness inheritance, so two agents on one harness can use two gateways.
- Agent ids match display names and are scoped narrowly enough to leave room for siblings (`software-planner`, not `planner`).
- Splitting a flow onto its own agent copies the old agent's rule and runtime once, so behaviour is unchanged after upgrade; removing a built-in agent reassigns saved workflows and says who took over.
- An agent's own setting is a dropdown it declares in its `AGENT.md`; the core never adds code or flags for one agent. Two ways of running one agent means two agents.
- **花费只按模型、运行工具和用户统计**：单次运行或会话的花费不做功能；每次运行只记它自己的花费，否则总数重复计算。

## Workflows and spec agents

- **Two stages only**: each card runs plan → execute; spec agents are post-plan hooks; checking finished work belongs to scheduled agents (such as QA) that read archived cards.
- **Coding 工作流不搞特例**：`software-planner` 与其他领头 agent 同一架构，专属规则写进它的 `AGENT.md`，不写进核心 guide 或特例代码。
- Adding a built-in agent is writing a prompt, never command code; the core hard-codes no agent's checks.
- Workflows only switch their agents on or off; helpers run only on request. Built-in workflows can be configured or copied, not renamed or deleted.
- An agent that writes text or files hands it over as final; the user edits the section to disagree.
- The card is the brief: executors get its requirements as frozen at delivery start. The executor is never the planner; an external tool or person is an execute-stage agent with an "external" runtime.
- An agent is harness-agnostic: its rules set the output standard and name no harness's tools.
- **规划即交付的工作流可选配执行阶段**：配了执行 agent 就有 Build，空着就规划完归档；内置工作流的执行阶段保持空着。
- **工作流定义是文件**：内置与用户工作流同一 `WORKFLOW.md` 格式；用户的放 `docs/kanban/workflows/`，随项目进 git。
- 审批轮次越少越好（每轮都冷启动新会话）；每轮提问写明第几轮、批准后发生什么。

## Content workflows

- 内容类工作流（视频、PPT）各配专用的规划与制作代理，不复用 `software-planner` 与 `builder`。
- 产品视频工作流只规定叙事与文案确认、成片检查和经验沉淀；制作方式由执行代理自定。
- **video-cloner 是编程化视频复刻**，不限产品视频：拍法用模板代码复刻，内容换成使用者的，通用系统界面照原样画；草稿阶段只有一个原片拆解与复刻脚本的逐镜对照，拆解兼作分镜列表。
- 旁白只让用户选音色，不选模型；托管音色经 AI4Kanban Cloud 提供，无需各家 API key。
- 项目内的运镜配方反馈只留在该项目的看板记忆，不改写随命令分发的配方。
- 构图与动画选用索引随 akb 发布给脚本作者，不放官网；维护者用的盘点清单留在仓库。
- Recipes are named for what they do, never "demo".
- **Social post 默认纯文字**：只有卡片要图或平台必须（小红书、Instagram、TikTok）才做图文轮播。
- **Blog post 与 Social post 按内容形态分**：有标题、单独成页的文章（自家博客、Medium、dev.to）是 Blog post；在信息流里刷到的帖子（LinkedIn 帖、X 线程、轮播）是 Social post。

## Templates

- **道具与动效上 Cloud**：各自独立类别，不用标签；复刻先查 Cloud 再查本机，本机只当缓存。
- **视频模板自包含**：beat 表 + 动效 + 道具，带一套只供预览的默认内容；原片画面不进模板，用到的道具、动效拷进模板包，不按名字引用。
- **动效对得上原片才复用，差别分三档**：只差外部传入的（内容、主题色、beat 时长）直接复用；差写死在代码里的数值，提成参数、默认保持原值，再同名覆盖发布；编排不同（步骤、动的元素、先后顺序）就新建动效。
- **复刻外部参考的模板带来源说明**：参考了哪个页面、复刻和改动了哪些部分；记原站 URL、实际参考资料 URL 和采集时间，并附采集时的截图或录屏作凭证，凭证与模板源码、复刻预览分开存。
- **模板元数据给默认值**：缺 `access` 按 `free`，缺 `source` 按原创，是否原创由创建者负责；不让用户填不必要的字段。
- **只有视频代理自己找模板**：`hyperframes-editor` 和 `video-cloner` 自己找道具、动效；`ui-designer`、`carousel-planner` 不带模板指令。`hyperframes-editor` 只在卡片指定整套视频模板时照它做，否则逐镜用卡片指定的道具或动效，其余自己做，现成的可能省事时才查目录。
- **发布到 Cloud 不是用户的事**：内置 video-clone 做到本机模板为止；发布只在维护者看板，由各自工作流的执行负责人（视频 `video-template-publisher`、界面 `ui-template-publisher`）负责，一个代理只属于一个工作流。

## Mockups

- Mockups are gitignored, so what a layout settled must be in the card's words.
- 只产出渲染页面，不做字符草图，也不另建字符草图 agent。
- **截图不列拍摄清单**：要拍什么由图片的 `alt` 说明，不在卡片待办里另列。
- 手机设计稿的外框负责 iOS 真机布局，规划和 ui-designer 不用管。

## Chat

- Nothing is built without talking first: chat offers Discuss, and Plan tasks / Start now act on the plan it writes, carrying the discussion's own words along — the plan is the contract, the words add intent.
- Only an agent that can take a second message into an open session can hold a chat; never resend the whole exchange.
- Each discussion owns one plan and cannot modify another's; a transcript never enters git, so without the local record the plan alone governs.
- 创建未完成的卡只放行直接丢弃，不放行带否决记忆的普通拒绝。

## Writing the product

- 引入外部开源资料：许可允许就署名后改写，只取通用部分，不整段照搬。
