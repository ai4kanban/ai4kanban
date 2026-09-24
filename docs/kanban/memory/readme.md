# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

- prompt-writer edits a prompt only when its agent lacks a needed instruction, in the
  prompt of the task that needs it and within the flows the card names; app-controlled
  mechanics never become agent duties.
- The scriptwriter writes its section as two subsections, the script then the demo.
- Screen recordings from `record.mjs` draw a standard macOS arrow pointer whose tip, the
  real click and the click ring all land on the same point.
- The scriptwriter's demo guide is product-neutral: an isolated environment is optional, shot
  states may be staged with the user's permission, and each shot is rehearsed on its own
  instead of rerunning the whole workflow.
- The scriptwriter rehearses the demo in the product before round 1 and hands in a
  reproducible `demo.md` with a few rehearsal screenshots; round 1 now approves the script and
  demo, and the assets agent records from that procedure.
- The video editor cuts from the storyboard JSON wherever the card links it, including the
  assets agent's derived storyboard; with no JSON it stops and asks instead of reading the
  Markdown script, and retiming updates only the JSON.
- A video card's screen recordings come from the assets agent's own recorder, saved with
  `akb raw agent-file hyperframes-assets record.mjs`: a task writes only its environment and,
  per shot, how to reset, what the starting state must be, and the actions. It records a batch
  or one named shot, skips what is already recorded and unchanged, retakes on request, and
  checks size, length and the rate it really sampled at before replacing a file.
- A video retake restores and checks the shot's starting state before every take, so real actions such as sending a message are recorded again from the same screen. Storyboard JSON is checked by its owner agent's `scripts/validate-storyboard.mjs` (scriptwriter for videos, deck-planner for slides), saved with `akb raw agent-file <agent> scripts/validate-storyboard.mjs`; `akb raw validate` no longer checks its contents.
- A video script's round 1 is Markdown shots in the scriptwriter's section — order, what each
  shot shows and its exact lines, with no storyboard JSON, frames or per-shot times.
  `hyperframes-assets` derives the storyboard JSON from that approved content, settles the
  capture and production details itself, and sets shot times from what it measured; round 2
  reviews those previews. Changing approved content reopens round 1.
- Pick composition and animation references for this repo's videos by category: the local `composition-selector` skill (`.agents/skills/composition-selector/`), five pilot entries.
- A Demo video card's asset section shows one playable preview per shot plus only what needs
  you; the full media record lives in the asset folder's `media.md`: `web/content/docs/agents.mdx`.
- The daily loop — add, refine, resolve, review, finish, reject, what rejection records and
  what **Just discard** skips, skipping a single open question, and what a build leaves on
  `verify:`: `web/content/docs/daily-loop.mdx`.
- How the board is laid out — the card's two halves around `<!-- agent -->`, group tasks,
  per-agent rule files, mockups, and the board's language: `akb guide board`.
- Refining a card, planning a screen, turning a source into cards, naming what to build next,
  and splitting or renaming a module: `akb guide qa-loop`, `akb guide extract-ideas`,
  `akb guide next-card`, `akb guide module-map`.
- Every board move and every run is an `akb` command that works on any board, answers
  `--json`, and prints its flow with `--print` instead of starting anything; a run outlives
  the command that started it: `cli/README.md`, `web/content/docs/runs.mdx`.
- One repository can hold several boards: `akb install --board <dir>`, `--board` or
  `AI4KANBAN_BOARD` on every command: `cli/README.md`.
- `akb chat` talks about the board or one card, keeps many discussions and pins a runtime per
  conversation: `web/content/docs/chat.mdx`.
- `akb triage fetch | add | run | check` is the one name for what is waiting to be sorted:
  `web/content/docs/triage.mdx`.
- Setup in one guide, and an optional free-form goal no flow stops for: `akb guide setup`,
  `web/content/docs/what-makes-a-good-goal.mdx`.
- Plan a version, fill it against its goal, close or drop it, and get a changelog on close:
  `web/content/docs/releases.mdx`.
- One Implement carries a card from build to landed and archived, reviewing its own work and
  holding at landing on open questions or diff approval; review can be switched off per board
  and per build, and a failed delivery is resumed rather than rebuilt: `akb guide implement`,
  `akb guide review`, `web/content/docs/daily-loop.mdx`.
- **Build now** builds a sentence or a handed-over plan with no card of its own, writing its
  card as it starts: `akb guide implement`.
- Every card runs through one workflow — `plan → execute → review`. Coding is the one
  built-in; a board adds its own, and a built-in can be copied but not renamed or deleted.
  A review stage is a list of reviewers with no lead, and a workflow with none delivers
  unreviewed: `web/content/docs/agents.mdx`.
- 只有编码工作流才开分支和 worktree：其他工作流直接在项目目录里运行、不提交也不合入，多张卡可同时跑；
  自建工作流在名称旁 `⋯` 的「高级设置」里用「使用独立 Git 工作区」切换：`web/content/docs/daily-loop.mdx`。
- 工作流的复制、重命名、删除都在名称旁的 `⋯` 里；删除前按钮直接写明要删的工作流，仍有卡片在用时只说明原因。
- An agent is an ordinary `AGENT.md`: its `description` is what the panes show, `akb.stage`
  says which stage it can take, `akb.output: human` puts its section above `<!-- agent -->`,
  and `lead: true` is what lets it lead a stage rather than help. `akb guide write-agent`
  covers writing one: `web/content/docs/agents.mdx`.
- A spec agent's memory is its own `AGENT.md`'s business: every file in
  `docs/kanban/memory/agents/<agent>/` is handed to each of its runs, and the memory panel
  lists only the agents that have written one: `web/content/docs/agents.mdx`. Files split
  into the folder named after an entry file (`feedback/<topic>.md`) are listed under it in the
  panel, open as their own pages, and the entry file's index links to them; runs still get
  only the top-level files.
- A memory file belongs to whoever writes it: `docs/kanban/memory/` holds the board's own
  record and goal, and everything a run learned is an agent's, under `memory/agents/<agent>/`.
  Memory keeps only notes that change a later planning call; asking not to record suppresses
  the write while the board action still finishes: "Who owns a memory file" in
  `akb guide board`.
- Pruning the memory and reviewing what conversations settled are agents, not cards: pruning
  is opt-in with a cadence, the daily chat-memory review is on by default:
  `web/content/docs/agents.mdx`.
- Settling cards that have sat too long is the Sweeper agent, on a cadence of its own and off
  by default: `web/content/docs/agents.mdx`.
- Triage sorting is an optional agent, off by default and asking once before it goes on:
  `web/content/docs/agents.mdx`, `web/content/docs/triage.mdx`.
- A discussion judges the idea before it plans one: it separates the outcome from the means,
  says whether the thing is worth doing, and may disagree, advise a pause, or ask for evidence
  first. Sending always starts a discussion, and **Start planning** or **Build now** under its
  plan is where work begins.
- 同一讨论可以同时有多份方案：「开始规划」把它们一次交给同一次规划，没有被 `## Source` 引用的方案退回
  讨论，可再次提交；`akb raw plan drop --path <plan>` 撤回不想交接的方案。
- Mentioning work a card does not cover, while talking on that card, opens a new card for it;
  the conversation says so and stays on the card you were reading.
- 卡片对话在修改意图明确时当轮改卡（包括问句形式的要求和对上一轮建议的同意），不再等二次确认；纯粹
  询问或要求先讨论时只回答，结果不同的想法另建新卡。
- Planning questions are written for someone who hasn't seen the board — no card ids, agent
  names or board terms — and every planning agent writes its part on the card before work
  starts.
- 创建失败、停止或中断的卡片可直接丢弃；继续原创建运行会保留丢弃决定，不重建已丢弃的卡片。
- Updating an installed board is a newer command then `akb update`, which repairs the board,
  moves an older board's memory over and removes what a release retired: `akb guide update`.
- The reading language belongs to the machine, and what the board writes follows it: "The
  board's language" in `akb guide board`.
- 新增内置工作流「演示视频」（`hyperframes-video`）：脚本作者一份写全画面、运动、字幕和逐镜台词，
  「HyperFrames 素材」按已批准的脚本备齐素材并产出可播放的逐镜预览，HyperFrames 剪辑在本地渲染出
  mp4，`video-reviewer` 对照脚本检查成片。脚本与素材在卡片上各占一个小节、按镜头编号对应，两轮各等
  你批准：`web/content/docs/agents.mdx`。
- 演示视频中展示操作的镜头会配一段真实产品的录屏；录不了时，素材状态写明需要你录制的起始状态、操作、
  预期结果、画幅和时长：`web/content/docs/agents.mdx`。
- 内置 `copywriting` agent 不自带写作规则：语气、用词和长短只取自项目已发布的文案和 `writing.md`，
  交付成稿在前——按页面与小节只给改动的部分，多语言分组，后附最多三条影响判断的说明。
- A project agent, `prompt-writer`, answers with the final prompt text of any skill, agent
  prompt or akb guide change and waits for your confirmation.
- Codex 默认以 `--dangerously-bypass-approvals-and-sandbox` 运行，不再因审批、沙箱、启动更新检查
  或「切换低价模型」提示中断，不是 git 仓库的项目也能选用；自己写了同名配置的命令保持不变。
- 视频卡第一轮由 scriptwriter 交付 `storyboard.json` 结构化分镜，示意图仅在构图需要时附；`akb raw validate <id> --json` 逐项指出漏写的旁白、动作、时段或图片问题，不合格的分镜不能请求或接受批准。第二轮逐镜预览经你确认后卡片才能进入 ready 或开始成片，重新发起任一轮确认即撤销，Decider 不代答这两轮确认：`web/content/docs/agents.mdx`。
- 新增内置工作流「演示文稿」（`slide-deck`）：演示文稿策划先交付受众、目标、事实台账、版式方案和逐页文案，批准后再给每页真实预览图，两轮各等你批准；演示文稿制作据此生成可编辑的 `.pptx`，逐页核对预览后在卡片上提供下载：`web/content/docs/agents.mdx`。
- An agent declares no settings of its own: one agent is one way of working, and two ways is two agents. `ui-designer` always draws a rendered screen — the ASCII drawing is retired, and a board that saved it is told so in the run's log: `akb guide write-agent`.
- Standard planning QA now checks out the facts a plan turns on instead of handing them to you: it searches for authoritative sources, records the evidence it found, revises the plan when a premise turns out wrong, and stays open — naming the missing evidence — when it cannot settle one. Lightweight planning escalates to standard rather than checking anything itself: `akb guide validate-assumption`.

## local-ui

`kanban-ui/README.md` is this module's doc; a line naming no other doc is covered there.

- 通知中心每个标签先显示 30 条，列表底部“加载更多”继续查看更早的通知；铃铛数字和“N 条新通知”仍计入全部通知，历史再多也不会拖慢通知中心。
- 配置和新建任务的工作流下拉框里，悬停或键盘聚焦内置工作流可看它的用途说明，触屏点行旁的信息按钮查看；`akb workflow list` 同样列出内置工作流的说明。
- 讨论里点 Plan tasks 时，由原讨论的 agent 会话接着写任务卡，讨论中未写进计划的细节也会带进卡片；创建过程仍在运行列表里，进行中该讨论暂不能发消息。
- 配置里的工作流/agent 选择器、“…”菜单、定时节奏和模型建议与其他下拉框同一种弹层：悬停和方向键高亮，Esc 或点空白处只关闭弹层，焦点回到按钮。
- 卡片页上 agent 段落里的每个三级标题都能单独折叠：打开段落后各小节默认展开，可逐节收起；搜索或卡片更新时只展开相关小节。
- 配置页的云端和通知设置连不上 Cloud 时会自己重试：页面上说明正在自动重试、本地看板不受影响，网络回来后无需重开设置就回到已登录状态。
- A card's `<Storyboard>` also shows a slide deck: numbered pages with a preview, on-slide text, speaker notes and layout, and a "No preview" placeholder with Reload; an `<Asset>` pointing at a `.pptx` is a download button.
- The desktop app from `ai4kanban.dev/download` reopens the last repo, finds your coding
  agent, installs `akb` itself and updates in the background; the launcher opens, drops and
  creates projects, one at a time: `desktop/README.md`.
- The same board in a browser with `npx ai4kanban-ui`, deprecated the day the app shipped:
  `akb guide local-ui`.
- Setting a board up in the app is a guided first run that finds the coding agent instead of
  asking for it, and **Finish setup** runs the rest as one watchable, resumable run.
- The board, a **Queue** splitting the same cards into ready and not ready, finding a card,
  the goal behind the header star, a group root's build-order map, **Insights**, read-only
  **Memory** by owner, and the **Archive** under it.
- Opened on a phone the board becomes a bottom tab bar with the columns swiped one at a time
  and Resolve, Create task and Implement as full pages.
- Implement starts a delivery against the card exactly as it was approved — build, review,
  correct, land, archive — each in its own worktree and branch, with manual commit mode,
  **Approve diffs before landing**, **Discard** and **Resume**.
- 打开卡片时立即显示卡片框架和已知标题；读取超过约 300 ms 才显示骨架线，失败显示「卡片读取失败。」和
  「重试」。设计稿滚动到附近时才绘制，「代码」视图切换时才加载源码。
- Coming back to a card page with Back or Forward shows the card as it is on disk; a change
  that lands only in the folded agent analysis opens that fold.
- 卡片页人工阅读区里每个 agent 的段落默认收起为一行，点开查看；有待答问题的、打开期间更新过的、以及
  搜索词只出现在其中的段落会自动展开。
- Fenced code in cards, memory pages and chat replies is coloured by its language tag, and a
  ```diff block uses the Diff tab's green and orange.
- 卡片上的 `<Asset>` 指向视频或音频时直接在卡片上播放；`.hf.html` 镜头预览以播放器形式播放画面、
  动效、字幕和音轨，同时只播一镜。点文件名打开的独立页显示视频尺寸与时长。
- A card's `<Mockup src>` and images are read where their tags sit, and one opens at full size.
- Runs opens on a pixel office where every live job is a bot at a desk, with **Completed** for
  the records. 运行日志标题栏只显示这次运行的一个状态（已完成 / 失败 / 已中断 / 已停止），退出码在悬
  停提示里；续接出来的会话在时间线上标注「续接」，无法续接的运行不提供「继续」。手机上运行历史改为列
  表与日志二选一。
- 看板首页不看日志：卡片上的运行标记只打开运行对话框并选中那条运行。
- A run that stopped short on a card nobody has dealt with stays visible until that card is,
  on the bot's desk, in the **Unfinished** count and as a mark in the card's column.
- 讨论面板打开时点别处，一次点击就关闭面板并完成原本的操作；关闭只是隐藏，对话、未发送的文字和图片、
  进行中的回复都保留，草稿按讨论分开保存。
- 讨论界面的工作流菜单按上下空间自动选择展开方向并始终留在窗口内，键盘可移动和选择，滚动或改尺寸时
  自动关闭。
- 卡片页和看板上的「讨论中」会在对话结束后自动消失，按钮随之解冻。
- Create task has no mode switch: sending always starts a discussion, and **Plan tasks**
  or **Start now** under its plan is where work begins, with a **Workflow** picker beside them.
  Pictures pasted or dragged in go with the message you send.
- 「规划任务」或「立即开始」启动后，讨论会一直留在侧栏之外，规划中途被自动续跑也不会让它重新出现。
- Edit on a card opens that card's chat with the caret in the box and the first line typed for
  you; pressing it again folds the rail away.
- A conversation you have already spoken in stays on the agent that opened it; changing the
  discussion helper's runtime only decides where a new conversation starts.
- 待筛选改成可清空的队列：聚焦条目时出现「生成卡片」和「忽略」（必须填理由），条目按来源或来源卡片分
  组，页头有「全部分拣」，「历史」列出近 30 天成卡与忽略的条目并可「恢复」。详情在右侧栏打开，可拖宽，
  列表按自身宽度排成三、二或一列：`web/content/docs/triage.mdx`。
- 配置里的「定制」只剩「工作流」一个入口：选中工作流后在 规划 / 执行 / 检查 之间切换，就地打开每个
  agent 的说明、规则、运行设置和 `AGENT.md`，并可「新建一个」直接指派到当前阶段。每个有 `AGENT.md`
  的 agent 多了「复制一份」——副本带走说明、附带文件、规则和设置，记忆从空开始，这是改写内置 agent
  说明的唯一途径。看板自己那份 agent 名单在「设置 → 看板」：`web/content/docs/agents.mdx`。
- 工作流设置的阶段配置下方有默认收起的「高级设置」，里面只有「使用独立 Git 工作区」开关。
- **Runtimes** is one list: **Global default** first and undeletable, then every runtime you
  named, each with **Test connection** and a delete that puts its agents back on the default:
  `web/content/docs/runs.mdx`, `web/content/docs/connectors.mdx`.
- Codex 和 Claude Code 默认使用订阅，沿用 CLI 已有登录；想按量付费在提供方里选一次 API 或兼容接口，
  选择会保留。
- 自己新建的 agent 页上，文件路径与正文框之间可以就地展开《每个键怎么写》，不跳浏览器。
- 配置里的合并标签拆成「云端」和「通知」两个标签；未登录时通知标签只有 GitHub 登录入口和隐私政策、
  服务条款链接。
- **Prune memory** and **Tidy stalled cards** each carry **Run now** and a cadence chip, and
  the sweeper's page links the latest report card by card.
- **Language** — English or 中文 — settles the machine rather than the board and takes effect
  with no reload.
- A bell in the top row carries every board Cloud is on for, with **To do** and **Landed**
  tabs; it fills without Cloud too, for a run of this board's own that stopped short. The
  right side holds one rail at a time, so the bell and chat fold each other.
- 内置 agent 全部有专属像素角色；自定义 agent 仍是字母牌。配方见 `kanban-ui/agent-art.md`。
- 像素房间里浮着的面板画成游戏对话框：直角、粗墨线、硬阴影、标题栏反色、贴边推出；只在办公室内用。
- A project holding more than one board draws each board's folder beside the folder chip and
  opens another in a new window.
- 卡片中的 `<Storyboard>` 显示静态分镜：顶部可横向滚动的镜头时间线，每镜左图右文（窄屏上下），无图镜头文字占满整行且时间线不显示缩略图；分镜有误时显示“分镜需要修正”，可复制诊断并重新加载。
- 分镜画面和卡片、聊天、日志、记忆等 Markdown 中的图片都可点击（或 Tab 后按 Enter）放大查看，按原比例适应窗口且不超过原图；Esc、✕、点击图片外区域或滑动返回即可关闭，回到原来的阅读位置。

- 启动、继续、取消、丢弃、配置校验、Cloud 与对话的失败提示跟随界面语言；路径、命令和第三方原始诊断原样列在下面，未知错误显示该操作的本地化兜底句。
- A card's **Edit** button is now **Revise** (修订).
- In **Configuration → Workflows**, a built-in helper's page has one **Extra requirements** box for that workflow stage (e.g. "Demo video · Plan"), growing with its text; the Output picker and the board-wide instructions box are gone from it, and their saved values still apply. An agent you added has no such box — its own `AGENT.md`, on the same page, is where everything it is told goes.
- 改过名的 Agent（如 HyperFrames 素材）切回「全局默认」或换运行时后立即生效，旧名下的绑定不再覆盖选择。
- agent 页面不再有由 agent 自己声明的设置行；**原型样式**已经没有了，界面设计师只画渲染页面，页面上留下的是运行时和这个环节的额外要求。
- 工作流设置里，自建的辅助 Agent / 评审员排在内置之后，上方有一条“我的”分隔线；详情面板不再显示“Yours”标记和“只有这个工作流在用它”等使用状态文字。

## site

- The landing page and the comparison pages read in Chinese, Spanish, Japanese and French at
  `/zh`, `/es`, `/ja`, `/fr`; English keeps its old URLs and nothing redirects by browser
  language. Recipes and the Markdown mirrors stay English.
- 对外定位定稿为「你掌舵，AI 带队」：AI 项目经理替你管理 Agent 团队，只汇报需要知道的事。中英
  README、五种语言首页、文档首页、下载页、`llms.txt`、插件描述与 CLI README 都已换成这一定位；
  文案与表达边界见仓库根目录 `positioning.md`。
- The landing page starts you on the board app: the download is the top button and the only
  way in it offers. The plain-Markdown mirror at `/index.md` and the file index at
  `/llms.txt` say the same as the page they mirror.
- The home page's agent strip names every agent the board runs, and its last loop step draws
  Configuration → Board the way the app does, separating the one automatic job that ships on
  from the ones that wait to be switched on.
- `/vs-task-master`, `/vs-linear`, `/vs-vibe-kanban` and `/vs-hermes-kanban` each say where
  the other tool is ahead and who should pick which.
- `/recipes/competitor-analysis-loop` and `/recipes/daily-kanban-maintenance`:
  `web/public/recipes/`.
- [/cloud](https://ai4kanban.dev/cloud) says what AI4Kanban Cloud is, what the relay carries
  and what stays on the machine.
- [/privacy](https://ai4kanban.dev/privacy) and [/terms](https://ai4kanban.dev/terms) are
  English-only, linked from the footer in all five languages, naming NULLREACH LTD as the
  operator and `support@ai4kanban.dev` for support and data requests.
- [/training](https://ai4kanban.dev/training) sells one-to-one project guidance and takes the
  booking on the page — $99 for one session, $349 a month for four, the visitor's own current
  week hour by hour. English and Chinese only.
- `/contact` (all five languages, linked from the footer) is one form for support and for
  custom agents at $15 per agent, answered by email.
- 文档里的界面设计师只画渲染页面，不再提**原型样式**这个可选项：`web/content/docs/agents.mdx`。

## docs

- Both READMEs are app-first: the quick start opens on downloading the board app, `akb` comes
  second, and the coding agent skill is an optional section further down: `README.md`,
  `README-zh.md`. No page says installing a board installs the skill.
- A page each for the daily loop, chat, releases, runs, agents, connectors, triage and local
  and cloud boards: `web/content/docs/`. The commands themselves are `akb --help`, never
  copied onto the site.
- Which coding agents the board runs, what each needs installed and signs in with, what a run
  may touch, and every agent's own settings: `web/content/docs/connectors.mdx`.
- 官网 Agents 页的「Add one of your own」只指路：装好 skill 与 `akb` CLI，再让项目里的 coding
  agent 读 `akb guide write-agent` 按你的描述创建：`web/content/docs/agents.mdx`。

## marketing

- Marketing work is planned and written on the ordinary board, as an ordinary card on the
  default workflow: its delivery is the file in the repo, and review reads that file.
- **[awesome-agent-kanban](https://github.com/neverchanje/awesome-agent-kanban)** is a public
  directory of tools that put agents to work on tasks, sorted by what the reader wants to hand
  over. English only, CC0, with AI4Kanban listed under the same criteria as everything else.
- 本项目看板新增「Email」工作流：`email-planner` 写好通知、欢迎邮件或 newsletter 并在卡片里显示
  HTML 预览，批准后 `email-builder` 把预览发到评审邮箱：`scripts/email/README.md`。
- 演示视频有一套共用的免费素材库（3 段配乐、10 条界面音效、3 张纸张背景，均为 CC0），放在
  `https://cdn.ai4kanban.dev/video/`；清单、来源和许可见 `assets/video/README.md`。

## cloud

- One GitHub sign-in makes a machine a Cloud account, from Configuration → Notifications;
  every project and terminal on that machine then acts as that account. An account we have
  not admitted is refused with **Request an invite**, answered by hand: `cloud/README.md`.
- Turn notifications on for a board and pick one open release: a card that reaches `ready` or
  raises a question only you can answer becomes a durable Cloud event carrying enough of the
  card to review it, deleted 30 days after it ends. One event takes exactly one action.
- **Slack** posts one message per card with every control on it, so a control can be pressed
  from anywhere and the board's machine runs it when next reachable. **Lark** sits beside it:
  `cloud/README.md`.
- A notification that fails to reach Cloud is retried in seconds, backing off to a five-minute
  cap and giving up after about four hours with the board said to be out of step; a retry
  about a card somebody has since dealt with is dropped.
- What a workspace holds, what stays on the machine, and what moving either way costs:
  `web/content/docs/local-and-cloud-boards.mdx`. Nothing about the code goes with it.
- A workspace has a URL its members open, signed in independently of the machine, reading and
  never writing; no Cloud board is on the open web.
- One writer holds a card, or the board, at a time on a half-hour lease; a second machine
  writing a card the first has moved past is refused as a conflict naming the version the
  board holds now.
- Cloud reports what the board's machine resolves each runtime to — names only, never a key,
  argument string or path.
- Cloud takes the bookings behind [/training](https://ai4kanban.dev/training).
- How many accounts the free tier and the day's write budget carry: `cloud/README.md`,
  "Limits the preview lives inside".

## telemetry

- Anonymous usage reporting is on by default, disclosed once per machine, and read or changed
  with `akb telemetry status|on|off`: `web/content/docs/local-and-cloud-boards.mdx`.
- A public read-only route answers the cumulative install count, so the README can carry an
  install badge.
- Feedback never requires a task, and sharing the conversation behind it is one switch under
  the box, off on every new conversation.
