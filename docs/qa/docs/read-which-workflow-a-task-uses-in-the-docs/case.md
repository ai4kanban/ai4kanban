# 在文档里查任务用哪个工作流、怎么自定义工作流

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/follow-ups`，窗口 1280×1000。
- **命令**：一个刚 `akb install` 的临时项目，用来对照第 4 步。
- **读者**：想知道看板除了写代码还能做什么、一张卡用哪个工作流、能不能改成自己的流程的人。

## Steps

1. 滚到 `/docs/follow-ups` 页底，点「Next / Workflows」。
   进入 `/docs/workflows`，从页顶开始；分组「How it works」，标题「Workflows」，导语「Use a built-in workflow for your task, or create one for the work you do.」；左栏「How it works」下 Follow-ups 之后的「Workflows」高亮；右侧目录三节：Use a workflow、Built-in workflows、Customize a workflow。
   ![Workflows 页顶部](01-workflows-top.png)

2. 点右侧目录里的「Use a workflow」。
   一句：新建任务时描述请求，Agent 自动推断工作流；下面一张卡片页截图，橙色圈住 Workflow 一栏（PRODUCT VIDEO），图注「The workflow matched to a request, shown on the task.」。
   ![Use a workflow](02-use-a-workflow.png)

3. 点目录里的「Built-in workflows」。
   一张两列表：Coding、Product video、Slide deck、Social post、Blog post、Video clone 六行，各一句用途（Slide deck 写明幻灯片元素不可编辑；Social post 写「Creates a social media post with images and captions for each platform, plus page images for a carousel.」）；表下一段：六个内置工作流都免费；托管的图片、配音、音乐生成要 Pro 并消耗 AI 积分（Pro 链到定价页），没有权限或积分不够时 Agent 改用代码画图、本地配音或不配乐并在卡上注明，结果可能简单些，但工作流照样跑完。
   ![内置工作流](03-built-in-workflows.png)

4. 在临时项目里跑 `akb workflow list`，和第 3 步的表对照。
   同样六个工作流、同样的名字和顺序（Social post 的 id 仍是 `carousel-post`，描述写明纯文字或带图、LinkedIn 帖、X 长帖、轮播都算，规划帮手里有 `social-illustrator`）；六个都只标 `(built-in)`，没有 `Pro` 或 `locked` 标记，和页上「都免费」一致。
   [akb workflow list 的输出](04-workflow-list.log)

5. 点目录里的「Customize a workflow」。
   说明入口 Configuration → Workflows，配一张配置页截图（Coding 的规划 helper、Execute 的 Builder、Scheduled 下的 QA manager，选中一个 helper 的 Disable、Runtime 和 Extra requirements）；下面讲内置工作流的负责人固定、要改就 **Duplicate**、从零建用 **New workflow**；给出一段让编码 Agent 建自定义工作流的提示词；最后一句「Using, duplicating and creating workflows is free.」
   ![自定义工作流](05-customize.png)

6. 点这一节里的「Runs」。
   `/docs/runs#which-runtime-each-agent-runs-on` 在新标签页打开；Workflows 页留在原标签页。
   [标签页前后](06-runs-link.log)

7. 关掉新标签页，滚到页底。
   两张翻页卡：左「Previous / Follow-ups」（How it works），右「Next / The daily loop」（Using the board）。
   ![页底翻页](07-end-of-page.png)

## Feedback

- **收费边界一句话说清**：「六个都免费」，Pro 只管托管生成和积分，和 `akb workflow list` 不再有 Pro 标记对得上；读者不用再猜某个工作流能不能用。
- **降级说法让人放心但偏抽象**：写了没积分时换成代码画图、本地配音或不配乐，但没说一张卡上的「注明」长什么样、在哪看，也没说降级后能不能补用 Pro 重跑。
- **Social post 的描述仍先说「with images」**：读起来像每条帖子都要配图，看不出可以纯文字；Blog post 和 Social post 怎么分只在命令行描述里有。
- **命令行里还是旧 id**：`akb workflow list` 显示 `carousel-post  Social post`，第一次看会以为是两样东西。
- **没说匹配错了怎么办**：只写 Agent 自动推断，没讲推断错了怎么换工作流。
- **配置截图字太小**：缩进正文栏后 helper 名字和按钮几乎读不清。
- **没有跑到的**：在看板里真的建卡看匹配、真的 Duplicate 一个工作流（属 local-ui 模块）；没积分时降级生成的实际效果；窄屏。
