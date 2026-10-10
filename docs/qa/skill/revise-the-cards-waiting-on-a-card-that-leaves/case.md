# 依赖卡归档或被否决后，等它的卡排上修订

## Setup

- **看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md`；用 `akb raw create --title` 建了 #2「Export to PDF」、#3「Print preview」、#4「Print button」、#5「Share sheet」、#6「Share to Slack」，再 `akb raw update 3 --blocked-by 2`、`4 --blocked-by 2`、`6 --blocked-by 5`，然后提交。加依赖时看板已给 #3、#4、#6 各排上一次「解除阻塞后细化」。
- **定时器**：不开界面；用本目录的 [tick.mjs](tick.mjs) 顶替界面每分钟一次的巡检——它打印看板此刻会启动什么，不启动任何东西，但会取走它选中那张卡的排程标记。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令，`<project>` 是项目目录。

## Steps

1. 执行 `akb raw schedule 4 --clear`，再 `akb raw list`。
   #4 回答 `no longer scheduled (was refine)`；列表里 #3、#4 显示 `blocked by #2`，#6 显示 `blocked by #5`。
   [01-waiting.log](01-waiting.log)

2. 执行 `akb raw archive 2`，看 #4 和 #3 的 frontmatter。
   回执多出两行：`added #2's outcome to the refine queued on #3`、`queued a revise of #4`。#4 有了 `schedule: action: revise`，notes 是 `#2 "Export to PDF" was archived (docs/kanban/.archive/2-export-to-pdf.md). Check this card against what it shipped …`；#3 原来的 refine 不变，notes 换成同一句。
   [02-archive.log](02-archive.log)

3. 执行 `akb raw list`。
   #3、#4 不再显示 `blocked by`；列表里看不到它们排着修订。
   [03-list.log](03-list.log)

4. 执行 `akb raw reject 5 --reason "We share by link only."`，看 #6 的 frontmatter。
   回执 `added #5's outcome to the refine queued on #6`；notes 是 `#5 "Share sheet" was rejected (…). Remove what this card relied on from it; if the card cannot stand without it, ask the user an open question instead.`
   [04-reject.log](04-reject.log)

5. 手工排修订：`akb raw schedule 4 --action revise`（不带 `--notes`），再 `akb raw create --title X --schedule revise`。
   都被拒绝（exit 1）：`a revise needs notes saying what to revise`；新卡的 `--schedule` 只接受 `implement | refine`。
   [05-revise-refused.log](05-revise-refused.log)

6. 提交后跑一次 `tick.mjs`。
   看板先挑 #3：`{"action":"clarify","id":3,…,"notes":"#2 \"Export to PDF\" was archived …"}`，即带着依赖结果去细化。
   [06-tick.log](06-tick.log)

7. 执行 `akb raw schedule 3 --clear`、`akb raw schedule 6 --clear`，再跑 `tick.mjs`。
   #3 回答 `had no schedule`（上一次巡检已取走它的标记）；这次挑 #4：`{"action":"edit","id":4,…}`，notes 同第 2 步，即一次修订运行。
   [07-tick-revise.log](07-tick-revise.log)

## Feedback

- **回执说得清楚**：归档或否决时直接列出哪张卡排上了修订、哪张把结果并进了已排的细化，不用再去翻文件。
- **自相矛盾的交接**：同一次 `raw archive 2` 的「next」里，把看板刚写进 #3、#4 的修订 notes 当成「指向已不在看板上的卡的过时提及」，要 agent 改写——照做的 agent 会把修订指令本身删掉。
- **列表看不到排程**：`akb raw list` 不显示「排着修订 / 细化」，想确认只能打开卡片 frontmatter。
- **notes 是写给 agent 的英文长句**：用户在卡片上看到的是一整句指令，而不是「依赖 #2 已落地，待核对」这样的状态。
