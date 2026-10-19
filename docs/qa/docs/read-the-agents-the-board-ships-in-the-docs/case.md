# 在文档里查看板自带哪些 Agent、各自做什么

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 5 步。
- **读者**：想知道看板自己会跑哪些 Agent、规划时会请哪些专员、怎么给它们定规矩的人。

## Steps

1. 打开 `/docs/agents`。
   标题「Configure your agents」，副标题「Start with built-in agents. Give them your rules or create custom agents for the work you need.」；第一段说工作流的 Agent 在 **Configuration → Workflows**、全看板的在 **Configuration → Board**。右侧目录：Roles、Specialists（下挂 Coding、Product video (Pro)、Blog post (Pro)）、Give an agent a rule、Run an agent on a schedule、Add one of your own、Choose what an agent runs on。
   ![Agents 页顶部](01-agents-top.png)

2. 点右侧目录里的「Roles」。
   页面滚到「Roles」，目录里该项高亮。六条，每条一句：Planning helper、Workflow planners（哪些要 Pro 链到 Workflows 页）、Builder、Suggest follow-up work（链到 Follow-ups）、Review chats 和 Tidy memory（链到 Memory）、Describe the project（维护 `memory/project.md`）。
   ![Roles 一节](02-roles.png)

3. 点目录里的「Specialists」。
   一段说明后分三张表：Coding 7 个（ui-designer、copywriting、illustrator、prompt-writer、email-planner、tech-stack-advisor、competitor-research）、Product video (Pro) 3 个、Blog post (Pro) 2 个（blog-researcher、blog-illustrator），共 12 个。每行左边一个和正文字一样高的像素头像，表行不被撑高；blog-researcher 用的是通用机器人图。表下一句：Slide deck、Carousel post、Video clone 没有专员；再一句给点名说法（「put the ui-designer agent on #4」或 `akb spec ui-designer 4`）。
   ![Specialists 三张表](03-specialists.png)

4. 点目录里的「Give an agent a rule」。
   一段讲规则框和 `docs/kanban/rules/<agent>.md`；下面只一句「See Memory to edit preferences and decisions, share notes between agents, and review finished card chats.」，页上没有讲记忆的小节。
   ![Give an agent a rule 一节](04-give-a-rule.png)

5. 点那句里的「Memory」。
   `/docs/memory` 在新标签页打开；Agents 页留在原标签页。
   [标签页前后](05-memory-link.log)

6. 在空项目里跑 `akb spec`，数清单上的专员。
   列出 12 个，名字和第 3 步三张表一一对得上，`blog-researcher` 在内。
   [akb spec 的清单](06-akb-spec.log)

> **证据环境**：main（01ddb6ac）上本地站点所有 `/docs` 页都是 500——`llms.txt` 里 Agents 的描述没跟着 #1728 改（[500 日志](00-docs-500.log)，已报待筛选）。以上截图取自 `web/` 的临时副本，只把 `public/llms.txt` 那一行换成新描述；线上 ai4kanban.dev 仍是旧页。

## Feedback

- **短了很多，好扫**：Roles 从十一条长句缩成六条一句话，「哪些要 Pro」交给 Workflows 页，不再在这里重复。
- **按工作流分表很直观**：做博客的人只看 Blog post 一张表；头像让名字好认，和看板配置页是同一张图。
- **头像太小**：和字一样高（约 15px）的像素图看不清是什么，Coding 表里还被列宽挤成 14×15，略变形；blog-researcher 是通用机器人，和别人放一起像缺图。
- **三张表列宽不齐**：每张表各自排版，「Specialist」「Work」两列上下不对齐；`competitor-research` 在名字列里折成两行。
- **记忆不再讲两遍**：一句链接去 Memory 页，名字也统一成 Tidy memory，旧版与 Memory 页打架的问题没了。
- **站内链接仍开新标签页**：读文档时跳一下就多一个标签页。
- **数字对上了**：页上 12 个专员，`akb spec` 也是 12 个。
- **没有跑到的**：窄屏；真实部署后的页面（本地 main 上 500，见上）。
