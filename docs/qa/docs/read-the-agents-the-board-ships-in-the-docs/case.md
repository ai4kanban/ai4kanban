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
   页面滚到「Roles」一节：一句「Roles run the board's own flows. You can't add, remove or switch one off.」，下面十一条，每条一句——Software planner、Builder、Scriptwriter、Deck planner、Carousel planner、Blog planner、Video cloner、Proposer、Review chats、Describe the project、Memory pruner。Deck planner 一条写「you approve the content, then get an image-based `.pptx`, one image per slide」，不再说可编辑；Video cloner 一条写「captures the feel of a video made with code」，交付并排的成片和「a template of its beats that renders your own product footage」，不改代码就能删、调顺序、改时长。
   ![Roles 一节](02-roles.png)

3. 点目录里的「Specialists」。
   开头一段：专员在规划时只写卡片的一段，规划者按需请来；只有你能做的选择留成待澄清问题。下面十一条，`copywriting` 一条同时管文案和用户文档；最后四条注明「Product video only」或「Blog post only」。清单下面是自己点名的说法（「put the ui-designer agent on #4」或 `akb spec ui-designer 4`）。
   ![Specialists 一节](03-specialists.png)

4. 在空项目里跑 `akb spec`，数清单上的专员。
   列出 11 个，名字和第 3 步的清单一一对得上；`video-cloner` 不在其中，它是 Role。
   [akb spec 的清单](04-akb-spec.log)

## Feedback

- **Video cloner 说清了拿到什么**：成片和原片并排，外加一份按节拍排的模板、套进自己的产品素材；「不碰代码就能删、调顺序、改时长」对不写代码的人是实在的承诺。但「beats」没解释，第一次读的人不一定知道一个节拍是一段镜头。
- **演示文稿的交付物说实话了**：「image-based `.pptx`, one image per slide」一看就知道拿到的是图片版；但没直接说「PPT 里不能改字，要改就让 Agent 改页面重出」。
- **Roles 越来越像工作流目录**：一半条目是某个工作流的规划者，读的人要自己对上哪个 Role 属于哪个工作流。
- **名字和配置页对不上**：这里叫「Memory pruner」，配置页和 Memory 文档页叫「Tidy memory」；Review chats 这里写「after a card is archived」，Memory 页写「every day」。
- **记忆讲了两遍**：本页仍留着「What agents remember」「Share a memory between agents」「Let the memory review remember for you」三节，和 Memory 页内容重叠。
- **数字对上了**：页上专员和 `akb spec` 都是 11 个。
- **没有跑到的**：真的跑一次 Slide deck 或 Video clone（要 Pro 和真实 agent）；窄屏。
