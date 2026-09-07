<div align="center">

# AI4Kanban

### 面向编码 Agent 的 AI 项目经理。

[English](README.md) · **简体中文**

[下载](https://ai4kanban.dev/download) · [官网](https://ai4kanban.dev) · [使用指南](https://ai4kanban.dev/docs/daily-loop)

<img src="https://cdn.ai4kanban.dev/og-image-v6.jpg" alt="AI4Kanban——面向编码 Agent 的 AI 项目经理" width="720">

</div>

AI4Kanban 是面向使用编码 Agent 的开发者的 AI 项目经理：把模糊想法变成任务计划，
执行开发与评审，并记住项目决策。

## 为什么使用它？

编码 Agent 需要清晰的需求。当计划散落在冗长的聊天记录里，你就得反复解释决策、
澄清同样的问题，还要手动协调各项工作。

AI4Kanban 把任务、依赖关系和项目记忆放在同一块 Markdown 看板中，用 Git 管理版本。
它根据代码库和已有决策澄清下一项任务，把需要你判断的取舍交给你，再让编码 Agent 执行已就绪的工作。

## 实际效果

一个模糊想法会变成一组带依赖关系和验收标准的任务。回答待澄清问题后，点击卡片上的
**开发**，即可启动开发、评审和合入。默认情况下，这次批准覆盖直到合入的整个交付流程；
如果希望先查看代码变更，可以开启**合入前需要批准差异**。

点击任意截图查看大图。

<table>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg" alt="带子任务依赖图的分组卡片：五张卡片由依赖箭头串联" /></a><br/>
<sub><b>明确任务与依赖</b> — 将大目标拆成边界清晰的卡片，用依赖箭头标明哪些任务可以并行。</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg" alt="卡片上的待澄清问题，每个问题都带有推荐答案和备选项" /></a><br/>
<sub><b>澄清需求</b> — 根据项目记忆和代码库回答常规问题，把产品决策交给你。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-execute-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-execute-v1.jpg" alt="运行面板：implement、review、resolve 会话及其运行日志" /></a><br/>
<sub><b>推进执行</b> — 在独立的 git worktree 中并行执行已就绪的任务，评审变更，并在合入前解决冲突。</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg" alt="ui-design Agent 的报告，卡片上附有两套可运行的 mockup" /></a><br/>
<sub><b>先定关键方案</b> — 使用内置或自定义规格 Agent 比较技术方案，产出可运行的 UI 原型。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-approval-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-approval-v1.jpg" alt="Slack 中的审批通知，带有 Implement 和打开卡片按钮" /></a><br/>
<sub><b>在 Slack 中批准任务</b> — 接收问题和审批请求，直接在消息中回答或启动实施。</sub>
</td>
<td width="50%" valign="top"></td>
</tr>
</table>

## 快速开始

**准备工作：**一个项目文件夹，以及一个已安装并完成登录或 API 密钥配置的受支持编码 Agent。
如需独立 worktree 和自动合入，项目应为 Git 仓库，至少有一次提交，且当前检出在一个分支上。

1. **[下载并安装桌面应用](https://ai4kanban.dev/download)。** 应用内置运行环境和 `akb` CLI，
   无需单独配置 Node.js 或 npm。
2. **新建本地看板，打开项目文件夹。** 设置流程会尝试使用本机的编码 Agent。
   确认或纠正它对仓库的理解，并描述你的项目目标。
3. **点击完成设置。** AI4Kanban 会建立项目记忆、整理模块，并提出首批任务。
4. **试着完成一项任务。** 打开一张建议的卡片，回答待澄清问题，范围明确后点击**开发**。
   在运行面板中查看开发和评审进度。

当前安装包尚未签名。如果操作系统阻止启动，请按[首次启动说明](https://ai4kanban.dev/download)
中对应平台的步骤操作。

也可以通过看板 skill，直接让编码 Agent 操作：

```text
下一步做什么？
细化 #4
实现 #4
```

将 `#4` 换成你看板中的卡片编号。应用会在打开项目时安装 skill，也可以在**配置 → 通用**中安装。
桌面应用、skill 和 `akb` CLI 操作的是同一块看板。终端用法见 [CLI 指南](cli/README.md)。

## 适合我的环境吗？

| 项目 | 支持情况与限制 |
| --- | --- |
| 桌面平台 | macOS（Apple Silicon 和 Intel）、Windows、Linux。macOS 版本每次发布都会测试；Windows 和 Linux 版本发布前尚未测试。所有安装包均未签名。 |
| 编码 Agent | Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness、ZCode、Grok Build。需要自行安装并完成认证。运行信息上报、权限和适配测试情况各有不同，详见[支持矩阵](https://ai4kanban.dev/docs/connectors)。 |
| Git | 独立 worktree 用于隔离并行开发。如果没有 Git、尚无提交，或当前未检出在分支上，则直接在项目文件夹中开发，需要手动提交。 |
| 集成 | 应用通知中心和 Slack 接收问题与审批请求。自定义规格 Agent 放在 `docs/kanban/agents/` 中。 |
| 语言 | 应用和看板内容支持简体中文与英文，应用默认跟随系统语言。 |
| 终端 | 桌面应用在 macOS 和 Windows 上提供 `akb` 安装入口。Linux AppImage 不会在 PATH 中留下命令，单独安装方式见 [CLI 指南](cli/README.md)。 |

### 本地看板与 Cloud 看板

- **本地（默认）**：卡片、记忆、发布和配置保存在 `docs/kanban/`，由 Git 管理版本，
  无需 Cloud 工作区。
- **Cloud（邀请制预览）**：看板内容保存在托管工作区，可从登录后的不同机器访问。
  编码 Agent 仍在本机操作你的仓库；AI4Kanban Cloud 不接收仓库代码，也不运行 Agent。
- **迁移与导出**：本地与 Cloud 之间的切换通过一次经你审阅的提交完成。
  在**配置 → 工作区**中，可以将 Cloud 看板导出为 Markdown，或删除工作区。
  详见[本地看板与 Cloud 看板](https://ai4kanban.dev/docs/local-and-cloud-boards)。

### 数据与使用情况上报

你选择的编码 Agent 和模型服务商会按各自的配置处理所需代码。看板存储在本地，并不意味着模型调用离线运行。

AI4Kanban **默认开启**匿名使用情况上报，并在打开第一个看板前说明。上报内容为功能使用和失败情况，
不包含代码、卡片内容、项目名称或文件路径。可以在首次启动时、**配置 → 通用**中，
或通过 `akb telemetry off` 关闭。[隐私政策](https://ai4kanban.dev/privacy)列出了全部事件与字段。

## 文档与贡献

AI4Kanban 正在持续开发。试用前可查看[发布记录](https://github.com/ai4kanban/ai4kanban/releases)
了解已发布的变更，并留意上方的平台限制。

- **了解工作流**：[日常指南](https://ai4kanban.dev/docs/daily-loop)、
  [项目目标](https://ai4kanban.dev/docs/what-makes-a-good-goal)，以及 `akb help`。
- **报告问题或提出功能建议**：[提交 Issue](https://github.com/ai4kanban/ai4kanban/issues)。
  报告问题时，请附上操作系统、应用版本、编码 Agent 和复现步骤。
- **贡献修复**：阅读[仓库开发约定](AGENTS.md)，以及[桌面应用](desktop/README.md)、
  [看板 UI](kanban-ui/README.md)或 [CLI](cli/README.md) 的开发说明。
  运行对应检查后，[提交 Pull Request](https://github.com/ai4kanban/ai4kanban/pulls)，说明改动和验证方式。
- **看看我们如何使用它**：浏览本仓库自己的[任务看板](docs/kanban/)。

## 许可证

[Apache License 2.0](LICENSE)。可自由使用、修改和再分发。

[`web/`](web/) 下的官网是例外：源码公开仅供阅读，适用其[单独的许可证](web/LICENSE)。
