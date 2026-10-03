# 回答卡片的问题，然后让看板把它做完

## Setup

- **看板**：接着 [建一张卡，让看板把它规划好](../create-a-card-and-let-it-plan/case.md) 的项目——#2「Export a card as PDF」已规划，带一个问题；看板文件已提交。
- **Agent**：同一个 [stand-in.mjs](../create-a-card-and-let-it-plan/stand-in.mjs)：收到「应用回答」就清掉卡上的问题；收到「实现」就写一个 `2.txt`。
- **设置**：默认的「允许自动 Git 提交」开着；当前分支 `master`。
- **终端**：zsh，在项目根目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb card resolve 2 "A4"`。
   打印 `resolve — run <id>` 和跟踪、停止的命令。
   [01-resolve.log](01-resolve.log)

2. 几秒后看运行和卡片。
   `resolve #2` 已完成；#2 那一行不再有 `open question`。
   [02-after-resolve.log](02-after-resolve.log)

3. 执行 `akb card implement 2`。
   打印 `implement — run <id> in delivery <id>`。
   [03-implement.log](03-implement.log)

4. 等它结束后执行 `akb run list`。
   `implement #2` 完成并标着它的 delivery；`nothing running.`
   [04-runs.log](04-runs.log)

5. 看 git 和看板。
   当前分支多一次提交 `Export a card as PDF (#2)`（正文 `delivery <id>`），只含 `2.txt`；卡片从 `todo/` 移到 `.archive/`。
   [05-landed.log](05-landed.log)

## Feedback

- **一条命令走到落地**：`implement` 之后不用再管，改动作为一次 squash 提交落在当前分支，卡片自己归档，和帮助里说的一致。
- **归档本身没进提交**：落地后工作区留着 `todo/` 删卡、`.archive/` 新卡、`metrics.csv`、`deliveries/` 等改动，得自己再提交一次；用户很容易以为看板已经全收拾好了。
- **帮助说有评审，实际没有**：`akb delivery --help` 写着构建后「a fresh run reviews and fixes what it built」，但运行列表和交付记录里只有 `implement`——`review` 在代码里已是停用的动作，帮助没跟上。
- **`resolve` 的回答只能写成一句话**：命令行没有按选项回答的方式，`"A4"` 是作为附注交给运行去理解的。
- **证据的局限**：构建内容由替身写成（一个 `2.txt`），验证的是交付流程，不是真实 agent 的代码质量。
