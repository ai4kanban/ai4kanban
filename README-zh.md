<div align="center">

# AI4Kanban

### 自主规划、随决策成长的项目看板。

[English](README.md) · **简体中文**

[下载](https://ai4kanban.dev/download) · [官网](https://ai4kanban.dev) · [使用指南](https://ai4kanban.dev/docs/daily-loop)

<img src="https://cdn.ai4kanban.dev/og-image-v6.jpg" alt="AI4Kanban——自主规划、随决策成长的项目看板" width="720">

</div>

编码 Agent 已经能够根据明确需求稳定交付代码。软件开发的瓶颈正从编码转向规划与决策：下一步
做什么、如何把模糊想法变成可执行的需求，以及如何在不断扩大的项目中协调优先级和依赖关系。

AI4Kanban 是一个以看板为工作界面的项目管理 Agent。它结合项目目标、代码库和长期记忆，主动
提出任务、逐步澄清需求、规划执行顺序，并推动任务从想法走向交付。

看板记录代码本身无法完整保留的项目上下文：产品决策、未采纳的方向、已完成功能和设计经验。
每一轮规划都会参考这些信息，使后续判断始终贴合项目实际。

## 主要能力

- **主动规划下一步。** Agent 结合项目目标、代码库和长期记忆，判断接下来应该做什么，并提出
  具体任务。
- **将模糊想法变成可执行任务。** Agent 主动发现需求中的缺口，依据项目上下文处理常规细节，
  大部分问题会根据项目记忆和代码库自行回答，只把品味、商业方向、风险和成本交由你决策。
- **管理任务生命周期。** Agent 将大目标拆成边界清晰的卡片，自动决定哪些任务可以并行、哪些
  必须等待。
- **支持自定义 Spec Agents。** 内置 Agent 可以比较技术方案，也可以提供多套可运行的 UI 方案，
  帮你在实施前完成关键决策。
- **从实现到合入。** 多个 Agent 可以在相互隔离的 git worktree 中并行执行就绪任务；合入前
  如有冲突，会触发独立的解冲突流程。
- **需要你时及时通知。** 待确认的评审和只能由你决定的问题会集中显示在应用的通知中心，并推送
  到 Slack。你可以直接在消息中批准任务或回答问题。
- **将关键判断留给人。** 产品方向、体验偏好和重要取舍仍由人决定；常规细节由 Agent 根据项目
  上下文处理。
- **积累长期项目记忆。** 产品决策、已完成工作、未采纳的想法和设计经验会继续用于后续规划，不会
  随聊天会话结束而丢失。
- **本地存储，可自由选择 Agent。** 看板以 Markdown 文件存放在 `docs/kanban/`。AI4Kanban
  支持 Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness 和 ZCode。

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
<a href="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg" alt="ui-design agent 的报告，卡片上附有两套可运行的 mockup" /></a><br/>
<sub><b>在实施前完成关键决策</b> — 支持自定义 Spec Agents，也内置技术选型 Agent 和 UI 设计 Agent：前者帮助比较技术方案，后者提供多套可运行的界面方案供你选择。</sub>
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
