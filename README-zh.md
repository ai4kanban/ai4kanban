<div align="center">

# <img src="https://cdn.ai4kanban.dev/readme/logo-mark-v1.svg" width="40" align="top" alt=""> AI4Kanban

**独立开发者的 Agent 工作台**<br>先看草稿，其余交给 Agent

[![下载 macOS 版](https://img.shields.io/badge/macOS-24231f?style=for-the-badge&logo=apple&logoColor=white)](https://ai4kanban.dev/zh/download) [![下载 Windows 版](https://img.shields.io/badge/Windows-24231f?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTAgMy40IDkuNiAydjkuNEgwem0xMC44LTEuNUwyNCAwdjExLjRIMTAuOHpNMCAxMi42aDkuNlYyMkwwIDIwLjZ6bTEwLjggMEgyNFYyNGwtMTMuMi0xLjl6Ii8%2BPC9zdmc%2B)](https://ai4kanban.dev/zh/download) [![下载 Linux 版](https://img.shields.io/badge/Linux-24231f?style=for-the-badge&logo=linux&logoColor=white)](https://ai4kanban.dev/zh/download)

[![release](https://img.shields.io/github/v/release/ai4kanban/ai4kanban?style=flat-square&color=dd4f1e)](https://github.com/ai4kanban/ai4kanban/releases/latest) [![license](https://img.shields.io/github/license/ai4kanban/ai4kanban?style=flat-square&color=57534e)](LICENSE) [![downloads](https://img.shields.io/github/downloads/ai4kanban/ai4kanban/total?style=flat-square&color=57534e)](https://github.com/ai4kanban/ai4kanban/releases) [![installs](https://img.shields.io/endpoint?url=https%3A%2F%2Ft.ai4kanban.dev%2Fv1%2Finstalls&style=flat-square&color=57534e)](https://ai4kanban.dev/zh/download)

[官网](https://ai4kanban.dev/zh) · [博客](https://ai4kanban.dev/blog) · [English](README.md) | 简体中文

</div>

AI4Kanban 将开发与营销工作流整合在同一个 agent 工作台中。agent 先把界面、文案、视频脚本等需要你判断的部分做成草稿，由你审阅、修改并把关质量。确认后，agent 按稿完成制作与执行细节，让你少盯过程，交付更多功能、发布更多营销内容。互不依赖的任务可以并行推进，项目背景和你的偏好也会延续到下一项任务。

[![观看 AI4Kanban 演示](https://cdn.ai4kanban.dev/home/hero-demo-poster-v1.jpg)](https://cdn.ai4kanban.dev/home/hero-demo-v1.mp4)

## 既做产品，也做营销

独立开发者不仅要开发产品，还要让用户看见它、愿意使用它。营销投入的时间和精力，可能与开发一样多，甚至更多。如果每个细节都要亲自盯，快速、稳定地交付更多功能、发布更多内容，就很难兼顾。

## AI4Kanban 如何帮助你

### 1. 开发与营销都有专业 agent 团队

![6 个工作流及各自的专业 agent 团队](https://cdn.ai4kanban.dev/readme/workflow-teams-zh-v3.png)

AI4Kanban 为独立开发者的日常工作内置了 **6 个工作流和 10+ agent**。每个 agent 负责工作流中的一部分，例如界面设计或文案。开始工作前，无需先搭建 agent 团队。

agent 共享项目背景，同时在各自的专业领域积累你的反馈。设计偏好由设计 agent 记住，用词偏好由文案 agent 记住。后续任务沿用这些经验，逐渐更符合你的要求，减少反复解释。

| 工作流 | agent 交付什么 |
| --- | --- |
| 开发 | 从界面调整到新功能的软件改动 |
| 幻灯片 | 每页一张图片的 PowerPoint 文件，页内元素不可编辑 |
| 产品视频 | 制作完成的产品视频与封面 |
| 社媒帖 | 帖子正文、配图和各平台配文，轮播另有逐页图片 |
| 博客文章 | 带配图和链接的完整文章 |
| 视频克隆 | 基于代码制作的参考视频，交付复刻成片和可复用模板；实拍素材、插图和标志使用占位内容 |

完整团队见 [agent 文档](https://ai4kanban.dev/docs/agents)。

### 2. 你把关草稿，agent 完成其余工作

按要求实现的功能，界面仍可能不好用；按要求制作的视频，脚本也可能生硬、带着明显的 AI 腔。

AI4Kanban 会从任务中提取需要你判断的部分，请对应的专业 agent 做成草稿。你审阅、修改界面、文案或脚本，直到达到自己的要求，再让 agent 按确认的草稿制作。

分工由此清晰：需要你亲自打磨、确保精确的部分，由你把关；执行和你愿意放权的细节，交给 agent。你把精力放在最在意的地方，其余工作让 agent 完成。

### 3. 自动拆解任务，分批交付

AI4Kanban 会将一个请求拆成任务，识别哪些可以独立推进。agent 并行执行这些任务，开发任务可使用不同的 Git worktree。你可以优先安排紧急任务，完成一部分就交付一部分；低优先级工作继续推进，不必拖住整个请求。

### 4. 主动发现值得跟进的工作

完成一项主线工作后，agent 会提出跟进项，帮你补缺补漏。质检 agent 也会从用户角度检查近期开发改动。哪些建议继续推进，由你决定。

![AI4Kanban 概览](https://cdn.ai4kanban.dev/readme/overview-grid-v10.png)

## 快速开始

1. [下载桌面端](https://ai4kanban.dev/zh/download)，打开你的项目。看板保存在项目的 `docs/kanban/` 下。使用自己的订阅或 API 密钥，[连接支持的工具](https://ai4kanban.dev/docs/connectors)。
2. 描述你想完成的工作，选择工作流。agent 拆解任务，并自动请来相关的专业 agent。
3. 对需要你判断的部分审阅、修改并确认草稿，安排任务优先级，再交给 agent 执行。

跟随[第一张卡片教程](https://ai4kanban.dev/docs/first-card)，走完从想法到交付的过程。

偏好命令行，也可以在项目里运行 `npx ai4kanban@latest install`。

## 支持多种运行环境

![AI4Kanban 支持的 8 个工具](https://cdn.ai4kanban.dev/readme/harnesses-v1.png)

- **支持 8 个工具**：Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness、ZCode 和 Grok Build。[查看配置方法](https://ai4kanban.dev/docs/connectors)。
- **用自己的订阅或 API 密钥**：agent 通过你电脑上的工具运行，AI4Kanban 不对这些运行额外收取 token 费用。
- **按分工选择模型**：每个 agent 可以单独选择运行环境与模型。

## 开源协议

- 桌面端、`akb` CLI、看板 UI 与 Cloud 服务端都按 [Apache-2.0](LICENSE) 授权。
- [`web/`](web/) 目录采用单独的[源码可见许可](web/LICENSE)。它公开是为了可读、可审计，但不是开源许可，不授予部署或再分发的权利。

## 联系我们

使用中遇到问题，欢迎提 issue，或写信到 [support@ai4kanban.dev](mailto:support@ai4kanban.dev)。
