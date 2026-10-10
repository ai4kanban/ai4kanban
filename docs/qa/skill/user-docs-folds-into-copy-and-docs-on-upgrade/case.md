# 升级后，「用户文档」并入「文案与文档」，Coding 规划多出竞品调研和配图

## Setup

- **上一版的看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md`，建了 #2「Export to PDF」。然后手写上一版会留下的状态并提交：
  - `.akb/boards/docs/kanban/ui.config.json`：Coding 规划阶段的辅助 Agent 是 `copywriting`（额外要求「Keep it short.」）、`email-planner`、`prompt-writer`、`tech-stack-advisor`、`ui-designer`、`user-docs`（额外要求「Docs live in web/content/docs.」）；`shipped` 里还没有 `competitor-research` 和 `illustrator`。
  - `docs/kanban/rules/user-docs.md`：「Write docs task first.」
  - `docs/kanban/memory/agents/user-docs/writing.md`：「- Put the steps before the reasons.」；`copywriting/writing.md`：「- Call it "the board", never "the kanban".」
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令，`<project>` 是项目目录。

## Steps

1. 升级前看 `rules/` 和两位 Agent 的记忆文件。
   有 `rules/user-docs.md`、`memory/agents/user-docs/writing.md`、`memory/agents/copywriting/writing.md`。
   [01-before.log](01-before.log)

2. 用这次构建执行 `akb workflow list`，再看 `ui.config.json` 里 Coding 规划阶段的辅助 Agent。
   hooks 变成 `copywriting, email-planner, prompt-writer, tech-stack-advisor, ui-designer, competitor-research, illustrator`：`user-docs` 消失，`competitor-research` 和 `illustrator` 新加入且开着。`copywriting` 只剩一行，额外要求是两者合并：`Keep it short.\nDocs live in web/content/docs.`；`shipped` 记下了两个新 Agent。
   [02-workflow-list.log](02-workflow-list.log)

3. 执行 `akb spec copywriting 2 --print`。
   打印的提示里：这一节如果在旧卡上写成 ``## By `user-docs` agent``，就原地改名；`Placement` 写着放在 `<!-- agent -->` 之上；规则里有「Stage 1 — copy」，文案要先经用户确认；记忆里 `writing.md` 原有一行之后多了 `## Docs` 和 user-docs 那一行；工作流的额外要求两句都在；末尾是「this board's `copywriting` agent carries one rule of its own」加上 `Write docs task first.`。
   [03-spec-print.log](03-spec-print.log)

4. 再看文件和 `git status --short`。
   `rules/user-docs.md` 变成 `rules/copywriting.md`，`memory/agents/user-docs/` 整个没了，内容都在 copywriting 名下；这些改动没有提交。
   [04-after.log](04-after.log)

## Feedback

- **什么都没丢**：规则、记忆、额外要求都并进了 copywriting，用户不用动手；`## Docs` 小标题让并进来的内容一眼可辨。
- **悄无声息**：命令行没有一句话说 `user-docs` 已并入「文案与文档」，也没说 Coding 规划多了两个默认开着的 Agent——用户只会在下一次规划多花时间和钱时才发现竞品调研在跑。
- **改动留在工作区**：迁移在第一次用到 copywriting 时才发生，留下一堆未提交的删除和新文件，看起来像是别人改的。
