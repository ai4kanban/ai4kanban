# 用命令行让工作流里的一个 Agent 按周期自己运行

## Setup

- **看板**：一个刚用 `akb install` 建好的看板（项目是 git 仓库，`user.name` 设为 `qa`），删掉 `docs/kanban/setup-checklist.md`；自动 Git 提交是默认的开启。
- **周期 Agent**：手写 `docs/kanban/agents/changelog-keeper/AGENT.md`——`akb.hook: schedule`，正文一句「每张自上次运行以来落地的卡在 `CHANGELOG.md` 加一行，用 `akb raw list --archived --since last-run` 列出它们」；连同看板一起提交。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替真实的 Agent（不需要账号）——在 `<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs <路径>/cli/bin/ai4kanban.mjs"}}}`。它把收到的开场白和额外要求原样说出来，执行 `akb raw list --archived --since last-run`，再往 `CHANGELOG.md` 加一行；额外要求里写「change nothing」就什么都不改，写「fail」就以失败结束。
- **定时器**：不开界面；用本目录的 [tick.mjs](tick.mjs) 顶替界面每分钟一次的巡检——它只打印看板此刻会自己启动什么，不启动任何东西。新看板每次都还想跑一次 `describe-product`，与本用例无关。
- **落地**：第 5 步用本目录的 [land.mjs](land.mjs) 顶替一次真实的卡片落地（一个提交加一条 `docs/kanban/deliveries/*.json`）。
- **终端**：zsh，在项目目录里。日志里的 `akb` 就是这次构建出的命令，`<project>` 是项目目录；为了不必等一天，周期用 `1m`。

## Steps

1. 执行 `akb workflow schedule coding`，再看 `akb workflow list` 里「Coding」那几行。
   还没被任何工作流收下的周期 Agent 归在 Coding 下，是关着的：`changelog-keeper  off · never run`；`workflow list` 在两个阶段下面多一行 `scheduled`。
   [01-list.log](01-list.log)

2. 执行 `akb workflow schedule coding --on changelog-keeper --cadence 1m`，再列一次。
   回答 `changelog-keeper on, changelog-keeper: every 1m`；列表变成 `every 1m · never run · next after <一分钟后>`，`workflow list` 的那一行相同。
   [02-switch-on.log](02-switch-on.log)

3. 马上执行 `node tick.mjs <cli>/dist/kanban.mjs`；等 65 秒再执行一次。
   刚开启时看板不会启动它；过了一个周期，要启动的清单里多出 `{"action":"scheduled","workflow":"coding","specAgent":"changelog-keeper"}`。
   [03-due.log](03-due.log)

4. 执行 `akb workflow schedule coding --run changelog-keeper`，几秒后看 `akb run list`、`akb run log`、`git log`、`git worktree list`，再列一次周期 Agent。
   立即启动一次运行，`run list` 里是 `scheduled changelog-keeper  done`。Agent 收到的开场白只有三句：它是 `Coding` 工作流的 `changelog-keeper`、看板目录的绝对路径、`Nobody is watching: never ask.`；`--since last-run` 回答 `this is the first run, so no cards are listed.`。它的改动成为当前分支上的一个提交，标题 `changelog-keeper: scheduled run (Coding)`，工作区没有留下；列表显示 `last run <这次开始的时刻> · next after <一个周期后>`。
   [04-run-now.log](04-run-now.log)

5. 新建并归档一张卡（`akb raw create --title "Dark mode follows the system"`、`akb raw archive 2`、`node land.mjs 2 "Dark mode follows the system"`），再 `--run changelog-keeper`，看 `akb run log`。
   这一次 `--since last-run` 列出 `1 card landed since <上次运行开始的时刻>` 和 #2；`CHANGELOG.md` 多一行，又是一个同名提交。
   [05-landed-since.log](05-landed-since.log)

6. 执行 `akb workflow schedule coding --on changelog-keeper --extra "Change nothing this time."`，等 65 秒后 `--run changelog-keeper`，看 `akb run log`、`git log -1` 和列表。
   Agent 说出收到的额外要求；运行成功但没有新提交（`git log -1` 还是上一步的提交），上次运行时间照样前进一分钟。#2 被再列了一次。
   [06-nothing-changed.log](06-nothing-changed.log)

7. 把额外要求改成 `"Fail this time."`，等 65 秒后 `--run`；看 `akb run list`、列表、`git worktree list`；马上 `node tick.mjs`，等 65 秒再一次；然后 `--extra ""` 清掉要求、再 `--run`，看 `akb run list` 和 `git worktree list`。
   失败的一遍是 `✗ … error`，后面提示 `akb run resume <id>`；上次运行时间没有动，它的工作区 `.akb/worktrees/delivery/<id>` 还留着。失败后的一分钟内看板不再启动它，过一个周期才重新列入。新的一遍成功后，失败那一遍的工作区被清掉，上次运行时间前进。
   [07-failed.log](07-failed.log)

8. 把看板的「Automatic Git commits」关掉（日志里直接把 `ui.config.json` 的 `autoCommit` 写成 `false`），`--run`；看 `akb run list`、`git status --short`、`git log -1`；不提交就再 `--run` 一次，等 65 秒后 `node tick.mjs`；`git commit -qam changelog` 之后第三次 `--run`。
   运行成功，改动留在项目里没提交（` M CHANGELOG.md`），没有新提交。再运行被拒绝：`Commit or stash your changes before starting.` 并列出 `CHANGELOG.md`，退出码 1——而 `tick.mjs` 仍把它列为到点。提交之后才又能运行。
   [08-manual-commits.log](08-manual-commits.log)

9. 重新打开自动提交，执行 `akb workflow schedule coding --off changelog-keeper`，列一次；`--run changelog-keeper`；等 65 秒 `node tick.mjs`；再 `--on changelog-keeper`，列一次。
   列表变成 `off · last run <时刻>`，没有下次运行时间；立即运行被拒绝：`` `changelog-keeper` is switched off in "Coding" ``，退出码 1；过了一个周期看板也不启动它。重新开启后周期和上次运行时间都还在，下次运行从开启的那一刻起算一个周期。
   [09-off.log](09-off.log)

10. 依次试写错的用法：`--on builder`、`--on release-notes`（看板上没有的名字）、不带 Agent 的 `--cadence 1d` 和 `--extra "Keep it short."`、`--on changelog-keeper --cadence weekly`、`akb workflow schedule docs`，以及在运行之外执行 `akb raw list --archived --since last-run`。
    每条都被拒绝（exit 1），一行说明原因：没声明 `akb.hook: schedule`、没有这个 Agent、要指明是哪个 Agent、读不懂的周期（附写法示例）、没有这个工作流（列出全部 id）、`--since last-run` 只在周期 Agent 的运行里可用。
    [10-refusals.log](10-refusals.log)

11. 执行 `akb workflow schedule --help`，再看 `akb raw list --help` 里 `--since` 那一行。
    说明里写明：不带改动就是列出；周期 Agent 声明 `akb.hook: schedule`，不随卡片、每个周期运行一次，改动像一次构建那样提交并落地；开启后过一个周期才第一次运行。`--since` 的说明多了 `last-run`。
    [11-help.log](11-help.log)

## Feedback

- **一条命令就能用起来**：写好 `AGENT.md`，`--on … --cadence …` 一行开启，`--run` 马上看到一个带固定标题的提交；列表一行里有周期、上次和下次运行，够看。
- **新写的 Agent 自己跑进了 Coding**：没人把它加进任何工作流，它就以「off」出现在 Coding 下。想让它属于另一个工作流的人得先知道这一点；`--help` 没提。
- **被拒绝的命令改了一半**：`--on changelog-keeper --cadence weekly` 报周期写错、退出码 1，但 `--on` 已经生效——在它关着的时候试这条命令，Agent 被悄悄开启了（探索时实测）。
- **`--cadence`、`--extra` 借 `--on` 指人**：只想改周期也得写 `--on <agent>`，对已经开着的 Agent 回答里还多一句「changelog-keeper on」；清空额外要求要写 `--extra ""`，回答仍是「extra requirements」，看不出是清掉了。
- **手动提交模式下会卡住，而且没人说**：上一遍留下的文件没提交，后面每一遍都被拒绝；拒绝的话只说「Commit or stash your changes」，不提这是周期 Agent 自己上一遍留下的。巡检每分钟仍把它列为到点，等于每分钟撞一次墙；`akb workflow schedule` 的列表里也看不出它卡住了。
- **失败和成功在列表里一个样**：失败的一遍只在 `akb run list` 里看得到，`akb workflow schedule` 的那一行只是上次运行时间没动。`run resume` 的提示在下一遍启动时就作废了——半成品连同工作区一起被丢掉，没有任何一句话提醒。
- **`last-run` 会把同一张卡给两次**：时间只精确到分钟，上一遍开始的那一分钟里落地的卡，下一遍还会列出来；Agent 得自己去重。
- **没改动的一遍也算跑过**：上次运行时间照常前进，这符合「成功才推进」；但提交历史里没有痕迹，要去 `akb run list` 才知道它来过。
- **`--help` 里一句话两个意思**：`--extra` 的说明写「the --on or --off agent」，`--cadence` 只写「the --on agent」，实际两者都能跟 `--off`、`--run` 一起用。
- **没有跑到的**：真实的 Agent（这里是替身，开场白之后的规则、文件、记忆几段没有逐段核对）；产出文件的工作流（需要 Pro）；上一遍还在合入时不启动新的一遍；`akb run resume` 继续失败的一遍；界面的真实定时器（由 `tick.mjs` 顶替，没有真的让看板自己启动一遍）；`1d at 09:30` 这种带时刻的周期。
