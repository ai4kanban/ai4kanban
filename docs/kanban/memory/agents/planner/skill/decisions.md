# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## Memory

- Planning memory keeps a folder per module under the planner: `agents/planner/<module>/`
  holds that module's `decisions.md`, `rejected.md` and `redesign.md`, beside the planner's
  board-wide three. Who owns a file and which module it covers are two separate axes, and one
  is never folded into the other.
- A file nothing writes is the leftover we avoid, so the set never grows a fifth file.
- An agent edits its own memory directly. No command flag writes memory and no opaque key
  switches it on; the rules for remembering are prose an agent can read.
- A user's answer or revision on a spec agent's section is written into that agent's memory
  right away by the planning flow.
- A finished card moves to `.archive/` and stays in git; a rejected card is deleted, since
  `rejected.md` records why. The archive is not memory — no flow reads it.

## The goal

- The goal is optional and free-form. The agent judges only whether text is there, never the
  prose, and never nags about a goal the user did write.
- With the goal empty, every planning flow reads direction from the card's module memory and
  the repository instead.

## Setup and the module map

- Setup asks the user for nothing it can read: it settles what a repository scan answers and
  hands every remaining call over as `[user]` questions on one card that tops the board. That
  card's title, body and questions follow the user's language from the moment it is shown, and
  fall back to English only where none is set.
- Setup is a bounded bootstrap — one scan, at most 5 decisions and 5 modules, 3 seed cards
  with background refinement doing the deeper work. A repository with nothing to read
  finishes with no seed card at all.
- Be conservative with modules, above all in a from-scratch repo: a simple single-purpose
  project is one module, and lines are added only as the code grows. Adding a module later
  moves the notes now clearly its own out of the memory they came from, once; a rename keeps
  the memory, and deleting one folds it back in.

## Planning and refining

- One session drives one card the whole way and never pauses to ask: it answers what it is
  sure of and ends either `ready` or holding only the questions a human must answer.
- Creation and refinement keep a hard context boundary: creation distils the request into a
  self-contained card, refinement starts fresh and tests that card on its own. Context the
  card failed to preserve is a creation defect.
- A card is refined as soon as a run creates it, and never because a run merely edited it.
- A card the gate turns down goes back to `todo` with its reason as a `[user]` question.
  Turning the gate on applies only to cards that reach `ready` afterwards.
- A question can carry options and one with no options stays open-ended; prose questions keep
  working and are never migrated.
- The decider answers every `[user]` question still open on a card, takes the recommended
  option when it cannot decide, never hands a card back, and has no round cap.
- **假设在规划 QA 中验证**：卡片上未证实的前提（如某个参数是否可行）在标准 QA 里逐项实测取证，结论写进卡片，不留给构建阶段；没测过的不写成「已验证」，也不靠删掉那句要求了事。验证不可行的部分就放弃，整张卡都不可行就放弃这张卡。快速规划不自行验证，遇到时升级到标准 QA。

## Implementation runs

- Every agent's runs reach the network, Codex included, and no connector's shell is fenced to
  the project folder — fencing one whose sandbox also shuts the network would cost every card
  its `npm install`. The fence stays available in Extra arguments.
- A project that is not a git repo runs on every agent; Codex is given the flag it needs
  rather than the user being told to `git init`.
- A connector may ship before a card has ever run on it: it reaches the picker with the docs
  saying so, and the first real card's surprises become a new card.
- A conflict-free rebase is never reviewed again. Only a resolved conflict takes a review,
  and there is no switch to turn the skip off.
- A landing conflict is retried forever and never handed back, on the run-retry curve capped
  at two minutes — nobody is asked, at the price of an unresolvable conflict holding cost.
- A delivery that ended abnormally is carried on by hand and never restarted for you. It may
  finish without rebuilding only on evidence its change is already on the target branch.
- Minor direct-to-target, no-commit execution is for interactive in-session work only;
  background runs keep delivery tracking and landing.
- Run retry ships on the harnesses whose failure signals are proven, and gives up after 3
  attempts or 15 minutes.
- 构建在独立工作树里从当前提交切出、不含主目录里手头的未提交改动时，要在启动处说明这一点，而不是让用户等结果对不上才发现；主目录干净时不提。
- 看板的流程规则和语言规则优先于项目里的 `AGENTS.md` / `CLAUDE.md`，冲突时以看板为准，项目配置只在不冲突时生效。

## Recurring and background work

- A built-in background job ships as a seeded card in `todo/recurring/`, run when the user
  sets a cadence — never as its own switch with its own state file. Deleting the card is the
  opt-out. A cadence is always the units grammar: `30m`, `2h`, `1d`, `1d at 09:30`.
- Memory pruning and the daily chat-memory review are the exceptions: each is an agent with
  its own page. Pruning is opt-in with a cadence and off by default; the review is on by
  default with a switch and no cadence, and skips a day with no new conversation. Tying the
  two would leave a default board writing no memory at all.
- A recurring card holds only the batch of work that repeats. Changing how that work is done
  once — a migration, a new entry point — is an ordinary card of its own.
- The sweeper drops a card it judges done or not worth the investment with no sign-off and no
  `rejected.md` line, so the idea can be raised again. It skips only a card being built or
  blocked by an open one.
- Turning one agent on never flips another's switch; a page may warn about a combination and
  leaves both where the user put them.
- The board's own background agents keep an on/off switch — the switch is whether the board
  starts that background run at all. An agent inside a workflow has none: the stage's
  assignment is the only thing that says it takes part.

## Releases

- A version ships when the user says it ships, open cards or not. Closing clears the release
  off the cards still open, and they are never moved in afterwards.
- The open releases are one line each in `releases.md`, in ship order, short enough that
  reordering and renaming are hand edits. A card naming a release the list doesn't have keeps
  it, but setting one is an error, so a typo can't invent a version.
- A release with a goal is filled by an agent judging each open card against it. Filling only
  ever adds, so it can be re-run as the goal changes; taking a card back out is the user's
  move.

## The command

- One command owns every board and agent action, and every surface drives its runs through
  it, so there is one implementation of each move.
- What we teach a person is the actions the UI's buttons stand for; the board's own
  bookkeeping stays a command the agent calls.
- The command is a Node program, not a compiled binary: everything the board runs on already
  carries Node, and a binary would add six signed builds per release.
- A user installs and updates by running one Node script published on npm: no shell script,
  no `curl … | sh`, no git clone. Install never asks which agents you use, and installing a
  board does not install the skill.
- `akb` typed alone opens the app when the app installed it; on a machine with no `akb` the
  board spells its own command as `node <path>/ai4kanban.mjs`.
- **No backward compatibility for a removed CLI option**: drop it outright, so passing it
  fails as an unknown option. A board file a release retires is deleted by `akb update`.
- **No backward compatibility for an agent's output shape**: when it changes, agents read
  only the new shape and cards in the old one are re-planned.

## Storage

- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend; only
  cards ever move, and there is one backend per project.
- Machine-local state the board cleans up itself lives under `~/.ai4kanban/`, keyed by the
  project's path — so moving or renaming a project starts its records over. Only the user's
  own configuration stays in `docs/kanban/`.
- The GitHub Projects backend is wanted but parked; Notion gets a card when a user asks.

## Triage

- The board reaches one endpoint the user configures rather than a platform we integrate: the
  format is fixed and the endpoint and token are files in the board, so any provider works.
- Source connections are optional and independent, each keeping its own identity, settings and
  pull results while sharing one Triage lifecycle and its deduplication. dist0 is ours, so its
  cost sits inside the Cloud subscription.
- A card triage creates schedules its own refine, so an external item arrives with its plan
  written.
- A dismissal only blocks the automatic pull — adding the same thing by hand is always let
  through. A dismissed item is kept for good, with the reason it was turned down.
- Triage has an opt-in demo mode, and every synthetic item is marked as such for good.

## Agents and runtimes

- A runtime is the whole answer to what a run runs as, with no inheritance from a per-harness
  block, so two agents on one harness can sit on two gateways.
- The default is a position, not a badge: **Global default** is the first row, which no board
  can rename or delete and every agent naming no runtime runs.
- A runtime's id keys everything and its name keys nothing, so a rename is lossless on every
  computer. Deleting one puts its agents back on **Global default** rather than being refused.
- A runtime's shape travels in git and its key does not, so the first computer to upgrade sets
  the model every checkout runs.
- A harness's capability is declared from what the installed runtime actually does, not from
  what its protocol hands back. A context-window reading trusts the harness's own number
  first and falls back to models.dev's nominal cap.
- **Agent names say their scope**: the id matches the display name, and both are narrow enough
  to leave room for siblings — `software-planner`, not `planner`.
- Splitting a flow out onto its own agent copies the old agent's rule and runtime across once,
  so the first run after the upgrade behaves exactly as before.
- **移除一个内置 agent**：已存盘的工作流指派自动改掉，配置页用一句话说明谁接手了，不保留旧角色。
- **An agent carries no advanced configuration**: no per-agent option that switches how it
  works, such as the UI designer's prototype style — that flexibility costs more than it
  buys. Two ways of running one agent means two agents.

## Workflows and spec agents

- A built-in agent is an ordinary `AGENT.md`, and a workflow loads the agents its
  configuration names; no workflow's behaviour is a guide the command hard-codes by workflow
  id. Adding an agent is writing a prompt, not changing the machinery.
- **Built-in and custom agents share one structure**: an agent's own scripts, references and
  validators live with the agent, not in the command's core — the core only loads and runs
  them, and hard-codes no one agent's checks (as `storyboard.ts` does for `scriptwriter`).
  Material an agent is meant to use is reachable from its own `references/index.md` and ships
  with it; what sits only in a repository skill is material the agent never finds.
- An agent definition stays minimal: no field that restates the description or the body.
  **新建 agent 的模板**保持最简，只用注释指向 `AGENT.md` 指南。
- Each card runs one configurable plan → execute → review flow. Each stage selects one lead
  and existing helpers; helpers run only on request, with no always-call setting. Built-in
  flows may be configured or copied but not renamed or deleted.
- **spec agent 的先后顺序**只写在 agent 说明里，看板不做启动拦截。
- An agent that writes text or files hands it over as final and never asks the user to confirm
  it — the user edits its section when they disagree. Copywriting is the one that asks,
  because a screen waits on its confirmed copy, and it ships no house style of its own.
- The card is the brief. Handing work to any executor gives it the card's requirements as
  frozen at delivery start; the board writes no separate handoff brief. The executor is always
  a separate agent from the planner, and an external tool or person is an execute-stage agent
  whose runtime is "external" — the board runs nothing and records only the paths handed back.
- A spec agent's `description` names the kinds of work it covers, never repository paths.
- **内容类工作流用专用代理**：视频、PPT 等工作流各自配规划与制作代理，不复用编码工作流的 `software-planner` 与 `builder`。
- **产品视频只维护脚本和记忆**：工作流只规定制作前确认连贯叙事与准确文案、成片后检查、经验沉淀；
  动画配方、技术栈和制作方式由执行代理自定，不写进工作流或卡片。镜头按连续叙事规划，衔接和逐镜一样
  要紧。演示只是可选手段，用到时制作前一并评审演示准备。**视频不进 git**：源文件和渲染脚本与成片一起
  放在素材目录。
- **旁白只让用户选音色，不选模型**：托管音色经 AI4Kanban Cloud 提供，用户不必为每家供应商配 API key。
- **自建工作流是否开分支**由用户在工作流设置里自选，开启后不开分支、不提交。
- 视频助手记下的运镜配方反馈只留在本项目的看板记忆里，随命令分发的配方条目不因某个项目的反馈改写；换一个项目要重新提一遍。
- **审核用的画面与它的文字相邻**：每个镜头的画面紧跟自己的脚本段落，而不是单独一张总览；标题栏下常驻一条按播放顺序排列的缩略图时间线，点格跳转。
- **镜头多时时间线不横向滚动**：全部镜头排满一行，悬停放大看清。
- Revising a section a spec or helper agent owns loads that agent's `AGENT.md` first, and its
  other references as the edit needs them; a required doc that is missing is reported before
  anything is edited.
- **An agent is harness-agnostic**: its rules name no harness's own tools and no particular
  browser tool. They set the standard the output must meet, and the agent uses whatever tool
  the environment provides.
- **构图与动画选用索引**按类别分组，只用文字写清每个动效做什么、适合什么，让 agent 不看源码也能复现；不含代码和素材。随 akb 发布，作为脚本作者的参考文件；不放官网。只给维护者看的盘点清单不随它分发，留在仓库里，补条目时自己对齐两边。
- **`scriptwriter` owns the storyboard and the motion references**; there is no separate
  storyboard agent. A recording recipe is named for what it does — `desktop-zoom-and-interact`,
  never a filler word like "demo".
- **审批轮次越少越好**：每轮审批都开新会话、重新冷启动；看板也无法强制 agent 按顺序交接。演示准备（数据、可重复的步骤、重置）归 `scriptwriter` 在第一轮内完成，不另设 agent 或轮次。
- **审批提问点明轮次与下一步**：每轮审批的提问写清当前是第几轮、批准后会发生什么，用户不必回看卡片；不为缩短指令压成只问批准与否。
- An agent's output takes the form that reads best for it — an image, a storyboard, or Markdown
  restructured to scan; `prompt-writer` shows its change as a `diff` block, not an
  explanation.

## Mockups

- A card points at a mockup with one `<Mockup>` tag on a line of its own; a markdown link is
  never drawn as one.
- Mockups are gitignored, because a mockup is a working drawing the build throws away — so
  what a layout settled has to be in the card's words.
- 只有渲染页面一种产出：`.tsx` 或 `.html` 的产品化界面。字符草图取消，也不另建一个只画字符草图的
  agent，等真有人要再说。
- The agent draws one mockup by default, alternatives only when explicitly asked. Re-drawing
  one is re-running the agent with the change said in words.
- The Resolve dialog does not show the mockups a layout question is about: the options name
  the labels and the user opens the card page to look.
- One design system per app: a style drawing against a saved one reads
  `docs/kanban/design/<app>.md`, picked from the card's module.

## Chat

- The chat box offers **Discuss** alone. **Plan tasks** and **Start now** sit on the plan
  a discussion writes, so no task is created or built without talking first.
- A chat does the board work itself, as soon as it is asked, through the board's own moves.
  It may take any action without asking, and git is where the user takes it back. It adds no
  rule of its own: the session is an ordinary kanban-skill session. A change stated clearly
  enough to act on is made in that same turn, phrased as a question or not — it waits only
  where the user asks it to hold off or a choice that changes the result is genuinely open,
  and a question asking only why gets an answer alone.
- Only an agent whose command can be sent a second message into an open session can hold a
  chat; a conversation is never held by resending the whole exchange.
- A board holds many discussions, and the app and the terminal are the same conversation. A
  conversation pins one runtime, kept with the transcript.
- Each discussion owns one plan and cannot modify another's. A plan is kept: once its cards
  are written it moves to the plans archive, and every card names that path as its source.
  Plans are modified through ai4kanban only.
- A discussion's transcript never enters git: a card built from it references the local
  record, and without that record the plan alone governs.
- **交接带上用户原话**：**Plan tasks** 和 **Start now** 把讨论记录连同方案一起交给后续规划与实现；方案是契约，用户原话补充意图，不必沿用同一会话。
- There is no separate lightweight QA flow: the check a small change needs happens in the
  conversation, so a small change is never escalated into a full QA pass.
- **创建未完成的卡**只放行直接丢弃，不放行带否决记忆的普通拒绝。

## Card format

- The human half is for review and stands alone, because the agent half is folded by default.
  A spec agent's section joins the human half only when the user has to pick from it.

## Writing the product

- **引入外部开源资料**：许可允许（如 Apache-2.0）就署名后改写进本仓库，只取通用部分，不整段照搬。
