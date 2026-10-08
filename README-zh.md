<div align="center">

# <img src="https://cdn.ai4kanban.dev/readme/logo-mark-v1.svg" width="40" align="top" alt=""> AI4Kanban

**你把关关键点，Agent 完成其余工作。**<br>先看草稿、定好方向，再交给 Agent 执行。

[![下载 macOS 版](https://img.shields.io/badge/macOS-24231f?style=for-the-badge&logo=apple&logoColor=white)](https://ai4kanban.dev/zh/download) [![下载 Windows 版](https://img.shields.io/badge/Windows-24231f?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTAgMy40IDkuNiAydjkuNEgwem0xMC44LTEuNUwyNCAwdjExLjRIMTAuOHpNMCAxMi42aDkuNlYyMkwwIDIwLjZ6bTEwLjggMEgyNFYyNGwtMTMuMi0xLjl6Ii8%2BPC9zdmc%2B)](https://ai4kanban.dev/zh/download) [![下载 Linux 版](https://img.shields.io/badge/Linux-24231f?style=for-the-badge&logo=linux&logoColor=white)](https://ai4kanban.dev/zh/download)

[![release](https://img.shields.io/github/v/release/ai4kanban/ai4kanban?style=flat-square&color=dd4f1e)](https://github.com/ai4kanban/ai4kanban/releases/latest) [![license](https://img.shields.io/github/license/ai4kanban/ai4kanban?style=flat-square&color=57534e)](LICENSE) [![downloads](https://img.shields.io/github/downloads/ai4kanban/ai4kanban/total?style=flat-square&color=57534e)](https://github.com/ai4kanban/ai4kanban/releases) [![installs](https://img.shields.io/endpoint?url=https%3A%2F%2Ft.ai4kanban.dev%2Fv1%2Finstalls&style=flat-square&color=57534e)](https://ai4kanban.dev/zh/download)

[官网](https://ai4kanban.dev/zh) · [博客](https://ai4kanban.dev/blog) · [English](README.md) | 简体中文

</div>

AI4Kanban 帮你同时推进更多工作：Agent 先把需要你拍板的部分做成草稿，你审过后，它再完成任务。它还会记住你的偏好，主动跟进后续工作。

## 我们要解决的问题

AI Agent 已经让一个人的工作效率提高了 10 倍。AI4Kanban 的目标，是在这个基础上，把**效率再提高 10 倍**。

好的 Agent 能把一个明确的需求做好。但当执行变快，新的瓶颈就出现了：人来不及规划。你需要不断提出想法、明确要求，把它们变成 Agent 能执行的计划，才能让更多工作同时推进。

AI4Kanban 要解决的，就是这个问题。

<p align="center">
<img src="https://cdn.ai4kanban.dev/readme/bottleneck-zh-v1.gif" width="680" alt="瓶颈从执行前移到规划">
</p>

## 我们的解法

### 1. 先草稿，再执行

要同时推进很多工作，你就不能盯着每一个细节。你需要把精力放在关键点上：哪些地方必须按你的想法来，不能让 Agent 自己决定。

AI4Kanban 会先把这些部分做成草稿，让你在执行前就能判断方向对不对。

| 辅助 Agent | 负责什么 | 你先审什么 |
| --- | --- | --- |
| `ui-designer` | 界面布局与交互 | 界面原型 |
| `prompt-writer` | Skill、Agent 提示词等模型指令 | 提示词修改 diff |
| `copywriting` | 官网、README、版本说明等宣传文案 | 文案草稿 |
| `email-planner` | 新增或修改的邮件 | 桌面和手机上的邮件预览 |

以上是部分辅助 Agent，完整名单和分工见 [Agent 文档](https://ai4kanban.dev/docs/agents)。

你只审这些关键点。方向定下来后，其余细节交给 Agent，在你给定的范围内自行处理。

### 2. 多智能体，持续学习

不同的工作，需要把关的地方也不同。AI4Kanban 内置 5 类工作流、10+ Agent，分工处理各自负责的部分。

比如，UI 设计师负责起草界面原型。你每次提出修改意见，它都会记下来，用在后续设计中。随着合作增多，它会越来越了解你的偏好，你也不用反复解释同样的要求。

### 3. 智能体自主跟进细节

一个人同时推进很多开发任务，难免漏掉一些设计或测试。AI4Kanban 的后台 Agent 会定期回顾进展，提出需要跟进的工作；质检员 Agent 会测试近期改动，从用户的角度找出问题。

这些遗漏不用全靠你自己发现。Agent 会帮你找出来，提出建议，交给你决定下一步。

### 4. 基础能力：任务管理与 Agent 调度

要让多个 Agent 同时工作，还需要把任务和执行安排好。AI4Kanban 提供任务拆解、优先级、任务信息和状态管理，以及定时任务、事件通知、Git worktree 并行执行和冲突处理。

这些基础工作由 AI4Kanban 管起来，你就能把更多精力放在想法、方向和关键决策上。

![AI4Kanban 概览](https://cdn.ai4kanban.dev/readme/overview-grid-v9.png)

## 快速开始

1. [下载桌面端](https://ai4kanban.dev/zh/download)，打开你的项目，看板会建在项目的 `docs/kanban/` 下。
2. 写下一个想法。Agent 开始规划，把需要你审的草稿和问题推给你。
3. 审完草稿，Agent 动手实现；做完后，它会提出值得继续的后续工作。

偏好命令行，也可以在项目里运行 `npx ai4kanban@latest install`。

## 支持的 Harness

![AI4Kanban 支持的 8 个 Harness](https://cdn.ai4kanban.dev/readme/harnesses-v1.png)

- **8 个常见 Harness**：你用的不在列表里，欢迎提 issue 告诉我们。
- **用你自己的订阅**：所有 Harness 都跑在你的电脑上，我们不额外收取 token 费用。
- **按角色配模型**：每个 Agent 可以单独选择 Harness 和模型。

## 开源协议

- 桌面端、`akb` CLI、看板 UI 与 Cloud 服务端都按 [Apache-2.0](LICENSE) 授权。
- [`web/`](web/) 目录采用单独的[源码可见许可](web/LICENSE)。它公开是为了可读、可审计，但不是开源许可，不授予部署或再分发的权利。

## 联系我们

使用中遇到问题，欢迎提 issue，或写信到 [support@ai4kanban.dev](mailto:support@ai4kanban.dev)。
