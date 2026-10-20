# 看工作流列表就知道一张卡该交给哪个工作流

## Setup

- **项目**：一次性 git 项目，`akb install` 新装；`AI4KANBAN_HOME` 指向一个空的临时目录（未登录，Pro 工作流显示为锁定）。
- **终端**：zsh；日志里的 `akb` 就是这次构建出的命令。建卡、讨论想法的 agent 选工作流时读的就是这份列表。

## Steps

1. 执行 `akb workflow list`。
   六个内置工作流，每个名字下一行先说何时选它，再一句做什么：Coding「Use for software changes, and for any work no other workflow covers.」；Slide deck「Use when the deliverable is a slide deck or presentation, including one designed as HTML or TSX pages.」；其余四个都以「Use when the deliverable is …」或「Use when a reference video …」开头。
   [01-list.log](01-list.log)

2. 执行 `akb workflow list --json`，取每项的 `description`。
   与第 1 步逐字相同。
   [02-json.log](02-json.log)

3. 看建卡和讨论想法的指引：`akb guide add-task`、`akb guide discuss-idea`。
   都要求从 `akb workflow list` 里挑「fits the card's work」的那个，优先不带 `Pro · locked` 的；都不合适就不写。
   [03-guides.log](03-guides.log)

## Feedback

- **一眼能分**：每条先说「什么时候用」，用 HTML/TSX 做的路演稿明确归演示稿，不会再被当成编码任务。
- **Coding 是兜底**：「any work no other workflow covers」让别的都不合适的请求有去处，不会落空。
- **说明偏长**：演示稿和图文那两句近 30 词，终端里折成两行，扫读要多看一眼。
- **没有跑到的**：没让真实 agent 把「用 TSX 重做路演稿」这类请求建成卡、看它选中 Slide deck——那要一次付费运行；这里只证明它读到的列表写对了。
