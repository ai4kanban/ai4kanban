# 在文档里查看板自带哪些 Agent、各自做什么

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 7 步。
- **读者**：想知道看板自己会跑哪些 Agent、规划时会请哪些专员、怎么给它们定规矩的人。

## Steps

1. 打开 `/docs/agents`。
   标题「Configure your agents」，副标题「Start with built-in agents. Give them your rules or create custom agents for the work you need.」；第一段说工作流的 Agent 在 **Configuration → Workflows**、全看板的在 **Configuration → Board**。右侧目录：Roles、Specialists（下挂 Coding、Product video (Pro)、Blog post (Pro)）、Give an agent a rule、Run an agent on a schedule、Add one of your own、Choose what an agent runs on。
   ![Agents 页顶部](01-agents-top.png)

2. 点右侧目录里的「Roles」。
   页面滚到「Roles」，目录里该项高亮。六条，每条一句：Planning helper、Workflow planners（哪些要 Pro 链到 Workflows 页）、Builder、Suggest follow-up work（链到 Follow-ups）、Review chats 和 Tidy memory（链到 Memory）、Describe the project（维护 `memory/project.md`）。
   ![Roles 一节](02-roles.png)

3. 点目录里的「Specialists」。
   一段说明后分三张表：Coding 7 个（ui-designer、copywriting、illustrator、prompt-writer、email-planner、tech-stack-advisor、competitor-research）、Product video (Pro) 3 个、Blog post (Pro) 2 个（blog-researcher、blog-illustrator），共 12 个。每行左边一个和正文字一样高的像素头像，表行不被撑高。表下一句：Slide deck、Social post、Video clone 没有专员；再一句给点名说法（「put the ui-designer agent on #4」或 `akb spec ui-designer 4`）。
   ![Specialists 一节](03-specialists.png)

4. 放大看 Blog post (Pro) 表的头像。
   blog-researcher 是胸前抱着蓝色地球仪的专属角色，和旁边 blog-illustrator 一样有自己的道具；12 个头像里没有通用机器人底图。
   ![Blog post 表放大 3 倍](04-blog-post-art.png)

5. 点目录里的「Give an agent a rule」。
   一段讲规则框和 `docs/kanban/rules/<agent>.md`；下面只一句「See Memory to edit preferences and decisions, share notes between agents, and review finished card chats.」，页上没有讲记忆的小节。
   ![Give an agent a rule 一节](05-give-a-rule.png)

6. 点那句里的「Memory」。
   `/docs/memory` 在新标签页打开；Agents 页留在原标签页。
   [标签页前后](06-memory-link.log)

7. 在空项目里跑 `akb spec`，数清单上的专员。
   列出 12 个，名字和第 3 步三张表一一对得上，`blog-researcher` 在内。
   [akb spec 的清单](07-akb-spec.log)

## Feedback

- **短，好扫**：Roles 六条，每条一句，「哪些要 Pro」交给 Workflows 页。
- **按工作流分表很直观**：做博客的人只看 Blog post 一张表；头像和看板配置页是同一张图。
- **缺图的那一格补上了**：blog-researcher 换成举地球仪的专属角色，Blog post 表不再一格像没做完。
- **头像仍太小**：和字一样高（约 15px），不放大看不出地球仪还是望远镜；Coding 表里被列宽挤成 14×15，略变形。
- **三张表列宽不齐**：每张表各自排版，「Specialist」「Work」两列上下不对齐；`competitor-research` 在名字列里折成两行。
- **站内链接仍开新标签页**：读文档时跳一下就多一个标签页。
- **数字对上了**：页上 12 个专员，`akb spec` 也是 12 个。
- **没有跑到的**：窄屏；真实部署后的页面；看板 Agent 页里 blog-researcher、video-cloner 的新头像（属 local-ui 模块）。
