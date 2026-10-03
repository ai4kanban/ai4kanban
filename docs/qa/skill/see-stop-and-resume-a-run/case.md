# 查看、停止并继续一次运行

## Setup

- **看板**：刚用 `akb install` 建好，删掉了 `setup-checklist.md`；用 `akb raw create` 建了 #2「Slow export of all cards」并提交。
- **Agent**：[stand-in.mjs](../create-a-card-and-let-it-plan/stand-in.mjs)：标题含「slow」的卡要「做」五分钟，每 5 秒打印一行进度；被看板续上时（`--resume`）直接写出 `2.txt`。
- **终端**：zsh，在项目根目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb card implement 2`。
   打印 `implement — run <id> in delivery <id>` 和跟踪、停止的命令。
   [01-implement.log](01-implement.log)

2. 十几秒后执行 `akb run list`。
   这次运行带圆点 `·`，`running 12s`，下面一句 `1 running.`
   [02-running.log](02-running.log)

3. 执行 `akb run log last`。
   打印到目前为止的进度行 `Still working on #2 (5s)…` 等。
   [03-log.log](03-log.log)

4. 不带 id 执行 `akb run stop`。
   回执 `stopping <id>`，停的是最新那次运行。
   [04-stop.log](04-stop.log)

5. 再看运行和卡片。
   运行前是 `■`、`stopped`，并直接给出 `continue it with akb run resume <id>`；卡片仍是 `implementing`。
   [05-stopped.log](05-stopped.log)

6. 照抄执行 `akb run resume <id>`。
   回执 `continuing <id> — run <新 id> in delivery <同一个>`。
   [06-resume.log](06-resume.log)

7. 等它结束后看结果。
   新运行完成；当前分支多一次提交 `Slow export of all cards (#2)`，含 `2.txt`；卡片进了 `.archive/`。
   [07-resumed.log](07-resumed.log)

## Feedback

- **停和续都在手边**：停下后列表那一行直接写着怎么继续，照抄就行，续上的运行仍属于原来那次交付，最后照常落地。
- **`run stop` 不带 id 就停最新的**：单个运行时很方便，但同时跑着几次时容易停错，回执也只给一个短 id，不说停的是哪张卡。
- **续上后旧运行从列表里消失了**：只剩新的那次，看不到「停过一次」这段历史。
- **`run log` 不带 `--follow` 时末尾有几行空行**，看起来像还在等输出。
- **证据的局限**：续上后由替身直接写出结果；真实 agent 是否真的从停下的地方接着做，要看它自己的会话恢复，这次没有验证。
