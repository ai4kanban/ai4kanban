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

- 定位只说面向独立创作者和小团队、一个看板统筹开发、设计与内容，不承诺「无需写代码」，也不写
  「面向所有人」——零编码用户的开箱即用体验还不具备，说法要和今天的产品对得上。
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
