# 在文档里查看板自带哪些 Agent、各自做什么

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 4 步。
- **读者**：想知道看板会自己跑哪些 Agent、哪些工作流要 Pro、规划时会请哪些专员的人。

## Steps

1. 读页首第二段。
   一句「Product video, Slide deck, Carousel post, Blog post and Video clone need a Pro plan. Coding and the workflows you make yourself are free.」——Video clone 和其他内容类工作流并列为 Pro。
   ![Pro 一段](01-pro-plan.png)

2. 点右侧目录里的「Roles」。
   页面滚到「Roles」一节：一句「Roles run the board's own flows. You can't add, remove or switch one off.」，下面十一条，每条一句——Software planner、Builder、Scriptwriter、Deck planner、Carousel planner、Blog planner、**Video cloner**、Proposer、Review chats、Describe the project、Memory pruner。Video cloner 一句说它克隆用代码做的视频：先确认逐镜头配方，再拿到可渲染、文字图片配色时长都能改的模板。
   ![Roles 一节](02-roles.png)

3. 点目录里的「Specialists」。
   开头一段：专员在规划时只写卡片的一段，规划者按需请来；只有你能做的选择留成待澄清问题。下面十一条，`copywriting` 一条同时管文案和用户文档；最后四条注明「Product video only」或「Blog post only」。清单下面是自己点名的说法（「put the ui-designer agent on #4」或 `akb spec ui-designer 4`）。
   ![Specialists 一节](03-specialists.png)

4. 在空项目里跑 `akb spec`，数清单上的专员。
   列出 11 个，名字和第 3 步的清单一一对得上；`video-cloner` 不在其中，它是 Role。
   [akb spec 的清单](04-akb-spec.log)

## Feedback

- **新工作流一眼找得到**：Video clone 同时出现在 Pro 那句和 Roles 清单里，一句话说清「给配方→拿模板」，不用点进别处。
- **「clones a video made with code」有门槛**：没做过程序化视频的人看不出能不能丢一段普通实拍视频进去；卡片里「要在描述里写 mp4 路径」「实拍和 logo 只做占位」这些都不在文档里，第一次用得去工作流里试。
- **Roles 写着「不能关」却越来越像工作流目录**：一半条目是某个工作流的规划者，读的人要自己对上哪个 Role 属于哪个工作流；按工作流分组会更好扫。
- **数字对上了**：页上专员和 `akb spec` 都是 11 个。
- **频率仍没写**：Describe the project、Review chats 不说多久跑一次，页下「Run an agent on a schedule」一节才讲，但不指名这几个。
- **没有跑到的**：真的跑一次 Video clone（要 Pro 和真实 agent）；窄屏。
