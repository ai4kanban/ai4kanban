# 升级后，版本从看板上消失，卡片照常可读

## Setup

- **上一版的看板**：用这次构建之前（`5a46e9f5`）的 `akb` 在一个空的 git 项目里（`user.name` 设为 `qa`）执行 `OLD="node <上一版>/cli/bin/ai4kanban.mjs" sh seed.sh`（[seed.sh](seed.sh)）。种下的是：
  - 版本 **v1**（目标「Sign-in works」）和 **v2**（目标「Export」）。
  - **#2 Fix the login redirect**：在 v1 里，已归档；随后关闭 v1，`.release-summaries/v1.md` 记下它，并手写了一行更新日志。
  - **#3 Export to PDF**：在 v2 里，还在 `todo/`。
- **终端**：在项目目录里。日志里的 `akb` 是这次构建出的命令（标了 `# the previous version` 的是上一版），`<project>` 是项目目录。

## Steps

1. 升级前用上一版看：`akb raw release list`、`akb raw list`、`releases.md`、所有卡片的 `release:` 行、`.release-summaries/`。
   `releases.md` 里只剩 v2；#3 显示 `release v2`；归档的 #2 写着 `release: v1`；有 `.release-summaries/v1.md`。
   [01-before.log](01-before.log)

2. 换成这次构建的命令，执行 `akb update`。
   多一行 `releases are retired: deleted docs/kanban/releases.md, cleared the release on 3 cards`，退出码 0。
   [02-update.log](02-update.log)

3. 看 `docs/kanban`、所有卡片的 `release:` 行、#3 的 frontmatter、`.release-summaries/v1.md`，执行 `akb raw validate 3` 和 `git status --short`。
   `releases.md` 没了；`todo/` 和 `.archive/` 里都找不到 `release:`，其他字段原样；`v1.md` 连同更新日志都在；#3 校验通过；改动未提交。
   [03-after.log](03-after.log)

4. 试已经去掉的用法：`akb release list`、`akb raw release list`、`akb raw create --title … --release v2`、`akb raw update 3 --release v2`、`akb guide releases`。
   都被拒绝，退出码 1：`unknown command 'release'`、`unknown option '--release'`（建议 `--related`）、`no guide called "releases"`；`akb raw peek` 仍是 4，没有建卡。
   [04-retired.log](04-retired.log)

5. 执行 `akb raw list`，看归档的 #2，再执行一次 `akb update`。
   #1、#3 照常列出，#3 不再带版本；#2 还在 `.archive/`，标题和 `archived:` 不变。第二次升级是 `nothing to do (safe to re-run)`。
   [05-cards.log](05-cards.log)

6. 在另一个空 git 项目里用这次构建执行 `akb install`。
   新看板没有 `releases.md`，卡片里也没有 `release:` 行。
   [06-new-board.log](06-new-board.log)

## Feedback

- **升级一步到位**：一条 `akb update`，一行说清删了什么、清了几张卡；再跑一次什么也不做。卡片、归档和版本总结都在。
- **说法互相打架**：刚说完「cleared the release on 3 cards」，结尾又是 `Your cards, config, and memory were left alone.`。
- **旧命令只得到 `unknown`**：`akb release` 和 `--release` 没有一句说明版本已经去掉、改用「搁置」；`--release` 还被建议成 `--related`，意思完全不同。旧脚本的作者得自己猜。
- **`.release-summaries/` 成了孤儿**：留下作记录是对的，但看板上已没有任何东西指向它，新用户不知道它为什么在那里。
- **整板校验本来就不过**：`akb raw validate`（不带 id）在新装的看板上就因 #1 设置问题卡缺少 `## Worth noting` 等小节失败，上一版也一样，与本卡无关，所以第 3 步只校验 #3。
- **旧版的关闭会偷偷跑 Agent**：上一版 `release close` 会自动起一个真实的 Agent 写更新日志；种子里用 `KANBAN_RUN` 挡住了它。
- **没有跑到的**：看板界面里版本选择器、徽章的消失；Cloud 看板升级和通知设置；卡片本身是文件夹（`<id>-<slug>/root.md`）的分组卡。
