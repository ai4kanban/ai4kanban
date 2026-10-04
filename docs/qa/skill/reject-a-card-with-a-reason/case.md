# 带着原因否决一张卡

## Setup

- **看板**：一个刚用 `akb install` 建好的看板，`todo/` 里有普通卡 #2「深色模式跟随系统」、#3「导出为 PDF」、#4「看板支持自定义字体」、#5「每周邮件摘要」（`blocked_by: [2]`、`related: [3]`，正文提到 #2）、#9「看板按周归档」，以及一个分组 `todo/6-mobile-board/`（`root.md` 加子任务 #7、#8）。
- **终端**：zsh 或 bash，在看板所在的项目目录里；没有正在跑的看板运行。日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb card reject 2 $'和系统设置重复：macOS 已经能按时间切换外观。\n用户说的"跟随"其实是想要定时，it\'s 另一张卡的事。'`。
   当场完成，不起运行：回执是 `rejected #2: moved file … → docs/kanban/.archive/2-dark-mode-follows-system.md, marked rejected`，并说明已把 #2 从 #5 的 `blocked_by` 里摘掉；`akb run list` 什么都没有。
   [01-reject.log](01-reject.log)

2. 看归档文件的 frontmatter。
   `rejected: true` 下面有 `rejected_reason`（两行原文、双引号和撇号都和输入的一样）、`rejected_at` 和 `rejected_by: user`。
   [02-archived-card.log](02-archived-card.log)

3. 看 #5。
   `blocked_by` 变成空的；正文里「沿用 #2 的深色模式」原样保留。
   [03-other-card.log](03-other-card.log)

4. 不给原因，执行 `akb card reject 3`。
   被拒绝（exit 1）：`say why the card is being dropped, or pass --discard to just drop it`；卡还在 `todo/`。
   [04-no-reason.log](04-no-reason.log)

5. 执行 `akb card reject 3 --discard`。
   卡片进归档，有 `archived` 和 `rejected: true`，没有原因，也没有 `rejected_at` / `rejected_by`；#3 从 #5 的 `related` 里摘掉。
   [05-discard.log](05-discard.log)

6. 执行 `akb card reject 4 --discard 字体不在这个版本的范围内`。
   归档文件里带着 `rejected_reason`，仍没有 `rejected_at` / `rejected_by`。
   [06-discard-with-reason.log](06-discard-with-reason.log)

7. 执行 `akb raw reject 6 --reason 今年不做手机端`。
   整个文件夹移到 `.archive/6-mobile-board/`，`root.md` 和两个子任务都带同样的 `rejected_reason`、`rejected_at`、`rejected_by: user`。
   [07-group.log](07-group.log)

8. 在还没否决的 #9 的 frontmatter 里手写一行 `rejected_reason: "以后再说"`，执行 `akb raw validate 9`。
   校验失败（exit 1），指到这一行：`rejected_reason is only kept on a rejected card. Only akb raw reject writes it; remove the line.`
   [08-validate.log](08-validate.log)

## Feedback

- **一条命令就完事**：原因直接跟在卡号后面，不用加引号的单行原因也行；不再起会话、不再要求照抄收尾命令，比以前省一大步。
- **依赖摘得干净，正文不动**：回执逐条说从哪张卡的哪个字段摘掉了，一眼能看懂；但 #5 正文里「沿用 #2」这句还在，要等它下次细化才改，看卡的人会读到一张已否决的卡。
- **回执不说原因存没存**：`rejected #2 … marked rejected` 和丢弃时的回执几乎一样，看不出原因有没有进文件、会不会被学习；要打开归档文件看 `rejected_at` 才知道。
- **丢弃和否决的区别藏在字段里**：`--discard` 带了原因也不会被学习，区别只在有没有 `rejected_at`，命令输出里看不到。
- **写下就改不了**：没有命令能改或撤掉归档卡上的原因，打错字只能手改 `.archive/` 里的文件。
- **报错前缀带着全路径**：不在 PATH 上时，「必须给原因」的报错以 `node …/ai4kanban.mjs:` 开头（日志里已换成 `akb`）。
- **没有跑到的**：每日回顾从原因里学出「用户不要的东西」（要起真实 agent 运行）；在运行里否决的卡记成 `rejected_by: agent`；PowerShell / cmd 下多行原因的写法。
