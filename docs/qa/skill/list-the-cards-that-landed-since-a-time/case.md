# 列出某个时间以来落地的卡片

## Setup

- **看板**：一个刚用 `akb install` 建好的看板（项目是 git 仓库），用 `akb workflow new 文档更新` 加了一个自建工作流，id 是 `wf-2`。
- **卡片**：#2「深色模式跟随系统」、#3「导出为 PDF」、#4「更新安装文档」（工作流 `wf-2`）、#5「每周邮件摘要」、#8「修正首页错别字」、#9「调研竞品定价」已用 `akb raw archive` 归档；#6「看板支持自定义字体」归档后文件被手工删掉；#7「手机端看板」还在 `todo/`。
- **落地记录**：在项目目录执行 `node seed.mjs`（[seed.mjs](seed.mjs)）。它顶替真实的看板落地：每次落地做一个空提交，并写一条 `docs/kanban/deliveries/*.json`。#2、#3、#4、#6 各落地一次，#5 落地两次，#7 落地过但卡还在看板上，#8 落地但没有提交（手动提交），#9 没有记录（手动归档）。
- **每日清理**：第 8 步用本目录的 [tick.mjs](tick.mjs) 顶替界面每分钟一次的巡检，看板的每日清理就在其中、一天一次；它只打印看板此刻会启动什么，不启动任何东西（新看板总带一条 `describe-project`，与本用例无关）。
- **终端**：zsh 或 bash，在项目目录里；没有正在跑的看板运行。日志里的 `akb` 就是这次构建出的命令，时间是本机时间。

## Steps

1. 执行 `akb raw list --archived`。
   按落地时间从早到晚列出 6 次落地：每块一行 `#id 标题 (归档文件)`，一行 `工作流 · landed 时间 · commit 提交`。#5 出现两次；#6 没有文件路径；#7、#8、#9 不在其中。
   [01-all.log](01-all.log)

2. 执行 `akb raw list --archived --since "2026-09-30 00:00"`。
   只剩这之后的 3 次落地（#3、#4、#5 的第二次），首行写明 `since 2026-09-30 00:00`。
   [02-since.log](02-since.log)

3. 把上一步最后一张卡的落地时间填回去：`--since "2026-10-01 15:30"`；再试 `--since "2026-10-01 15:31"`。
   前者仍列出 #5 那次落地（同一分钟内不漏卡）；后者回答 `no cards landed since 2026-10-01 15:31.`，退出码 0。
   [03-cursor.log](03-cursor.log)

4. 执行 `akb raw list --archived --workflow wf-2`，再用工作流的名字 `--workflow 文档更新`，再把 `--workflow coding` 和 `--since "2026-10-01 00:00"` 一起用。
   用 id 只列出 #4；用名字被拒绝（exit 1），并列出看板上的工作流 id；两个条件一起用只剩 #5 的第二次落地。
   [04-workflow.log](04-workflow.log)

5. 执行 `akb raw list --archived --since "2026-10-01 00:00" --json`。
   一个 JSON 对象，`cards` 里每项有 `id`、`title`、`workflow`、`landedAt`、`commit`、`file`，另有 `since` 和 `workflow`。
   [05-json.log](05-json.log)

6. 依次试写错的用法：`--since yesterday`、`--since 2026-09-30`、`--since last-run`、`--archived --stale`、`--archived --module skill`、不带 `--archived` 的 `--since` 和 `--workflow`。
   每条都被拒绝（exit 1），一行说明原因；读不懂的时间会给出 `"YYYY-MM-DD HH:MM"` 的示例；`last-run` 的报错说它只在周期 Agent 的运行里可用，别处要写出时间。
   [06-refusals.log](06-refusals.log)

7. 执行 `akb raw list --help`。
   说明里有一段 `--archived`：回答「这段时间落地了哪些卡」；归档文件不在 `.archive/` 里（例如被手工删掉）时路径留空，被每日清理删掉的卡连同已结束的交付记录一起移除、不再列出；手动归档、手动提交、只产出文件的卡不在其中。选项里有 `--archived`、`--since`、`--workflow`，`--since` 的说明里带一句：在周期 Agent 的运行里，`last-run` 是它上一遍开始的时刻。
   [07-help.log](07-help.log)

8. 把 #2 卡片上的 `archived:` 改成 45 天前、把 #6 的交付记录文件的修改时间改成 14 天前（顶替时间流逝），执行 `node tick.mjs <cli>/dist/kanban.mjs`，再看 `.archive/`、`deliveries/` 和 `akb raw list --archived`。
   每日清理删掉了过期的 #2 和它的交付记录，也删掉了 #6 这条卡片早已不在的记录；其余卡片和记录都在。清单只剩 4 次落地，#2、#6 都不再出现。
   [08-cleanup.log](08-cleanup.log)

## Feedback

- **拿来就能用**：一条命令给齐 id、标题、时间和提交，时间能原样填回 `--since`，按周期运行的 agent 不用再翻提交历史。
- **「6 cards landed」其实是 5 张卡 6 次落地**：#5 落地两次就算两张，首行的数字和下面的卡对不上；说 landings 更准。
- **少了的卡没有任何交代**：#7、#8、#9 悄悄不在清单里，输出不提有几条被略过；只有读过 `--help` 才知道手动提交和手动归档的卡不算，用这两种方式工作的看板只会看到一句 `no cards landed.`。
- **清单会自己变短**：过了 30 天的卡被每日清理删掉后，它的落地也从清单里消失，无法再查到；`--help` 现在说清了这一点，空路径的那一块也有了解释。想留长期落地记录的人得靠 git 历史。
- **`--workflow` 只认 id**：自建工作流的 id 是 `wf-2` 这种编号，清单里显示的也是它而不是「文档更新」；用名字会被拒绝，好在报错列出了全部 id。
- **只给日期不行**：`--since 2026-09-30` 被拒绝，必须带上 `HH:MM`；报错里有示例，但「上周以来」这种最常见的问法多打了一截。
- **游标会重复最后一张**：把上次最后一张卡的时间填回去会再看到它一次，要自己去重或加一分钟；这一点只写在卡片里，`--help` 没提。
- **`last-run` 在终端里试不了**：它只在周期 Agent 的运行里有值，自己在终端敲会被拒绝；报错说清了原因。
- **提交是完整 40 位**：方便直接 `git show`，但一行很长。
- **没有跑到的**：落地记录是 `seed.mjs` 写的，没有起真实的 agent 运行让看板自己落地；第 8 步的「45 天前」「14 天前」是改日期和修改时间顶替的；Cloud 看板上的同一清理（在服务端执行）没有跑；分组卡（归档为 `root.md`）也没有在这里验证；`--since last-run` 在运行里的两种回答在 `run-a-workflow-agent-on-a-schedule` 那个用例里跑。
