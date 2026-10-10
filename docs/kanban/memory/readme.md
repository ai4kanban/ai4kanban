# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

- Board layout, group tasks, card frontmatter, the board's language and memory ownership (planner memory split per module): `akb guide board`.
- Setup: `akb guide setup`.
- Updating an installed board: `akb guide update`.
- The daily loop — refine, build, finish, reject or discard, test cases: `web/content/docs/daily-loop.mdx`.
- Planning never builds: refine and resolve end with the card ready or open questions for you, and the build is always its own session: `web/content/docs/daily-loop.mdx`.
- Refining, picking the next card, and splitting a module: `akb guide refine`, `akb guide next-card`, `akb guide module-map`.
- Build carries a card from build to landed and archived, holding only on open questions; there is no AI review: `akb guide implement`, `web/content/docs/daily-loop.mdx`.
- **Start now** builds a sentence, a plan or a triage item, writing its card as it starts: `akb guide implement`.
- Only the Coding workflow gets a branch and worktree; other workflows run in the project directory without committing, several cards at once, and a custom workflow toggles it under Advanced settings: `web/content/docs/daily-loop.mdx`.
- Every board move and run is an `akb` command on any board, with `--json` and `--print`; a run outlives its command: `web/content/docs/runs.mdx`.
- One repository can hold several boards (`--board`, `AI4KANBAN_BOARD`): `web/content/docs/index.mdx`.
- 不带参数执行 `akb` 或 `akb raw` 打印命令列表并以 0 退出，与 `--help` 相同。
- Stop, retry, resume (also on another connector after one is removed) and creation resume/discard: `web/content/docs/runs.mdx`.
- 停止运行、静默超时、卡片被接管或停止对话回复时，Agent 启动的命令（含后台的）一并结束：`web/content/docs/runs.mdx`。运行正常结束时后台命令也结束，对话回复正常结束时保留；退出桌面应用会结束正在回复的对话和 Agent 测试；Windows 上 `taskkill` 失败也会结束。
- Claude Code 的运行和对话在后台任务进行时不被沉默上限结束，最长等 2 小时：`web/content/docs/connectors.mdx`。
- Sub-runs (`akb run start`, `akb run wait`): `web/content/docs/runs.mdx`.
- Planning leads all run on the Planning helper's (`discussion-helper`) runtime, so planning continues the discussion's session; `akb agent bind` refuses a planning lead: `web/content/docs/runs.mdx`.
- 一张卡的规划接着同一个会话走（从建卡会话分出，回答问题后续用上次规划的会话）；换了工具、工具不支持或会话已不存在时新开。在讨论或终端里建的卡，卡片对话接上建卡时的会话。
- Triage — follow-ups from builds and plans, the Proposer, `akb triage add`, Make card / Start now / Discuss / Ignore, history and restore, auto-sort (Pro only) — open to every account: `web/content/docs/triage.mdx`.
- 构建和规划中发现的跟进进待筛选而不直接建卡；只改另一张未完成卡的，改为修订那张卡：`akb guide follow-up`。你直接提的需求照你说的建卡，不再查重。
- 自动分拣只问要不要你定、是否免规划，再定模块、优先级、ROI 和工作流；除非留给你或没有工作流能做，一律建卡，不合适的在看板上否决。它建的卡在第一次规划（免规划的在开工）时先对照代码，已做到或已不存在的直接带依据归档。
- 待筛选条目文件名是英文 slug（`akb triage add --slug` 可指定），建出的卡沿用它。
- 卡片来源记在 frontmatter `source:`（`akb raw create --source <计划 | plan:<id> | #<id> | 网址>`、`--triage <source-id>`，`raw update --source` / `--add-source`），卡片页显示为「来源」链接；旧卡的 `## Source` 照样认。
- Dependencies are recorded on the waiting card (`--blocked-by`, `akb raw update --add-blocked-by` / `--add-related`, appended and de-duplicated): `akb guide add-task`.
- 组内卡片不能（直接或间接）依赖它所在的组或上层组：`akb raw update` 拒绝，`akb raw validate` 报 `dependency-cycle` 并写出完整环路径。
- `akb card reject <id> <原因>` 和丢弃当场完成；被否决或丢弃的卡移进归档、带 **Rejected** 和原文原因，不计入交付，持久的原因进 `rejected.md`：`web/content/docs/daily-loop.mdx`。
- 离开看板 7 天的卡每天清掉附件、旧 mockup、对话和已结束的交付工作区（记忆或未关闭卡引用的附件保留）；归档的卡满 30 天删除，仍属于未关闭版本的留到版本关闭。
- `akb raw list --archived` 列出由看板落地并归档的卡（id、标题、工作流、落地时间与提交），可加 `--since`、`--workflow`、`--json`；`akb raw list --stale` 列出搁置的卡，看板不会自动改写或丢弃它们。
- `memory/project.md` describes the project from its users' side, rewritten by **Describe the project** when cards were archived since its last run; planning, triage and releases read it: `akb guide describe-project`, `web/content/docs/agents.mdx`.
- Built-in agents, workflows and specialists (Coding, Product video, Slide deck, Carousel post, Blog post, `illustrator`, `competitor-research`, `demo-rehearser` and the rest), which need Pro, agent memory and rules, and adding your own: `web/content/docs/agents.mdx`.
- `copywriting` (Copy & docs) writes all copy outside the product's screens, user docs included (`user-docs` folded into it with its rule, memory and assignments); `ui-designer` writes the text in its mockups; `illustrator` makes every image a card needs except screen mockups — diagrams, GIFs, icons, share cards, and real screenshots, each shown on the card as the image alone with optional `alt` text. Agents with drafts to approve share `akb guide multi-stage-drafting`; when the wording still needs your call, the copy is a draft you confirm before `ui-designer` turns it into the final page; `illustrator`'s images are likewise a draft you confirm, then placed as they are by the agent that follows it, or kept as the final draft when none does: `web/content/docs/agents.mdx`.
- Board helpers are always on, grouped as You start / On a schedule / On an event; scheduled agents (board-level and per workflow) run on **Auto**, a cadence or **Run now**, and replace the old recurring cards: `web/content/docs/agents.mdx`.
- Writing an agent — the one `akb:` role key (`lead: plan|execute`, `hook: plan|schedule`), `reads:`, no settings of its own: `akb guide write-agent`. Old keys (`stage`, `kind`, `lead: true`, `hook: execute`) are refused with the line to change; there are no post-execute hooks.
- 工作流负责人被拒用时，开始卡片的报错和 `akb workflow list` 用一句话说明是哪个负责人、为什么、改哪一行。
- `akb raw agent-file <agent> AGENT.md` 打印任何 agent（含内建）的规则文件。
- AGENT.md 的值后可写行尾注释，像 YAML 一样忽略；值里要 `#` 时加引号。
- `akb workflow stage <id> --stage <stage> --on|--off <agent>` switches one of a workflow's agents; `akb workflow duplicate` copies every agent into the new workflow.
- 记忆审阅在卡片归档后读一次它的对话，纠正写进对应 agent 的记忆：`web/content/docs/agents.mdx`。没审过的对话在本机最久留 30 天；被拒绝或丢弃的卡不审，讨论也不审。
- 回答问题和修订在改动某个 agent 负责的 section 前先读它的 AGENT.md：`akb guide writing` 的 "Agent sections"。卡片 agent 半区只写别处没有的内容：`akb guide writing`。
- 「建议后续任务」按批回顾已完成的卡（每轮至多 10 张、跨卡去重），对照讨论、交付、过去漏提的和拒绝记录，不提定时 Agent 自己会做的工作：`akb guide reflect`。
- 「建议后续任务」的「小改动」设置：先问我（默认，进待筛选）、直接做完（直接建卡开做）、不提（只写在报告里）。
- 定时 Agent（「建议后续任务」、工作流的定时 Agent）只看有没有新输入：待筛选里还有它上一轮放进的条目，也照常运行。
- 看板界面开着时，写过或改过的卡会自动细化一次；失败不重试，规则生效前的旧卡要手动细化。等你回答的卡执行 `akb card refine` 会说明在等回答。
- Planning questions are written for someone who has not seen the board — no card ids, agent names or board terms.
- Standard planning QA checks the facts a plan turns on against authoritative sources, and revises or stays open when it cannot settle one.
- A discussion never edits code: it judges the idea first (outcome versus means, worth doing), may disagree or ask for evidence, and ends in **Plan tasks** or **Start now**; a plain question gets an answer, and asking a card's chat to build starts the build unless questions are open: `web/content/docs/chat.mdx`.
- **Start now** from a discussion builds with the discussion's context; the discussion stays unchanged.
- One discussion can hold several plans; **Plan tasks** hands them to one planning run, an unused plan returns to the discussion, and `akb raw plan drop` withdraws one.
- A new card picks its workflow by the work it will deliver, falling back to the board default; `akb create --workflow <id>` sets it.
- Card chat makes a settled change without asking again; a pure question only gets an answer, and work the card does not cover becomes a new card: `web/content/docs/chat.mdx`.
- `akb cloud image` and `akb cloud tts` generate an image or hosted-voice narration on Pro credits; every agent can call them (`akb cloud --help`).
- Video, slide deck, carousel and blog cards track each review as a todo, ticked when a `[user]` answer accepts it; a change that makes a ticked todo stale adds a new one, and Archive is offered once every todo is ticked.
- A video script's first review is the story, shots and exact lines; capture details and timing come after approval, and changing approved content reopens that review. A retake restores and checks the shot's starting state first.
- The blog planner's outline shows the keyword-bearing title, section plan, SEO title and meta description; keywords land only in sections they match.
- 剪辑、封面和脚本只用自制或生成的、仓库里的和开源许可的素材，其余（含平台标志）先提问；封面的模型和提示词与源文件放在一起。
- email-planner covers any email, newsletters included; one with its own format and send script is written in that format, not TSX: `scripts/email/README.md`.
- prompt-writer edits a prompt only where its agent lacks a needed instruction, within the prompts the card names; app-controlled mechanics never become agent duties.
- Codex runs with approvals and sandbox bypassed by default, works outside git, and a command you set yourself is left as is: `kanban-ui/README.md`.
- PATH 上的 `codex` 起不来时（包括 ChatGPT.app 26.928 起的新位置），运行、对话、连接测试和登录检查改用 ChatGPT 里的那份，运行日志说明一句。
- 看板设置（Agent、运行时、工作流等）每人本机一份，放在 `.akb/boards/<board>/ui.config.json`，不进 git、不上传 Cloud；旧的 `docs/kanban/ui.config.json` 首次读取时自动迁移。
- 所有 spec agent 的小节都写在卡片分界线上方供你审阅，Agent 页不再有「产出」设置；规划阶段的 lead agent 同样另写自己的小节。
- Global memories: folders under `docs/kanban/memory/<name>/` that agents opt into with `akb.memory`; built-in `competitors` ships first: `web/content/docs/agents.mdx`.
- The scheduled competitor analysis shares the `competitors` memory with `competitor-research`, and re-reads a competitor once its `last_read` is over three months old.
- 依赖卡归档或被拒时，还在等它的卡会自动排上一次「修订」（`akb raw schedule --action revise`），按依赖实际落地的内容或被拒的结果核对计划；已排了构建的卡则把说明附进那次构建，正在构建或交付中的卡不受影响。
- 插图 Agent 的动图默认交静音循环的 H.264 MP4 加首帧封面（卡片上用 `<Asset ... loop />`），GIF 只用于 README 等不能放视频的地方。
- Helper agents work in the card chat by default; one starts its own session only when it writes from scratch, the chat already ran another agent, or it is set to another runtime than the chat's: `akb guide refine`.

## local-ui

`kanban-ui/README.md` is this module's doc; a line naming no other doc is covered there.

- The desktop app reopens the last repo, finds your coding agent, installs `akb` and updates in the background: `desktop/README.md`. The browser board (`npx ai4kanban-ui`) is deprecated: `akb guide local-ui`.
- Setting a board up is a guided first run, and **Finish setup** runs the rest as one watchable, resumable run.
- The board, a **Queue** of ready and not-ready cards, search, a group's build-order map, **Insights** (cards and token cost), read-only **Memory** by owner, the **Archive** (rejected cards included, with their reason) and **Test cases**.
- On a phone: a bottom tab bar (Board, More), one column at a time, the card search on top; a tooltip stays until you tap elsewhere.
- The board page has one entry, **New idea**, for ideas, progress questions, and moving, changing, archiving, rejecting or starting cards; **Discuss** exists only on a card page.
- Planning from a discussion continues the same agent session; the discussion stays hidden once planning or building starts.
- A conversation stays on the agent that opened it; changing the helper's runtime affects only new conversations.
- Closing the discussion panel only hides it; drafts, images and in-flight replies stay, per discussion.
- 卡片对话展开「来自讨论」后，「关于这张卡片，想聊什么？」与输入框之间留有间距，不再贴着输入框。
- 讨论或方案读取失败时显示「讨论载入失败。」和「重试」；回复中途退出或崩溃的，重开后可「重新发送」。
- Returning to a card with Back or Forward shows it as it is on disk; the desktop app re-reads every page when you switch back to its window.
- 桌面应用重启后保留同一项目的界面状态（草稿、聊天栏开合与宽度、已庆祝的里程碑、已提示的运行提醒）。
- A card's **Revise** opens its chat with the first line typed.
- Card assets play in place: videos, audio, shot previews, storyboards, slide decks with speaker notes, `.pptx` downloads, and mockups labelled by device.
- An image `<Asset>` may carry `alt="..."`; the card page uses it as the image's alt text, falling back to `label`.
- 分镜（轮播图、幻灯片、产品视频）可「全部下载」为一个按页序命名的 zip；托管看板没有。
- 右键（触屏长按）看板自己的图片可「复制图片」「下载图片」，下载沿用原文件名；外链图片保持浏览器原有右键。
- A delivery's **Diff** shows what the agent has written so far; an archived card shows its landed commit's diff.
- A stopped-short run on a card nobody has dealt with stays visible on the card and in **Unfinished**; a failed run's log leads with the board's reason, and a run that cannot resume offers **Retry**: `web/content/docs/runs.mdx`.
- A run or chat turn's cost is its own, not the session's running total: `kanban-ui/README.md`.
- Notifications load 30 at a time; counts still include everything.
- **Configuration → Global memory** creates, edits and deletes global memories; an agent's page lists the ones it uses and warns about a name that doesn't exist.
- Built-in workflows explain themselves in the workflow picker and `akb workflow list`; an unavailable workflow says why.
- Each agent belongs to one workflow; copying a workflow copies its agents, and copying an agent is the only way to change a built-in agent's instructions.
- Configuration → Workflows lists each workflow's planning, execution, **Helpers** and **Scheduled** agents; a scheduled agent on **Auto** says what it is waiting for: `web/content/docs/agents.mdx`.
- A built-in helper's page has one **Extra requirements** box per workflow stage; an agent you added is told everything through its own `AGENT.md`.
- **Runtimes** is one list with **Global default** first; Codex and Claude Code default to their subscription login: `web/content/docs/runs.mdx`, `web/content/docs/connectors.mdx`.
- Configuration has separate **Cloud** and **Notifications** tabs, which retry on their own when Cloud is unreachable; storing a board in Cloud is offered only to team accounts.
- **Language** — English or 中文 — belongs to the machine and applies without reload; error messages follow it, with raw diagnostics left as they are.
- A bell carries every Cloud board's **To do** and **Landed**, and a stopped-short run of this board even without Cloud; bell and chat share one side rail.
- A project with several boards shows each board's folder and opens another in a new window.
- **Upgrade to Pro** buys monthly or yearly in Configuration → Billing; Pro workflows are locked without Pro (cards queued on them read **Needs Pro** and start once Pro is active), and `akb` refuses them too.
- Signing in or out, buying Pro and editing workflows update every open screen at once.
- 新用户设置完成后、老用户升级后首次打开时弹出一次「功能导览」，之后可从帮助菜单、「配置 → 通用」或 Cloud 设置页重看。
- 看板为三种时刻欢呼：一个版本全部完成、一整组完成、当天第一个任务完成；每件事每个浏览器一次，手机宽度不显示。
- 待筛选里由 Agent 写入的条目，来源显示为该 Agent 名，可按来源筛选。
- 卡片上 `<Asset ... loop />` 的视频静音循环、无控制条，进入视野播放、离开暂停；“减少动态效果”时停在首帧并显示播放按钮。

## site

- The landing and comparison pages are also in `/zh`, `/es`, `/ja`, `/fr`; no browser-language redirect, and Markdown mirrors stay English.
- Positioning is "you steer, AI leads the team": an AI project manager runs your agents and reports only what you need; wording limits in `positioning.md`.
- The landing page's only way in is the app download; `/index.md` and `/llms.txt` mirror it.
- `/vs-multica` argues three AI4Kanban wins (ready specialist agents, drafts approved before execution, per-agent memory), each with what both share, then a comparison table and a recommendation.
- `/vs-task-master` and `/vs-hermes-kanban` say where the other tool is ahead and who should pick which.
- `/vs-hermes-kanban` argues specialist workflows, draft review and settling requirements before agents build, then a row-by-row table against Hermes Agent v0.21.6 that grants Hermes chat-app control, stalled-task recovery and its API.
- The GitHub Issues, Linear and Vibe Kanban comparisons are gone; their old URLs, in every language, go to that language's home page.
- 官网没有 Recipes：`/recipes` 跳转到 `/docs/agents`。
- [/cloud](https://ai4kanban.dev/cloud) says what Cloud is, what the relay carries and what stays on the machine.
- [/privacy](https://ai4kanban.dev/privacy) and [/terms](https://ai4kanban.dev/terms) are English-only, name NULLREACH LTD as operator and the China company as training seller, and cover Pro: Creem as merchant of record, auto-renewal, 14-day refund, credits reset monthly.
- [/training](https://ai4kanban.dev/training) sells one-to-one guidance with booking on the page ($99 a session, $349 a month for four); English and Chinese only.
- [/pricing](https://ai4kanban.dev/pricing) lists Free, Pro (monthly or yearly), the seed-partner application, done-for-you agents ($15 per agent, via `/contact`) and training; English and Chinese only. "Custom" means what users build themselves; "done-for-you" means agents we build.
- [/seed](https://ai4kanban.dev/seed) takes seed-partner applications (email, GitHub username, planned use), answered by hand; English and Chinese only.
- `/contact` is one form for support and done-for-you agents.
- The built-in demo video workflow is called "Product video" everywhere.
- A blog post can take an SVG component from `web/components/blog/covers/` as its cover with `featured_cover: <name>` instead of `featured_image`; it may animate, and holds still under reduced motion.
- `/blog` is a grid of posts with the newest featured on top, filtered by topic tabs (`?topic=<slug>`); the feed is `/blog/rss.xml`.
- The training page no longer scrolls sideways on a phone; only the week grid scrolls inside its own frame.
- The site header shows Docs, Pricing and a Resources menu (Blog, Training) with GitHub and Download buttons; comparisons and the language switcher live in the footer, and on a phone the languages are in the menu.
- 官网动图用 `web/components/LoopVideo.tsx`：静音循环的 MP4 加封面，接近视野才加载和播放，离开暂停；“减少动态效果”或浏览器拒绝自动播放时停在封面并显示播放控件。

## docs

- Both READMEs are app-first: download first, `akb` second, the skill optional: `README.md`, `README-zh.md`.
- One page per topic under `web/content/docs/`, saying only what you can do, how, and where to set it; commands stay in `akb --help`.
- Coding agents, what each needs and may touch, and their settings: `web/content/docs/connectors.mdx`.
- `/docs/triage-endpoint` is gone and redirects to `/docs/triage`; the old "What makes a good goal" page redirects to the docs home.

## marketing

- Marketing work is an ordinary card on the default workflow; its delivery is the file in the repo.
- [awesome-agent-kanban](https://github.com/neverchanje/awesome-agent-kanban) is a public CC0 directory of agent task tools, AI4Kanban listed on the same criteria as the rest.
- Free shared video assets (music, UI sounds, paper backgrounds, CC0) are on `cdn.ai4kanban.dev/video/`.
- The "see it first, then build it" product video exists in English and Chinese, 16:9, for YouTube and Xiaohongshu.
- An 8-page Chinese Xiaohongshu carousel, "review the UI, not the wall of text", is ready to post (3:4, with caption).
- The blog post "[Visual specs for AI coding: show me before you build](https://ai4kanban.dev/blog/show-the-ui-first)" is live.
- The 0.10.0 newsletter issue, "Build sooner. Catch gaps.", is ready to send: `node scripts/newsletter-send.mjs --issue 2026-10-07`.
- `README.md` and `README-zh.md` both lead with draft review ("You review what matters. Agents do the rest."): planning is the new bottleneck, drafts come first, then the build; matching sections and bottleneck animations in each language. Slack notifications and onboarding sessions are no longer mentioned.

## cloud

- GitHub sign-in, invites, seed-partner grants and free-tier limits: `cloud/README.md`.
- Workspaces, moving boards either way, members and roles, the read-only browser view, and archived cards deleted for good after 30 days: `web/content/docs/local-and-cloud-boards.mdx`.
- Notifications: a card reaching `ready` or raising a user-only question becomes a Cloud event, kept 30 days after it ends; one event takes one action; a failed send retries for about four hours, then marks the board out of step.
- One writer holds a card or the board at a time on a half-hour lease; a stale write is refused as a conflict.
- Cloud reports runtime names only, never keys, arguments or paths.
- Pro is sold monthly or yearly through Creem to any GitHub sign-in, managed at `cloud.ai4kanban.dev/settings`; it carries 5,000 AI credits each UTC month, shown with the reset date in Configuration → Billing.
- Accepted seed partners get six months of Pro on their GitHub handle, once per handle, with no charge afterwards; the end date shows in Billing.
- Pro payments are non-refundable unless the law requires it; a refund or chargeback ends Pro and its credits at once.
- A payment whose Creem notification is lost still becomes Pro if Billing, Upgrade or a Pro workflow is used within 24 hours of checkout; it never opens a second checkout.
- Cloud is an invite-only alpha, free for invited users; pricing may change.

## telemetry

- Anonymous usage reporting, on by default and disclosed once: `akb telemetry status|on|off`, `web/content/docs/local-and-cloud-boards.mdx`.
- Feedback never requires a task; sharing its conversation is one switch, off by default.
