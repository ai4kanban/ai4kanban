# 不复制，直接给内置的「视频克隆」工作流设置、换掉或移除执行 Agent

## Setup

- **看板**：用本目录的 `seed.sh` 建一个一次性项目：新装看板，#2「把审阅过的片头模板发到共享模板库」已规划好、状态是待执行，工作流是内置的「视频克隆」，有一条未勾的待办。
- **账号**：本机已登录 Cloud，是 Pro。Cloud 由 [stand-in.mjs](../give-a-copied-video-clone-workflow-a-build-agent/stand-in.mjs) 顶替，登录是手写的 `session.json`。
- **Agent**：PATH 最前放一个替身 `claude`（被问登录状态时答已登录，被叫去运行时答「Done (stand-in).」），打开界面不会起真实的 setup 运行。
- **界面**：浏览器打开看板 UI（`kanban-ui`），视口 1440×900，界面语言中文。截图只截「配置」窗口或卡片页。

## Steps

1. 点右上角的「配置」，再点左栏「工作流」，在中间一栏顶上的下拉里选「视频克隆」。
   中间三个框：「规划」（视频克隆、规划助手）、「执行」（只有一个「+ 设置 Agent」按钮，没有「不可用」之类的警示）、「定期运行」。
   ![内置的视频克隆](01-built-in.png)
   [三个框的文字](01-stages.log)

2. 点「设置 Agent」。
   「执行」框里出现「视频克隆 executor」并被选中，右侧是它的 `AGENT.md`（`docs/kanban/agents/video-clone-executor/AGENT.md`），标题旁写「你添加的」和「删除」。规划那一侧不变。
   ![设好执行 Agent](02-executor.png)
   [设好之后](02-executor.log)

3. 按 Esc 关掉「配置」，打开 #2。
   标题旁是「可以开始执行」，工具栏有「执行」「修订」「移除」，「工作流」写「视频克隆」。
   ![卡片可以执行](03-card-can-build.png)
   [卡片页文字](03-card.log)

4. 回到「配置 → 工作流 → 视频克隆」，点执行框里的「视频克隆 executor」，在右侧点「删除」，再在确认框里点「删除」。
   确认框只有「取消」「删除」。删掉后「执行」框回到「+ 设置 Agent」，`docs/kanban/agents/` 空了，没有留下「不可用」的空负责人。
   ![确认删除](04-confirm-delete.png)
   ![删掉之后](04-deleted.png)
   [删除前后](04-deleted.log)

5. 再点「设置 Agent」，点新 Agent 右边的箭头，选最下面的「移除 Agent」；然后关掉「配置」打开 #2。
   箭头弹出选择器：可换成「开发」或当前的「视频克隆 executor」（打勾），底部一项「移除 Agent」。移除不再弹确认框，直接把这个 Agent 删掉：「执行」框回到「+ 设置 Agent」，`docs/kanban/agents/` 空了。#2 的工具栏变回「细化」「修订」「移除」，没有「执行」；标题旁仍是「可以开始执行」。
   ![选择器](05-picker.png)
   ![移除之后](05-removed.png)
   ![卡片没有执行了](05-card-after-remove.png)
   [每一步的文字](05-removed.log)

6. 回到「配置 → 工作流 → 视频克隆」，再点「设置 Agent」。
   1 秒内「执行」框里出现一个全新的「视频克隆 executor」，右侧是它的 `AGENT.md`，正文回到「Unwritten」占位。
   ![再设一次](06-set-after-remove.png)
   [每秒的执行框](06-set-after-remove.log)

7. 点执行 Agent 右边的箭头选「开发」，再点箭头选「移除 Agent」。
   选「开发」后执行框是「开发」；移除后回到「+ 设置 Agent」。「开发」是内置 Agent，只解除指派；第 6 步建的 `video-clone-executor` 文件夹也还留着。
   ![移除开发之后](07-builtin-agent-removed.png)
   [每一步的执行框与 Agent 文件夹](07-builtin-agent.log)

8. 再点「设置 Agent」。
   应当重新设上执行 Agent。**实际什么都没发生**：等 6 秒「执行」框仍是「+ 设置 Agent」，配置窗口背后的看板顶部出现英文报错「docs/kanban/agents/video-clone-executor/ is already there. Pick another name.」（已报待筛选）。
   ![再设一次没有反应](08-set-after-builtin.png)
   [每秒的执行框与看板顶部](08-set-after-builtin.log)

## Feedback

- **不用复制了**：内置的视频克隆直接点「设置 Agent」就能接着执行，卡片立刻出现「执行」；规划那一侧仍锁着，不会被误改。
- **移除后能重来**：「移除 Agent」直接删掉本工作流自己的执行 Agent，再点「设置 Agent」马上得到一个新的，原来的死路没了。
- **移除即删除，没有确认**：箭头里的「移除 Agent」会连提示词一起删掉、无法撤销，却不像右侧的「删除」那样先问一句；写过提示词的人一不小心就没了。
- **换一次就又卡住**：先改选「开发」再移除，旧的 `video-clone-executor` 留在磁盘上，「设置 Agent」又静默失败，报错是英文且藏在配置窗口背后。
- **卡片状态没跟上**：移除执行 Agent 后 #2 仍标「可以开始执行」，工具栏却没有「执行」，读起来自相矛盾。
- **选择器里有「开发」**：给视频克隆的执行选编码用的「开发」也被允许，不熟的人可能误选。
- **没有跑到的**：真的执行一次（另一个场景跑过副本的）、升级后执行 Agent 是否保留、其他四个内置工作流、英文界面。
