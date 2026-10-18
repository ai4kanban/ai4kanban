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
   一张两列表：Coding、Product video、Slide deck、Carousel post、Blog post、Video clone 六行，各一句用途（Slide deck 写明幻灯片元素不可编辑）；表下一句「Coding is free. The other five built-in workflows require Pro.」，Pro 链到定价页。
   ![内置工作流](03-built-in-workflows.png)

4. 在临时项目里跑 `akb workflow list`，和第 3 步的表对照。
   同样六个工作流、同样的名字和顺序；Coding 只标 `(built-in)`，其余五个都标 `(Pro · locked)`，和页上的收费说法一致。
   [akb workflow list 的输出](04-workflow-list.log)

5. 点目录里的「Customize a workflow」。
   说明入口 Configuration → Workflows，配一张配置页截图（Coding 的规划 helper、选中一个 helper 的 Disable、Runtime 和 Extra requirements）；下面讲内置工作流的负责人固定、要改就 **Duplicate**、从零建用 **New workflow**；给出一段让编码 Agent 建自定义工作流的提示词；最后一句自建免费、复制 Pro 工作流仍要 Pro。
   ![自定义工作流](05-customize.png)

6. 点这一节里的「Runs」。
   `/docs/runs#which-runtime-each-agent-runs-on` 在新标签页打开；Workflows 页留在原标签页。
   [标签页前后](06-runs-link.log)

7. 关掉新标签页，滚到页底。
   两张翻页卡：左「Previous / Follow-ups」（How it works），右「Next / The daily loop」（Using the board）。
   ![页底翻页](07-end-of-page.png)

## Feedback

- **一页讲清「看板不只写代码」**：六个工作流一张表、一句话一个，收费边界写在表下，和 `akb workflow list` 的 Pro 标记对得上。
- **「自动匹配」有图有真相**：卡片截图把 Workflow 一栏圈出来，读者知道建完卡去哪看用了哪个工作流。
- **没说匹配错了怎么办**：只写 Agent 自动推断，没有一句讲推断错了怎么换工作流，读者只能猜。
- **配置截图字太小**：2060px 宽的图缩进正文栏后，helper 名字和按钮几乎读不清，要点开原图才看得见。
- **「AI4Kanban skill」链到 daily loop**：链接文字说的是 skill，落地却是 The daily loop 页，想装 skill 的人要再找一次。
- **How it works 的收尾**：前一页换成了 Follow-ups，「先审草稿 → 记住偏好 → 交付后跟进 → 换工作流」顺着读下来是通的。
- **没有跑到的**：在看板界面里真的建一张卡看工作流被匹配、真的 Duplicate 一个工作流（见 local-ui 模块的场景）；窄屏。
