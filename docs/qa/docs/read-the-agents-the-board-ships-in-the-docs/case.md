# 在文档里查看板自带哪些 Agent、各自做什么

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 3 步。
- **读者**：想知道看板会自己跑哪些 Agent、规划时会请哪些专员写卡片的哪一段的人。

## Steps

1. 点右侧目录里的「Roles」。
   页面滚到「Roles」一节：一句「Roles run the board's own flows. You can't add, remove or switch one off.」，下面十条，每条一句——Software planner、Builder、Scriptwriter、Deck planner、Carousel planner、Blog planner、Proposer、Review chats、Describe the project、Memory pruner。**Describe the project** 只说它维护 `docs/kanban/memory/project.md`、规划据此定方向，不再写运行频率。
   ![Roles 一节](01-roles.png)

2. 点目录里的「Specialists」。
   开头一段：专员在规划时只写卡片的一段，规划者按需请来；只有你能做的选择留成待澄清问题。下面十条，`user-docs` 一句「the user documentation the card changes」，排在 `email-planner` 之后；不再写「ships nine」这样的数字。清单下面是自己点名的说法（「put the ui-designer agent on #4」或 `akb spec ui-designer 4`）。
   ![Specialists 一节](02-specialists.png)

3. 在空项目里跑 `akb spec`，数清单上的专员。
   列出 10 个，名字和第 2 步的清单一一对得上，含 `user-docs`（Human review）。
   [akb spec 的清单](03-akb-spec.log)

## Feedback

- **短了很多，扫得完**：Roles 和 Specialists 各一屏，每个 Agent 一句话，想知道「谁干什么」不用再读段落。
- **数字对上了**：去掉「ships nine」以后，页上清单、`akb spec` 都是十个，不会再让人怀疑漏看。
- **频率全没了**：Describe the project、Review chats 都不说多久跑一次；按卡片的原则这是对的，但想知道「它会不会每小时花我一次钱」的人得去 Agent 页上看，这里没有一句指路。
- **Roles 写着「不能关」，「Run an agent on a schedule」又说 Board 下的 Agent 能 Disable**：两处都对（Roles 是规划流程，Board 下是周期 Agent），但 Describe the project、Memory pruner 同时出现在 Roles 清单里，读的人会问它们到底能不能关。
- **`user-docs` 一句太短**：旧文档写了它管什么、不管什么（宣传文案、界面文字），现在只剩一句，和 `copywriting` 的分工要自己猜。
- **没有跑到的**：真的让某个专员在一张卡上写一次（要起真实 agent）；窄屏。
