# 在不是 git 仓库的项目里，靠归档卡片而不是新提交让周期 Agent 运行

## Setup

- **项目**：一个空文件夹，**不是** git 仓库，用 `akb install` 建好看板，删掉 `setup-checklist.md`。
- **自建周期 Agent**：`docs/kanban/agents/release-notes/AGENT.md`，`hook: schedule`，还写着旧的 `reads: commits`（#1523 之前的写法）。
- **替身 Agent**：`ui.config.json` 的 Agent 命令指向本目录的 [stand-in.mjs](stand-in.mjs)：被要求描述项目时写一段 `project.md`；作为周期 Agent 启动时往 `CHANGELOG.md` 加一行。不花钱、不需要账号。
- **巡检**：[tick.mjs](tick.mjs) 顶替界面每分钟一次的巡检，只打印看板此刻会启动什么，不启动任何东西。
- **终端**：zsh，`env -i` 只留 `PATH`、空的 `HOME` 和 `AI4KANBAN_HOME`。第 1–3 步是 [part1.zsh](part1.zsh)，第 4–6 步是 [part2.zsh](part2.zsh)。

## Steps

1. 在不是 git 仓库的项目里看 `release-notes` 的声明，执行 `akb workflow schedule coding` 和一次巡检。
   `git status` 报 `not a git repository`；`reads: commits` 没被拒绝，`release-notes` 照常列出（`off · never run`）；巡检只想启动 `describe-project`——还没有项目描述时立即跑。
   [01-not-git.log](01-not-git.log)

2. 执行 `akb describe-project`，看 `akb run list` 和 `project.md`，再巡检一次。
   运行结束为 `done`，`project.md` 有了「What it is」一节；巡检回 `[]`，描述过的项目不再重复跑。
   [02-described.log](02-described.log)

3. 打开 `release-notes`，周期 1 分钟：`akb workflow schedule coding --on release-notes --cadence 1m`，再 `--run release-notes`。
   不是 git 仓库也能启动，运行 `done`，`CHANGELOG.md` 多了一行；列表里写着下次运行时间。
   [03-switch-on.log](03-switch-on.log)

4. 把「描述项目」的周期设成 1 分钟（日志外直接在 `ui.config.json` 写 `projectDescription.cadence: "1m"`，等同于配置 → 看板 →「描述项目」），等 70 秒后巡检。
   两者都过了周期，但没有新归档的卡片：`release-notes` 标着 `(nothing new yet)`，巡检回 `[]`。
   [04-a-quiet-minute.log](04-a-quiet-minute.log)

5. `git init` 并提交一次，再等 70 秒后巡检。
   有了新提交，巡检仍回 `[]`——提交不再让任何周期 Agent 运行。
   [05-a-commit.log](05-a-commit.log)

6. `akb raw create --title "Export notes as Markdown"`，`akb raw archive 2`，再巡检。
   一张卡归档后，巡检同时要启动 `describe-project` 和 `release-notes`（按旧写法 `commits` 声明的它，被当作 `archived-cards`）。
   [06-a-finished-card.log](06-a-finished-card.log)

7. 执行 `akb describe-project --help`。
   应写明有新归档的卡片才运行。**失败**：仍写着 `runs only after new commits`，已记待筛选 `describe-project-help-still-says-commits`。
   [07-help.log](07-help.log)

## Feedback

行为本身干净：不是 git 仓库也能描述项目、跑周期 Agent，旧的 `reads: commits` 不报错地换成按归档卡片触发，升级的人不用改任何文件。但这个换算是悄悄发生的——`akb workflow schedule` 不显示 Agent 读什么，写着 `commits` 的人不会知道它的含义变了。`describe-project --help` 还在讲「新提交」，和实际行为相反，读帮助的人会白等一次提交。等待原因 `(nothing new yet)` 只出现在 `release-notes` 上，「描述项目」为什么不跑在命令行里看不到，只能靠巡检结果猜。
