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
- A partner, seed partners included, is promised one page, once, before consent: no payment, the case stays in the
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

## Pricing

- **四档**：Free（Apache 2.0、支持 8 种编码 agent、7 个 agent 组成的编码工作流、不限并发和自定义工作流/agent、邮件支持）；
  Pro $15/月或 $120/年，默认显示年付（邮件、幻灯片、演示视频工作流与优先支持）；种子伙伴（在保护隐私的
  前提下分享对话，换 6 个月 Pro，候补加入，内部上限 20 人，满额即暂停，不对外公布）；培训只放一张链接到
  `/training` 的卡，不写细节。
- **托管旁白额度**：Pro 每月含 60 分钟托管旁白、不另收费，用尽暂停至下月；成本按满额仍小有盈利来定。
- **Pro 不只是工作流**：对外说 Pro 时不把差别限定为「更多工作流」。

## Showing our own numbers

- The install badge shows the real count of installs, however far below the download count it
  sits. The gap is not hidden and the badge does not wait for a better number.

## marketing

- **演示视频的被演示产品**：功能开发演示用专门搭建的独立演示项目，不直接拿 AI4Kanban 自身开发做演示

## skill

- **按交付物选工作流**：看卡片最终要交付什么，不看它改动的对象；改视频规则的卡片走编码流程，产品视频流程只用于做视频。指南里的选择规则不举具体工作流名，免得工作流改名或增删后失效。
