# Decisions

Settled user-facing answers for this module. Read before proposing so you don't re-ask a
settled call.

- **按交付物选工作流**：看卡片最终交付什么，不看改动对象；指南里的选择规则不举具体工作流名。
- **发版前不做旧数据兼容**：未发版功能改名或改格式时直接换新。
- **Cloud 付费命令归在 `akb cloud` 下**：要登录、扣额度的命令不放顶层。
- **视频卡演示截图只显示一次**：排练结果及截图在卡片审阅区显示，脚本段落只注明对应哪段演示，不重复嵌图。
- **博客工作流不在 SEO 上花力气**：主攻关键词只问用户，没有就跳过；不做关键词研究或排名追踪。
- **不保留 AI 审查**：coding 卡 build 完直接交付，不留可选审查开关；漏掉的靠归档后的建议后续任务补。
- **对话里要求实现**：助手从不在对话里改代码，也绝不绕过卡片；用户明说建卡或直接做时可跳过讨论计划，当轮从原话建卡并启动后台 build。
- **refine 指引保持轻量**：计划里站不住的缺口交给建议后续任务事后对照交付补卡，不往规划指引加核查规则；proposer 保持通用，不按工作流定制。
- **续跑会话是基础能力**：从对话建的卡接续原会话，而不是让新 agent 读对话记录；认出「当前是哪个智能体的哪段会话」和续跑/分叉只在一处实现，续跑中断任务、卡片对话、讨论建卡、终端建卡都走它。
- **Pro 的 triage 由 Jev 逐条判断**：本机组装上下文，经 Cloud 调用；结论只有 plan / plan-without-refine / skip / human-review，极小改动（调按钮样式、修小错）建卡跳过规划，不自动开工。判断分「忽略」和「值得做」两个把握度，各自过线才自动处理，都不过线才留给用户，并写出这两个数。Jev 不判「产品是否已做到」（它看不到代码），这由提出条目的一方和卡片第一次规划时对照代码负责；Jev 管否决过、值不值得、与未完成卡重复、要不要用户、元数据。proposer 的条目只让 Jev 补「要不要用户」和元数据；竞品分析等其他来源仍由 Jev 完整判断，不在各来源里各写一份判定规则，也不换成 agent。来自 `follow-up.md` 的后续工作默认代码里还没有。
- **游戏开发先看平台**：用户要的是微信小游戏和 ModRetro（Game Boy Color），希望尽量多覆盖；每张卡只交付单个场景或 mockup，不带完整产品，整体测试在用户的模拟器、引擎或真机上。
- **接用户终端里的会话**：只接能分叉的智能体（Claude Code、Codex、OpenCode），不续用原会话、不读智能体的本地会话记录。
- **看板设置按机器存**：本地看板和 Cloud 工作区都不共享看板设置（工作流、运行时、模型），不进 git、不上传。
- **卡片来源只给链接，不显示路径**：来源记在 frontmatter，正文不写 `## Source`；界面只放一个指向原文（计划、分诊条目、来源卡或外部链接）的链接，用户关心内容而不是路径。
- **构建不续用规划会话**：build 始终新开会话，规划时读到的代码和路径到构建时可能已过期；会话复用只限规划阶段内（建卡→规划、回答问题→再规划），审查和复盘也保持全新会话。
- **记忆审阅按归档卡片分批**：只审已归档卡片的卡片对话，不读讨论；每批最多 10 张卡，剩余的接着再跑一批。
- **归档卡片保留 7 天**：归档的卡片文件和它的附件、对话一样，满 7 天后自动删除。
- **一次运行带多张卡的上下文要有明确边界**：每张卡各自包在 XML 块或分隔线里，避免 agent 串用。
- **QA 手册的覆盖范围**：`qa-manager` 是所有用户项目通用的内置 agent，默认覆盖项目的全部模块，不只挑几个。
- **QA 手册的目录**：`docs/qa/<module>/<case>/case.md`，保留模块这一层，证据放在 `case.md` 旁边。
- **QA 手册取代 `verify:`**：规划不再产出 `verify:`；用户会遇到的用例由 Coding 工作流的周期 agent `qa-manager` 维护成可读、可复现的手册，每步带用户可见的证据（截图、GIF、日志）。每遍只跟进上次运行以来归档的卡片，更新受影响的步骤并删掉过期记录，不做整本重跑；agent 如实留下使用感受，证据可复用于演示和内容营销。
- **工作流只有 plan 和 execute 两个阶段**：spec agent 是 post-plan hook，不再是阶段；执行后不再运行任何 agent，检查已完成的工作由读取已归档卡片的周期 agent（如 QA）负责。
- **规划只有一个运行环境**：不设单独的讨论助手，它改为规划助手；各工作流的规划负责人不再各配运行环境，统一用规划助手的，只各写各的「你的要求」。
- **自动处理待筛选不算 agent**：它只是逐条调用 Cloud，没有会话和记忆，不进 agents 列表。
- **清空的卡片对话留到记忆审阅**：清空对话或换 agent 不立即删除旧对话；清理跟着记忆审阅的周期走，另设保留上限以免占空间。
- **小改动默认先问用户**：建议后续任务的小改动由用户在该 agent 的选项里选「直接做完 / 先问我 / 不提」，默认先问我（进待筛选并标明）；通用回顾说明不写任何一档。
- **建议后续任务不设条数上限**：每条各自过「值得用户花时间读」的门槛，由 agent 判断，探索性的想法也提；堆积靠运行条件控制，不靠截断。
- **视频 agent 不写 `media.md`**：素材怎么生成、重新生成由 agent 每次读项目脚本自己判断；记忆里只放风格和偏好。
- **换分拣方式的门槛**：新方式错删不多于原来，且错留少三分之一以上才替换。

## Memory

- An agent edits its own memory directly, following prose rules; no command flag or opaque key writes it.
- A user's answer or revision on a spec agent's section goes into that agent's memory right away.
- A finished card is archived in git; a rejected card is deleted, since `rejected.md` keeps the why. No flow reads the archive.
- **规划记忆按模块分文件夹**：某模块的条目写进 `planner/<module>/` 下各自的文件，根目录只放跨模块的；不在同一份文件里用 `## <module>` 分组，那样文件太臃肿。
- **拒绝不起会话**：只从其他卡的 `blocked_by`/`related` 移除它，正文里提到它的句子留给那张卡的细化处理。

## The goal and setup

- The goal is optional and free-form: the agent checks only that text is there and never nags about what the user wrote.
- The setup questions card follows the user's language from the moment it shows, English only when none is set.

## Planning and refining

- One session drives a card the whole way without pausing, ending `ready` or holding only questions a human must answer.
- Creation distils the request into a self-contained card; refinement starts fresh and tests it alone. Lost context is a creation defect.
- A card is refined when a run creates it, never because a run edited it.
- Turning the gate on applies only to cards that reach `ready` afterwards.
- The coding workflow is judged on cost and time alone, never plan quality: planning takes one session and coding as few as possible, and trimming sessions trims their prompts too.
- Coding has no review stage: what a build missed becomes cards the post-archive follow-up suggests.
- **Material pasted to make cards from**: an article, research or feedback gets no board flow or instruction; the agent runtime answers it as it would any request.

## Implementation runs

- Every agent's runs reach the network and no shell is fenced to the project folder; the fence stays available in Extra arguments.
- A project that is not a git repo runs on every agent; the board passes what each needs instead of telling the user to `git init`.
- A connector may ship before any card ran on it, with the docs saying so; the first real card's surprises become a new card.
- A rebase is never re-reviewed: a conflict gets one session to resolve it and no review after.
- A landing conflict is retried forever on the run-retry curve (capped at two minutes) and never handed back.
- A delivery that ended abnormally is carried on by hand, never restarted for you; it may finish without rebuilding only on evidence its change is already on the target.
- Run retry ships only on harnesses whose failure signals are proven, and gives up after 3 attempts or 15 minutes.
- 构建在独立工作树里、不含主目录未提交改动时，在启动处说明；主目录干净时不提。
- 看板的流程与语言规则优先于项目的 `AGENTS.md` / `CLAUDE.md`，项目配置只在不冲突时生效。

## Recurring and background work

- All repeating work, built-in or the user's, is a workflow's scheduled agent run on a cadence the user sets (`30m`, `1d at 09:30`), under one guide for unattended runs; there are no recurring cards.
- A scheduled agent has no priority and no open questions: what it can't settle, and what it finds broken, goes to triage.
- A scheduled agent never ships output that needs review (e.g. a blog post) itself; it writes that workflow's card, which goes through planning and acceptance.
- Each workflow may have its own triage automation and competitor analysis; this board's competitor analysis compares product features only, so it belongs to Coding.
- An agent splits a run by starting child runs through an `akb` command, never a per-agent key like `per: module` nor the harness's own subagents: not every runtime has them, and child runs' cost, logs and status must show on the board.
- Migrating recurring cards shows no notice in the UI and adds no note to the migrated rules; the upgrade's command output lists what moved.
- Exceptions: memory pruning is an always-on agent whose cadence the user sets; the daily chat-memory review is always on, has no cadence, and skips days with no conversation.
- A scheduled agent declares at most `reads` (the new work it waits for); the board derives the rest — no `writes`, no user-presence signal, backpressure is its own last batch still unhandled, and nothing spells out "time" since `hook: schedule` already says so.
- A scheduled agent holds only the repeating batch; a one-off change to how it works is an ordinary card.
- Turning one agent on never flips another's switch; a page may warn and leaves both as set.
- The board's own background agents have an on/off switch; an agent inside a workflow has none — its stage assignment decides — except a scheduled one, whose cadence menu ends in Disable.

## Releases

- A version ships when the user says so; closing clears the release from cards still open, and they are never moved in afterwards.
- Setting a release the list doesn't have is an error, so a typo can't invent a version.
- Filling a release only adds cards, so it can be re-run; taking a card out is the user's move.
- A bug no shipped version carries gets no patch release; the fix only lands on main.

## The command

- One command owns every board and agent action; every surface drives runs through it.
- It is a Node program installed and updated by one npm script — no binary, shell script, `curl | sh` or clone. Install never asks which agents you use, and a board install does not install the skill.
- `akb` alone opens the app when the app installed it; without `akb` the board spells its command as `node <path>/ai4kanban.mjs`.
- No backward compatibility: a removed option fails as unknown, a retired `AGENT.md` key is rejected at once with its replacement line (no deprecation window, no rewriting user files), `akb update` deletes retired board files, and a changed agent output shape means old cards are re-planned.

## Storage

- Memory, `metrics.csv` and `next-id` stay local markdown on every backend; only cards move, one backend per project.
- Machine-local state lives under `~/.ai4kanban/`, keyed by project path, so moving a project starts its records over; only user configuration stays in `docs/kanban/`.
- GitHub Projects backend is wanted but parked; Notion gets a card when a user asks.

## Triage

- The board reaches one user-configured endpoint with a fixed format, endpoint and token as board files, so any provider works.
- Sources are optional and independent, each with its own identity, settings and results, sharing one Triage lifecycle and dedup. dist0's cost sits inside the Cloud subscription.
- A dismissal only blocks the automatic pull; adding by hand always goes through. Dismissed items are kept with their reason.
- **A change to an open card is not a triage item**: the agent that finds it — build, planning, or the post-archive review — revises that card in the background; triage and auto-sort never handle it.
- **Follow-ups queue, the exit judges**: work found during build or planning goes to triage, never straight to a card; the evaluation runs once, when an item leaves triage (Make card, release planning). A card the user asks for directly is created without it.

## Agents and runtimes

- A runtime fully defines what a run runs as, with no per-harness inheritance, so two agents on one harness can use two gateways.
- **Global default** is the first runtime row: not renamable or deletable, used by every agent naming none. Deleting a runtime moves its agents there.
- A runtime's id keys everything and its name nothing, so renames are lossless; its shape travels in git, its key does not.
- Harness capability is declared from what the installed runtime does; context window trusts the harness's number, then models.dev.
- Agent ids match display names and are scoped narrowly enough to leave room for siblings (`software-planner`, not `planner`).
- Splitting a flow onto its own agent copies the old agent's rule and runtime once, so behaviour is unchanged after upgrade.
- 移除内置 agent 时，已存工作流的指派自动改掉，配置页一句话说明谁接手。
- An agent's own setting is a dropdown it declares in its `AGENT.md`, drawn by the generic UI; the core never adds code or `akb` flags for one agent (a flag is the last resort). Two ways of running one agent means two agents.
- **花费只按模型、运行工具和用户统计**：单次运行或单个会话的花费对用户没有意义，不为它做功能；每次运行记的必须是它自己的花费，否则这些总数会重复计算。

## Workflows and spec agents

- A built-in agent is an ordinary `AGENT.md` loaded by workflow configuration; adding an agent is writing a prompt, never command code keyed by workflow id.
- Built-in and custom agents share one structure: scripts, references and validators live with the agent and ship with it; the core hard-codes no agent's checks.
- Each card runs one configurable plan → execute flow; spec agents are post-plan hooks, not stages; no agent runs after execute — checking finished work belongs to scheduled agents (such as QA) that read archived cards. Workflows only switch their agents on or off; helpers run only on request. Built-in flows can be configured or copied, not renamed or deleted.
- An agent that writes text or files hands it over as final; the user edits the section to disagree. Copywriting alone asks, and has no house style.
- The card is the brief: executors get its requirements as frozen at delivery start, no separate handoff. The executor is never the planner; an external tool or person is an execute-stage agent with an "external" runtime that records only returned paths.
- An agent is harness-agnostic: its rules set the output standard and name no harness's tools or specific browser tool.
- 内容类工作流（视频、PPT）各配专用的规划与制作代理，不复用 `software-planner` 与 `builder`。
- 演示文稿流程同视频：只有规划，Storyboard 逐页预览即成品，批准后直接归档。
- 产品视频工作流只规定叙事与文案确认、成片检查和经验沉淀；制作方式由执行代理自定。视频不进 git，源文件与成片一起放素材目录。
- 旁白只让用户选音色，不选模型；托管音色经 AI4Kanban Cloud 提供，无需各家 API key。
- 自建工作流是否开分支由用户在工作流设置里选，开启后不开分支、不提交。
- 项目内的运镜配方反馈只留在该项目的看板记忆，不改写随命令分发的配方。
- 构图与动画选用索引随 akb 发布给脚本作者，不放官网；维护者用的盘点清单留在仓库。
- `scriptwriter` owns the storyboard and motion references within its first round, with no separate storyboard agent or round; demo rehearsal belongs to the `demo-rehearser` helper. Recipes are named for what they do, never "demo".
- 审批轮次越少越好（每轮都冷启动新会话）；每轮提问写明第几轮、批准后发生什么。
- 产品视频成片做好后不再提问（不问是否定稿）；不满意由用户在卡片对话里提。

## Mockups

- A card points at a mockup with a `<Mockup>` tag on its own line; a markdown link is never drawn as one.
- Mockups are gitignored, so what a layout settled must be in the card's words.
- 只产出渲染页面，不做字符草图，也不另建字符草图 agent，等真有人要再说。
- The Resolve dialog does not show mockups; options name the labels and the user opens the card page.
- One design system per app, picked from the card's module.
- 手机设计稿的外框负责 iOS 真机布局（状态栏、灵动岛、Home 条、安全区），规划和 ui-designer 不用管这些细节。

## Chat

- The chat box offers **Discuss** alone; **Plan tasks** and **Start now** sit on the plan it writes, so nothing is built without talking first.
- Only an agent that can take a second message into an open session can hold a chat; never resend the whole exchange.
- A board holds many discussions; app and terminal are the same conversation, pinned to one runtime.
- Each discussion owns one plan and cannot modify another's. Written plans move to the plans archive and every card names that path; plans change only through ai4kanban.
- A discussion transcript never enters git; without the local record the plan alone governs.
- **Plan tasks** 和 **Start now** 把讨论原话连同方案交给后续流程；方案是契约，原话补充意图。
- 创建未完成的卡只放行直接丢弃，不放行带否决记忆的普通拒绝。

## Card format

- The human half stands alone for review since the agent half is folded; a spec agent's section joins it only when the user must pick from it.

## Writing the product

- 引入外部开源资料：许可允许就署名后改写，只取通用部分，不整段照搬。
