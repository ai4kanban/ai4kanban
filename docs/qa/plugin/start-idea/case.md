# 在面板里发起想法并管理任务

## Setup

- 同 [在插件里把文件夹变成项目](../add-project/case.md)，在 `proj` 里，50 行终端。
- 没有模型可用，第 1 步由测试代替 Claude 调 `PUT /v1/discussions/{id}/draft` 写入想法，
  所以 clarify-idea 技能本身没有验证。
- 执行任务的 `claude` 是假脚本，只 `sleep`，Runner 是插件自带的真 Runner。
- 替身没有 Realtime，插件的 Runner 只在启动时领作业，所以第 5 步要重启 Claude Code。
- 种子里遗留的假 Runner 把作业的 `machine_id` 定到了别的电脑，取证时用 SQL 改回这台。

## Steps

1. 让 Claude 写好两个想法后打开 Ideas。
   预期：第一个想法展开，有结果、`Done when`、工作流和 **Start**；第二个收起。
   证据：[01-ideas-listed.png](01-ideas-listed.png)
2. 在收起的想法上按 Enter。
   预期：它展开，第一个收起。
   证据：[02-other-idea-open.png](02-other-idea-open.png)
3. 把焦点移到 Start，按 Enter。
   预期：显示 `✓ Started` 和任务编号。
   证据：[03-started.png](03-started.png)
4. 按 `3` 打开 Tasks。
   预期：任务排在里面，写着 `Queued`、项目和 Agent。
   证据：[04-tasks-queued.png](04-tasks-queued.png)
5. 等 Runner 领走任务。
   预期：状态变成 `Running`，多出 Stop。
   证据：[05-tasks-running.png](05-tasks-running.png)
6. 按 Stop。
   预期：先显示 `Stopping…`，几秒后任务离开列表。
   证据：[06-after-stop.png](06-after-stop.png)

## Feedback

Start 之后立刻看到编号，Tasks 的状态也清楚，这条路径本身很短。问题在键盘：面板在普通高度下放不下
Start，焦点要从标签页一路 Tab 过去，还要经过 Discard 和工作流，按过头会移到右上角的 ✕，再按 Enter
面板就关了。Tasks 为空时只说这台电脑上没有在跑的，刚 Start 的任务如果排给了别的电脑，用户在这里看不到，
Ideas 却写着已发起。
