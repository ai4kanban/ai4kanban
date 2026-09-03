<div align="center">

# AI4Kanban

### 面向编码 Agent 的 AI 项目经理。

[English](README.md) · **简体中文**

[下载](https://ai4kanban.dev/download) · [官网](https://ai4kanban.dev) · [使用指南](https://ai4kanban.dev/docs/daily-loop)

<img src="https://cdn.ai4kanban.dev/og-image-v6.jpg" alt="AI4Kanban——面向编码 Agent 的 AI 项目经理" width="720">

</div>

让编码 Agent 自己交付，不用你全程盯着。AI4Kanban 把模糊想法变成可开工的任务，交给你的
Agent 执行，只在需要产品决策时找你。

**编码变快了，产品决策成了瓶颈。** 需求清晰时，Agent 能稳定交付；需求含糊时，换来的是方向
漂移、返工，以及一堆没人有时间看完的 Agent 对话。AI4Kanban 位于编码 Agent 之上：动手之前
先把要做什么定下来，只把必须由人决定的部分交回给你。

你的每一次回答都会写入项目记忆——产品决策、未采纳的方向、已完成功能和设计经验——下一次
规划要问你的就更少。

## 从一句模糊想法到一次合入

1. **从一句模糊的想法开始。** 用一句话说明你想要的结果。AI4Kanban 会读取代码库，把目标拆成
   边界清晰的任务，并按依赖关系排序，让互不相关的工作可以并行推进。
2. **只把该你定的交给你。** 常规细节由代码库和项目记忆自行回答；涉及品味、商业方向、风险和
   成本的取舍，会以一个带推荐答案的简短问题交回给你。
3. **让 Agent 自己跑起来。** 已就绪的任务在后台执行，每项交付都在独立的 git worktree 中
   进行；合入前如有冲突，会先走一轮解冲突。只有交付等待验收时，你才会收到通知。

## 其他能力

- **在实施前完成关键决策。** 内置 Spec Skills 可以比较技术方案，也可以给出可运行的 UI
  方案；你也可以在 `docs/kanban/skills/` 下添加自己的技能。
- **需要你时及时通知。** 待确认的评审和只能由你决定的问题会集中显示在应用的通知中心，并推送
  到 Slack。你可以直接在消息中批准任务或回答问题。
- **按模块积累项目记忆。** 已完成功能、产品决策、未采纳的方向和设计经验保存在
  `docs/kanban/memory/`，持续用于后续规划，不会随聊天会话结束而丢失。
- **本地存储，可自由选择 Agent。** 看板以 Markdown 文件存放在 `docs/kanban/`，用 Git 管理
  版本。AI4Kanban 支持 Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness
  和 ZCode。

## 实际效果

从一个模糊目标到一次落地提交，这就是完整的一轮。点击任意截图查看大图。

<table>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg" alt="带子任务依赖图的分组卡片：五张卡片由依赖箭头串联" /></a><br/>
<sub><b>明确任务与依赖</b> — Agent 能够将大目标拆解成边界清晰的卡片，自动决定哪些任务可以并行、哪些必须等待，让每个任务都能在独立的上下文中完成。</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg" alt="卡片上的待澄清问题，每个问题都带有推荐答案和备选项" /></a><br/>
<sub><b>澄清需求</b> — Agent 能够将模糊需求补全为可落地的计划。大部分问题会根据项目记忆和代码库自行回答；只有涉及品味、商业方向、风险和成本的取舍，才交由你决策。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-execute-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-execute-v1.jpg" alt="运行面板：implement、review、resolve 会话及其运行日志" /></a><br/>
<sub><b>推进执行</b> — 你可以并行调度多个 Agent 完成已就绪的任务。每项交付都在独立的 git worktree 中进行，确保变更隔离；合入前如有冲突，会触发独立的解冲突流程。</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg" alt="ui-design 技能的报告，卡片上附有两套可运行的 mockup" /></a><br/>
<sub><b>在实施前完成关键决策</b> — 支持自定义 Spec Skills，也内置技术选型技能和 UI 设计技能：前者帮助比较技术方案，后者默认提供一套可运行的界面方案，并仅在明确要求时提供备选方案。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-approval-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-approval-v1.jpg" alt="Slack 中的审批通知，带有 Implement 和打开卡片按钮" /></a><br/>
<sub><b>仅在必要时请求审批</b> — AI4Kanban 会在后台持续推进任务，只在需要产品取舍或确认交付时向你汇报。它像一位项目经理，始终尽量少占用你的注意力。</sub>
</td>
<td width="50%" valign="top"></td>
</tr>
</table>

## 快速开始

1. **[下载并安装桌面应用](https://ai4kanban.dev/download)。** 无需预先配置 Node.js、npm 或
   终端。应用内置 `akb` CLI，并会在打开项目时自动写入编码 Agent 所需的 skill。
2. **打开项目文件夹。** 先选择负责运行看板的编码 Agent，然后让它读取仓库，并告诉你它认为这
   个项目是什么——确认，或者用一句话纠正它。只有项目目标需要你自己动笔写。
3. **完成设置。** 点击 Finish setup 后，AI4Kanban 会读取仓库、建立项目记忆、整理模块，并
   创建首批任务。

当前安装包尚未签名，因此操作系统可能会在首次启动时显示警告。
[下载页](https://ai4kanban.dev/download)提供 macOS、Windows 和 Linux 的完整操作步骤。运行任务
前，还需要在本机安装任一受支持的编码 Agent，并完成登录或密钥配置。

完成设置后，可以在桌面应用中操作，也可以直接告诉编码 Agent：

```text
下一步做什么？
提出新任务
细化 #4
检查看板
实现 #4
```

桌面应用、编码 Agent 和内置的 `akb` CLI 操作的是同一块看板。如需使用终端，安装桌面应用后
直接运行 `akb` 即可，无需单独安装 npm 包。

应用支持简体中文和英文，默认跟随系统语言。看板内容也会使用你选择的语言，包括卡片、待答问题
和验收条目。

## 延伸阅读

- [日常工作流](https://ai4kanban.dev/docs/daily-loop)
- [如何写好项目目标](https://ai4kanban.dev/docs/what-makes-a-good-goal)
- [各个编码 Agent 的能力差异](https://ai4kanban.dev/docs/connectors)
- 运行 `akb help` 查看内置 CLI 的命令说明。
- 在 [`docs/kanban/`](docs/kanban/) 中查看本仓库实际使用的看板。

## 许可证

[Apache License 2.0](LICENSE)。可自由使用、修改和再分发。

[`web/`](web/) 下的官网是例外：源码公开仅供阅读，适用其[单独的许可证](web/LICENSE)。
