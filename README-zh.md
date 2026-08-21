<div align="center">

# AI4Kanban

### 自主规划、随决策成长的项目看板。

[English](README.md) · **简体中文**

[下载](https://ai4kanban.dev/download) · [官网](https://ai4kanban.dev) · [使用指南](docs/guides/daily-loop.md)

<img src="https://cdn.ai4kanban.dev/og-image-v5.jpg" alt="AI4Kanban——自主规划、随决策成长的项目看板" width="720">

</div>

编码 Agent 已经能够稳定实现明确需求。软件开发的瓶颈正在前移到项目管理：下一步做什么、
如何把模糊想法澄清为可落地需求，以及怎样在不断增长的项目中安排优先级和依赖。

AI4Kanban 是一个以看板为工作界面的项目管理 Agent。它结合项目目标、代码和长期记忆，主动
提出任务、循环澄清需求、规划执行，并持续推进任务的完整生命周期。

看板保留代码本身无法表达的项目上下文：产品决策、否决方向、已完成功能与设计经验。这些信息
会进入下一轮规划，使后续判断持续贴近项目实际。

## 主要能力

- **主动规划工作。** Agent 结合项目目标、代码和记忆，判断下一步应该做什么，并提出具体任务。
- **循环澄清需求。** Agent 审视模糊想法，从项目上下文中自行回答问题，直到任务可以开工。
- **管理任务生命周期。** Agent 拆解任务、安排依赖和优先级、规划版本，并将就绪任务交给编码
  Agent 执行。
- **将关键判断留给人。** 产品方向、品味和重要取舍仍由人决定，常规细节则根据项目上下文处理。
- **积累长期项目记忆。** 产品决策、已完成工作、否决想法和设计经验会继续用于后续规划，不会
  随聊天会话结束而丢失。
- **本地存储，不绑定 Agent。** 看板以 Markdown 文件存放在 `docs/kanban/`，支持 Claude Code、
  Codex、Cursor、OpenCode 和 DeepSeek Harness。

## 快速开始

1. **[下载并安装桌面应用](https://ai4kanban.dev/download)。** 无需预先配置 Node.js、npm 或
   终端。应用内置 `akb` CLI，并会在打开项目时自动写入编码 Agent 所需的 skill。
2. **打开项目文件夹。** 确认项目简介和 track，设置项目目标，并选择负责运行看板的编码 Agent。
3. **点击 Finish setup。** AI4Kanban 会读取仓库、建立项目记忆、整理模块，并创建首批任务。

当前安装包尚未签名，因此操作系统可能会在首次启动时显示警告。
[下载页](https://ai4kanban.dev/download)提供 macOS、Windows 和 Linux 的完整操作步骤。运行任务
前，还需要在本机安装并登录任一受支持的编码 Agent。

完成设置后，可以在桌面应用中操作，也可以直接告诉编码 Agent：

```text
下一步做什么？
提出新任务
细化 #4
检查看板
实现 #4
```

桌面应用、编码 Agent 和内置的 `akb` CLI 操作的是同一块看板。如需使用终端，请先安装桌面
应用，再直接运行 `akb`；无需单独安装 npm 包。

## 延伸阅读

- [日常工作流](docs/guides/daily-loop.md)
- [如何写好项目目标](docs/guides/what-makes-a-good-goal.md)
- [各个编码 Agent 的能力差异](docs/guides/connectors.md)
- 运行 `akb help` 查看内置 CLI 的命令说明。
- 在 [`docs/kanban/`](docs/kanban/) 中查看本仓库实际使用的看板。

## 许可证

[Apache License 2.0](LICENSE)。可自由使用、修改和再分发。

[`web/`](web/) 下的官网是例外：源码公开仅供阅读，适用其[单独的许可证](web/LICENSE)。
