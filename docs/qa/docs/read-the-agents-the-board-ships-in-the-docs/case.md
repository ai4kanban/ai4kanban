# 在文档里查看板自带哪些 Agent、各自做什么

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 7 步。
- **读者**：想知道看板自己会跑哪些 Agent、规划时会请哪些专员、怎么给它们定规矩的人。

## Steps

1. 打开 `/docs/agents`。
   标题「Configure your agents」，副标题「Start with built-in agents. Give them your rules or create custom agents for the work you need.」；第一段说工作流的 Agent 在 **Configuration → Workflows**、全看板的在 **Configuration → Board**，每个 Agent 有自己的页。右侧目录：Roles、Specialists（下挂 Coding、Product video、Blog post、Social post，都不带 (Pro)）、Give an agent a rule、Run an agent on a schedule、Add one of your own、Choose what an agent runs on。
   ![Agents 页顶部](01-agents-top.png)

2. 点右侧目录里的「Roles」。
   页面滚到「Roles」，目录里该项高亮。六条，每条一句：Planning helper、Workflow planners（链到 Workflows 页看各工作流的规划 helper，不再提 Pro）、Builder、Suggest follow-up work（链到 Follow-ups）、Review chats 和 Tidy memory（链到 Memory）、Describe the project（维护 `memory/project.md`）。
   ![Roles 一节](02-roles.png)

3. 点目录里的「Specialists」。
   一段说明后分四张表：Coding 7 个（ui-designer、copywriting、illustrator、prompt-writer、email-planner、tech-stack-advisor、competitor-research）、Product video 3 个（demo-rehearser、hyperframes-editor、cover-designer）、Blog post 2 个（blog-researcher、blog-illustrator）、Social post 1 个（social-illustrator），共 13 个。每行左边一个和正文字一样高的像素头像，表行不被撑高。表下一句：Slide deck、Video clone 没有专员；再一句给点名说法（「put the ui-designer agent on #4」或 `akb spec ui-designer 4`）。
   ![Specialists 一节](03-specialists.png)

4. 放大看 Blog post 表的头像。
   blog-researcher、blog-illustrator 各是自己的像素角色，造型不同；13 个头像里没有通用机器人底图。
   ![Blog post 表放大 3 倍](04-blog-post-art.png)

   再放大 Social post 表：一行 social-illustrator，「The images on a carousel's pages, or one image for a text-only post.」，头像是自己的像素角色。
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

- **短，好扫**：Roles 六条，每条一句；表头去掉 (Pro) 后，四张专员表读起来就是「这个工作流会请谁」，不再让人以为要先付费。
- **按工作流分表很直观**：做社媒帖的人一眼看到 Social post 表和配图帮手。
- **数字对上了**：页上 13 个专员，`akb spec` 也是 13 个。
- **头像太小**：和字一样高，3 倍放大后也只看得出颜色和轮廓，认不出各自的道具；`social-illustrator`、`competitor-research` 在窄列里折成两行。
- **四张表列宽不齐**：每张表各自排版，「Specialist」「Work」两列上下不对齐。
- **站内链接仍开新标签页**：读文档时跳一下就多一个标签页。
- **没有跑到的**：窄屏；真实部署后的页面；看板 Agent 页和 Configuration → Workflows（属 local-ui 模块）。
