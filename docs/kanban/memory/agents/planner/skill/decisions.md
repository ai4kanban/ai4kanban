# Decisions

Settled user-facing answers for this module. Read before proposing so you don't re-ask a
settled call.

## Memory

- An agent edits its own memory directly, following prose rules; no command flag or opaque key writes it.
- A user's answer or revision on a spec agent's section goes into that agent's memory right away.
- A finished card is archived in git; a rejected card is deleted, since `rejected.md` keeps the why. No flow reads the archive.

## The goal and setup

- The goal is optional and free-form: the agent checks only that text is there and never nags about what the user wrote.
- The setup questions card follows the user's language from the moment it shows, English only when none is set.

## Planning and refining

- One session drives a card the whole way without pausing, ending `ready` or holding only questions a human must answer.
- Creation distils the request into a self-contained card; refinement starts fresh and tests it alone. Lost context is a creation defect.
- A card is refined when a run creates it, never because a run edited it.
- Turning the gate on applies only to cards that reach `ready` afterwards.

## Implementation runs

- Every agent's runs reach the network and no shell is fenced to the project folder; the fence stays available in Extra arguments.
- A project that is not a git repo runs on every agent; the board passes what each needs instead of telling the user to `git init`.
- A connector may ship before any card ran on it, with the docs saying so; the first real card's surprises become a new card.
- A conflict-free rebase is never re-reviewed, with no switch to change that; only a resolved conflict takes a review.
- A landing conflict is retried forever on the run-retry curve (capped at two minutes) and never handed back.
- A delivery that ended abnormally is carried on by hand, never restarted for you; it may finish without rebuilding only on evidence its change is already on the target.
- Run retry ships only on harnesses whose failure signals are proven, and gives up after 3 attempts or 15 minutes.
- 构建在独立工作树里、不含主目录未提交改动时，在启动处说明；主目录干净时不提。
- 看板的流程与语言规则优先于项目的 `AGENTS.md` / `CLAUDE.md`，项目配置只在不冲突时生效。

## Recurring and background work

- A built-in background job ships as a seeded recurring card run on a cadence the user sets (`30m`, `1d at 09:30`), never a separate switch; deleting the card opts out.
- Exceptions: memory pruning is an opt-in agent with a cadence; the daily chat-memory review is on by default, has no cadence, and skips days with no conversation.
- A recurring card holds only the repeating batch; a one-off change to how it works is an ordinary card.
- Turning one agent on never flips another's switch; a page may warn and leaves both as set.
- The board's own background agents have an on/off switch; an agent inside a workflow has none — its stage assignment decides.

## Releases

- A version ships when the user says so; closing clears the release from cards still open, and they are never moved in afterwards.
- Setting a release the list doesn't have is an error, so a typo can't invent a version.
- Filling a release only adds cards, so it can be re-run; taking a card out is the user's move.

## The command

- One command owns every board and agent action; every surface drives runs through it.
- It is a Node program installed and updated by one npm script — no binary, shell script, `curl | sh` or clone. Install never asks which agents you use, and a board install does not install the skill.
- `akb` alone opens the app when the app installed it; without `akb` the board spells its command as `node <path>/ai4kanban.mjs`.
- No backward compatibility: a removed option fails as unknown, `akb update` deletes retired board files, and a changed agent output shape means old cards are re-planned.

## Storage

- Memory, `metrics.csv` and `next-id` stay local markdown on every backend; only cards move, one backend per project.
- Machine-local state lives under `~/.ai4kanban/`, keyed by project path, so moving a project starts its records over; only user configuration stays in `docs/kanban/`.
- GitHub Projects backend is wanted but parked; Notion gets a card when a user asks.

## Triage

- The board reaches one user-configured endpoint with a fixed format, endpoint and token as board files, so any provider works.
- Sources are optional and independent, each with its own identity, settings and results, sharing one Triage lifecycle and dedup. dist0's cost sits inside the Cloud subscription.
- A dismissal only blocks the automatic pull; adding by hand always goes through. Dismissed items are kept with their reason.

## Agents and runtimes

- A runtime fully defines what a run runs as, with no per-harness inheritance, so two agents on one harness can use two gateways.
- **Global default** is the first runtime row: not renamable or deletable, used by every agent naming none. Deleting a runtime moves its agents there.
- A runtime's id keys everything and its name nothing, so renames are lossless; its shape travels in git, its key does not.
- Harness capability is declared from what the installed runtime does; context window trusts the harness's number, then models.dev.
- Agent ids match display names and are scoped narrowly enough to leave room for siblings (`software-planner`, not `planner`).
- Splitting a flow onto its own agent copies the old agent's rule and runtime once, so behaviour is unchanged after upgrade.
- 移除内置 agent 时，已存工作流的指派自动改掉，配置页一句话说明谁接手。
- An agent has no advanced per-agent options; two ways of running one agent means two agents.

## Workflows and spec agents

- A built-in agent is an ordinary `AGENT.md` loaded by workflow configuration; adding an agent is writing a prompt, never command code keyed by workflow id.
- Built-in and custom agents share one structure: scripts, references and validators live with the agent and ship with it; the core hard-codes no agent's checks.
- Each card runs one configurable plan → execute → review flow; workflows only switch their agents on or off; helpers run only on request. Built-in flows can be configured or copied, not renamed or deleted.
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
- `scriptwriter` owns the storyboard, motion references and demo preparation within its first round; there is no separate storyboard agent or round. Recipes are named for what they do, never "demo".
- 审批轮次越少越好（每轮都冷启动新会话）；每轮提问写明第几轮、批准后发生什么。

## Mockups

- A card points at a mockup with a `<Mockup>` tag on its own line; a markdown link is never drawn as one.
- Mockups are gitignored, so what a layout settled must be in the card's words.
- 只产出渲染页面，不做字符草图，也不另建字符草图 agent，等真有人要再说。
- The Resolve dialog does not show mockups; options name the labels and the user opens the card page.
- One design system per app, picked from the card's module.

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
