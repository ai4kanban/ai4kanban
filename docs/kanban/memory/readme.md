# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

- **Board, setup, update**: `akb guide board`, `akb guide setup`, `akb guide update`.
- **draft-first**: a standalone skill that has any coding agent draft a task's key parts for review in the browser before building; lives in its own repo, [ai4kanban/draft-first](https://github.com/ai4kanban/draft-first).
- **Blog drafts**: a delivered blog post lives only in its article file, linked by one Article asset on the card; going back to the outline unticks the dropped stage's todos instead of appending cleanup ones: `akb guide multi-stage-drafting`.
- **draft-first long drafts**: a draft over about 20 lines goes in a `.md` asset the review page draws as Markdown, so headings inside it no longer count as alternatives that block Confirm; the prompt helper asks for diffs, not sample outputs: `SKILL.md` in [ai4kanban/draft-first](https://github.com/ai4kanban/draft-first).
- **Daily loop** — refine, build, finish, reject or discard, test cases; planning never builds; only Coding gets a branch and worktree: `web/content/docs/daily-loop.mdx`, `akb guide implement`.
- **Refine, next card, module map**: `akb guide refine`, `akb guide next-card`, `akb guide module-map`.
- **Competitor research**: a card that only names competitors gets a whole-product comparison and adds them to the competitors memory; feature planning compares but never adds new competitors — the list is yours. Such a card is not built; read it and archive it.
- **Start now** builds a sentence, a plan or a triage item, writing its card as it starts: `akb guide implement`.
- **Long drafts**: a planning agent's draft over about 20 lines goes in a card asset, one `<name>.<lang>.md` per language, leaving the card body to the summary and the open questions: `akb guide spec-agent`.
- **Copy drafts**: the copywriting agent writes one `copy.<lang>.md` per published language, with labels and field names in that language, shown on the card as one `<Asset>` with language variants.
- **Reject while the card chat replies**: `akb card reject` works mid-reply; the reply stops and the conversation is dropped with the card.
- **Runs** — `akb` commands, stop, retry, resume, creation resume/discard, sub-runs, stopping what a run started, the planner following the Planning helper's runtime: `web/content/docs/runs.mdx`.
- **Background tasks**: Claude Code runs and chats wait up to 2 hours on background work: `web/content/docs/connectors.mdx`.
- **Several boards per repository**: `web/content/docs/index.mdx`.
- **Triage**: `web/content/docs/triage.mdx`; follow-ups: `akb guide follow-up`.
- **Dependencies**: `akb guide add-task`.
- **Agents, workflows, specialists, Pro, rules, global memories, schedules, memory review, project description**: `web/content/docs/agents.mdx`, `akb guide describe-project`.
- **Specialist drafts approved stage by stage**: `akb guide multi-stage-drafting`.
- **Writing an agent**: `akb guide write-agent`.
- **Agent sections**: `akb guide writing`.
- **Suggest follow-up work**: `akb guide reflect`.
- **One planning session**: creating, refining, revising and answering a card stay in one session, each turn ends ready or with questions, and spec agents run inside it; only the build opens a new one: `akb guide refine`, `akb guide resolve`.
- **Discussions** never edit code, judge the idea first and end in **Plan tasks** or **Start now**: `akb guide discuss-idea`, `web/content/docs/chat.mdx`.
- **Card chat** makes a settled change without asking again: `web/content/docs/chat.mdx`.
- **Asset labels**: images keep `<Asset>` labels to a few words; the caption goes in `alt` and illustrators draw it on the image.
- **Copy drafts** read as the reader sees them — new text, ~~old~~ → new, or `Field: new value` — not a source diff.
- **Software planner** belongs to Coding like other workflows' leads; a plan lead with nothing to show writes no `## By` section, and it draws a top-down mermaid diagram only when a sentence or two cannot explain a change no other spec agent covers.
- **`akb` 无参数**: 执行 `akb` 或 `akb raw` 打印命令列表并以 0 退出，与 `--help` 相同。
- **后台命令**: 运行正常结束时后台命令也结束，对话回复正常结束时保留；退出桌面应用会结束正在回复的对话和 Agent 测试；Windows 上 `taskkill` 失败也会结束。
- **规划续用会话**: 一张卡的规划接着同一个会话走（从建卡会话分出，回答问题后续用上次规划的会话）；换了工具、工具不支持或会话已不存在时新开。讨论或终端里建的卡，卡片对话接上建卡时的会话。
- **直接提的需求**: 照你说的建卡，不再查重。
- **自动分拣**: 只问要不要你定、是否免规划，再定模块、优先级、ROI 和工作流；除非留给你或没有工作流能做，一律建卡。它建的卡在第一次规划（免规划的在开工）时先对照代码，已做到或已不存在的带依据归档。
- **待筛选 slug**: 条目文件名是英文 slug（`akb triage add --slug` 可指定），建出的卡沿用它。
- **卡片来源**: 记在 frontmatter `source:`（`akb raw create --source`、`--triage <source-id>`，`raw update --source` / `--add-source`），卡片页显示为「来源」链接；旧卡的 `## Source` 照样认。
- **依赖成环**: 组内卡片不能（直接或间接）依赖它所在的组或上层组：`akb raw update` 拒绝，`akb raw validate` 报 `dependency-cycle` 并写出完整环路径。
- **否决与丢弃**: 当场完成，不计入交付：`web/content/docs/daily-loop.mdx`。
- **清理**: 离开看板 7 天的卡每天清掉附件、旧 mockup、对话和已结束的交付工作区（记忆或未关闭卡引用的附件保留）；归档的卡满 30 天删除。
- **`akb raw list`**: `--archived` 列出看板落地并归档的卡（可加 `--since`、`--workflow`、`--json`）；`--stale` 列出搁置的卡，看板不会自动改写或丢弃它们。
- **Copy & docs**: `copywriting` writes all copy outside the product's screens, user docs included; `ui-designer` writes its mockups' text; `illustrator` makes every image except screen mockups, shown on the card as the image alone with optional `alt`; copy whose wording needs your call is a draft you confirm before `ui-designer` places it.
- **Old agent keys** (`stage`, `kind`, `lead: true`, `hook: execute`) are refused with the line to change; there are no post-execute hooks.
- **负责人被拒用**: 开始卡片的报错和 `akb workflow list` 用一句话说明是哪个负责人、为什么、改哪一行。
- **`akb raw agent-file <agent> AGENT.md`** 打印任何 agent（含内建）的规则文件。
- **AGENT.md 行尾注释**: 像 YAML 一样忽略；值里要 `#` 时加引号。
- **`akb workflow stage <id> --stage <stage> --on|--off <agent>`** switches one of a workflow's agents; `akb workflow duplicate` copies every agent.
- **记忆审阅**: 没审过的对话在本机最久留 30 天；被拒绝或丢弃的卡不审，讨论也不审。
- **建议后续任务**: 每轮至多 10 张、跨卡去重；「小改动」可选先问我（默认，进待筛选）、直接做完、不提。
- **定时 Agent** 只看有没有新输入：待筛选里还有它上一轮放进的条目，也照常运行。
- **自动细化**: 看板界面开着时，写过或改过的卡会自动细化一次；失败不重试，规则生效前的旧卡要手动细化。等你回答的卡执行 `akb card refine` 会说明在等回答。
- **依赖落地后修订**: 依赖卡归档或被拒时，等它的卡自动排上一次修订（`akb raw schedule --action revise`）核对计划；已排了构建的把说明附进那次构建，构建或交付中的不受影响。
- **Planning questions** are written for someone who has not seen the board — no card ids, agent names or board terms.
- **Planning QA** checks the facts a plan turns on against authoritative sources, and revises or stays open when it cannot settle one.
- **Start now from a discussion** builds with its context; the discussion stays unchanged.
- **Several plans per discussion**: **Plan tasks** hands them to one planning run, an unused plan returns to the discussion, and `akb raw plan drop` withdraws one.
- **Workflow choice**: a new card picks its workflow by the work it delivers, falling back to the board default; `akb create --workflow <id>` sets it.
- **`akb cloud image` / `akb cloud tts`** generate an image or narration on Pro credits; every agent can call them.
- **Review todos**: video, slide deck, carousel and blog cards track each review as a todo ticked by a `[user]` answer; a change that makes a ticked todo stale adds a new one, and Archive is offered once all are ticked.
- **Video script**: the first review is story, shots and exact lines; capture details and timing come after approval, and changing approved content reopens it. A retake restores and checks the shot's starting state first.
- **Blog outline** shows the keyword-bearing title, section plan, SEO title and meta description; with a primary keyword, the planner reads the top-ranking pages first and builds around one to three points the post adds, keeping the research off the card.
- **素材来源**: 剪辑、封面和脚本只用自制或生成的、仓库里的和开源许可的素材，其余（含平台标志）先提问；封面的模型和提示词与源文件放在一起。
- **email-planner** covers any email, newsletters included; one with its own format and send script is written in that format, not TSX.
- **prompt-writer** edits a prompt only where its agent lacks a needed instruction, within the prompts the card names; app-controlled mechanics never become agent duties.
- **Codex** runs without approvals or sandbox; your own `command` wins: `kanban-ui/README.md`.
- **Codex 回退**: PATH 上的 `codex` 起不来时（含 ChatGPT.app 26.928 起的新位置），改用 ChatGPT 里的那份，运行日志说明一句。
- **看板设置每人本机一份**: `.akb/boards/<board>/ui.config.json`，不进 git、不上传 Cloud；旧的 `docs/kanban/ui.config.json` 首次读取时自动迁移。
- **Spec 小节**: 所有 spec agent 的小节写在卡片分界线上方供你审阅；规划阶段的 lead agent 同样另写自己的小节。
- **Competitor analysis** shares the `competitors` memory with `competitor-research`, and re-reads a competitor once its `last_read` is over three months old.
- **动图**: 插图 Agent 默认交静音循环的 H.264 MP4 加首帧封面（`<Asset ... loop />`），GIF 只用于 README 等不能放视频的地方。
- **定时 agent 的收件箱条目**：某工作流的定时 agent（如 Coding 的质检员）报进收件箱的条目（包括它的子运行报出的），整理时直接建成该工作流的卡片，不再由判断另选工作流或因「没有工作流能做」而忽略。
- **版本已移除**: 看板不再有 release 命令、`--release`、`releases.md` 和更新日志；`akb update` 会删掉旧看板的 `releases.md` 和卡片的 `release` 字段，`.release-summaries/` 保留。

## local-ui

- **Desktop app** reopens the last repo, finds your coding agent, installs `akb` and updates in the background: `desktop/README.md`, `kanban-ui/README.md`. The browser board is deprecated: `akb guide local-ui`.
- **First run and Finish setup**: `kanban-ui/README.md`.
- **Stale column**: cards untouched for over 5 days (not building) move to a third column, oldest first, showing how many days they have sat; a group counts as touched while any of its subtasks is edited or building.
- **Markdown assets read as articles**: an `<Asset>` pointing at a `.md`/`.mdx` file shows the article on the card page, folded with Show full article, and in full on its own page; Source shows the file as written.
- **Asset versions**: one `<Asset>` can list versions of the same content (languages, devices) with `variants='{"<label>": "<src>", ...}'`; the caption shows the current version and a muted count as a quiet, borderless switch that opens a menu (`akb guide writing`). Every asset's caption copies the file's absolute path and opens it at full size from icons.
- **Reject during a chat reply**: the card page's Reject stays available while its chat is replying; the reply stops with the card.
- **Board, search, Insights, Memory, Archive, Test cases, New idea, Discuss, card buttons, Diff, run cost, resume**: `kanban-ui/README.md`, `web/content/docs/runs.mdx`.
- **Group build-order map**: a group shows the order its cards build in.
- **Phone**: a bottom tab bar (Board, More), one column at a time, card search on top.
- **Discussions**: the discussion stays hidden once planning or building starts; a conversation stays on the agent that opened it, and changing the helper's runtime affects only new ones; **End discussion** stops its agent and everything it started.
- **讨论载入失败**: 显示「讨论载入失败。」和「重试」；回复中途退出或崩溃的，重开后可「重新发送」。
- **Back and Forward** show a card as it is on disk; the desktop app re-reads every page when you switch back to its window.
- **重启保留界面状态**: 草稿、聊天栏开合与宽度、已庆祝的里程碑、已提示的运行提醒。
- **Revise** opens the card's chat with the first line typed.
- **Card assets** beyond the README's: slide decks with speaker notes, `.pptx` downloads, mockups labelled by device; an image's `alt` falls back to `label`.
- **分镜「全部下载」**: 轮播图、幻灯片、产品视频可下载为按页序命名的 zip；托管看板没有。
- **右键图片**: 右键（触屏长按）看板自己的图片可「复制图片」「下载图片」，沿用原文件名；外链图片保持浏览器原有右键。
- **Stopped-short runs** on a card nobody has dealt with stay visible on the card and in **Unfinished**; a failed run's log leads with the board's reason.
- **Notifications** load 30 at a time; counts still include everything.
- **Global memory** in Configuration: `web/content/docs/agents.mdx`; an agent's page lists the ones it uses and warns about a name that doesn't exist.
- **Workflows** explain themselves in the picker and `akb workflow list`; an unavailable one says why: `kanban-ui/README.md`.
- **Agents per workflow**: each agent belongs to one workflow; copying a workflow copies its agents, and copying an agent is the only way to change a built-in agent's instructions.
- **Workflow agents and schedules**: `web/content/docs/agents.mdx`.
- **Extra requirements**: a built-in helper's page has one box per workflow stage; an agent you added is told everything through its own `AGENT.md`.
- **Runtimes**: `web/content/docs/runs.mdx`, `web/content/docs/connectors.mdx`.
- **Cloud settings** retry on their own when Cloud is unreachable; storing a board in Cloud is offered only to team accounts.
- **Language** is per machine and applies without reload: `kanban-ui/README.md`; error messages follow it, raw diagnostics stay as they are.
- **Bell** carries every Cloud board's **To do** and **Landed**, and this board's stopped-short runs even without Cloud; bell and chat share one side rail.
- **Several boards**: `web/content/docs/index.mdx`; another board opens in a new window.
- **Pro**: **Upgrade to Pro** in Configuration → Billing; cards on Pro workflows read **Needs Pro** without it and start once Pro is active, and `akb` refuses them too.
- **Live sync**: signing in or out, buying Pro and editing workflows update every open screen at once.
- **功能导览**: 新用户设置完成后、老用户升级后首次打开时弹出一次，可从帮助菜单、「配置 → 通用」或 Cloud 设置页重看。
- **欢呼**: 一整组完成、当天第一个任务完成时；每件事每个浏览器一次，手机宽度不显示。
- **待筛选来源**: Agent 写入的条目来源显示为该 Agent 名，可按来源筛选。
- **循环视频**: `<Asset ... loop />` 静音循环、无控制条，进入视野播放、离开暂停；“减少动态效果”时停在首帧并显示播放按钮。
- **Mermaid**: a ```` ```mermaid ```` block on a card is drawn as a diagram; one that does not parse shows as written.
- **Mockup scripts**: `.tsx` and `.html` mockups run inline scripts with no network, so libraries are inlined; `ui-designer` and `illustrator` draw `.tsx` only and add script only when the motion needs it.
- **缩放**: 卡片里的 mockup、图片及其预览页可放大、缩小、适应宽度并显示比例，放大后在预览区域内滚动。
- **Focus**: a calm ink frame shows only on keyboard focus; text fields firm to an ink edge while typing, and an open dropdown keeps its frame with a flipped chevron.
- **归档排序**: 归档页标题行可切换「交付时间 / 创建时间」，都是最近的在前，默认按交付时间。
- **版本已移除**: 看板界面不再有版本选择器、筛选、徽章和建/关/放弃版本操作。

## site

- **Languages**: landing and comparison pages also in `/zh`, `/es`, `/ja`, `/fr`; no browser-language redirect, and Markdown mirrors stay English. The footer is fully translated in every language, even where its links lead to English-only pages. On desktop, the header names the visitor's preferred language when the page has a copy in it; one click opens it.
- **Positioning** is "you steer, AI leads the team"; wording limits in `positioning.md`.
- **Landing**: the only way in is the app download; `/index.md` and `/llms.txt` mirror it.
- **`/vs-multica`** argues ready specialist agents, drafts approved before execution and per-agent memory, each with what both share, then a table and a recommendation.
- **`/vs-task-master`, `/vs-hermes-kanban`** say where the other tool is ahead and who should pick which; Hermes's table is against v0.21.6 and grants chat-app control, stalled-task recovery and its API.
- **`/vs-orca`**: Orca suits people who keep control of execution details; AI4Kanban suits those who let agents lead the details while they set direction.
- **`/workflows/coding`** (five languages, mirror at `/workflows/coding.md`) explains the coding workflow with demo-board captures and a measured cost of 1.07–2.08× direct Claude Code.
- **Removed pages**: the GitHub Issues, Linear and Vibe Kanban comparisons redirect to each language's home; `/recipes` redirects to `/docs/agents`. The DeepSeek Harness blog post redirects to `/blog`.
- **[/cloud](https://ai4kanban.dev/cloud)** says what Cloud is, what the relay carries and what stays on the machine.
- **[/privacy](https://ai4kanban.dev/privacy), [/terms](https://ai4kanban.dev/terms)**: English only; NULLREACH LTD as operator, the China company as training seller; cover Pro (Creem as merchant of record, auto-renewal, 14-day refund, monthly credit reset).
- **[/training](https://ai4kanban.dev/training)** sells one-to-one guidance with booking on the page ($99 a session, $349 a month for four); English and Chinese only.
- **[/pricing](https://ai4kanban.dev/pricing)** lists Free, Pro (monthly or yearly), seed partners, done-for-you agents ($15 per agent, via `/contact`) and training; English and Chinese only. "Custom" means agents users build; "done-for-you" means agents we build.
- **[/seed](https://ai4kanban.dev/seed)** takes seed-partner applications (email, GitHub username, planned use), answered by hand; English and Chinese only.
- **`/contact`** is one form for support and done-for-you agents.
- **Product video** is the demo video workflow's name everywhere.
- **Blog covers**: `featured_cover: <name>` uses an SVG component from `web/components/blog/covers/`, which may animate and holds still under reduced motion. Every post has its own headline-and-contrast cover; none reuse the board screenshot.
- **`/blog`** is a grid with the newest featured, filtered by topic tabs (`?topic=<slug>`); feed at `/blog/rss.xml`.
- **Navigation**: header has Docs, Pricing, a Resources menu (Blog, Training), GitHub and Download; comparisons and the language switcher live in the footer (in the menu on a phone); the footer's "For coding" opens `/workflows/coding` in the reader's language.
- **官网动图**: 用 `web/components/LoopVideo.tsx`，静音循环 MP4 加封面，接近视野才加载播放；减少动态效果或拒绝自动播放时停在封面并显示播放控件。
- **[/builder](https://ai4kanban.dev/builder)** is Tao's founder letter (English only) on moving from AI running the project to people reviewing key drafts first; `/builder.md` and `llms.txt` tell the same story, and blog and agent posts are signed "Founder of AI4Kanban".
- **`/draft-first`** (all five languages) is the draft-first skill's page: install command, the four draft kinds, delete/note/confirm, adding a drafting agent, and the AI4Kanban upgrade; linked from the footer's Solutions, two blog posts and the skill README, not the header; the hero links to the skill's GitHub repo.
- **[Draft-first development](https://ai4kanban.dev/blog/draft-first-development)**: blog post on reviewing drafts of key screens, copy and prompts before the build; `/draft-first` links to it.

## docs

- **READMEs** are app-first and lead with draft review: `README.md`, `README-zh.md`.
- **Docs pages**: one per topic under `web/content/docs/`, saying only what you can do, how, and where to set it; commands stay in `akb --help`.
- **Coding agents**: `web/content/docs/connectors.mdx`.
- **Redirects**: `/docs/triage-endpoint` goes to `/docs/triage`; the old "What makes a good goal" page goes to the docs home.
- **版本页已删**: `/docs/releases` 不再存在，其他文档也不再提版本。

## marketing

- **Marketing work** is an ordinary card on the default workflow; its delivery is the file in the repo.
- **[awesome-agent-kanban](https://github.com/neverchanje/awesome-agent-kanban)** is a public CC0 directory of agent task tools, AI4Kanban listed on the same criteria as the rest.
- **Video assets**: free shared music, UI sounds and paper backgrounds (CC0) are on `cdn.ai4kanban.dev/video/`.
- **Shipped pieces**: the "see it first, then build it" product video (English and Chinese, 16:9); an 8-page Chinese Xiaohongshu carousel, "review the UI, not the wall of text"; the blog post "[Visual specs for AI coding](https://ai4kanban.dev/blog/show-the-ui-first)"; the 0.10.0 newsletter, "Build sooner. Catch gaps." (`node scripts/newsletter-send.mjs --issue 2026-10-07`).

## cloud

- **Sign-in, invites, seed-partner grants, free-tier limits, write leases**: `cloud/README.md`.
- **Workspaces, moving boards, members and roles, the read-only browser view, invite-only preview**: `web/content/docs/local-and-cloud-boards.mdx`; Cloud is free for invited users and pricing may change.
- **Notifications**: a card reaching `ready` or raising a user-only question becomes a Cloud event, kept 30 days after it ends; one event takes one action; a failed send retries for about four hours, then marks the board out of step.
- **Runtime privacy**: Cloud reports runtime names only, never keys, arguments or paths.
- **Pro** is sold monthly or yearly through Creem to any GitHub sign-in, managed at `cloud.ai4kanban.dev/settings`, with 5,000 AI credits each UTC month shown with the reset date in Billing.
- **Seed partners** get six months of Pro on their GitHub handle, once per handle, with no charge afterwards; the end date shows in Billing.
- **Refunds**: none unless the law requires; a refund or chargeback ends Pro and its credits at once.
- **Stale column** on the hosted board judges a group by its subtasks, the same as the desktop app.
- **Lost payment notification**: a payment still becomes Pro if Billing, Upgrade or a Pro workflow is used within 24 hours of checkout, never opening a second checkout.
- **通知只剩开关**: 开启后看板上所有卡片的待决事项都会通知，不再按版本筛选。

## telemetry

- **Anonymous usage reporting**: `web/content/docs/local-and-cloud-boards.mdx`, `akb telemetry status|on|off`.
- **Feedback** never requires a task; sharing its conversation is one switch, off by default.
