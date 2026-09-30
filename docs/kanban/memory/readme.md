# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

- `goal.md` 由 `docs/kanban/memory/product.md` 取代：看板助手「更新产品描述」（`akb describe-product`）每天检查一次，只在有新提交或还没有描述时从用户视角整篇重写；评估、分拣、规划发布和处理卡住的卡都读它。`akb update` 把写过的目标挪到 planner 的 `decisions.md` 顶部并删掉 `goal.md`，setup 不再有「目标」一步。
- 在卡片对话里把一件事拆成新卡、或建卡/修订卡片时出现依赖，等待的那张卡（包括已有的原卡）会记上 `blocked_by`，不再只在新卡上记一笔 `related`。
- AGENT.md 里可以在值后面写行尾注释（如 `stage: plan  # 它的阶段`），会像 YAML 一样被忽略；需要值里带 `#` 时给值加引号。
- 在讨论里写好方案后点「立即开始」，开发会带着这段讨论动手，聊天里说过、方案没写的细节不再丢失，讨论本身保持不变；所用连接器不支持时会自动改走「规划任务」。
- 在终端或 Skill 里建卡时，新卡片会按交付物落到对应的工作流（产品视频、演示文稿、博客等）；也可以用 `akb create --workflow <id>` 直接指定。
- 在讨论里直接说「建张卡」，或在终端让 Claude Code、Codex、OpenCode 建卡，新卡片的对话都会接上建卡时的那段会话，打开就能从原话接着聊。
- 开启“建议后续任务”后，它会对照卡片来源的讨论和实际交付，提出卡片声称却没有交付支撑的缺口；你指出它漏掉的后续任务，会在每日记忆整理后被记住，下次对照检查。
- A discussion never edits code: asking to create or build something makes its card on that
  turn (and starts the build when asked), an idea gets a short outcome plan for Plan tasks or
  Start now, and a plain question just gets an answer. Asking a card's chat to build it starts
  the build, unless the card still has open questions.
- A coding card takes one or two sessions: refine plans it in one session and builds it right
  after when nothing waits on you, and answering its questions builds it in the same session.
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
  prompt-writer, email-planner, reviewers, Sweeper, Triage, Memory pruner, Review chat memory,
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
- The daily loop, discarding, Just discard, and what a build leaves on `verify:`:
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
- **Build now** builds a sentence or a handed-over plan, writing its card as it starts:
  `akb guide implement`.
- A failed or stopped card creation can be resumed or discarded, and resuming keeps the
  discard: `web/content/docs/runs.mdx`.
- A discussion judges the idea before planning it — outcome versus means, whether it is worth
  doing — and may disagree or ask for evidence; sending always starts a discussion, and
  **Start planning** or **Build now** under its plan starts work.
- One discussion can hold several plans; **Start planning** hands them to one planning run,
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

## local-ui

- Pro 用户分拣 triage 时，每条由 Jev 单独判断（免费、不限条数）：值得做的建卡（小改动直接设为可开工，不再规划），重复、已支持、否决过或价值不大的带理由忽略，拿不准的标「待你判断」排在待处理最前；历史里显示「需规划 / 免规划」和理由。
- 卡片页的工作流在无法开始时（环节缺少可用的负责 Agent，或工作流已被删除）旁边标「不可用」，悬停看原因，点击打开「配置 → 工作流」；已删除的工作流显示为「已删除的工作流」。配置页工作流的同款标记也由「未就绪」改为「不可用」。
- 顶栏的目标按钮和首次运行的「目标」一步已去掉；「配置 → 看板」多了「更新产品描述」助手，可调周期、立即更新，产品描述在「记忆」里只读显示。
- A failed run's log now leads its stopped-short line with the board's reason (e.g. the agent went silent for 30 minutes), and the board's closing note under a run follows the interface language; older runs and the agent's own errors show as before.
- A delivery's Diff tab wraps long lines instead of scrolling sideways: wrapped rows hang under the line's indent, line numbers stay on the first row, and below tablet width the file list starts hidden.
- Every board helper is always on: Configuration → Board groups them as You start / On a schedule / On an event, a scheduled one only sets its cadence or runs now (Tidy memory and Tidy stalled cards default to every 7 days, first pass one cadence after upgrade), and boards that had turned any off get them back: `web/content/docs/agents.mdx`.
- A card's chat rail, before anything is said, asks "What's on your mind about this card?" and types sample questions under it one at a time; they are only prompts, nothing to click.
- Opening an existing discussion shows a loading skeleton instead of the new-discussion screen, and a failed read says so with Retry; a new discussion still opens straight to its empty screen.
- Triage's Waiting tab is a compact list: hover a row for Make card, Start now, Discuss and Ignore; Ignore takes effect at once with an undo toast and an optional reason afterwards, ticked rows ignore in one go, and acting in the detail moves on to the next item: `web/content/docs/triage.mdx`.
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
- **Prune memory** and **Tidy stalled cards** each carry **Run now** and a cadence.
- Signing in or out, buying Pro, and editing workflows update every open screen at once: Pro locks, the create panel's workflow list and the card page no longer wait for a reopen or a window switch.
- A discussion carries on in the cards **Plan tasks** writes from it: [Chat](/docs/chat).

## site

- 首页记忆插图和对比页里的 `goal.md` 换成由看板维护的 `product.md`；首次运行改为回答两个问题。
- The landing and comparison pages are also in `/zh`, `/es`, `/ja`, `/fr`; no browser-language
  redirect, and recipes and Markdown mirrors stay English.
- Positioning is "you steer, AI leads the team": an AI project manager runs your agents and
  reports only what you need; wording limits in `positioning.md`.
- The landing page's only way in is the app download; `/index.md` and `/llms.txt` mirror it.
- `/vs-task-master`, `/vs-linear`, `/vs-vibe-kanban` and `/vs-hermes-kanban` say where the
  other tool is ahead and who should pick which.
- Recipes: `web/public/recipes/`.
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

- 「What makes a good goal」页已删，旧地址重定向到文档首页；方向如何确定见 `web/content/docs/daily-loop.mdx`，助手见 `web/content/docs/agents.mdx`。
- Both READMEs are app-first: download first, `akb` second, the skill optional:
  `README.md`, `README-zh.md`.
- One page per topic under `web/content/docs/`; commands stay in `akb --help`.
- Coding agents, what each needs and may touch, and their settings:
  `web/content/docs/connectors.mdx`.

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
  YouTube and Xiaohongshu.

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
- The invite approval email says Cloud is an alpha, free for invited users, pricing may change.

## telemetry

- Anonymous usage reporting, on by default and disclosed once: `akb telemetry status|on|off`,
  `web/content/docs/local-and-cloud-boards.mdx`.
- A public route serves the install count for the README badge.
- Feedback never requires a task; sharing its conversation is one switch, off by default.
