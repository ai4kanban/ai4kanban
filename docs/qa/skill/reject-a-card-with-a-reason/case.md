# 带着原因否决一张卡

## Setup

- **看板**：一个刚用 `akb install` 建好的看板，`todo/` 里有四张普通卡 #2「深色模式跟随系统」、#3「导出为 PDF」、#4「看板支持自定义字体」、#5「每周邮件摘要」，以及一个分组 `todo/6-mobile-board/`（`root.md` 加子任务 #7、#8）。
- **终端**：zsh 或 bash，在看板所在的项目目录里；没有正在跑的看板运行。日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb card reject 2 $'和系统设置重复：macOS 已经能按时间切换外观。\n用户说的"跟随"其实是想要定时，it\'s 另一张卡的事。' --print`。
   什么都没启动；打印出的收尾命令第 2 条是 `akb raw reject 2 --reason $'…\n…'`，两行原因写成一行，引号已转义。
   [01-print.log](01-print.log)

2. 原样复制这条收尾命令并执行。
   回执是 `rejected #2: moved file … → docs/kanban/.archive/2-dark-mode-follows-system.md, marked rejected`，`.archive/` 里多出这张卡。
   [02-reject.log](02-reject.log)

3. 看归档文件的 frontmatter。
   `rejected: true` 下面多一行 `rejected_reason`，两行原文、双引号和撇号都和输入的一样。
   [03-archived-card.log](03-archived-card.log)

4. 执行 `akb raw reject 3 --discard`。
   卡片进归档，有 `archived` 和 `rejected: true`，没有 `rejected_reason`。
   [04-discard.log](04-discard.log)

5. 执行 `akb raw reject 4 --discard --reason "字体不在这个版本的范围内"`。
   回执仍是 `discarded #4 … no memory written`，归档文件里带着 `rejected_reason`。
   [05-discard-with-reason.log](05-discard-with-reason.log)

6. 执行 `akb raw reject 6 --reason "今年不做手机端"`。
   整个文件夹移到 `.archive/6-mobile-board/`，`root.md` 和两个子任务都带同一行 `rejected_reason`。
   [06-group.log](06-group.log)

7. 在还没否决的 #5 的 frontmatter 里手写一行 `rejected_reason: "以后再说"`，执行 `akb raw validate 5`。
   校验失败（exit 1），指到这一行：`rejected_reason is only kept on a rejected card. Only akb raw reject writes it; remove the line.`
   [07-validate.log](07-validate.log)

## Feedback

- **原因确实留下了**：多行、带引号的原因照抄收尾命令就原样进了归档文件，不用自己想怎么转义，这是最省心的地方。
- **回执不说原因存没存**：`rejected #2 … marked rejected` 和没给原因时一模一样，要自己打开文件才知道那行写进去了；写下后又改不了，这里更该说一句。
- **打印流程里的 `reason` 一栏排版断了**：多行原因的第二行顶到行首，和下面的 `memory` 一栏混在一起，读起来像另一个字段。
- **收尾命令只能在 bash / zsh 里照抄**：`$'…'` 在 PowerShell、cmd 和 fish 里都不成立，打印出的命令旁边没有任何提示。
- **写下就改不了**：没有命令能改或撤掉归档卡上的原因，打错字只能手改 `.archive/` 里的文件；原因随看板提交和同步，写之前没有任何提醒。
- **丢弃也能带原因**：`--discard --reason` 可用，但回执仍说「no memory written」，容易让人以为原因也没留。
- **校验报错清楚**：指到行号、说明只有 `raw reject` 会写它。顺带一提，新装的看板上不带卡号的 `akb raw validate` 会先被设置卡 #1 的五条错误淹没（与这次改动无关），所以这里只校验 #5。
- **没有跑到的**：看板启动的否决运行（不传 `--reason`，由命令读运行记录里的原因）要起一个真实的 agent 运行，这次没有跑；PowerShell / cmd 下的行为也没有验证。
