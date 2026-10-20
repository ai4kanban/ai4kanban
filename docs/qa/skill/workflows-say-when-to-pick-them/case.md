# 看工作流列表就知道一张卡该交给哪个工作流

## Setup

- **项目**：一次性 git 项目，`akb install` 新装；`AI4KANBAN_HOME` 指向一个空的临时目录（未登录，Pro 工作流显示为锁定）。
- **终端**：zsh；日志里的 `akb` 就是这次构建出的命令。建卡、讨论想法的 agent 选工作流时读的就是这份列表。

## Steps

1. 执行 `akb workflow list`。
   六个内置工作流，每个名字下一行先说何时选它，再一句做什么：Coding「Use for software changes, and for any work no other workflow covers.」；Social post（id 仍是 `carousel-post`）「Use when the deliverable is a post published on a social platform, text-only or with images, such as a LinkedIn post, an X thread or a carousel.」，规划由 `carousel-planner` 主持、帮手是 `social-illustrator`；Blog post「Use when the deliverable is an article published on the project's own site or blog, whether or not it targets search; a post on a social platform is a Social post.」；其余三个以「Use when the deliverable is …」或「Use when a reference video …」开头。
   [01-list.log](01-list.log)

2. 执行 `akb workflow list --json`，取每项的 `description`。
   与第 1 步逐字相同。
   [02-json.log](02-json.log)

3. 看建卡和讨论想法的指引：`akb guide add-task`、`akb guide discuss-idea`。
   都要求从 `akb workflow list` 里挑「fits the card's work」/「does the work the card will do」的那个，优先不带 `Pro · locked` 的；都不合适就不写。
   [03-guides.log](03-guides.log)

## Feedback

- **社媒帖有了去处**：LinkedIn 长帖、X 串这类纯文字帖以前没有对应工作流，会落到 Coding；现在 Social post 点名了它们，和 Blog post 互相指认边界，一眼能分。
- **名字和 id 对不上**：列表里叫 Social post，id 却还是 `carousel-post`，帮手叫 `social-illustrator`、负责人叫 `carousel-planner`；手写 `--workflow` 时得记旧名。
- **说明偏长**：Social post 和 Blog post 两句都超过 30 词，终端里折成两三行，扫读要多看一眼。
- **dev.to、Medium 没说清**：Blog post 只写「project's own site or blog」，发在第三方博客平台的文章归哪边要靠 agent 自己推断。
- **没有跑到的**：没让真实 agent 把「写一条 LinkedIn 帖」这类请求建成卡、看它选中 Social post——那要一次付费运行；这里只证明它读到的列表写对了。
