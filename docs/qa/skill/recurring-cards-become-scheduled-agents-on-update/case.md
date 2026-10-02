# 升级后，周期任务卡变成定期运行的 Agent

## Setup

- **上一版的看板**：用这次构建之前的 `akb` 在一个空的 git 项目里（`user.name` 设为 `qa`）建板并种卡——先起 `node endpoint.mjs 4517`（本目录的 [endpoint.mjs](endpoint.mjs)，顶替一个待筛选条目的接口，返回两条虚构条目），再执行 `OLD="node <上一版>/cli/bin/ai4kanban.mjs" sh seed.sh`（[seed.sh](seed.sh)）。种下的是：
  - **#2 Fetch triage items**：上一版第一次 `akb triage fetch` 成功后自己种的周期任务卡。
  - **#3 Check for dependency updates**：周期 `7d`、运行过一次，带 `## Run state`，步骤里引用卡旁文件夹 `todo/recurring/dependency-notes/`（[card-dependency-updates.md](card-dependency-updates.md)）。
  - **#4 Sweep stale branches**：没有周期，带一个未回答的 `[user]` 问题（[card-sweep-stale-branches.md](card-sweep-stale-branches.md)）。
  - **#5 Upgrade the linter**：普通卡片，`related` 里写着 #3。
  - **#6 Post the weekly summary**：周期 `7d`，正文只有一段话、没有 `## Process`（[card-weekly-summary.md](card-weekly-summary.md)）。
- **Agent**：第 7 步用 [`run-a-workflow-agent-on-a-schedule/stand-in.mjs`](../run-a-workflow-agent-on-a-schedule/stand-in.mjs) 顶替真实的 Agent（不需要账号）：把它的命令并入 `<project>/.akb/boards/docs/kanban/ui.config.json` 的 `harness` / `harnessSettings`，文件里已有的内容要留着——周期就存在这个文件里。它不照 `AGENT.md` 做事，只往 `CHANGELOG.md` 加一行。
- **定时器**：第 12 步不开界面，用 [`run-a-workflow-agent-on-a-schedule/tick.mjs`](../run-a-workflow-agent-on-a-schedule/tick.mjs) 顶替界面每分钟一次的巡检。
- **终端**：zsh，在项目目录里。日志里的 `akb` 是这次构建出的命令（标了 `# the previous version` 的是上一版），`<project>` 是项目目录。

## Steps

1. 升级前用上一版看一眼：`akb raw list`、`todo/` 和 `triage/` 下的文件、#3 的 frontmatter。
   六张卡，其中四张在 `todo/recurring/` 下；#3 带 `cadence: 7d` 和 `last_run`。
   [01-before.log](01-before.log)

2. 换成这次构建的命令，执行 `akb update`。
   每张卡一行：#3 `is now the scheduled agent … in the Coding workflow — on, cadence 7d`；#4 `off: it had no cadence, so it runs only when you run it`；#2 `removed …`，并指向 `akb guide write-agent`；#6 `could not turn … into a scheduled agent: it has no ## Process …  It is left as it was and tried again next time`。
   [02-update.log](02-update.log)

3. 看 `docs/kanban/todo`、`docs/kanban/agents` 下的文件和两个新的 `AGENT.md`。
   `todo/recurring/` 里只剩 #6。两张卡各成了 `agents/<卡片文件名里的短名>/AGENT.md`：`hook: schedule`，描述是卡片开头一段，标题在 `i18n` 下，开头一段、`## Run state`、`## Process` 原样搬来。卡旁的 `dependency-notes/` 搬到了 `agents/dependency-notes/`，规则里的两处路径跟着改成了 `docs/kanban/agents/dependency-notes/ignore.md`。
   [03-agents.log](03-agents.log)

4. 执行 `akb workflow schedule coding` 和 `akb workflow list`。
   `check-for-dependency-updates  every 7d · last run <卡上的上次运行> · next after <七天后>`；`sweep-stale-branches  off · never run`。两者都在 Coding 下。
   [04-schedule.log](04-schedule.log)

5. 看卡片留下的痕迹：`akb raw list`、`todo/README.md`、#5 的 `related`、`docs/kanban/triage/`、`git status --short`。
   看板上只剩 #1 和 #5；#5 的 `related` 变成 `[]`；#4 的问题成了一条待筛选条目，`meta.source` 是 `agent sweep-stale-branches`，两个选项列在正文里。改动都还没提交。
   [05-leftovers.log](05-leftovers.log)

6. 处理没迁成的 #6：确认 `akb raw list` 里没有它，给卡片补上 `## Process`，再 `akb update`；然后第三次 `akb update`。
   补上之后它成了 `post-the-weekly-summary`，`on, cadence 7d`，`todo/recurring/` 随之消失；列表里它是 `every 7d · never run`，没有下次运行时间。再跑一次什么都不做：`nothing to do (safe to re-run)`。
   [06-failed-then-retried.log](06-failed-then-retried.log)

7. 提交看板，接上替身 Agent，执行 `akb workflow schedule coding --run check-for-dependency-updates`，看 `akb run list`、`akb run log`、`git log`、`git worktree list`。
   启动一次 `scheduled check-for-dependency-updates` 运行；开场白是 `You are the check-for-dependency-updates agent of the Coding workflow …`；它的改动是当前分支上的一个提交 `check-for-dependency-updates: scheduled run (Coding)`，工作区没有留下。
   [07-run.log](07-run.log)

8. 对没有周期的那个执行 `akb workflow schedule coding --run sweep-stale-branches`；再 `--on sweep-stale-branches --cadence 30d`。
   立即运行被拒绝：`` `sweep-stale-branches` is switched off in "Coding" ``，退出码 1——第 2 步说它「runs only when you run it」，实际上停用着就跑不了。给它一个周期才启用，下次运行在一个周期之后。
   [08-run-while-off.log](08-run-while-off.log)

9. 把项目克隆到另一个目录，在那里执行 `akb workflow schedule coding`。
   三个 Agent 都在，但全是 `off · never run`：周期和上次运行时间没有跟着仓库走。
   [09-another-clone.log](09-another-clone.log)

10. 试已经去掉的用法：`akb raw create --title … --recurring`、`--cadence 30d`、`akb raw update 5 --cadence 1d`、`akb raw record-run 3`、`akb raw run 3`、`akb guide recurring-task`，再看 `akb raw create --help`。
    前三条：`--recurring is gone` / `--cadence is gone — repeating work is a scheduled agent now, not a card. Write one with akb guide write-agent.`，退出码 1，没有建卡。`record-run` 和 `run` 是 `unknown command`（后者还问 `Did you mean rule?`）；守则 `recurring-task` 不存在。帮助里不再出现这两个选项。
    [10-retired-commands.log](10-retired-commands.log)

11. 看守则现在怎么说：`akb guide add-task` 的分流、`akb guide write-agent` 的两条新要求。
    重复的工作 → 用 `akb guide write-agent` 写一个 `schedule` Agent，不建卡；两遍之间的状态怎么保存要问用户并写进 `AGENT.md`；用 `akb workflow schedule <workflow> --on <name> --cadence <cadence>` 设周期。
    [11-guides.log](11-guides.log)

12. 另一个上一版的看板，不跑 `akb update`：种两张周期 `1m` 的卡（#2 运行过一次，#3 从未运行），等 65 秒后 `node tick.mjs <cli>/dist/kanban.mjs`；看文件和 `akb workflow schedule coding`；再等 65 秒巡检一次。
    巡检自己先迁了两张卡，并在同一遍里把已经到点的 `check-for-dependency-updates` 列为要启动。从未运行过的那张要从迁移的那一刻起等满一个周期：第一遍不在清单里，列表写 `never run · next after <一分钟后>`，第二遍才列入。
    [12-timer.log](12-timer.log)

13. 在一个这次构建新建的看板上配好接口，第一次执行 `akb triage fetch`。
    `Added 2 items`，只建了 `docs/kanban/triage/`；`todo/` 下没有多出任何卡。
    [13-first-pull.log](13-first-pull.log)

## Feedback

- **升级这一步很省心**：一条 `akb update`，每张卡一行说清去了哪个工作流、叫什么、开没开；规则是卡上的原话，路径也替我改了。没跑 `akb update` 的看板巡检也会迁，不会有卡被漏下。
- **「runs only when you run it」是句空话**：没有周期的卡迁过来是停用的，而停用的 Agent `--run` 被拒绝（第 8 步）。原来「只在我点 Run 时跑」的卡，升级后不给它一个周期就再也跑不了，给了周期它又会自己跑——这种用法没有了，输出却说还在。
- **`Your cards, config, and memory were left alone`**：这句话紧跟在三张卡被删、一张卡的 `related` 被改之后。
- **没迁成的卡从看板上消失**：#6 不在 `akb raw list` 里，界面上也没有，唯一的线索是那一次 `akb update` 的一行输出；巡检迁移时失败则连这一行都没有。
- **没迁成的卡还能被改坏**：探索时对 #6 执行 `akb raw update 6 --priority high`，命令照常成功，但重写 frontmatter 时把 `cadence: 7d` 丢了；之后迁移把它说成「it had no cadence」，以停用状态落地。
- **换台机器全都停了**：周期和上次运行存在 `.akb/` 里，不进仓库。克隆出来的看板上三个 Agent 都是 `off · never run`，没有任何提示说它们在别处是开着的；团队里谁的机器负责跑，得自己约定。
- **有周期但没跑过的 Agent 没有下次运行时间**：`post-the-weekly-summary  every 7d · never run` 后面是空的，要等巡检走过一轮才出现 `next after`；只用命令行的人看不出它什么时候会跑。原来的卡是立即跑第一遍，现在要等满一个周期。
- **卡旁文件夹和 Agent 并排放着**：`agents/dependency-notes/` 里没有 `AGENT.md`，和真的 Agent 文件夹长得一样；不看规则不知道它属于谁。
- **问题换了地方答**：#4 的开放问题成了一条待筛选条目，标题就是问题本身，选项成了正文里的列表；答案不会回到 Agent 的规则里，要自己改 `AGENT.md`。
- **`run` 的报错不指路**：`--recurring`、`--cadence` 都说了去哪，`akb raw record-run` / `run` 只说 `unknown command`，还建议 `rule`。旧脚本和旧的 `## Process` 里写着它的人得自己猜。
- **Agent 的标题只写了一种语言**：迁移把卡片标题写在看板语言（这里是 `zh`）的 `i18n` 下，标题本身是英文原样。
- **没有跑到的**：真实的 Agent 照迁来的 `## Process` 跑一遍并维护 `## Run state`（第 7 步是替身）；写了工作流的卡迁到 Coding 以外的工作流（需要 Pro）；短名已被别的 Agent 占用时在后面加卡片 id；卡片本身是文件夹（`<id>-<slug>/root.md`）；Cloud 看板上的卡；允许自动提交关闭时的一遍；旧的「Prune the memory」卡。
