# Decisions

Settled answers to cards' open questions for the project as a whole — the calls that
aren't any single module's. A module's own decisions live in
`docs/kanban/memory/<module>/decisions.md`, never here.

Keep only **user-facing** calls that still guide future planning — what a user can see,
do, or would care about. Code detail stays on the card. Read before proposing so you
don't re-ask a settled call.

## What local-first promises

- Local-first is a promise about the default backend — markdown in git — not about every
  backend a user can pick.

## The positioning statement

- 定位是「AI 项目经理替你管理 Agent 团队，只汇报你需要知道的事」，覆盖产品开发到内容营销；看板
  是载体而非卖点，人群标签不作开头。中英文案、使用位置和主张依据以仓库根目录 `positioning.md` 为准，
  入口文案（#771–#773）引用它，不再单独确认。不承诺「无需写代码」「面向所有人」或无人参与。
- 10/20/100 个 Agent 与对应倍数是「一个人经营公司」的愿景，不写成容量或效果保证；自有 marketplace
  是规划，不写成现有能力。
- 目标建议（未生效）：「通过 AI 管理 Agent 团队，放大个人可承担的工作规模」，`goal.md` 由用户自己改。
- The "3–6× faster" claim has no verifiable source and stays anyway: it is the one line that
  makes the size of the gain land. It is given a footing rather than a citation — this
  repository's own auditable figures sit beside it, so a reader works the order of magnitude
  out instead of taking our word for it.
- The role is a middle-manager project manager: clarify the goal, break requirements down,
  delegate to specialist agents, and carry the work through acceptance and rework. Deciding
  which projects to start or stop and how to spread resources across the business is a COO's
  job and stays the user's. Breaking requirements down is inside the role, and the role is
  not tied to software — one project manager covers content work on the same board.

## How far agents go alone

- There is no single on/off switch for what the board does on its own, and no ladder of
  levels. Work that needs no user follows whatever caused it, and each further step brings
  its own setting if it needs one.
- One click already carries a card from build to landed and archived. Letting the board reject
  a card is a separate feature: nothing today ever decides a card should be rejected.
- A delivery that cannot land does not become a question: the board resolves the conflict and
  lands it itself, and only asks when the work is genuinely at risk.

## Eval collection

- The partner feedback agent is disabled by default and enabled only after the user agrees to
  participate. Once on, concrete issue feedback triggers it to analyze, collect and submit the
  session it came from, uploading only the project files that session read.
- The first collection is for a small group of partners whose code the team may inspect, with
  no upload preview in the first version.
- Curated cases, rubrics, runners and experiment summaries live in the separate private
  repository `ai4kanban-evals`, with the public guide revision recorded per experiment.
  Incoming submissions are reproduced and reviewed before admission.

## Keeping a delivery's work

- The only reason to keep a finished delivery's worktree is that the user can really bring it
  back. Where the UI offers no way to resume, the board cleans up on its own; where a case
  deserves a resume and has none, the answer is to add the entry point, not to keep the
  directory as a stand-in for one.

## Learning from acceptance

- Turning review feedback into reusable SOPs is a recursive-self-improvement problem, not a
  "write a skill" step bolted onto review. Prove the acceptance judgement is reliable first,
  then prove a learned SOP improves tasks it has not seen; until both hold, the output is a
  proposal a human approves rather than a rule the board starts applying.

## Showing our own numbers

- The install badge shows the real count of installs, however far below the download count it
  sits. The gap is not hidden and the badge does not wait for a better number.

## What a card can carry

- A card's assets have one lifecycle: nothing is dropped when the build starts, everything stays
  readable through it, and it is archived with the card and still shown on the archive page.
  Screen mockups follow the same path — "discarded at build time" is gone.
- A card's files, rendered videos included, live in the board's one assets folder under the
  card's id; no feature adds a folder of its own.

## Selling a service

- Contact is a form, not a mailto: one form covers support and a customized workflow, and picking
  customization adds a field for the workflow being described. Submitting confirms on the page;
  the human reply is the confirmation.
- A customized agent workflow is priced per agent, at $15 each — a five-agent workflow is $75.
  The figure is the same in every language; the quote and the payment are settled by email, and
  the site takes no payment.

## site

- **首页多语言同步**：首页定位类文案改动时，en / zh / es / fr / ja 五语同批更新，不留某种语言停在旧说法。

## marketing

- **邮件资产位置**：定稿邮件放在看板资产目录 `.akb/boards/docs/kanban/assets/email/`，只存本机，任何清理都不能删它。
- **邮件格式**：用 React Email 写成可直接经 Resend 发送的 TSX，卡片里显示渲染后的 HTML。
- **邮件 build 后**：默认发一封预览邮件到固定评审邮箱，不发给其他人。
- **自定义工作流的自动选择**：靠工作流名称和负责 agent 的描述让看板建卡时自动选中，不为此加产品规则。
- **演示视频的字幕语言**：同一工程渲染英文字幕版和中文字幕版两份。
- **演示视频的共享素材**：下载到本地 `assets/video/` 审阅，定稿存到 `cdn.ai4kanban.dev`，二进制不进 git。
- **Email agents stay project agents**: `email-planner` → `email-builder` live in this board's `agents/`, not shipped built-in.

## skill

- **spec agent 的先后顺序**：只写在 agent 说明里，看板不做启动拦截（不再有 `akb.dependencies`）。
- **Agent names say their scope**: the id matches the display name, and both are narrow enough to
  leave room for siblings — `software-planner`, not `planner`; `hyperframes-editor`, not `editor`.
- **自建工作流是否开分支**：工作流设置里的「产出是文件」开关由用户自选，开启后不开分支、不提交。
- **演示视频不进 git**：composition 源文件和渲染脚本与成片一起放在素材目录，不再用 git 管理版本。
- **Video assets are one agent**: `video-assets` prepares picture and sound; no separate audio or
  sound-design agent.
- **No backward compatibility for an agent's output shape**: when it changes, agents read only the
  new shape and cards in the old one are re-planned.
