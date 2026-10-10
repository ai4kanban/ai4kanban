# 在命令行开始一张卡，而它的工作流负责人文件被看板拒用

## Setup

- **看板**：一个刚用 `akb install` 建好的看板。
- **Agent**：`docs/kanban/agents/docs-pruner/AGENT.md`，`name: docs-pruner`、一行 `description`，`akb:` 下写 `lead: execute`；另有一个写法正确的规划负责人 `docs-planner`（`lead: plan`）。软件规划师只属于 Coding，`--lead software-planner` 会被拒绝（「create a new agent here instead」）。
- **工作流**：`akb workflow new Docs`（得到 `wf-2`），`akb workflow stage wf-2 --stage plan --lead docs-planner`，`akb workflow stage wf-2 --stage execute --lead docs-pruner`。
- **卡片**：`akb raw create --title "Trim the install guide" --workflow wf-2`，得到 #2。
- **终端**：zsh 或 bash，在项目目录里；没有正在跑的看板运行。日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 把 `AGENT.md` 里的 `lead: execute` 改回旧写法 `stage: execute` 加 `kind: lead`，执行 `akb card implement 2`。
   什么都没启动（exit 1），只有一句：`` `docs-pruner`, the lead of `Docs`' execute stage, can't be used: in docs/kanban/agents/docs-pruner/AGENT.md, replace `stage`, `kind` with `lead: execute`.`` 后面没有「另行指派」的指引。
   [01-implement.log](01-implement.log)

2. 执行 `akb card refine 2`。
   规划同样不启动，报的是同一句。
   [02-refine.log](02-refine.log)

3. 执行 `akb card implement 2 --json`。
   `error.kind` 是 `run-refused`，`error.message` 是同一句。
   [03-json.log](03-json.log)

4. 执行 `akb workflow list`。
   `Docs` 下面的 `!` 行是同一句。
   [04-workflow-list.log](04-workflow-list.log)

5. 删掉 `AGENT.md`、留下空文件夹，执行 `akb card implement 2`。
   原因换成 `docs/kanban/agents/docs-pruner/AGENT.md is missing — add it.`
   [05-no-file.log](05-no-file.log)

6. 放回新写法的文件，但把 `name` 写成 `doc-pruner`，再执行。
   原因换成 ``its folder is `docs-pruner` but …/AGENT.md names it `doc-pruner` — make the two match.``
   [06-folder-name.log](06-folder-name.log)

7. 把 `name` 改成内置角色名 `builder`，再执行。
   原因换成 `…/AGENT.md takes a name already in use — rename one of the two.`
   [07-name-taken.log](07-name-taken.log)

8. 把 `name` 改回 `docs-pruner`、删掉 `description` 一行，再执行；随后执行 `akb spec`。
   原因换成 ``…/AGENT.md has an error — `akb spec` says which.``；`akb spec` 末尾的 `Problems on this board:` 下列出具体原因（缺 `description`）。
   [08-file-error.log](08-file-error.log)

9. 删掉整个 `docs-pruner` 文件夹，再执行。
   回到原来那句：`` `Docs` has `docs-pruner` leading its execute stage, and this board has no such agent.`` 后面带 ``Assign it in Configuration → Workflows, or with `akb workflow stage wf-2 …` ``。
   [09-no-such-agent.log](09-no-such-agent.log)

10. 放回第 1 步的文件并照报错改那一行（`stage`、`kind` 换成 `lead: execute`），执行 `akb workflow list` 和 `akb card implement 2 --print`。
    `!` 行消失，实现流程正常打印（exit 0）。
    [10-fixed.log](10-fixed.log)

## Feedback

- **照着改就好了**：旧写法这一句给了文件路径、要去掉的键和要换成的那一行，改完立刻能跑，不用再去翻别的页面。这是这次改动最值的地方。
- **重名那句不说和谁重**：`takes a name already in use — rename one of the two` 没说另一个是谁；这里撞的是内置角色 `builder`，根本改不了「另一个」，「rename one of the two」是句误导。`akb spec` 里的原句反而说清了。
- **「其他错误」要多跑一条命令**：只说文件有错、让人去跑 `akb spec`，而 `akb spec` 先打印整份 agent 清单，真正的原因在最后三行，容易漏看。
- **只报第一个问题**：规划和实现报的是同一句，哪怕规划负责人 `docs-planner` 本身没问题、出问题的只是执行阶段的负责人；规划因此也被挡住，句子里没解释为什么规划也不能跑。
- **借不到软件规划师**：自建工作流不能再让软件规划师领规划，得先自己写一个规划 Agent；拒绝的那句话说了该怎么做，但没说为什么。
- **`Docs`' 的写法**：以 s 结尾的工作流名用了 `Docs'`，读起来像少了个字符，但不影响理解。
- **没有跑到的**：仍放在旧位置（`.agents/…`）的 agent、两个项目 agent 互相重名、看板启动的真实运行（不带 `--print`），这次都没有验证。
