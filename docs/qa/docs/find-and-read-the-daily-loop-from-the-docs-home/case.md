# 从文档首页找到并读完「The daily loop」

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs`，窗口 1280×1000。
- **读者**：刚装好看板、想知道每天怎么用它的新用户。

## Steps

1. 打开 `/docs`。
   标题「AI4Kanban documentation」，导语「An agent workspace for indie hackers…」；左栏三组「Start here」「How it works」「Using the board」，「Overview」高亮；正文七节，从「Install the desktop app」（只有一张「Download AI4Kanban」卡片，没有安装命令）到「Switch between projects」；整页不出现 npm、`akb` 或 `--board`。
   ![文档首页](01-docs-home.png)
   [首页与配图](daily-loop.log)

2. 往下读「Deliver your first card」。
   先是「Connect a coding agent」链接和「Your first card」卡片，下面是交付后的 Diff 截图，图下一句「After your first delivery, use the daily loop to pick work…」；首页三张配图（`delivered`、`draft`、`workflow-on-card`）都加载出来。
   ![Deliver your first card 一节](02-deliver-your-first-card.png)

3. 点这句里的「the daily loop」。
   `/docs/daily-loop` 在新标签页打开，首页留在原标签页；新页标题「The daily loop」，左栏高亮移到「The daily loop」，右侧「On this page」列出 10 个小节加一个子节（「Finish a task」下的「Test cases」），第一项高亮。
   ![The daily loop 页顶部](03-daily-loop.png)
   [标签页前后](03-new-tab.log)

4. 点右侧目录里的「Build a card」。
   页面滚到「Build a card」一节，标题停在页头下方；地址栏带 `#build-a-card`，目录里该项高亮。
   ![Build a card 一节](04-build-a-card.png)

5. 滚到页面底部。
   最后一节是「Keep it lean」；下面是两张翻页卡：左「Previous / Workflows」（How it works），右「Next / Chat」（Using the board）。
   ![页底与翻页](05-end-of-page.png)

6. 点「Next / Chat」。
   进入 `/docs/chat`，从页顶开始显示，左栏高亮移到「Chat」，页标题是「Discuss ideas and update cards」。
   ![下一页 Chat](06-next-page.png)

## Feedback

- **首页终于把新手先送去第一张卡**：「Deliver your first card」排在安装之后，卡片直达「Your first card」，「The daily loop」放到交付之后再读，顺序对了。
- **「The daily loop」入口变弱了**：原来是一张独立卡片，现在只是配图下面一句里的链接，扫读的人容易错过；左栏仍是最稳的入口。
- **正文链接另开标签页**：点「the daily loop」会新开一页，读完首页再回来攒了好几个标签。
- **首页和下一页口径不一**：首页刻意不写命令，点进「The daily loop」第一段就是 `akb skill install`、`akb --help`，只装了桌面应用的人会疑惑要不要开终端。
- **翻页落点名字不一致**：往后是「Chat」，点进去标题叫「Discuss ideas and update cards」，第一眼像点错了。
- **左栏图标撞了**：「The daily loop」和「Follow-ups」用同一个循环箭头。
- **没有跑到的**：窄屏下的这条路径（见 [在文档页之间跳转](../move-between-docs-pages/case.md) 第 5–7 步）、站内搜索、「Copy page」按钮。
