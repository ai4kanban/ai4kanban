# 在文档里查看板自带哪些 Agent、各自什么时候跑

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 4 步。
- **读者**：想知道看板会自己跑哪些 Agent、规划时会请哪些专员写卡片的哪一段的人。

## Steps

1. 在「The agents that work your board」页往下滚到看板自己的 Agent 清单（Proposer、Memory pruner、Review chats、Describe the project）。
   **Describe the project** 一条说它维护 `docs/kanban/memory/project.md`，「Runs once a card is finished, at most once an hour by default」——按卡片完成来跑，不再说「new commits have landed」。
   ![看板自己的 Agent](01-board-agents.png)

2. 往下滚到「Specialists」一段。
   说专员只在规划时各写卡片的一段，「The board ships nine, and `akb spec` lists them」，下面是清单。
   ![Specialists 开头](02-specialists.png)

3. 往下滚到清单里的 **`user-docs`**。
   **`user-docs`** (User docs) 排在 `email-planner` 之后：写卡片改动到的用户文档（指南、帮助页、文档站、FAQ），改已有页给 diff、新页给整段 Markdown，你确认后构建者照写；内部文档、宣传文案和界面文字不归它；文档偏好记在它的记忆 `writing.md`。
   ![清单里的 user-docs](03-user-docs.png)

4. 在空项目里跑 `akb spec`，数清单上的专员。
   列出 10 个，含 `user-docs`（Human review）。**与第 2 步不符**：文档说 nine，页上清单和命令都是十个。已记待筛选。
   [akb spec 的清单](04-akb-spec.log)

## Feedback

- **「Describe the project」终于说对了时机**：「Runs once a card is finished」和产品现在的触发一致，不用 git 的项目也看得懂它什么时候动。
- **但没说为什么改**：从旧版升级、记得「new commits」的人读不出变化；自定义 Agent 的 `akb.reads: commits` 被当作 `archived-cards` 读，这件事只在「Run an agent on a schedule」的取值清单里少了一个词，没有一句交代。
- **数字错了**：「ships nine」是加 `user-docs` 时没改的旧数，读者对着清单数到十会怀疑漏看了什么。
- **user-docs 和 copywriting 分工清楚**：两条互相写明了对方不管什么（用户文档 / 宣传文案），读者知道一张卡会被谁写哪段。
- **没说它什么时候被请来**：只说「a card changes what a user can see or do」时写，读者不知道没有文档站的项目会不会白跑一次；「writing.md」放在哪也要去「Give an agent memory」一节才找得到。
- **没有跑到的**：真的让 `user-docs` 在一张卡上写一次（要起真实 agent）；窄屏。
