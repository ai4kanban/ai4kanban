# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

- Claude Code 的卡片运行在后台任务跑着时不再被沉默上限结束：一直等到后台任务结束、结论写进同一次运行，只在纯等后台时最长等 2 小时（「沉默多久后结束运行」为 0 时不设上限）：`web/content/docs/connectors.mdx`。
- 自动分拣不再问「已经做到了吗」；它建的卡在第一次规划（免规划的卡在开工）时先对照代码，产品已做到或所涉及的东西已不存在的，直接带着依据移进归档，不问你：`web/content/docs/triage.mdx`。
- 提案者写进待筛选的条目，自动分拣不再判「已做到」「否决过」「值不值得」「与未完成卡重复」，只问要不要你和是否免规划，再定卡片的模块、优先级、ROI 和工作流；除非留给你或没有工作流能做，一律建卡，不合适的在看板上否决：`web/content/docs/triage.mdx`。
- 构建和规划中发现的跟进不再直接建卡，改为进待筛选（`akb triage add`），离开待筛选时才判断值不值得做；只需改另一张未完成卡的，改为对那张卡启动修订。「建议后续任务」回顾时发现未完成卡的计划已过时，也直接修订它而不提新条目。你直接提的需求照你说的建卡，不再查重：`web/content/docs/triage.mdx`。
- `akb raw agent-file <agent> AGENT.md` 能打印任何 agent（含内建 agent）的规则文件；改 agent 负责的内容、记 agent 记忆时按它读规则，内建 agent 不再因读不到文件而被跳过。
- `akb card reject <id> <原因>` 和 `--discard` 当场完成，不再起会话；你写下的拒绝原因和忽略原因由同一个每日回顾学习，写进 `rejected.md`，旧的 `dismissed.md` 升级时自动并入。
- 不带参数执行 `akb` 或 `akb raw` 会打印命令列表并以 0 退出，与 `--help` 相同。
- 定时 agent 默认「自动」：`AGENT.md` 可写 `akb.reads`（`archived-cards` | `commits` | `chats` | `dismissals`），有新东西才跑、两轮至少隔 1 小时；它上次送进待筛选的条目没处理完（或建成的卡还没开始做）时不跑，工作流里的还要等没有开发在进行；连续失败间隔翻倍，最多 1 天。手动设过的周期保留，`akb workflow schedule … --cadence auto` 或周期菜单的「自动」回到自动。「建议后续任务」改由看板定时启动，归入「定期运行」。见 [Agents](/docs/agents#run-an-agent-on-a-schedule)。
- 规划记忆按模块分文件夹：某个模块的决定、否决、设计教训和筛选偏好写进 `memory/agents/planner/<module>/`，`planner/` 根目录只放跨模块的条目；升级时根文件里的 `## <module>` 主题自动移进对应文件夹。记忆面板在规划者的每个文件下列出拥有该文件的模块，点开即读。
- 点「继续」接着跑的运行和说进讨论的运行（Plan tasks）也只记这一次自己的花费：Runs 列表、运行日志和用量统计不再把前面的花费重复算进去；接着跑的那一行不含被替换掉的前一次花费，用量统计里那一笔仍在。
- Codex 用 `gpt-6.1-sol` 的运行现在也显示花费（按 OpenAI 公布价目估算）。
- 「建议后续任务」改为按批回顾：完成的卡先进等待名单（`ui.config.json` 的 `reflectQueue`），一次 `reflect` 运行回顾名单里最早的至多 10 张并跨卡去重，每条提议的 `--source` 是它出自的那张卡；只有成功的一轮才把卡移出名单，失败的卡等下一次有卡完成时一起回顾，同一时间只跑一轮。
- 「建议后续任务」的真实运行（不只是本地打印的流程）现在会对照过去漏提的后续（`memory/agents/proposer/missed.md`）、全局和各模块的拒绝记录（`planner/rejected.md`、`planner/<module>/rejected.md`），以及已开启的定时 Agent，不再重复提议定时 Agent 自己会做的工作或已被否过的方向。
- 「建议后续任务」（`proposer`）的「小改动」设置决定小改动怎么处理：默认「先问我」照旧进待筛选；「直接做完」让它用 `akb raw create --source "#<完成的卡>" --schedule implement` 直接建卡开做（不带 `--related`，已归档的卡不会再让建卡失败）；「不提」只写在报告里。内置角色可在 `roles.ts` 声明这类选项，选中项的附加说明加在每次运行末尾、用户规则之前，存于 `ui.config.json` 的 `specAgents.<agent>.<key>`。
- 规划（refine）和回答问题（resolve）结束时，agent 都会判断卡片能否直接构建：能就当场标为 ready，不能就留下待你回答的问题；回答完问题后不再等看板空闲后的那轮自动 refine。
- 通知栏「已落地」页在收起通知栏、切换看板或通知中心重启时不再对 Cloud 反复请求同一页；一次最多读 20 页，游标不前进即停（需发新版本后生效）。
- 周期任务卡已去掉，重复的工作改由工作流里定期运行的 agent 来做：`akb update`（以及看板自己的巡检）把 `todo/recurring/` 下的每张卡变成所属工作流的一个 `hook: schedule` agent，卡上的步骤和运行状态成为它的规则，周期和上次运行照搬，没设周期的迁过去是停用；开放问题进待筛选，卡旁文件夹搬到 `docs/kanban/agents/`，「Fetch triage items」卡直接删除。`akb raw create --recurring`、`--cadence`、`akb raw record-run`、`akb card run` 和 `akb guide recurring-task` 都已去掉，新增重复工作见 `akb guide write-agent`。
- 本看板自建的「整理文档」（`docs-pruner`）agent 改用 `lead: execute` 写法，`akb spec` 和配置页不再报它，可重新选作工作流执行阶段的负责人；目前没有工作流指派它，要用得先建一个。
- 本看板的「竞品分析」（`competitor-analysis-loop`）agent 只剩一份六步的 `AGENT.md`，`process.md` 已删；名称和简介按中英文显示，每次运行只把本次新写下的缺口送进待筛选，已忽略的缺口不再重复提起。
- `akb raw list --archived` 列出由看板落地并归档的卡片，从早到晚，每张带 id、标题、工作流、落地时间、落地提交和归档文件路径（文件已不在 `.archive/` 时留空）；`--since "YYYY-MM-DD HH:MM"` 只看这之后的落地，`--workflow <id>` 只看一个工作流，`--json` 可用。手动归档、手动提交和只产出文件的卡不在其中。
- 工作流负责人的 `AGENT.md` 还在、只是被看板拒用时（旧写法 `stage`/`kind`/`lead: true`、缺文件、重名、文件夹名与 `name` 不一致、其他文件错误），开始卡片的报错和 `akb workflow list` 的 `!` 行改为一句话说明是哪个负责人、为什么用不了、改哪一行，界面按中英文显示；名字确实不存在时仍报「没有这个 agent」。
- 否决卡片时给的原因随卡片存进归档（frontmatter 的 `rejected_reason`，分组的子任务也带）：看板发起的否决自动保存，手动执行用 `akb raw reject <id> --reason <text>`，`card reject --print` 打印的收尾命令已带好转义后的原因。此前的否决卡不补。
- Cloud 看板上没有 `archived:` 日期的归档卡片（该字段出现前归档的旧卡片、手工放进归档的卡片）现在按 Cloud 记录的归档时间满 30 天后删除，此前这类卡片及其所在分组永远不会被清理；导入的这类卡片从导入那一刻算起。
- 构建后的 hook 会被告知看板目录和卡片文件的绝对路径；QA 手册每个场景一个文件夹 `docs/qa/<module>/<case>/case.md`，截图、GIF、日志只存在本机项目的 `.akb/qa/<module>/<case>/`、不进 git（证据都不在本机时测试用例页只标一次「这台电脑上没有截图和日志」），模块只取自看板的 `modules.md`，清单为空时放在 `docs/qa/<case>/case.md`：`web/content/docs/daily-loop.mdx`。
- 清空卡片对话、给它换 agent、或归档卡片时，没审过的对话会在本机留底，卡片归档后由记忆审阅读一次再删除，最久 30 天；被拒绝或丢弃的卡片当场删除：`web/content/docs/chat.mdx`。
- 记忆审阅改为卡片归档后只审一次它的对话，每次运行最多 10 张卡、接连跑完；对某个 agent 产出的纠正写进该 agent 自己的记忆。被拒绝的卡片不审，讨论也不再审——讨论定下的内容留在它生成的卡片里，想长期保留的偏好要在卡片对话里再说一次：`web/content/docs/agents.mdx`。
- `AGENT.md` 的 `akb:` 下用一个键声明角色：`lead: plan`、`lead: execute`、`hook: plan`、`hook: execute` 四选一；旧的 `stage`、`kind`、`lead: true/false` 不再读取，报错里写出该换成的那一行，自建 agent 要手动改：`akb guide write-agent`。
- 「整理搁置卡片」（sweeper）agent 已移除：看板不再自动重写或丢弃搁置的卡片，`akb card unstick` 一并去掉；搁置的卡片用 `akb raw list --stale` 查看后自己改写或否决。
- `akb raw reject <id>`（含 `--discard`）把卡片移入 `.archive/` 并在 frontmatter 写上 `rejected: true`，不再删除文件；附件和 mockup 留给一周后的例行清理，回执不再打印卡片全文：`akb guide reject`。
- 失败或被打断、又没有会话可接回的运行（分拣、Agent 未安装或没起来）可以原样重试：`akb run resume <id>` 对这类运行就是再做一遍，`akb run list` 会提示；连接器已被移除的运行也能「继续」，改为在 Agent 当前的连接器上开新会话接着做：`web/content/docs/runs.mdx`。
- 所有工作流的规划负责人（软件规划师及可负责规划的 agent）都用「规划助手」（`discussion-helper`）的运行时，从讨论建出的卡在后续规划里能接续原会话；`akb agent bind` 对规划负责人会拒绝并指向 `discussion-helper`：`web/content/docs/runs.mdx`。
- 回答问题（resolve）和修订（revise）在改写、删除或推翻某个 agent 负责的 section 前，都会先读该 agent 的 AGENT.md 及相关 references；读不到会先说明：`akb guide writing` 的 "Agent sections"。
- 停止运行、运行静默超时、卡片被接管、停止对话回复时，Agent 启动的命令（包括放到后台的）一并结束，不再留在后台继续跑：`web/content/docs/runs.mdx`。
- 运行正常结束时，Agent 放到后台的命令（如 dev server、测试 watcher）也一并结束；对话回复正常结束时照旧保留。
- Windows 上，运行意外中断或停止时 `taskkill` 失败后，Agent 和它启动的命令也会被结束；父进程已先退出的命令仍可能留下。
- 整理建的卡不写 `## Source`：来源 id 由 `akb raw create --triage <source-id>` 记在卡片 frontmatter，供看板防重复建卡，卡片页的「来源」链接由它得出：`web/content/docs/triage.mdx`。
- 待筛选对所有账号开放：免费或未登录也能看到顶栏「待筛选」按钮和数量，进页面逐条建卡、立即开始、讨论、忽略、恢复，`akb triage fetch` 和 `akb triage add` 照常；只有自动分拣需要 Pro（页面上的「自动分拣」、`akb triage run`、新条目到达后的自动分拣）：`web/content/docs/triage.mdx`。
- `goal.md` 由 `docs/kanban/memory/project.md` 取代：看板助手「描述项目 / Describe the project」（`akb describe-project`）每天检查一次，只在有新提交或还没有描述时从用户视角整篇重写；评估、分拣、规划发布和处理卡住的卡都读它。`akb update` 把写过的目标挪到 planner 的 `decisions.md` 顶部并删掉 `goal.md`，旧的 `product.md` 自动改名为 `project.md`，已设的更新周期、运行环境和规则一并带过去；旧命令 `akb describe-product` 不再可用，setup 不再有「目标」一步。
- 在卡片对话里把一件事拆成新卡、或建卡/修订卡片时出现依赖，等待的那张卡（包括已有的原卡）会记上 `blocked_by`，不再只在新卡上记一笔 `related`。
- 把卡片移进组后，若它经其他卡片间接依赖所属组（或祖先组），`akb raw validate` 会在它的 `blocked_by` 行报 `dependency-cycle`，并写出完整环路径（如 `#7 → #8 → #5 → #7`）。
- `akb raw update <id> --add-blocked-by <ids>` / `--add-related <ids>` 把依赖追加到已有卡上，原列表保留并去重；与同字段的 `--blocked-by` / `--related` 同时给出会被拒绝。
- 组内卡片不能依赖它所在的组或上层组（组要等成员完成才关闭，会互相卡死）：`akb raw update` 按依赖环拒绝，已这样放进组里的卡片 `akb raw validate` 报错。
- AGENT.md 里可以在值后面写行尾注释（如 `stage: plan  # 它的阶段`），会像 YAML 一样被忽略；需要值里带 `#` 时给值加引号。
- 在讨论里写好方案后点「立即开始」，开发会带着这段讨论动手，聊天里说过、方案没写的细节不再丢失，讨论本身保持不变；所用连接器不支持时会自动改走「规划任务」。
- 在终端或 Skill 里建卡时，新卡片会按交付物落到对应的工作流（产品视频、演示文稿、博客等）；也可以用 `akb create --workflow <id>` 直接指定。
- `akb triage run` 和页面上的「整理」在命令里逐条整理待筛选，不再启动编码代理：每条建卡并归档、带理由忽略，或留给你；卡的标题和文件名照搬条目，模块、优先级、ROI 和工作流由 Jev 选，没有任何工作流能做的条目会被忽略并写明原因：`web/content/docs/triage.mdx`。
- 新的待筛选条目文件名是一段英文 slug，不再带日期和哈希；`akb triage add --slug` 可以指定，旧条目不改名。
- 在讨论里直接说「建张卡」，或在终端让 Claude Code、Codex、OpenCode 建卡，新卡片的对话都会接上建卡时的那段会话，打开就能从原话接着聊。
- 开启“建议后续任务”后，它会对照卡片来源的讨论和实际交付，提出卡片声称却没有交付支撑的缺口；你指出它漏掉的后续任务，会在每日记忆整理后被记住，下次对照检查。
- A discussion never edits code: asking to create or build something makes its card on that
  turn (and starts the build when asked), an idea gets a short outcome plan for Plan tasks or
  Start now, and a plain question just gets an answer. Asking a card's chat to build it starts
  the build, unless the card still has open questions.
- Planning never builds: refine plans a card in one session and stops, answering its questions
  applies them and stops, and you start the build — always a session of its own
  ([Daily loop](https://ai4kanban.dev/docs/daily-loop)). `akb card resolve --and-implement` is gone.
  Builds are no longer AI-reviewed; Auto-approve builds and Auto-answer questions are gone:
  [Agents](https://ai4kanban.dev/docs/agents).
- The blog planner's outline now shows the keyword-bearing title, section plan, SEO title and
  meta description for review; keywords land only in sections whose topic they match.
- On a Product video card, the demo rehearser's result and key shots for each demo section
  sit above the line for review; the script names the result each section draws on:
  [Agents](https://ai4kanban.dev/docs/agents).
- `akb cloud image` and `akb cloud tts` generate an image or hosted-voice narration on the
  signed-in account's Pro credits; every agent can call them (`akb cloud --help`).
- Built-in agents, workflows and specialists — Coding, Product video (script, hosted voice,
  film, cover; one example per content type), Slide deck (two approval rounds, editable `.pptx`), Carousel post (copy, then
  every page as PNG per platform ratio with captions; one template and best example per
  format), Blog post (outline, then the full article with new images and links, delivered to
  the card and, for a blog in the project, its folder), copywriting, ui-designer,
  prompt-writer, email-planner, reviewers, Triage, Memory pruner, Review chats,
  agent memory and rules, adding your own agent, and which workflows need Pro:
  `web/content/docs/agents.mdx`.
- email-planner covers any email, newsletters and announcements included; one with its own
  format and send script (the newsletter's issue JSON) is written and previewed in it, not TSX.
- `akb workflow stage <id> --stage <stage> --on|--off <agent>` switches one of a workflow's
  agents; `akb workflow duplicate` copies every agent into the new workflow.
- Every agent is one way of working and declares no settings of its own; writing one:
  `akb guide write-agent`.
- Video, slide deck, carousel and blog cards track each review as a todo, ticked when a `[user]` answer
  accepts it; a change that makes a ticked todo stale adds a new one, and the card offers
  Archive once every todo is ticked and the file is on it.
- A video script's first review is the story, shots and exact lines; capture details and
  shot timing are settled after approval, and changing approved content reopens that review.
- A video retake restores and checks the shot's starting state before every take.
- A Product video's demo is rehearsed by `demo-rehearser`, and its 3–6 key shots show under the demo sections of the script for review.
- prompt-writer edits a prompt only where its agent lacks a needed instruction, within the
  prompts the card names; app-controlled mechanics never become agent duties.
- Codex runs with approvals and sandbox bypassed by default, so no approval, sandbox, update
  or model-switch prompt interrupts a run, and it works in non-git projects; a command you
  configured yourself is left as is.
- ChatGPT.app 26.928 起把 Codex 挪到了新位置；看板新旧两个位置都能找到，更新 ChatGPT.app 后 Codex 讨论和看板运行照常启动。
- The daily loop, discarding, Just discard, and the QA manual a build keeps up to date:
  `web/content/docs/daily-loop.mdx`.
- Only the Coding workflow gets a branch and worktree; other workflows run in the project
  directory without committing, several cards at once, and a custom workflow toggles it under
  Advanced settings: `web/content/docs/daily-loop.mdx`.
- Board layout, group tasks, rule files, mockups, memory ownership and the board's language:
  `akb guide board`.
- Refining, planning a screen, picking the next card, and splitting a module:
  `akb guide qa-loop`, `akb guide next-card`, `akb guide module-map`.
- Every board move and run is an `akb` command on any board, with `--json` and `--print`; a
  run outlives its command: `cli/README.md`, `web/content/docs/runs.mdx`.
- One repository can hold several boards (`--board`, `AI4KANBAN_BOARD`): `cli/README.md`.
- `akb chat` and card chat: `web/content/docs/chat.mdx`.
- Triage — fetch, add, sort, check, ignore, history and restore: `web/content/docs/triage.mdx`.
- Setup: `akb guide setup`.
- Releases and changelogs on close: `web/content/docs/releases.mdx`.
- Implement carries a card from build to landed and archived, holding only on open
  questions; review can be switched off, and a failed delivery resumes: `akb guide
  implement`, `akb guide review`, `web/content/docs/daily-loop.mdx`.
- **Start now** builds a sentence or a handed-over plan, writing its card as it starts:
  `akb guide implement`.
- A failed or stopped card creation can be resumed or discarded, and resuming keeps the
  discard: `web/content/docs/runs.mdx`.
- A discussion judges the idea before planning it — outcome versus means, whether it is worth
  doing — and may disagree or ask for evidence; sending always starts a discussion, and
  **Plan tasks** or **Start now** under its plan starts work.
- One discussion can hold several plans; **Plan tasks** hands them to one planning run,
  an unused plan returns to the discussion, and `akb raw plan drop` withdraws one.
- A discussion's plan picks its workflow by the work the resulting cards will do, falling
  back to the board default.
- Card chat changes the card on a clear edit intent (including a question-shaped request or
  agreeing with its own suggestion) without asking again; a pure question only gets an
  answer, and work the card does not cover becomes a new card.
- Planning questions are written for someone who has not seen the board — no card ids,
  agent names or board terms.
- Standard planning QA checks the facts a plan turns on against authoritative sources and
  revises or stays open when it cannot settle one: `akb guide validate-assumption`.
- Updating an installed board: `akb guide update`.
- A card off the board for 7 days has its assets, old mockups, chat and ended delivery
  worktrees removed from `.akb/` once a day while the app is open; asset files a memory note
  or open card names are kept.
- When the `codex` on the PATH cannot start, runs, chats, connection tests and the login check
  use the copy inside ChatGPT instead, and the run log says so in one line.
- 看板设置（Agent、运行时、工作流等）改为每人本机各存一份，放在 `.akb/boards/<board>/ui.config.json`，不进 git、也不上传到 Cloud 工作区；旧的 `docs/kanban/ui.config.json` 在首次读取时自动迁移并删除。
- The skill no longer has a flow for finding new work ("What are we missing?") or for turning
  a pasted article, research or feedback into cards; the coding agent answers those as any
  other request.
- 卡片的来源记在 frontmatter 的 `source:` 里：`akb raw create --source <计划路径 | plan:<id> | #<id> | 网址>`，`akb raw update --source` 替换、`--add-source` 追加；新卡不再写 `## Source`，由待筛选条目建的卡靠 `--triage` 自带来源，旧卡的 `## Source` 照样认。
- 一张卡的规划接着同一个会话走：建卡后的规划从建卡会话分出一份继续，回答问题后的那一步续用上次规划的会话，不再每步重读卡片、记忆和代码；换了智能体工具、该工具不支持或会话已找不到时照旧新开，构建、审查、专项智能体仍是全新会话。
- 自动整理建出的卡，文件名说不清它是什么时（`1303-item.md`、单个词的碎片、日期加哈希），规划时会改成简短的英文名；条目文件本身不改名。见 `web/content/docs/triage.mdx`。
- 看板启动的每次卡片规划（`clarify`、`resolve`），运行日志第一行的 `[board]` 说明这次是续用了上次规划的会话、从建卡会话分出一份，还是新开了会话；新开时带原因（没有记录、在别的目录打开、工具不支持、工具不一致、会话已不存在）。这一行只有英文。
- 归档的卡片在归档满 30 天后由每天的例行清理自动删除（分组按其中最晚的归档日期整体删除），仍属于未关闭版本的卡片留到版本关闭，卡片名下已结束的交付记录随卡片一并删除（之后 `akb raw list --archived` 不再列出它）；附件、mockup 和对话照旧在 7 天后清理。见 `web/content/docs/daily-loop.mdx`。
- 本机看板的每日清理还会删除卡片既不在看板也不在归档里的已结束交付记录（最后写入满 7 天、不再持有工作区），这些早已删除的卡片随之从 `akb raw list --archived` 消失；导入 Cloud 时也不再带上这类记录，Cloud 上已有的由迁移 0039 一次性删除。
- 工作流的 Execute 阶段可以挂执行后 hook：每次构建提交后，按顺序为每个已启用的 hook 各跑一段会话，它的改动并入交付，全部跑完才合入（或等你提交、以文件结束）；hook 失败或被停止时交付停下，对该运行 Resume 或 `akb delivery resume <id>` 从这个 hook 继续。声明 `akb.stage: execute` 且不是 lead 的 agent 就是执行后 hook；以前挂在 Execute 阶段的 Agent 现在会运行。见 `web/content/docs/agents.mdx`。
- 卡片不再带 `verify:`：`akb raw update-verify` 和 `update-questions --to-verify` 已移除，旧卡片上的 `verify:` 被忽略。Coding 工作流内置的 `qa-manager` 按周期运行（默认每天一遍，不再跟在构建之后，也不再有整本重跑）：先更新上次运行以来完成的卡片影响的 `docs/qa/` 场景，再为一个还没补写的模块写出已有功能的场景；走不通的场景进待筛选，手册索引在 `docs/qa/README.md`。升级时沿用原来的开关和额外要求。见 `web/content/docs/daily-loop.mdx`。
- Jev 分拣在一次请求里把每条待筛选分开问：值得做吗、已经做到了吗、以前拒绝过吗、重复哪张卡、要你定方向吗、小到免规划吗。已做到 / 拒绝过 / 重复任一达到 90% 才忽略，要你定达到 50% 留给你，值得做达到 80% 建卡、不到 20% 忽略（「小」达到 60% 才免规划），其余留给你；`akb triage run` 对留下的条目写出倾向和把握度（如 `likely worth doing, 57% sure`）。之前因拿不准留下的条目在下次分拣时重判一次。见 `web/content/docs/triage.mdx`。
- 新写或重新规划的卡片，折叠的 agent 半区只写卡片别处没有的内容：小改动不再写 `Today`，`Scope` 不重抄开头段落，`Decided by the agent` 不收「查过了，不需要」的结论，已无重犯余地的否决记录会删掉；已有卡片不变。
- 退出桌面应用（或看板服务、`akb chat` 被结束）时，正在回复的对话 Agent 和 Agent 测试连同它们启动的命令一起强制结束，不再留在后台；应用崩溃或被强制结束时不覆盖。
- 看板界面开着时，可细化、没在跑也没排队的卡会被自动细化一次（每分钟最多起一张，卡片文件静置两分钟后才取）：比如答完最后一个待你回答的问题后。细化失败或卡仍停在待办时不再自动重试，那次运行上会说明原因；这条规则生效前就已可细化的旧卡不会自动补，仍需手动点「细化」。对还在等你回答的卡执行 `akb card refine`，会说明它在等回答、回答后自动细化。
- 工作流可以带定期运行的 Agent：在 `AGENT.md` 里写 `akb.hook: schedule`，它就按自己的周期（默认每天）在没有卡片的情况下自己跑一遍，改动像一次构建那样提交并合入当前分支，没有改动就不提交；失败或被停止的一遍不算数，过一个周期再试。开启后不会立刻跑，第一遍在一个周期之后。`akb workflow schedule <id>` 开关、改周期、立即运行，`akb workflow list` 带出周期和上次运行；这种运行里 `akb raw list --archived --since last-run` 列出上次运行以来落地的卡片。见 `web/content/docs/agents.mdx`。
- 「自动处理待筛选」不再是 agent：`akb raw rule triage` 和 `akb agent bind triage` 按「看板上没有这个 agent」拒绝，已有的 `rules/triage.md` 留着但不被读取。自动分拣照旧运行，受忽略原因、`project.md` 和规划记忆影响：`web/content/docs/triage.mdx`。
- 完成卡片后的提议只提项目本身的工作：唯一内容是维护某个 Agent 自己文件的候选（它的记忆，或它的 `AGENT.md` 写明由它维护的产出，如 QA 手册）不再进入待筛选，这类缺口由该 Agent 自己补。
- 运行里的 agent 可以用 `akb run start "<任务>"`（或 `--file <路径>`，`--runtime <id>` 换运行环境）起子运行：同一个 agent、同一个工作目录，有自己的日志和费用，随父运行落地；`akb run wait` 每次最多等 90 秒，给出结束的子运行的状态和最后一条消息。父运行结束或被停止时还在跑的子运行一并停止，子运行不能再起子运行，也不能单独继续。QA 管理员（`qa-manager`）在两个以上模块有完成的卡片时每个模块交给一个子运行并行处理。说明见 [Sub-runs](/docs/runs#sub-runs)。
- QA 管理员（`qa-manager`）的简介改用「测试用例 / test cases」的说法，规则不变。
- 内置 Agent `qa-manager` 的中文名改为「质检员」，内置 Agent 的中文描述只写「它做什么」。
- 执行后 hook 已删除：构建完成后交付直接合入（或等你提交），不再等待任何 Agent；工作流配置里残留的执行后 Agent 被忽略，`akb.hook: execute` 的 agent 会报错并提示改成 `hook: schedule` 加 `reads: archived-cards`，配置界面的「执行后」一栏也去掉了。见 `web/content/docs/agents.mdx`。
- 剪辑、封面设计和脚本作者不再写 `media.md`：素材只用自己制作或生成的、仓库里的和开源许可的，其余（包括 Apple、Windows 等平台标志）先提问；生成封面的模型和提示词和封面源文件放在一起，范例不再附来源记录。
- 定期运行的 Agent 不再依赖 git 判断要不要跑：「描述项目」改为在上次运行后有卡片归档（或还没有项目描述）时运行；`akb.reads` 去掉 `commits`，旧 `AGENT.md` 里写的 `commits` 按 `archived-cards` 处理；`akb describe-project --help` 与文档「日常流程」页已同步此说法。见 `web/content/docs/agents.mdx`。
- 编码流程新增规划钩子「用户文档」（`user-docs`）：卡片改变用户能看到或能做的事时，在规划阶段写出要改的用户文档（已有页给 diff，新页给整段 Markdown），确认后由构建者照写；内部文档、宣传文案和界面文字不归它。个人写作偏好记在它的记忆 `writing.md`。实现阶段不再加载 `document-feature` 指南。见 `web/content/docs/agents.mdx`。

## local-ui

- Claude Code 的对话里，后台任务在跑时回复照常结束、可以继续发消息；输入框上方显示「N 个后台任务进行中 · 中止」，任务结束后的结论以「后台任务结束后」单独一条接在对话末尾：`web/content/docs/connectors.mdx`。
- 右键（触屏长按）卡片、计划、文档里看板自己的图片——正文图片、放大后的大图、mockup 预览图——弹出「复制图片」「下载图片」菜单，下载沿用原文件名，复制成功后图片右上角短暂显示「已复制」；外链图片保持浏览器原有右键。
- 定时代理频率菜单的「自动」一项下方用一行小字说明它对该代理意味着什么（如「有新对话后，最多每 6 小时一次」「每天一次」），看板自带的和工作流的定时代理都有；等待新输入的代理在「自动」下最多每 6 小时跑一次（原为每小时）。
- 执行中的卡片页「差异」显示 Agent 已写入工作目录的改动（含新建文件），点开该页签即重新读取；没有改动时显示「还没有改动」；归档卡片页可直接查看已合入那次提交的「差异」。
- 讨论写成的卡片链接按卡片当前状态显示：进行中为「→ 已写成」，归档后为「✓ 已完成」并淡化，被拒绝为「已放弃」；归档后仍显示标题、可点开，找不到文件的旧卡片只显示编号。
- 待筛选里由 Agent 写入的条目（如 qa-manager 跑 QA 手册时发现的问题），来源显示为该 Agent 名，同一 Agent 的条目归为一组并可在来源筛选中选择；「未注明来源」只留给确实没有来源的条目。
- 欢迎导览翻页时像洗一叠卡片：前进时当前卡向左滑出、塞到底下，后退时底下那张从左侧抽回到最前；手机上整页滑出、下一页浮起；系统开启「减少动态效果」时直接切换。
- 桌面应用从别的程序切回窗口时，看板、卡片页、待筛选页及其计数、归档、记忆、测试用例等页面都会重新读取，不必切页；点进页内模型图再点回来不算离开。
- 在「待筛选」页再点一次顶栏的「待筛选」按钮，会回到点开前所在的页面；直接打开该页时回到看板。
- 「待筛选」页没有条目时只显示图标、标题和说明，不再出现「从接口拉取」和「查看历史」链接；历史仍在「历史」标签页里。
- 顶栏「待筛选」按钮的条目数在任一后台运行结束后、以及测试用例送进待筛选后立即刷新，不必切换页面或窗口。
- 「待筛选 / Triage」从侧栏移到顶栏铃铛左侧（手机顶栏也有）：有待处理条目时按钮填深红并显示条目数（超过 99 显示 99+），点开是待筛选页；顶栏的 GitHub、铃铛，以及窄屏只剩图标的「讨论」「新想法」都有悬停提示：`web/content/docs/triage.mdx`。
- 新用户设置完成后、老用户升级后第一次打开看板时，弹出五页「功能导览 / Welcome tour」，每页一段循环动画，可翻页、可跳过；每台机器（Cloud 为每个浏览器）只自动弹一次，之后可从桌面「帮助 → 功能导览」、「配置 → 通用」或 Cloud 的「设置」页重新查看。
- 「回顾对话记忆」改名为「回顾对话 / Review chats」，agent 名 `memory-reviewer` 改为 `chat-reviewer`；按旧名保存的运行环境和规则照常生效：`web/content/docs/agents.mdx`。
- 「测试用例」页的每条使用感受旁有「送进待筛选 / Send to Triage」（桌面悬停时出现，手机一直显示），点一下就把这条感受连同所属用例写成一条待筛选条目；送过的显示「已送进待筛选」，条目被忽略后可再送：`web/content/docs/daily-loop.mdx` 的「Test cases」。
- 拒绝对话框和看板上的丢弃立即完成，不再出现运行；「回顾忽略记录」改名为「回顾拒绝和忽略记录」，「记忆」里的「筛选偏好」并入「已否决的内容」。
- 「配置」里定时 agent 设为「自动」时，列表里名称下方和周期菜单顶部会说明它在等什么，例如「有新的忽略原因后运行」「处理完待筛选后运行」「开发结束后运行」「上次失败，稍后重试」；看板自带的和工作流里的定时 agent 都一样。
- 回复还没结束时退出、崩溃或被强制结束，重新打开对话后那条消息下方会显示「回复被中断，内容没有保留。」和「重新发送」，卡片对话栏和讨论页都有。
- 卡片聊天每一轮、规划类运行（澄清、处理回答）显示和计入用量统计的“约 $x”是这一轮/这次自己的花费，不再是 Claude Code 会话的累计值；从别的会话接着或分叉时找不到前一段的花费，这一轮不显示花费。
- Agent 页「建议后续任务」多了「小改动 / Small fixes」下拉框：直接做完、先问我（默认）、不提；内置角色的设置文案写在 `kanban-ui/i18n/configuration` 的 `roles.<agent>.settings`。
- Configuration → Board 里的「回顾对话」「整理记忆」「回顾忽略记录」「描述项目」可以设周期、可以停用（周期菜单最后一项「停用 / Disable」），菜单第一行写下次运行；停用后「立即运行」照常可用。看板和工作流里打开的 agent 是同一张详情页：`web/content/docs/agents.mdx`。
- 一次讨论写出多份方案时，每份方案一行，带自己的工作流和「规划」「开始」，下方「全部规划」「全部开始」交出所有未交接的方案；还有方案没交出时讨论留在侧栏、可以继续聊，最后一份交出才结束。
- 桌面应用重启后，同一项目的界面记忆保持原样：已庆祝过的里程碑不再重复庆祝，未发送的草稿、聊天栏的开合与宽度、已提示过的运行提醒都还在。升级后第一次打开仍会重来一次；项目里另开的看板（非 `docs/kanban`）暂不保留。
- 记忆面板里看板自己的那份描述叫「项目 / The project」，Configuration → Board 里写它的助手叫「描述项目 / Describe the project」，Runs 里的运行也按新名字显示，升级前的历史运行照常列出。
- 看板不再有 Recurring 一栏，卡片页不再有 Run 按钮、周期控件和上次、下次运行；重复的工作在 Configuration → Workflows 的 Scheduled 下，停用的 agent 也可以点「立即运行 / Run now」：`kanban-ui/README.md` 的「Repeating work」。
- 卡片页标题旁的交付状态徽标和它下面的说明跟随界面语言（中文 / English），被锁按钮的悬停提示和运行页里无卡片构建的停下说明也一样；git 或系统的报错原文另起一行照写，`akb` 在终端里的同一句话保持英文。
- 手机上点开的提示气泡始终完整可读：超过 260px 的提示自动换行，贴近屏幕或列边缘时向内平移，上方放不下时改在下方打开；旋转屏幕会重新摆放，滚出视野后再点一次即可。本地看板与托管看板一致，鼠标悬停的气泡不变。
- 卡片页操作栏的「否决 / Reject」按钮改叫「移除 / Remove」，与它打开的对话框标题一致；确认按钮不变，原因留空是「丢弃 / Discard」、写了原因是「否决 / Reject」：`kanban-ui/README.md` 的操作表。
- 否决对话框输入框的占位符只问原因，不再预设否决：「原因（可选）…」/ "Reason (optional)…"
- 否决对话框输入框下的提示语改为一句话：「直接丢弃，或写下原因，未来会避开这类任务。」/ "Discard it, or add a reason so future planning avoids tasks like this."
- 归档里打开被否决的卡，「已否决」标签下方的「否决原因 / Reason」框显示当时填写的原文；没填原因的（丢弃）不显示：`kanban-ui/README.md` 的 "The archive"。
- 被否决或丢弃的卡不再从磁盘删除，而是进入「归档」列表，在版本标签的位置显示「已否决 / Rejected」，可以打开全文；它不计入任何版本的已交付：`kanban-ui/README.md` 的 "The archive"。
- 运行日志标题栏：「继续」接不住的失败运行在同一位置显示「重试」，被拒绝时原因写在按钮右侧；结束状态只留图标并排在按钮前，「失败 · 退出码」等状态词改为图标的悬停提示（手机上仍显示文字）。
- 讨论角色改名为「规划助手 / Planning helper」；配置里规划负责人的运行时改为只读，显示规划助手的运行时，点「在「规划助手」里更改」跳到 配置 → 看板 修改。
- 卡片页讨论栏首次读取失败时，在对话区顶部显示「讨论载入失败。」和「重试」，不再一片空白；读到后自动恢复。
- `kanban-ui/README.md` 的「Open questions」和「Refine」两节已与实际行为一致：澄清和回答应用完都会停下，开发总是由 **Implement** 单独开始。
- 未开通 Pro 时，排在 Pro 工作流卡片上的澄清或开发不再悄悄消失：看板卡片显示带锁的「需要 Pro」，开通 Pro 后看板自动开始；卡片页「已计划」旁的「取消」可以撤掉。
- 未开通 Pro 时，用 Pro 工作流的定时卡片到期后不再每分钟被悄悄拒绝：看板跳过它并在卡片上显示带锁的「需要 Pro」，开通 Pro 后下一轮自动执行。
- 定时卡片的卡片页「下次运行」到期时跟随界面语言：中文显示「已到期」，英文显示「Due now」。
- Pro 用户分拣 triage 时，每条由 Jev 单独判断（免费、不限条数）：值得做的建卡（小改动直接设为可开工，不再规划），重复、已支持、否决过或价值不大的带理由忽略，拿不准的标「待你判断」排在待处理最前；历史里显示「需规划 / 免规划」和理由。
- 卡片页的工作流在无法开始时（环节缺少可用的负责 Agent，或工作流已被删除）旁边标「不可用」，悬停看原因，点击打开「配置 → 工作流」；已删除的工作流显示为「已删除的工作流」。配置页工作流的同款标记也由「未就绪」改为「不可用」。
- 顶栏的目标按钮和首次运行的「目标」一步已去掉；「配置 → 看板」多了「更新产品描述」助手，可调周期、立即更新，产品描述在「记忆」里只读显示。
- A failed run's log now leads its stopped-short line with the board's reason (e.g. the agent went silent for 30 minutes), and the board's closing note under a run follows the interface language; older runs and the agent's own errors show as before.
- A delivery's Diff tab wraps long lines instead of scrolling sideways: wrapped rows hang under the line's indent, line numbers stay on the first row, and below tablet width the file list starts hidden.
- 打开已有讨论时，方案读取失败也会显示「讨论载入失败。」和「重试」，不再一直停在载入骨架上。
- Every board helper is always on: Configuration → Board groups them as You start / On a schedule / On an event, a scheduled one only sets its cadence or runs now (Tidy memory defaults to every 7 days, first pass one cadence after upgrade), and boards that had turned any off get them back: `web/content/docs/agents.mdx`.
- A card's chat rail, before anything is said, asks "What's on your mind about this card?" and types sample questions under it one at a time; they are only prompts, nothing to click.
- Opening an existing discussion shows a loading skeleton instead of the new-discussion screen, and a failed read says so with Retry; a new discussion still opens straight to its empty screen.
- Triage's Waiting tab is a compact list whose text runs to the date: hover a row for Make card, Start now, Discuss and Ignore, centred in the row; Ignore takes effect at once with an undo toast and an optional reason afterwards, ticked rows ignore in one go, and acting in the detail moves on to the next item: `web/content/docs/triage.mdx`.
- A discussion opened from a triage item's Discuss files that item under the first card the discussion writes, so it leaves Waiting on its own: `web/content/docs/triage.mdx`.
- On a phone the top row is the card search, the tab bar is Board and More (Memory is a row on More), triage's search folds into a 🔍, and ticked triage rows put their actions where the tab bar was.
- Phone mockups fill a 393×852 iPhone 16 screen under the frame's status bar and home indicator; a mockup using `env(safe-area-inset-*)` or `viewport-fit=cover` runs edge to edge, others sit inside the safe areas over their own background, and `apple-mobile-web-app-status-bar-style` `black-translucent` turns the status bar white.
- A triage item's detail offers **Start now** (write its card and build it at once) and **Discuss** (a new discussion with the item prefilled, not sent): `web/content/docs/triage.mdx`.
- Cards no longer show what was chosen for you: the board badge, the card page section and `akb list`'s "answered for you" are gone, and a leftover `decided:` block is ignored and dropped on the next rewrite.
- Nine newer built-in agents have distinct prop-based pixel characters; the shared recipe is in `kanban-ui/agent-art.md`.

`kanban-ui/README.md` is this module's doc; a line naming no other doc is covered there.

- The desktop app reopens the last repo, finds your coding agent, installs `akb` and updates
  in the background: `desktop/README.md`. The browser board (`npx ai4kanban-ui`) is
  deprecated: `akb guide local-ui`.
- Setting a board up in the app is a guided first run, and **Finish setup** runs the rest as
  one watchable, resumable run.
- The board, a **Queue** of ready and not-ready cards, search, a group's build-order
  map, **Insights**, read-only **Memory** by owner, and the **Archive**.
- On a phone the board becomes a bottom tab bar with one column at a time.
- **Upgrade to Pro** buys monthly or yearly inside Configuration → Billing on the app's Cloud
  sign-in, unlocking on return; Billing shows the plan, invoices and a link to manage billing.
- Pro workflows are locked without Pro, offering only upgrade or sign-in; archive and reject
  still work, and `akb` refuses them too.
- The board page has one entry, **New idea**, for ideas, progress questions, and moving,
  changing, archiving, rejecting or starting cards; **Discuss** exists only on a card page.
- A card's **Revise** opens its chat with the first line typed.
- Planning from a discussion continues the same agent session, so unwritten details reach the
  card; the discussion stays hidden once planning or building starts.
- A conversation stays on the agent that opened it; changing the helper's runtime affects
  only new conversations.
- Closing the discussion panel only hides it; drafts, images and in-flight replies stay, per
  discussion.
- Returning to a card with Back or Forward shows it as it is on disk.
- Card assets play in place: videos, audio, shot previews, storyboards, slide decks with
  speaker notes, `.pptx` downloads, and mockups labelled by device. Storyboard pictures keep
  their own shape, a page with no notes takes the full width, and `label` titles each one.
- A stopped-short run on a card nobody has dealt with stays visible on the card and in
  **Unfinished** until it is; runs that cannot resume offer no **Continue**:
  `web/content/docs/runs.mdx`.
- The Insights dialog shows completed, created and rejected over 30 days to a year, plus
  token use and estimated cost per connector and model.
- Notifications load 30 at a time; counts still include everything.
- Built-in workflows explain themselves in the workflow picker and `akb workflow list`.
- Each agent belongs to one workflow; a stage lists enabled agents and keeps disabled ones
  below, and copying a workflow copies its agents. Copying an agent is the only way to change
  a built-in agent's instructions; its memory starts empty.
- A built-in helper's page has one **Extra requirements** box per workflow stage; an agent you
  added is told everything through its own `AGENT.md`.
- A renamed agent's runtime change takes effect immediately.
- **Runtimes** is one list with **Global default** first: `web/content/docs/runs.mdx`,
  `web/content/docs/connectors.mdx`.
- Codex and Claude Code default to their subscription and existing CLI login; an API or
  gateway choice sticks: `web/content/docs/connectors.mdx`.
- Cloud and notification settings retry on their own when Cloud is unreachable and recover
  without reopening.
- Configuration has separate **Cloud** and **Notifications** tabs; Cloud says it is an alpha
  free for invited users, and storing a board in Cloud is offered only to team accounts.
- **Language** — English or 中文 — belongs to the machine and applies without reload; error
  messages follow it, with paths, commands and third-party diagnostics left as they are.
- A bell carries every Cloud board's **To do** and **Landed**, and a stopped-short run of this
  board even without Cloud; bell and chat share one side rail.
- A project with several boards shows each board's folder and opens another in a new window.
- **Prune memory** carries **Run now** and a cadence.
- Signing in or out, buying Pro, and editing workflows update every open screen at once: Pro locks, the create panel's workflow list and the card page no longer wait for a reopen or a window switch.
- A discussion carries on in the cards **Plan tasks** writes from it: [Chat](/docs/chat).
- 卡片页和归档卡片页的属性栏里有「来源」：计划、待筛选条目点开就在看板里读原文，卡片跳到那张卡，网址在新标签打开；界面不再显示路径，也不再画 `## Source` 一节。云端看板只显示卡片和网址两类来源。
- 待筛选的「历史」是与「待处理」相同的紧凑列表：按处理时间新的在前，每行写明「已建卡 / 已忽略」和去向卡片或理由；点一行在详情里恢复，或为自己忽略的条目补写、修改理由：`web/content/docs/triage.mdx`。
- 新建任务面板的工作流菜单里，悬停不可用的工作流（触屏点 ⓘ）会先显示选不了的原因，如「没有可用的负责 Agent：执行」，内置工作流在其下接用途说明。
- 电脑宽度下，待筛选列表里被省略号截断的标题，把指针停在上面约一秒就能读到完整标题；放得下的标题不出现提示。
- 配置页「写 agent」说明里的键表与看板实际接受的一致：`stage` 只有 `plan` 或 `execute`，不再列出不起作用的 `settings`；新建 agent 的模板注释也不再提它。
- 新建任务面板的工作流菜单、运行日志的中止确认、待筛选「自动分拣」下的提示，与配置页的弹层一个用法：方向键移动、点别处或按 Esc 只关弹层本身，不连带关掉下面的面板或对话框。
- Configuration → Workflows 不再分阶段标签：左栏从上到下是整条流程——规划、规划后、执行、执行后；「辅助 Agent」改称 hook，分隔线右端的加号直接在该阶段后新建 Agent。运行列表里 hook 运行显示它的 agent 名。
- 确认弹层（停止运行、放弃交付、删除、离开工作区、「立即开始」）在按钮下方放不下时改到上方打开，靠近窗口边缘时向内避让，不再被所在的滚动区域截住；Esc 或取消后焦点回到触发按钮。
- 卡片页不再有「人工验收」区块，看板卡片上也不再有它的计数图标；「QA 管理员」在 Configuration → Workflows 的 Coding「定期运行」里，可在那里改周期或停用。
- 看板右下角会为三种时刻欢呼：一个版本的任务全部完成、一整组任务完成、当天第一个任务完成；小办公室里机器人放礼炮，旁边一行字说明在庆祝什么，无操作 6 秒后自行淡出，悬停暂停，点击展开 Runs 办公室。每件事每个浏览器只欢呼一次，手机宽度不显示。任何归档都算一次完成（由开发归档或手动归档、手动提交、只产出文件、没改代码的都算），拒绝和被取代的不算。
- 待筛选的「自动分拣」在剩余条目全部「待你判断」时明显变灰，悬停、键盘聚焦或手机上点按会提示「剩余条目都待你判断」；按下不会开始分拣：`web/content/docs/triage.mdx`。
- 待筛选条目详情里，标题紧贴上方的来源行，不再悬在中间；待处理和历史条目、电脑和手机宽度都一样。
- 待筛选里留给你的条目写出 Jev 的倾向和把握度（「可能值得做，把握 57%」/「可能该忽略，把握 48%」），不再只写「拿不准」；还没重判的旧条目只显示「待你判断」。
- 「配置 → 工作流」的 Agent 列表：选中的行不再铺橙色底，只在分组框左边线上亮一小段橙色；「规划后」「执行后」右端的「+」是灰底小按钮，点开后直接在列表里输入新 Agent 的名称，「+」变成「×」用来取消，Esc 只收起这一行。
- 手机和平板上点一下带提示的元素，提示气泡会留到下一次点到别处才收起；本机看板和云端看板的所有提示气泡都一样，鼠标悬停和键盘聚焦不变。
- 「配置 → 工作流」在规划、执行两个框下面多了「定期运行」框：列出这个工作流按周期自己运行的 Agent，「+」新建一个；选中后名称行是周期小控件和「立即运行」，描述下面写上次和下次运行时间。停用在周期菜单的最后一项，再选一个周期就重新启用。Runs 里这种运行以「工作流 · Agent」命名。看板级周期 Agent 的周期菜单同样变窄。
- 配置 → 看板的「随事件运行」里不再有「自动处理待筛选」，它的规则框和运行时选择一并去掉；自动分拣本身和运行列表里的分拣记录不变。
- Runs 里子运行挂在起它的那一步下面，标「子运行 / Sub-run」和任务的第一行，悬停看全文；选中后右侧是它自己的日志、费用和模型，任务全文在备注处；整组的状态和办公室里的角色仍由父运行决定。
- 看板界面多了只读的「测试用例 / Test cases」：桌面在侧栏「归档」下面，手机在「更多」里，项目有 `docs/qa/` 用例时才出现；依次打开模块卡片、用例卡片和单个用例，截图和日志就地显示：`kanban-ui/README.md` 的「Test cases」。
- 「配置 → 看板」的 Agent 列表不再列工作流的定期运行 Agent（QA 管理员、竞品分析）；它们只在所属工作流的「定期运行」里改周期或立即运行。
- 看板界面的主按钮、状态和提示从 Implement / 开发 改为 Build / 执行（待执行、执行中），refine 统一为「细化」；中文界面全面改写：进行中的运行显示「正在运行执行后 Agent…」这类完整短语，并统一用词（Agent、卡片、执行后 Agent、连接器、服务商、电脑、项目文件夹、akb 命令、套餐、版本、完成 / 交付失败、待你决定）。
- 「配置 → 工作流」里规划阶段的辅助 Agent 一栏从「规划后 / After planning」改名为「规划助手 / Helpers」，表明它们在规划过程中被调用，而不是规划结束后才运行。

## site

- 官网下架 Recipes：`/recipes` 及其下所有网址跳转到 `/docs/agents`，页脚、文档首页、`llms.txt` 和站点地图不再有入口；对比页 AI4Kanban vs Hermes Kanban（五种语言）和 Claude Code 介绍页把「周期任务」改说成看板定期启动的 agent。待带定期 agent 的版本发布后再部署。
- 官网卡片页示意图的操作栏按钮由 Reject 改为 Remove，与应用一致；README 概览图同步更新。
- 官网说明 `project.md` 的地方统一写「项目是什么」（五种语言）：首页记忆列表、博客配图、对比页 AI4Kanban vs Hermes Kanban；首页「从桌面应用开始」的导语换成「Download AI4Kanban. Plan with precision, ship at speed.」。
- 首页 Loop 第 1、2、4、5 步插图对齐现行应用：卡片页多了 Workflow 与 ROI、子任务列表带折叠线；问题面板只剩 Close 和 Resolve，可 Skip；agent 小节是带头像的可折叠行；第 5 步正文改为「产品取舍和开工确认等你决定」，不再提交付审批。README 概览图同步更新。
- 种子伙伴申请页（`/seed`）和培训页（`/training`）预约表单的输入框与联系页同款：白底细边线，聚焦时余烬色边框加淡光晕；出错的输入框边框转警示色。
- 培训页（`/training`，中英文）预约表单的「服务」是两张单选卡片，名称一行、价格一行，手机上也完整显示，不再被下拉框截断。
- 联系页改为「左边选、右边填」：来意选项在左栏，表单是一块浅底面板，培训收成左栏底部一行链接；右上角有缓慢闪烁的像素方格背景。
- 首页记忆插图和对比页里的 `goal.md` 换成由看板维护的 `project.md`；首次运行改为回答两个问题。
- 首页 Loop 第 6 步改为「让 Agent 替你打理看板」：插图按「配置 → 看板」现行三组（你发起 / 定期运行 / 随事件运行）画七个助手，不再有开关。
- The landing and comparison pages are also in `/zh`, `/es`, `/ja`, `/fr`; no browser-language
  redirect, and Markdown mirrors stay English.
- Positioning is "you steer, AI leads the team": an AI project manager runs your agents and
  reports only what you need; wording limits in `positioning.md`.
- The landing page's only way in is the app download; `/index.md` and `/llms.txt` mirror it.
- `/vs-task-master`, `/vs-linear`, `/vs-vibe-kanban` and `/vs-hermes-kanban` say where the
  other tool is ahead and who should pick which.
- [/cloud](https://ai4kanban.dev/cloud) says what Cloud is, what the relay carries and what
  stays on the machine.
- [/privacy](https://ai4kanban.dev/privacy) and [/terms](https://ai4kanban.dev/terms) are
  English-only, name NULLREACH LTD as operator and the China company as training seller, and
  cover Pro: Creem as merchant of record, auto-renewal, 14-day refund, credits reset monthly.
- [/training](https://ai4kanban.dev/training) sells one-to-one guidance with booking on the
  page ($99 a session, $349 a month for four); English and Chinese only.
- [/pricing](https://ai4kanban.dev/pricing) lists Free, Pro (monthly or yearly, straight to
  checkout), the seed-partner application, done-for-you agents ($15 per agent, opens `/contact`
  with it preselected) and training; English and Chinese only. In English, "custom" means what
  users build themselves (Free) and "done-for-you" means agents we build.
- [/seed](https://ai4kanban.dev/seed) takes seed-partner applications (email, GitHub username,
  planned use), reviewed and answered by hand; English and Chinese only.
- `/contact` is one form for support and done-for-you agents at $15 per agent.
- The built-in demo video workflow is called "Product video" everywhere.

## docs

- `project.md` 的说明改为「what the project is」：`web/content/docs/daily-loop.mdx`、Kanban for Claude Code 和 Kanban for Codex 两页的记忆文件表格。
- 看板描述文件改名为 `docs/kanban/memory/project.md`、助手改名为 Describe the project：`web/content/docs/agents.mdx`、`daily-loop.mdx`、`chat.mdx`。
- 周期任务卡并入定期运行的 agent、停用时也能立即运行：`web/content/docs/agents.mdx` 的「Run an agent on a schedule」；`triage.mdx`、`daily-loop.mdx` 里周期任务卡的说法已去掉。
- 待筛选接口的条目可带可选的 `slug`，它是条目的文件名，也是之后卡片的文件名：`web/content/docs/triage-endpoint.mdx`。
- 「What makes a good goal」页已删，旧地址重定向到文档首页；方向如何确定见 `web/content/docs/daily-loop.mdx`，助手见 `web/content/docs/agents.mdx`。
- 用户文档精简为只讲能做什么、怎么用、什么能设置及在哪设置，删去内部机制和默认数值（`agents.mdx` 332 → 111 行）：`web/content/docs/`。
- Both READMEs are app-first: download first, `akb` second, the skill optional:
  `README.md`, `README-zh.md`.
- One page per topic under `web/content/docs/`; commands stay in `akb --help`.
- Coding agents, what each needs and may touch, and their settings:
  `web/content/docs/connectors.mdx`.
- 被否决或丢弃的卡移入归档并带 **Rejected** 标记，仍可阅读，不计入已交付；否决原因原样留在卡上并随看板同步，原因留空即丢弃：`web/content/docs/daily-loop.mdx`。
- QA 手册在哪、每遍定期运行做什么、走不通的场景去哪、如何改周期或停用：`web/content/docs/daily-loop.mdx`。
- 让 Agent 按周期运行（怎么设周期、何时提交、失败后怎样）：`web/content/docs/agents.mdx` 的「Run an agent on a schedule」。
- 用户文档新增 [Sub-runs](/docs/runs#sub-runs)，自建 agent 一节提到可用 `akb run start` 分工，QA 手册一节说明按模块并行。
- 「The QA manual」一节改叫「Test cases」，并说明可在看板界面里读，旧锚点 `#the-qa-manual` 仍可跳转：`web/content/docs/daily-loop.mdx`；`agents.mdx`、Kanban for Grill Me 页同步改名。
- 文档 `daily-loop` 里的卡片按钮改称 **Build**。
- 官网文档撤下 Triage 接口接入说明：`/docs/triage-endpoint` 已删并 301 到 `/docs/triage`，`triage.mdx` 只讲 Proposer、构建与规划中的后续事项和 `akb triage add`；`akb triage fetch` 和接口设置本身未改。

## marketing

- Marketing work is an ordinary card on the default workflow; its delivery is the file in
  the repo.
- [awesome-agent-kanban](https://github.com/neverchanje/awesome-agent-kanban) is a public CC0
  directory of agent task tools, AI4Kanban listed on the same criteria as the rest.
- Free shared video assets (music, UI sounds, paper backgrounds, CC0) on
  `cdn.ai4kanban.dev/video/`: `assets/video/README.md`.
- Email changes are written by `email-planner` on a Coding card; the Email workflow is gone:
  `scripts/email/README.md`.
- The "see it first, then build it" product video exists in English and Chinese, 16:9, for
  YouTube and Xiaohongshu: animation-led, with short real-app clips as evidence.

## cloud

- GitHub sign-in, invites, Slack and Lark: `cloud/README.md`.
- Notifications: a board's card reaching `ready` or raising a user-only question becomes a
  Cloud event, deleted 30 days after it ends; one event takes one action.
- A failed notification retries with backoff for about four hours, then marks the board out
  of step; a retry about an already-handled card is dropped.
- Workspaces, moving boards either way, and the read-only workspace URL:
  `web/content/docs/local-and-cloud-boards.mdx`.
- One writer holds a card or the board at a time on a half-hour lease; a stale write is
  refused as a conflict.
- Cloud reports runtime names only, never keys, arguments or paths.
- Cloud takes the [/training](https://ai4kanban.dev/training) bookings.
- The bell reads only open events when the app starts; the Landed tab loads its history from
  Cloud a page at a time.
- Free-tier limits: `cloud/README.md`.
- Pro is sold monthly or yearly through Creem to any GitHub sign-in, managed at
  `cloud.ai4kanban.dev/settings`.
- Accepted seed partners get six months of Pro on their GitHub handle (`npm run seed`), one grant
  per handle and no charge afterwards; the end date shows in Configuration → Billing and
  `/settings`, and they can still subscribe.
- Pro gets 5,000 AI credits each UTC month for hosted capabilities, shown with the reset date
  in Configuration → Billing.
- Pro payments are non-refundable unless the law requires it; a refund or chargeback, even
  partial, ends Pro and its credits at once, and Billing shows free from that day.
- A payment whose Creem notification is lost still becomes Pro: within 24 hours of starting the
  checkout, opening Billing, pressing Upgrade again or using a Pro workflow records it, and
  never opens a second checkout; after 24 hours it needs a manual fix.
- The invite approval email says Cloud is an alpha, free for invited users, pricing may change.
- Cloud 看板的归档卡片同样在归档满 30 天后删除，而且是从 Cloud 里真正删掉、无法找回（没有 git 历史这层备份），想留就先导出，卡片名下已结束的交付记录一并删除；由打开着看板的电脑每天清理一次：`web/content/docs/local-and-cloud-boards.mdx`。
- `npm run check:live` in `cloud/` lists the migrations and Worker commits on `main` that are
  not live; a daily `deploy-check` agent puts a triage item when Cloud or Telemetry is behind.

## telemetry

- Anonymous usage reporting, on by default and disclosed once: `akb telemetry status|on|off`,
  `web/content/docs/local-and-cloud-boards.mdx`.
- A public route serves the install count for the README badge.
- Feedback never requires a task; sharing its conversation is one switch, off by default.
- `npm run numbers:web` shows what Cloud's hosted AI calls cost, per capability and per user,
  from 2026-10-02, the day `cloud.ai_calls` went live; it reads Cloud's credentials from
  `cloud/.env` when `telemetry/.env` has none: `telemetry/README.md`.
- `npm run numbers` shows how many custom agents are switched on, on how many installs and
  boards, and how many runs they started, finished and failed; the privacy page lists both.
- `npm run numbers` and the usage dashboard show a Runs section: runs by tool and by model,
  cost and cost per run per model, and installs by daily cost. Finished and failed runs carry
  the model (`custom` for an own endpoint or an unlisted model) and the estimated cost; the
  privacy page lists both. Deploy telemetry before shipping the sender.
- `npm run numbers`' Board numbers section is filled: a board with reporting on sends its cards
  created (asked/proposed), completed and rejected, questions closed (board/user/verify),
  decisions stood and overruled, and releases closed, once a day, as the privacy page says.
- `npm run check:live` in `telemetry/` lists the migrations and Worker commits on `main` that are
  not live; `/health` names the deployed commit: `telemetry/README.md`.
- Chat turns count toward cost too: a chat message is reported once its reply ends, with that
  turn's model (`custom` on the same rule as a run) and estimated cost. `npm run numbers` and the
  dashboard show chat as one `(chat)` row beside the run models, and its cost counts toward
  installs by daily cost; the privacy page says so. Deploy telemetry before shipping the sender.
