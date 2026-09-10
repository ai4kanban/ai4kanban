<div align="center">

# <img src="docs/images/logo-mark.svg" width="40" align="top" alt=""> AI4Kanban

**下一个时代的 Vibe Coding 方式**<br>*让 Agent 自己进行项目规划和实施，人类只对关键的决策进行判断。*

[English](README.md) · 简体中文

[![release](https://img.shields.io/github/v/release/ai4kanban/ai4kanban?style=flat-square&color=dd4f1e)](https://github.com/ai4kanban/ai4kanban/releases/latest) [![license](https://img.shields.io/github/license/ai4kanban/ai4kanban?style=flat-square&color=24231f)](LICENSE) [![downloads](https://img.shields.io/github/downloads/ai4kanban/ai4kanban/total?style=flat-square&color=635a4e)](https://github.com/ai4kanban/ai4kanban/releases)

[ai4kanban.dev](https://ai4kanban.dev/zh) · [博客](https://ai4kanban.dev/blog)

[![下载 macOS、Windows、Linux 版](https://img.shields.io/badge/下载-macOS_·_Windows_·_Linux-dd4f1e?style=for-the-badge&labelColor=24231f)](https://ai4kanban.dev/zh/download)

![AI4Kanban 概览](docs/images/overview-grid.png)

</div>

## 我们的哲学

让人在每一个项目任务上投入的精力最小化。

只要 AI 能够让人类在开发上投入的精力缩小到原来的 1/10，那么单人能够承担的任务量就会增加到原来的 10 倍。

AI4Kanban 帮助我们的早期用户提升了 3–6 倍实施效率。

## 它是如何工作的

1. 你可以把 AI4Kanban 当做是一个项目经理，一个中层管理。它是人和 Coding Agent 之间的桥梁。

2. 首先 AI4Kanban 会给每一个用户输入的模糊想法创建一张卡片。接着我们会通过 refine 流程去将卡片进行澄清、拆解与规划。

3. 如果单个 spec 太长，需要考虑的问题太多，我们会把一张卡片再拆解成子卡片；每个子卡片又可以递归拆解，直到单张卡片上的问题足够具体、可落地。

4. 我们会通过类似于 [grill-me](https://github.com/mattpocock/skills) 或 [wayfinder](https://github.com/mattpocock/skills) 的流程，让 Agent 自己提出问题，并且自己进行回答，一直循环到它认为整个方案没有重大缺漏了为止。如果有一些重大的产品决策，涉及品味、产品方向和商业考量等，Agent 会请求人类做出决策。

5. 通常大部分的产品细节，我们允许 Agent 自行作答，最后交给人类决策的，往往只有两三个问题。对于一个简单的需求，它甚至可以自行解决所有的问题。

6. 每张卡片会被拆分为两部分：一部分交给人类 review，另一部分是 Agent 需要参照的执行计划。人类 review 的部分更像是一个简报，它只包含一些需要被人类关注的部分。

7. 简单来说，人类所需要做的就是提出想法，做选择题，最后 review 极扼要的简报。剩下的事情全都交给 AI。

![Vibe coding、中间层工具与 kanban coding](docs/images/vibe-vs-kanban-coding.jpg)

## 全自动开发工厂（实验性）

你可以把整个开发环节中仅有的几个需要人类参与的部分也交给 AI。

- 关于品味、商业方向等需要人类判断的问题，你可以配置 Decider Agent，让它使用最聪明、最强大的模型（Claude Fable，GPT-6 xhigh）来替你做出决策。

- 对于一个已经就绪的卡片，你可以让 Gater Agent 替你决定是否开始实施，它会 review 整个卡片的潜在问题，并做出最终的裁决，避免我们漏掉一些关键细节。

- 你可以开启反思流程，让 Agent 回顾已完成的卡片，并反思是否还有其他与原卡片无关，但可以让整个产品改进的地方。

- 你甚至可以让需求输入源都自动化。你可以对关注的 Reddit 帖文、竞品分析、市场报告、团队讨论、会议纪要等信息源进行粗筛，并提取需求点，放入待办项。再让 Agent 从待办项中提取真正对产品有帮助的工作，放进看板。

![从外部信息源到版本迭代](docs/images/automation-inputs.png)

注意，全自动开发流程的问题在于，它可能会把错误的决策沉淀到项目记忆中，导致后续决策也出现偏差。对于严肃、面向生产的产品，我们建议保留必备的人类审批流程。

## 看板就是团队大脑

- 你的每一个决策都会被记录到项目的记忆中。规划 Agent 会按需读取。

- 从零开始的项目通常只有一个模块，所有记忆都会放在这个模块里。随着项目演进，一个项目中可能包含多个独立进化的模块，它们的记忆也会被自动拆分。这样，每个模块的改动和决策都只会影响对应模块的记忆。

- 看板是所有团队成员的共享工作区，所有人共享所有的记忆。

## Harness 无关

- 我们支持 8 个常见的 Harness。如果你所使用的 Harness 不在我们的列表中，请创建 issue 告诉我们，这对我们非常有帮助。

![AI4Kanban 支持的 8 个 Harness](docs/images/harnesses.png)

- 所有 Harness 都运行在你自己的电脑上，这意味着你可以使用自己的 AI 订阅。我们不额外收取任何 token 费用。

- 每个 Agent 都可以配置各自的 Harness 和模型，考虑到不同角色所需的智能等级不同。

- 我们建议你使用至少一个 200 美金的月度 AI 订阅。考虑到你的 AI 编码效率会成倍提升，更低的档位 token 额度通常很快就会被耗光。

- 如果你同时订阅了 OpenAI 和 Claude，我们建议使用 OpenAI GPT 模型做规划和讨论 Agent，用 Claude 模型做实际的编码 Agent。

- 支持 Skill 和 CLI，你可以按照自己的喜好打造专属你的看板 UI，符合你的习惯。

## 异步通知

- 当你拥有了一个 AI 项目经理，你不需要再盯着 Coding Agent 干活。AI4Kanban 会把进度汇报给你，在你需要做决策的时候告诉你。

- 基于最小精力原则，每个通知里只会包含必要信息。

- 我们支持桌面通知，以及 Slack 通知。其他 IM 工具的支持后续会陆续提供。

## 开源协议

- 桌面端、`akb` CLI、看板 UI 与 Cloud 服务端都按 [Apache-2.0](LICENSE) 授权。

- [`web/`](web/) 目录采用单独的[源码可见许可](web/LICENSE)。它公开是为了可读、可审计，但不是开源许可，不授予部署或再分发的权利。

## 独立开发者：拓展你的大脑

所有人都说，营销和分发是创业者最重要的事。但实际中，许多项目在开发上就至少需要 3 个月，甚至一年，才能真正被用户使用。否则，它们始终会停留在 demo 阶段，或者只能作为极其细分的产品，缺乏远见和产品竞争力。这种情况该谈何营销？

AI4Kanban 致力于帮助独立开发者和小团队：

- 在 2–3 周内完成一个生产可用的产品；
- 在 30 天内单人完成 500 个提交；
- 每周完成一次大的版本迭代。

让你的产品在最短时间内，以一个构思完整、闭环的形态面向市场，这样用户不会被因为你的产品缺陷而失去兴趣。

如果你的产品在使用 AI4Kanban 之后无法实现这个迭代速度，我们很乐意为你提供 60 分钟的上手指导。欢迎联系 [support@ai4kanban.dev](mailto:support@ai4kanban.dev)。
