# 看工作流列表就知道一张卡该交给哪个工作流

## Setup

- **项目**：一次性 git 项目，`akb install` 新装；`AI4KANBAN_HOME` 指向一个空的临时目录（未登录，Pro 工作流显示为锁定）。
- **终端**：zsh；日志里的 `akb` 就是这次构建出的命令。建卡、讨论想法的 agent 选工作流时读的就是这份列表。

## Steps

1. 执行 `akb workflow list`。
   六个内置工作流，每个名字下一行先说何时选它，再一句做什么：Coding「Use for software changes, and for any work no other workflow covers.」；Social post（id 仍是 `carousel-post`）「Use when the deliverable is a post published on a social platform, text-only or with images, such as a LinkedIn post, an X thread or a carousel.」，规划由 `carousel-planner` 主持、帮手是 `social-illustrator`；Blog post「Use when the deliverable is a titled article on its own page, on the project's site or a platform such as dev.to or Medium; a post read in a feed is a Social post.」；其余三个以「Use when the deliverable is …」或「Use when a reference video …」开头。
   [01-list.log](01-list.log)

2. 执行 `akb workflow list --json`，取 `workflows` 里每项的 `description`。
   与第 1 步逐字相同。
   [02-json.log](02-json.log)

3. 看建卡和讨论想法的指引：`akb guide add-task`、`akb guide discuss-idea`。
   都要求从 `akb workflow list` 里挑「fits the card's work」/「does the work the card will do」的那个，优先不带 `Pro · locked` 的；都不合适就不写。
   [03-guides.log](03-guides.log)

## Feedback

- **博客和社媒帖按形式分**：Blog post 改成「有标题、独立成页的文章」，点名 dev.to 和 Medium，Social post 是「在信息流里读的帖子」；「发到 Medium」这类请求不再看发布地点猜归属，两句互相指认边界，一眼能分。
- **名字和 id 对不上**：列表里叫 Social post，id 却还是 `carousel-post`，帮手叫 `social-illustrator`、负责人叫 `carousel-planner`；手写 `--workflow` 时得记旧名。
- **说明偏长**：Social post 和 Blog post 两句都超过 30 词，终端里折成两三行，扫读要多看一眼。
- **两边都上锁**：未登录时 Blog post 和 Social post 都是 `Pro · locked`，建卡指引又要求优先选没上锁的，免费用户的博客请求多半落到 Coding。
- **没有跑到的**：没让真实 agent 把「写一篇发到 Medium 的文章」这类请求建成卡、看它选中 Blog post——那要一次付费运行；这里只证明它读到的列表写对了。
