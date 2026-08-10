<div align="center">

# AI4Kanban

### 越用越懂你的 AI 项目管理。

自主规划、随决策成长的项目看板。

[English](README.md) · **简体中文**

[官网](https://ai4kanban.dev) · [快速开始](#快速开始) · [路线图](#路线图)

<img src="https://cdn.ai4kanban.dev/og-image-v4.jpg" alt="AI4Kanban——越用越懂你的 AI 项目管理" width="720">

</div>

## Kanban Engineering

编码 Agent 已经能将明确需求直接转化为代码。随着项目进入持续迭代，瓶颈也从开发逐渐前移
至项目管理：下一步做什么，如何把模糊想法澄清为可执行需求，以及如何处理任务之间的取舍、
依赖与排期。

代码库只保留实现结果，不记录决策依据和明确排除的方向；聊天窗口适合一次性任务，难以承载
长期项目不断累积的上下文。缺少这些信息，人和 Agent 都容易在从 1 到 99 的迭代中被细节
淹没。

Kanban Engineering 将目标、任务、决策和执行状态组织在同一块看板上，由 AI 承担项目管理：
主动提出需求、循环澄清、拆解排序、规划版本，并推进任务的完整生命周期。人负责产品方向、
品味、商业判断和最终验收。AI4Kanban 是这一工作方式的开源实现。

## 它能做什么

以下标记为已完成的功能均可使用。

- [x] **主动提出需求。** Agent 会选择一个模块，结合代码与该模块的记忆，提出尚未规划的
  功能需求，自主定义具体工作。
- [x] **积累项目决策。** 对后续规划有用的决定会归入相应模块的记忆；否决理由也会保留，
  避免再次提出同类需求。
- [x] **循环澄清。** Agent 先审视需求并提出问题。能依据项目记忆和常识判断的，由它自行
  决策；无法判断的才交给你。这个过程会反复进行，直到需求可以开工，或只剩必须由你作出的
  决定。
- [x] **后台持续推进。** 开启 Auto-refine 后，Agent 会自动处理看板中尚未就绪的卡片，
  无需逐张下达命令；被其他任务阻塞的卡片会等待依赖完成。
- [x] **拆解任务。** Agent 会把需求拆成子任务，并将其中无关的诉求分离为独立卡片。
- [x] **安排依赖和优先级。** Agent 会识别任务之间的依赖，权衡价值与成本，据此确定执行
  顺序。
- [x] **保留决策轨迹。** 卡片记录需求如何被逐步细化，以及 Agent 自主作出的判断；任务
  完成后仍会归档在 Git 中。
- [x] **规划版本。** 可选。将卡片归入 release，即可查看每个版本的范围和已就绪任务数。
- [x] **管理完整生命周期。** AI4Kanban 覆盖任务的提出、澄清、执行和归档，让看板始终
  反映项目的真实进展。
- [x] **运行重复任务。** 将定期报告、外部信息检查等重复工作保存为长期卡片；新看板还会
  预置一张记忆清理卡片。它们可以按需运行或设置执行周期，每次运行都会记录时间，但卡片不会
  归档。

AI4Kanban 面向小团队。它不是替你决定产品方向，而是把人的工作从逐条编写需求、监督执行，
转向判断价值和验收结果。随着模块记忆不断积累，Agent 能依据项目特有的约束和偏好作出判断，
减少重复提问，并避开已被否决的方向。

## 实现方式

- [x] **不绑定单一 Agent。** 看板与运行工具解耦，目前已接入 Claude Code 和 Codex；
  Cursor 等其他运行环境在路线图中。
- [x] **本地优先。** 卡片默认存储为 Markdown 文件，无需 MCP 或数据库，减少 token 消耗。
  所有内容都是 Git 中的纯文本，可以审查、对比和回滚。
- [x] **开箱即用。** 一条提示词即可安装或更新。AI4Kanban 专注于项目管理，几乎无需配置。
- [x] **两种交互方式。** 既可在命令行中通过 skill 管理看板，也可使用本地 UI。

看板并非附加界面，而是 Agent 的长期项目上下文：目标、任务、决策、依赖和进度各有明确
归属。AI4Kanban 不以聊天窗口为中心；看板就是 Agent 的项目管理界面。

## 快速开始

在项目根目录下，对 Claude Code（或任何能执行 Shell 命令的编码 Agent）说：

```
Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt and follow it.
```

Agent 会先读取代码库，再运行：

```bash
npx ai4kanban install --tracks feature,bug,research
```

安装过程中只需提供一项信息：项目目标。Agent 会据此建立模块记忆与模块图，并创建首批
10 张基础任务卡片。此后即可直接通过看板管理项目。

如果 Agent 无法访问链接，可以打开 [`INSTALL_PROMPT.txt`](web/public/INSTALL_PROMPT.txt)
并将内容交给它，效果相同。唯一的前置要求是 Node.js 18+，无需安装其他依赖。

## 使用 skill

| 你说 | Agent 做什么 |
| --- | --- |
| "what's next?" / "propose new tasks" | 选择一个模块，读取其记忆，为尚未规划的工作起草卡片；默认创建 3 张 |
| "add a task: …" | 评估想法，再创建卡片并加入索引 |
| "refine #4" | 将 4 号卡片进一步细化，使其从模糊走向具体 |
| "auto-refine #4" | 持续自动细化 4 号卡片，直到只剩必须由你回答的问题 |
| "resolve #4" | 逐一处理 4 号卡片上的未决问题 |
| "review the board" | 检查卡片是否清晰、重复、已经完成或不再值得继续 |
| "implement #4" | 实现 4 号卡片，并完成其中的待办项 |
| "#4 is done" | 更新相关文档，再将卡片归档 |
| "reject #4" | 删除卡片并记录原因，避免再次提出同类需求 |
| "add a recurring task: …" | 创建不会归档的重复任务；说 "run #4" 即可运行一次 |
| "create release v1" | 规划一个版本；随后可使用 "put #4 in v1"、"what's in v1?"、"close v1" |

表中是英文示例，使用中文指令同样有效。

完整流程见[日常循环指南](docs/guides/daily-loop.md)。

本仓库也使用这套 skill 管理自身开发：`docs/kanban/` 是一块真实运行的看板，可作为完整
示例参考。

### 看板桌面应用（可选）

**[下载 →](https://ai4kanban.dev/download)** —— 无需预先安装任何东西：不需要 Node，
不需要 npx，也不需要开着终端。

看板 UI 以同一批 Markdown 文件为唯一数据源，提供 Board 和 Queue 两种视图。你可以查看
完整卡片和项目目标、创建任务或让 Agent 提出需求、规划版本、运行 Agent、设置重复任务周期，
并查看最近 30 天的进度；看板数据始终以 Markdown 文件为准。

首次打开时它会让你选择项目文件夹，之后记住这个选择。发起 Agent 运行仍然需要机器上装有
你的编码 Agent，这一点和在终端里一样。

| 系统 | 安装包 | 已签名 | 已测试 |
| --- | --- | --- | --- |
| macOS（Apple 芯片、Intel） | `.dmg` / `.zip` | 是 | 是 |
| Windows | `.exe` 安装包 | 否 | 否 |
| Linux | `.AppImage` | 否 | 否 |

每个版本我们只测试 macOS。Windows 和 Linux 这个版本未经测试、也未签名，首次打开时系统
会警告：Windows 上点 **更多信息** → **仍要运行**；Linux 上先 `chmod +x AI4Kanban-*.AppImage`
再运行。

![Web UI 的 Board 视图](https://cdn.ai4kanban.dev/ai4kanban-ui-v4-board-view.jpg)

![Web UI 的 Queue 视图](https://cdn.ai4kanban.dev/ai4kanban-ui-v4-queue-view.jpg)

每个按钮的作用见 [kanban-ui/](kanban-ui/README.md)。

<details>
<summary>改用浏览器打开（已弃用）</summary>

```bash
npx ai4kanban-ui        # 已弃用 —— http://localhost:7420，仅本机
```

自桌面应用发布的那个版本起弃用。它仍然可用，npm 包只是冻结而非下架，已经在用的人不会被
打断 —— 但不会再有新版本发到那里。页面本身不会消失：应用就是同样的页面装进了一个窗口。
被弃用的是“让人自己起一个服务再打开浏览器”这件事。

</details>

## 路线图

- [ ] **可插拔存储**（即将）：将看板存储在 Obsidian、Notion 或 GitHub Issues 中。
- [ ] **更多 Agent 运行环境**（进行中）：目前已支持 Claude Code 和 Codex，后续接入
  Cursor。
- [ ] **Git worktrees**（即将）：让多个任务分别在独立 worktree 中并行执行，互不干扰。
- [ ] **外部输入连接器**（即将）：通过 Webhook 接入用户反馈、竞品研究和行业信号，再由
  看板转成可以评估的任务。
- [ ] **阻塞任务处理**（即将）：拆分、改写或否决长期停滞的任务。
- [ ] **团队协作**（中期）

## 更新

使用一条提示词即可完成更新：

```
Update ai4kanban in this project. Read
.claude/skills/kanban/references/update.md and follow it.
```

## 许可证

[Apache License 2.0](LICENSE)。可自由使用、修改和再分发，欢迎贡献。
