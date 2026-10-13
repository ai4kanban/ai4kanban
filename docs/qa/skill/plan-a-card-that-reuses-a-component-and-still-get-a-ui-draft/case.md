# 建一张要求「复用现有组件」的界面卡，规划照样请界面设计师出稿

## Setup

- **项目**：一次性 git 项目 `tally`：`src/components/PlanCard.tsx`（带 `current`、`onPick` 的套餐卡片）、`src/screens/Billing.tsx`（只显示当前套餐的一张 `PlanCard`），根目录 `CLAUDE.md` 写着「We discourage over-design. Reuse what exists before adding anything new.」；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流，界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令（Agent 的 shell 里也是它）。

## Steps

1. 执行 `akb create "On the Billing screen (src/screens/Billing.tsx), let the user compare all three plans side by side and switch plan. Reuse the existing PlanCard component (src/components/PlanCard.tsx) — no new components."`。
   立即返回一次 `create` 运行。
   [01-create.log](01-create.log)

2. 一分钟左右后执行 `akb run list`。
   只有这一次 `create`，已完成；`nothing running.`
   [02-runs.log](02-runs.log)

3. 打开这次运行的 Claude Code 会话记录（`~/.claude/projects/<项目>/<run id>.jsonl`）看命令。
   建卡后同一个会话里 `akb card refine 2 --print`，紧接着 `akb spec ui-designer 2 "…只复用 PlanCard" --print`，再画稿；规划拿到的规则里写着「Skip a matching agent only for a reason its own description gives.」——「复用现有组件」和项目里那条「不要过度设计」都没让它跳过。
   [03-session-commands.log](03-session-commands.log)

4. 执行 `akb raw list`，看卡片 #2 的 `## By \`ui-designer\` agent` 一节和资产文件夹。
   #2「账单页并排对比三个套餐并切换」，`todo`，一个问题：点「Switch」前要不要确认。这一节是一个 `<Asset src=".assets/2/billing-compare.tsx" label="账单页，三个套餐并排（当前为 Team）" device="desktop" />`；稿子直接引用复制过来的 `PlanCard.tsx`，没有新组件；`src/` 没被改动。
   [04-card.log](04-card.log)

5. 在看板 UI 打开 `/2`，展开「界面设计师」一节。
   渲染出账单页：Solo、Team、Studio 三张卡片并排，Team 蓝框、按钮「Current plan」，另外两张是「Switch」，下面一行「Next invoice on the 1st.」。
   ![界面稿](05-ui-draft.png)

## Feedback

- **说了「复用」也照样看得到稿**：卡片明确要求只复用现有组件、项目还写着反对过度设计，规划仍请了界面设计师，在拍板前就能看到三张卡片排开的样子。
- **稿子没有越界**：设计师直接用了真实的 `PlanCard`，没借机加新组件，和「复用」的要求不冲突。
- **稿子照搬了现有毛病**：「1 seats」的单复数、「Current plan」与「Switch」同色同样式都原样出现在稿上，设计师没提，要用户自己看出来。
- **问题问在点子上**：唯一的问题是切换要不要确认（涉及扣费），而不是复述我已经说过的事。
- **没有跑到的**：回答问题后的修订；窄屏下改成上下排列的效果；同一卡片同时匹配文案 Agent 时的先后顺序；在 `resolve` 里补细化时是否同样不跳过。
