# 在文档里查看板自带哪些 Agent、各自做什么

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 7 步。
- **读者**：想知道看板自己会跑哪些 Agent、规划时会请哪些专员、怎么给它们定规矩的人。

## Steps

1. 打开 `/docs/agents`。
   标题「Configure your agents」，副标题「Start with built-in agents. Give them your rules or create custom agents for the work you need.」；第一段说工作流的 Agent 在 **Configuration → Workflows**、全看板的在 **Configuration → Board**。右侧目录：Roles、Specialists（下挂 Coding、Product video (Pro)、Blog post (Pro)、Social post (Pro)）、Give an agent a rule、Run an agent on a schedule、Add one of your own、Choose what an agent runs on。
   ![Agents 页顶部](01-agents-top.png)

2. 点右侧目录里的「Roles」。
   页面滚到「Roles」，目录里该项高亮。六条，每条一句：Planning helper、Workflow planners（哪些要 Pro 链到 Workflows 页）、Builder、Suggest follow-up work（链到 Follow-ups）、Review chats 和 Tidy memory（链到 Memory）、Describe the project（维护 `memory/project.md`）。
   ![Roles 一节](02-roles.png)

3. 点目录里的「Specialists」。
   一段说明后分四张表：Coding 7 个（ui-designer、copywriting、illustrator、prompt-writer、email-planner、tech-stack-advisor、competitor-research）、Product video (Pro) 3 个、Blog post (Pro) 2 个（blog-researcher、blog-illustrator）、Social post (Pro) 1 个（social-illustrator），共 13 个。每行左边一个和正文字一样高的像素头像，表行不被撑高。表下一句：Slide deck、Video clone 没有专员；再一句给点名说法（「put the ui-designer agent on #4」或 `akb spec ui-designer 4`）。
   ![Specialists 一节](03-specialists.png)

4. 放大看 Blog post (Pro) 表的头像。
   blog-researcher 是胸前抱着蓝色地球仪的专属角色，和旁边 blog-illustrator 一样有自己的道具；13 个头像里没有通用机器人底图。
   ![Blog post 表放大 3 倍](04-blog-post-art.png)

   再放大 Social post (Pro) 表：一行 social-illustrator，「The images on a carousel's pages, or one image for a text-only post.」，头像是自己的像素角色。
   ![Social post 表放大 3 倍](04-social-post-art.png)

5. 点目录里的「Give an agent a rule」。
   一段讲规则框和 `docs/kanban/rules/<agent>.md`；下面只一句「See Memory to edit preferences and decisions, share notes between agents, and review finished card chats.」，页上没有讲记忆的小节。
   ![Give an agent a rule 一节](05-give-a-rule.png)

6. 点那句里的「Memory」。
   `/docs/memory` 在新标签页打开；Agents 页留在原标签页。
   [标签页前后](06-memory-link.log)

7. 在空项目里跑 `akb spec`，数清单上的专员。
   列出 13 个，名字和第 3 步四张表一一对得上，`blog-researcher`、`social-illustrator` 在内。
   [akb spec 的清单](07-akb-spec.log)

## Feedback

- **短，好扫**：Roles 六条，每条一句，「哪些要 Pro」交给 Workflows 页。
- **按工作流分表很直观**：做社媒帖的人一眼看到 Social post 表和配图帮手，一句话说清轮播出各页图、纯文字帖配一张。
- **数字对上了**：页上 13 个专员，`akb spec` 也是 13 个，`social-illustrator` 在内。
- **社媒帖配图头像被挤窄**：名字 `social-illustrator` 在窄列里折成两行，头像只剩 11×15（别的 14～15×15），肉眼看比旁边几张瘦；整页头像和字一样高，不放大看不出道具。
- **四张表列宽不齐**：每张表各自排版，「Specialist」「Work」两列上下不对齐；`competitor-research` 也折成两行。
- **站内链接仍开新标签页**：读文档时跳一下就多一个标签页。
- **没有跑到的**：窄屏；真实部署后的页面；看板 Agent 页和 Configuration → Workflows 里的社媒帖配图（属 local-ui 模块）。
