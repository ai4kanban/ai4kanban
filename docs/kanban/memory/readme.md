# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- Install and quick start: `README.md`.
- The daily loop — propose, add, refine, resolve, review, finish, reject — including what
  rejection records and what **Just discard** (`--discard`) skips:
  `web/content/docs/daily-loop.mdx`.
- Beside it, one page each: `chat.mdx`, `releases.mdx`, `runs.mdx`, `agents.mdx`,
  `connectors.mdx`, `triage.mdx`, `local-and-cloud-boards.mdx`. The commands themselves are
  `akb --help`, never copied onto the site.
- Memory keeps only notes that change a later planning call: a duplicate rejection, a routine
  status change or a fact already written down leaves none, and asking not to record
  suppresses the write while the board action still finishes.
- Triage sorting is an optional agent, off by default and asking once before it goes on:
  `web/content/docs/agents.mdx`, `web/content/docs/triage.mdx`.
- Pictures pasted into Create task go with the message you send. Clicking one opens it whole,
  and its ✕ takes it out without opening it.
- Submitting a batch of draft comments can carry one optional note about the whole draft; a
  comment on a passage wins where the two disagree.
- Edit on a card opens that card's chat with the caret in the box and the first line — "修改
  当前卡片：" / "Change this card:" — typed for you. Pressing it again folds the rail away, and
  a box that already has something in it is left exactly as it is.
- A notification that fails to reach Cloud is retried in seconds rather than a minute, backing
  off to a five-minute cap and giving up after about four hours with the board said to be out
  of step. A retry about a card somebody has since dealt with is dropped.
- A discussion now judges the idea before it plans one: it separates the outcome you want from
  the means you named, says whether the thing is worth doing at all, and may disagree, advise a
  pause, or ask for evidence first. A turn that only answers your question is a finished turn.
- A conversation you have already spoken in stays on the agent that opened it. Changing the
  discussion helper's runtime now only decides where a new conversation starts, and the old
  ones are asked to be cleared only once the board has no runtime on their own agent left.
- Mentioning a piece of work a card does not cover, while talking on that card, now opens a
  new card for it: the board takes your own words and runs the full add-task flow on its own,
  and the conversation says so and stays on the card you were reading.
- The lead agents of the Coding workflow the command ships are fixed and shown rather than
  picked, so the name of a built-in always says who runs it.
  Duplicating one, or adding your own, gives you a workflow whose three leads are yours to
  choose; the helpers on a built-in are still yours to add and remove.
- Coming back to a card page with Back or Forward (the browser's, or the app's swipe) now
  shows the card as it is on disk, not as it was when you left; a change that lands only in
  the folded agent analysis opens that fold.
- Fenced code in cards, memory pages and chat replies is coloured by its language tag (common
  languages, GitHub's light colours); a ```diff block shows added and removed lines in the Diff
  tab's green and orange. An untagged block stays plain.
- 卡片页和看板上的「讨论中」会在对话结束后自动消失，卡片页的按钮随之解冻，不必再切换标签页或按返回键刷新。
- Create task has no mode switch any more: sending always starts a discussion, and
  **Start planning** or **Build now** under its plan is where work begins, with a **Workflow**
  picker beside them when the board has more than one. A small, clear ask
  gets a plan ready to build in the first reply. Writing a card straight from a sentence is
  `akb create`.

## site

- The site has a contact page at `/contact` (all five languages, linked from the footer): one form for support and for custom agents at $15 per agent, answered by email.
- 对外定位定稿为「你掌舵，AI 带队」：AI 项目经理替你管理 Agent 团队，只汇报需要知道的事；中英文案与表达边界见仓库根目录 `positioning.md`。
- 中英 README 与五种语言首页（标题、描述、首屏）已换成「你掌舵，AI 带队」定位。
- 文档首页、下载页、`llms.txt`、首页镜像、插件描述与 CLI README 也已换成同一定位；CLI README 精简为包用途、安装与链接；站外文案的建议写在 `positioning.md` 的「Off-site copy」。

## skill

- Codex 默认以 `--dangerously-bypass-approvals-and-sandbox` 运行，后台任务不再因审批或沙箱中断；旧版自动生成的默认命令也随之切换，自己写了 `--sandbox` 的命令保持不变。
- 不是 git 仓库的项目也能选用 Codex：Setup 的 agent 测试和看板运行不再因「Not inside a trusted directory」失败。
- Codex 运行不再弹出启动更新检查和「切换低价模型」提示，无人值守窗格不会因此卡住；自定义命令里写了同名配置的保持原样。
- 演示视频中展示点击、输入、滚动或拖拽的镜头会配一段真实产品的操作录屏；录不了时，素材状态写明需要你录制的起始状态、操作、预期结果、画幅和时长：`web/content/docs/agents.mdx`。
- 演示视频卡片的整份脚本放在人读区一处：简报之后按播放顺序列出 `S1`、`S2`… 镜头，每个镜头带分镜帧、成片预览、时间段、字幕或旁白、声音、转场和素材状态：`web/content/docs/agents.mdx`。
- 卡片对话先回答并给出修改建议，用户确认后才改卡；明说的修改和待定问题的回答仍当轮写入，结果不同的想法另建新卡，改另一张卡时走那张卡的修订并在回复里点名。
- `video-assets` 选出的音视频和 HyperFrames 编辑器渲染的成片都以 `<Asset>` 放在卡片上直接播放，不再只给文件路径：`web/content/docs/agents.mdx`。
- A lead agent whose `AGENT.md` sets `akb.output: human` now writes its section above `<!-- agent -->` on every run it leads; a run that leaves it out or puts it below goes back for a format fix.
- Planning questions are written for someone who hasn't seen the board — no card ids, agent names or board terms — and every planning agent writes its part on the card before work starts instead of leaving it as a build step.
- A specialist can wait for another one's section with `akb.dependencies`, and a new built-in `copywriting` agent writes promotional copy that `ui-designer` waits for until you confirm it: `web/content/docs/agents.mdx`.
- A project agent, `prompt-writer`, shows the full proposed text of any skill, agent prompt or akb guide change on the card and waits for your confirmation.
- The built-in Content creation workflow and its three content agents are gone; Coding is the only built-in workflow, and a card still marked `content` runs on it.
- An agent's `AGENT.md` no longer takes `akb.owns`; its `description` is what the Agents and Workflows panes show, and an old `owns` line is ignored: `web/content/docs/agents.mdx`.
- A workflow's review stage is a list of reviewers with no lead: the board picks the ones a build's diff needs, the built-in `code-reviewer` replaces the Reviewer role, and a workflow with no reviewers delivers a finished build unreviewed: `web/content/docs/agents.mdx`.
- 一个 spec agent 的记忆由它自己的 `AGENT.md` 决定：`docs/kanban/memory/agents/<agent>/` 里的每个文件都会交给它的每次运行，`akb.memory` 键不再需要（旧文件里的会被忽略）；`copywriting` 改记一份 `writing.md`，记忆面板只列出写过文件的 agent：`web/content/docs/agents.mdx`。
- 内置 `copywriting` agent 不再自带写作规则：语气、用词和长短只取自项目已发布的文案和 `writing.md`，它只负责写出最终文案并请你确认。
- 内置 `copywriting` agent 的交付改为成稿在前：按页面与小节只给改动的部分，多语言分组，后附最多三条影响判断的说明。
- 新增内置工作流「演示视频」（`hyperframes-video`）：脚本作者把分镜写进卡片，素材准备备齐素材，视频组装用 HyperFrames 在本地渲染出 mp4，素材和成片放在 `.akb/boards/docs/kanban/assets/<卡片号>/`；自建工作流也可以选用 `kind: lead` 的 agent 当负责人：`web/content/docs/agents.mdx`。
- 待你决定的问题可以在卡片的“待澄清问题”里逐题“跳过”（或 `akb raw update-questions <id> --skip <n>`）：问题保留为带删除线的记录并可“撤销”，只剩已跳过的问题时，等待中的交付自动继续；手动删除问题效果相同：`web/content/docs/daily-loop.mdx`。
- 自建工作流的「负责 Agent」下拉框只列出声明可担任负责人的 agent（`AGENT.md` 的 `akb:` 下写 `lead: true`；新建 agent 默认只当辅助，模板里留有这一行）；内置的 Planner、Builder、脚本作者和视频组装可担任负责人，其余只当辅助；之前已选了未声明 agent 的阶段照常运行，并在该阶段标出提示：`web/content/docs/agents.mdx`。
- 「演示视频」工作流提高了质量要求：脚本写明画幅、视觉方向、代表帧和声音；素材准备逐项核验质量、授权和敏感信息，并记下可复用素材；视频组装负责声音、校正时长、在卡片里放逐镜头预览帧和重渲命令；新增审片 agent `video-reviewer` 在评审阶段对照脚本检查并修复成片：`web/content/docs/agents.mdx`。
- 能担任负责人的 agent 不再能当辅助：「添加辅助」里不再列出，命令会说明原因拒绝；之前已加上的辅助照常运行，直到移除。内置的 Planner 改名为「软件规划师」（`software-planner`），旧的要求文件和工作流里的 `planner` 会自动迁移，规划记忆仍在 `memory/agents/planner/`，记忆面板里显示为「规划」：`web/content/docs/agents.mdx`。
- 「演示视频」规划分两轮，每轮等你批准：先批准脚本，再批准分镜和素材；新增「分镜设计」制作 HyperFrames 分镜，「素材准备」同时生成旁白并在卡片上维护素材索引，「视频组装」改名为「HyperFrames 剪辑」，在已批准的分镜上完成成片：`web/content/docs/agents.mdx`。
- 只有编码工作流才开分支和 worktree：「演示视频」和新建的自建工作流直接在项目目录里运行、不提交也不合入，多张卡可同时跑；卡片记下的成品文件存在并通过评审后自动归档，没记录、文件缺失或改动了看板以外的被跟踪文件时停下说明（不自动还原）。视频工程和渲染脚本放在素材目录的 `project/`。自建工作流在「高级设置」里用「使用独立 Git 工作区」切换（`akb workflow worktree <id> on|off`），升级前建的自建工作流保持原样：`web/content/docs/daily-loop.mdx`。

## marketing

- 本项目看板新增「Email」工作流：`email-planner` 写好通知、欢迎邮件或 newsletter，并在卡片里显示 HTML 预览；批准后 `email-builder` 把预览发到评审邮箱（`scripts/email/README.md`）。
- 演示视频有一套共用的免费素材库（3 段配乐、10 条界面音效、3 张纸张背景，均为 CC0，免署名），放在 `https://cdn.ai4kanban.dev/video/`；清单、来源和许可见 `assets/video/README.md`。

## local-ui

- 打开卡片时立即显示卡片框架和已知标题（侧栏保留，可随时关闭或切到别的卡片）；读取超过约 300 ms 才在标题下显示三条骨架线，读取失败显示「卡片读取失败。」和「重试」。卡片页和归档页不再随页面传送设计稿：`.tsx`/`.html` 设计稿滚动到附近时才单独绘制，「代码」视图切换时才加载源码，加载前保留同尺寸占位。
- 讨论界面的工作流菜单按上下空间自动选择展开方向并始终留在窗口内；列表最多约 8 行、超出可滚动，「管理工作流」固定在底部；打开时当前工作流滚入视野并获得焦点，方向键可移动、回车选择，Esc 或点击外部只关菜单；对话滚动或窗口尺寸变化时菜单自动关闭。
- 待筛选改成可清空的队列：聚焦条目时出现「生成卡片」（启动一次建卡运行并记下成了哪张卡）和「忽略」（必须填理由）；条目按来源或来源卡片分组，页头多了「全部分拣」；「已忽略」换成「历史」，列出近 30 天成卡与忽略的条目，忽略的可「恢复」（也可 `akb triage restore <source-id>`）。页面不再能手动加入条目，手动提需求用「新建任务」。文档：`web/content/docs/triage.mdx`。
- 待筛选的条目详情改在窗口右侧栏打开，和对话、通知一次只开一个，可拖宽；标题下直接有「生成卡片」「忽略」「查看原文」，头部显示来源（含来源卡片 `#id 标题`）和采集时间；Esc 或 ✕ 关闭，打开「新建任务」、切换标签时详情自动收起；列表改为单列行，窄窗口和手机上详情盖在右侧。
- 讨论面板打开时，点侧栏、顶栏、通知栏或手机底部标签里的任何控件，一次点击就关闭面板并完成原本的操作；面板正文里的卡片链接同样会关闭面板。关闭只是隐藏：对话、未发送的文字和图片、进行中的回复都保留，点侧栏里那段讨论即可接着聊；未发送的草稿按讨论分开保存。
- 配置里原来的合并标签拆成「云端」（账号、云端存储）和「通知」（静音这台机器、发到哪里、这个看板）两个标签；未登录时通知标签只有 GitHub 登录入口和隐私政策、服务条款链接。CLI、Cloud 消息和文档里的入口路径随之改为 `配置 → 云端` 或 `配置 → 通知`。
- 内置 agent 全部有专属像素角色：记忆整理、对话记忆回顾、停滞卡片清理、计划纠错、后续建议、Triage 分拣、Copywriting、分镜设计、视频审查与审查负责人不再显示字母牌；自定义 agent 仍是字母牌。配方见 `kanban-ui/agent-art.md`。
- 工作流设置的三个阶段按钮文字后带加号；阶段配置下方有默认收起的「高级设置」，里面只有「使用独立 Git 工作区」开关（内置工作流只读显示），保存失败时就地提示并保留原值。文件型卡片的开发对话框不再有分支选项，只说明制作文件后归档。
- 卡片上的 `<Asset>` 指向视频（mp4、webm、mov）或音频（mp3、wav、m4a）时直接在卡片上播放，可拖动进度；浏览器无法解码的文件显示提示并建议改用 MP4（H.264）、WebM 或 MP3。点文件名打开的独立页显示视频尺寸与时长：`kanban-ui/README.md` 的 "Assets on a card"。
- 卡片页人工阅读区里每个 agent 的段落（`By <name> agent`）默认收起为一行（头像 + 名称），点开查看；待你回答的问题所属的段落、卡片页打开期间内容有更新的段落、以及侧栏搜索词只出现在其中的段落会自动展开。
- Agent 设置页的「运行时」一行不再带说明文字，页面底部静态的「记忆」提示块已移除；运行时选择、指令保存和 agent 记忆本身不变。
- 卡片上的 `.hf.html` 镜头预览（`<Asset>`）以播放器形式播放：画面、动效、字幕和音轨一起播放、暂停、重播、拖动进度和静音；控制栏悬停时显示，手机上轻触显示；同时只播放一镜。视频任务的分镜设计先用已准备素材生成逐镜预览，再并入脚本供审阅。
- The prompt writer answers with the final prompt text only — no diffs, no code, and any
  logic written as plain instructions.
- 同一讨论可以同时有多份方案：新方案不再结束旧方案。「开始规划」在按钮上方列出将包含的方案，一次交给同一次规划；方案面板顶部可切换查看；有多份方案时「直接开做」不可用。规划写出的卡片没有在 `## Source` 引用的方案会退回讨论，讨论重新出现在侧栏，可再次「开始规划」（只提交剩下的）。讨论中的 Agent 可用 `akb raw plan drop --path <plan>` 撤回不想交接的方案。
