# 建一张只点名竞品的卡，让竞品调研拿整个产品对比

## Setup

- **项目**：一次性 git 项目，放一个小产品 `tik`（终端待办清单：`README.md` 写明 add / ls / done / rm / tag，不支持同步、提醒、共享；`src/tik.py` 实现），`akb install` 新装，删掉 `setup-checklist.md`；看板里没有 `memory/competitors/`。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），能用 WebSearch、WebFetch。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令，`<project>` 是项目目录。

## Steps

1. 执行 `akb create "和 Todoist 对比一下"`。
   立即返回一次 `create` 运行和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 等运行结束，打开新卡 #2。
   卡片按调研卡写：`## Todo` 只有一条「审阅完对比摘要后归档本卡」，状态 `todo`、不设 ready，`Decided by the agent` 写明不进入构建；还没有调研结果，只问一个 `[user]` 问题（对比用来做什么，推荐 A「找出值得补的功能差距」）。
   [02-created-card.log](02-created-card.log)

3. 执行 `akb card resolve 2 "选 A：找出 tik 值得补的功能差距。"`，等运行结束。
   `resolve #2` 读 `akb raw memory-file competitors`，再用 WebFetch 读 Todoist 的定价和帮助页，最后写竞品记忆和卡上的调研一节。
   [03-resolve.log](03-resolve.log)

4. 执行 `akb raw list`，打开卡片 #2。
   #2 仍是 `todo`、没有问题；新增 `## By \`competitor-research\` agent`：一张 Todoist 对 tik 的整产品表，10 行各是一项主要功能（日期输入、重复任务、优先级、项目与子任务、标签与筛选、提醒、多端同步、协作、备份与导出、价格），之后是 Verdict 和 7 个 Todoist 官方来源；`## Todo` 仍只有那一条归档。
   [04-card.log](04-card.log)

5. 看 `docs/kanban/memory/competitors/`。
   新建了索引 `README.md`，第一行 `- [Todoist](todoist.md): …`，下面留着 `## Not competitors (False positives)`；`todoist.md` 有 `last_read`、15 条 `## Features`（tik 已有的 Labels 打了勾）和 `## Sources`。
   [05-memory.log](05-memory.log)

6. 对照：执行 `akb create "加重复任务：比如 tik add \"交房租\" --every month。参考一下 TickTick 是怎么做重复任务的。"`，等运行结束后看卡片 #3 和竞品记忆。
   #3 是功能卡，状态 `ready`，带 TickTick 对重复任务的 5 行对比表；`memory/competitors/` 里仍只有 `README.md` 和 `todoist.md`，唯一的改动是 Todoist 的「Recurring due dates」末尾加了 `(#3)`；运行汇报写明没把 TickTick 加进记忆，因为哪些算竞品由用户决定。
   [06-feature-card.log](06-feature-card.log)

## Feedback

- **一句话就有一份能留下的竞品档案**：卡上的表看完即可归档，`todoist.md` 留在记忆里，下一张功能卡（#3）直接在它上面打 `(#3)`，调研没有白做。
- **调研要等回答完问题才跑**：`create` 只写卡和一个「对比用来做什么」的问题，明说「没跑调研」；用户得再 `resolve` 一次才看到结果。对只点名竞品的卡，这个问题的价值不大，A/B/C 的差别只是表的写法。
- **表比竞品功能清单短**：卡上 10 行、记忆里 15 条，日历视图、活动记录、AI 语音输入、API 只在记忆里，卡上看不到，想看全得打开 `todoist.md`。
- **调研卡和功能卡在看板上不好分辨**：#2 是 `todo`、#3 是 `ready`，`raw list` 没有别的标记说明 #2 是「看完就归档」的卡，要打开卡片才知道。
- **列表外的产品不留痕**：TickTick 的对比只写在 #3 上，记忆里没有它，也没有「要不要加进竞品」的提示；用户想留下它得自己改索引。
- **没有跑到的**：在看板界面里看这两张卡；一张卡同时点名多个竞品（每个竞品一张表）；索引里已有、但 `last_read` 超过三个月的竞品重新核实；看完后归档 #2。
