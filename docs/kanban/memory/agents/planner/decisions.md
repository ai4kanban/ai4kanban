# Decisions

Settled answers to cards' open questions for the project as a whole — the calls that
aren't any single module's. A module's own decisions live in its folder beside this file.

Keep only **user-facing** calls that still guide future planning — what a user can see,
do, or would care about. Code detail stays on the card. Read before proposing so you
don't re-ask a settled call.

## Positioning

- 定位是「AI 项目经理替你管理 Agent 团队，只汇报你需要知道的事」，覆盖产品开发到内容营销；看板是载体
  而非卖点。中英文案、使用位置和主张依据以仓库根目录 `positioning.md` 为准，入口文案引用它，不再单独
  确认。不承诺「无需写代码」「面向所有人」或无人参与。
- The role is a middle-manager project manager: clarify the goal, break requirements down,
  delegate to specialists, and carry the work through acceptance and rework. Which projects
  to start or stop is the user's. The role is not tied to software — one project manager
  covers content work on the same board.
- 10/20/100 个 Agent 与对应倍数是「一个人经营公司」的愿景，不写成容量或效果保证；自有 marketplace
  是规划，不写成现有能力。
- The "3–6× faster" claim has no verifiable source and stays anyway: it is the one line that
  makes the size of the gain land. It is given a footing rather than a citation — this
  repository's own auditable figures sit beside it.
- Local-first is a promise about the default backend — markdown in git — not about every
  backend a user can pick.

## How far agents go alone

- There is no single on/off switch for what the board does on its own, and no ladder of
  levels. Work that needs no user follows whatever caused it, and each further step brings
  its own setting if it needs one.
- Nothing today ever decides a card should be rejected; letting the board reject one is a
  separate feature.
- A delivery that cannot land does not become a question: the board resolves the conflict and
  lands it itself, and only asks when the work is genuinely at risk.
- The only reason to keep a finished delivery's worktree is that the user can really bring it
  back. Where the UI offers no way to resume, the board cleans up on its own.

## What a card can carry

- A card's assets have one lifecycle: nothing is dropped when the build starts, everything
  stays readable through it, and it is archived with the card and still shown on the archive
  page. Screen mockups follow the same path.
- A card's files, rendered videos included, live in the board's one assets folder under the
  card's id; no feature adds a folder of its own.

## Eval collection

- The partner feedback agent is disabled by default and enabled only after the user agrees to
  participate. The first collection is for a small group of partners whose code the team may
  inspect, with no upload preview.
- Curated cases, rubrics, runners and experiment summaries live in the separate private
  repository `ai4kanban-evals`. Incoming submissions are reproduced and reviewed before
  admission; only reproducible cases are admitted.
- A partner is promised one page, once, before consent: no payment, the case stays in the
  closed eval set indefinitely, the analysis may pass through a model provider, and a letter
  deletes what they submitted. A later use needs consent gathered again.

## Learning from acceptance

- Turning review feedback into reusable SOPs is a recursive-self-improvement problem, not a
  step bolted onto review. Prove the acceptance judgement is reliable first, then prove a
  learned SOP improves tasks it has not seen; until both hold, the output is a proposal a
  human approves rather than a rule the board applies.

## Selling a service

- Contact is a form, not a mailto: one form covers support and a customized workflow, and
  submitting confirms on the page — the human reply is the confirmation.
- A customized agent workflow is priced per agent, at $15 each. The figure is the same in
  every language; the quote and the payment are settled by email, and the site takes no
  payment.

## Showing our own numbers

- The install badge shows the real count of installs, however far below the download count it
  sits. The gap is not hidden and the badge does not wait for a better number.

## skill

- 视频助手记下的运镜配方反馈只留在本项目的看板记忆里，随命令分发的配方条目不因某个项目的反馈改写；换一个项目要重新提一遍。
- 构建在独立工作树里从当前提交切出、不含主目录里手头的未提交改动时，要在启动处说明这一点，而不是让用户等结果对不上才发现；主目录干净时不提。
- **审核用的画面与它的文字相邻**：每个镜头的画面紧跟自己的脚本段落，而不是单独一张总览；标题栏下常驻一条按播放顺序排列的缩略图时间线，点格跳转。
- **镜头多时时间线不横向滚动**：全部镜头排满一行，悬停放大看清。

## local-ui

- **共享提示不占整行**：Agent 被多个工作流共用时，只在名称旁放一个「共用 · <工作流名>」小标签，后果写进悬停提示；整句的共享说明信息量低、占地方。
