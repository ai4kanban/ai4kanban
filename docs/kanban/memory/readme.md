# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

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
  自建工作流在「高级设置」里用「使用独立 Git 工作区」切换：`web/content/docs/daily-loop.mdx`。
- An agent is an ordinary `AGENT.md`: its `description` is what the panes show, `akb.stage`
  says which stage it can take, `akb.output: human` puts its section above `<!-- agent -->`,
  and `lead: true` is what lets it lead a stage rather than help. `akb guide write-agent`
  covers writing one: `web/content/docs/agents.mdx`.
- A spec agent's memory is its own `AGENT.md`'s business: every file in
  `docs/kanban/memory/agents/<agent>/` is handed to each of its runs, and the memory panel
  lists only the agents that have written one: `web/content/docs/agents.mdx`.
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
- 卡片对话先回答并给出修改建议，用户确认后才改卡；明说的修改和待定问题的回答仍当轮写入，结果不同的
  想法另建新卡。
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

## local-ui

`kanban-ui/README.md` is this module's doc; a line naming no other doc is covered there.

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
- Create task has no mode switch: sending always starts a discussion, and **Start planning**
  or **Build now** under its plan is where work begins, with a **Workflow** picker beside them.
  Pictures pasted or dragged in go with the message you send.
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
